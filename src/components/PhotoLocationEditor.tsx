import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { FolderOpen, Loader2, MapPin, Search, Navigation } from 'lucide-react';
import type { DiaryEntry } from '../types';
import { readPhotoExif } from '../lib/photoMetadata';
import { selectOriginalPhotos, isImageFile } from '../lib/photoPicker';
import { searchLocations, type NominatimLocation, type LocationSearchScope } from '../lib/locationSearch';

interface PhotoLocationEditorProps {
  entry: DiaryEntry;
  center: [number, number];
  onClose: () => void;
  onSave: (lat: number, lng: number) => Promise<void>;
}

function PhotoLocationPicker({ position, onPick }: {
  position: [number, number] | null;
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({ click: event => onPick(event.latlng.lat, event.latlng.lng) });
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, Math.max(map.getZoom(), 13), { animate: false });
  }, [map, position?.[0], position?.[1]]);
  return position ? <Marker position={position} /> : null;
}

/**
 * The Android photo picker may supply a privacy-redacted photo without GPS,
 * regardless of the camera's Save location setting. Original-file import is
 * deliberately separate from the image upload: it reads metadata locally and
 * updates the existing diary record without duplicating or reuploading images.
 */
export default function PhotoLocationEditor({ entry, center, onClose, onSave }: PhotoLocationEditorProps) {
  const [latitude, setLatitude] = useState(entry.lat ? String(entry.lat) : '');
  const [longitude, setLongitude] = useState(entry.lng ? String(entry.lng) : '');
  const [message, setMessage] = useState('');
  const [reading, setReading] = useState(false);
  const [useStandardPicker, setUseStandardPicker] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<NominatimLocation[]>([]);
  const [saving, setSaving] = useState(false);
  const originalInput = useRef<HTMLInputElement>(null);
  const lat = Number(latitude);
  const lng = Number(longitude);
  const valid = latitude.trim() !== '' && longitude.trim() !== ''
    && Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    && !(lat === 0 && lng === 0);
  const position: [number, number] | null = valid ? [lat, lng] : null;
  const mapCenter = (entry.lat && entry.lng ? [entry.lat, entry.lng] : center) as [number, number];

  const setPin = (nextLat: number, nextLng: number) => {
    setLatitude(nextLat.toFixed(6));
    setLongitude(nextLng.toFixed(6));
  };

  const inspectOriginal = async (file: File) => {
    if (!isImageFile(file)) { setMessage('Choose a photo file, not an archive.'); return; }
    setReading(true);
    setMessage('');
    try {
      const metadata = await readPhotoExif(file);
      if (metadata.lat !== null && metadata.lng !== null && !(metadata.lat === 0 && metadata.lng === 0)) {
        setPin(metadata.lat, metadata.lng);
        setMessage('GPS recovered from the selected photo. Save to attach it to your diary.');
      } else {
        setMessage(metadata.capturedAt
          ? 'The file contains a camera timestamp but no readable GPS. Android may have hidden the coordinates. Search for the place or select it on the map.'
          : 'No embedded GPS found in the file supplied to the site. Search for the place or tap the map.');
      }
    } catch {
      setMessage('Could not read GPS from that file. Choose the original in Files or select a spot on the map.');
    } finally {
      setReading(false);
    }
  };

  const readOriginal = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) await inspectOriginal(file);
  };

  const browseOriginal = async () => {
    if (reading || saving) return;
    if (useStandardPicker) { originalInput.current?.click(); return; }
    try {
      const files = await selectOriginalPhotos(originalInput.current);
      if (files?.length) await inspectOriginal(files[0]);
    } catch {
      setUseStandardPicker(true);
      setMessage('Tap Read GPS from original photo again to open the standard Files picker.');
    }
  };

  const locateHereNow = () => {
    if (!navigator.geolocation) { setMessage('Your browser cannot access current location.'); return; }
    setLocating(true);
    setMessage('');
    navigator.geolocation.getCurrentPosition(result => {
      setPin(result.coords.latitude, result.coords.longitude);
      setLocating(false);
      setMessage('Current position selected. Only save this if you are still where the photo was taken.');
    }, () => {
      setLocating(false);
      setMessage('Current location was denied or unavailable. You can still search or choose a map pin.');
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 });
  };

  const searchForLocation = async () => {
    const query = searchQuery.trim();
    if (!query || searching) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const validScope = ['Austin', 'Texas', 'USA', 'UK & Ireland'].includes(entry.scope) ? entry.scope as LocationSearchScope : 'USA';
      const results = await searchLocations(validScope, query);
      setSearchResults(results.slice(0, 6));
      if (!results.length) setMessage('No matches found in this tracker. Try a more specific place name or tap the map.');
    } catch {
      setMessage('Could not search places. You can still tap the map to set a pin.');
    } finally {
      setSearching(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSave(lat, lng);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save this location.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Set diary photo location"
      className="fixed inset-0 z-[650] flex items-center justify-center bg-slate-900/70 p-3">
      <form onSubmit={submit} className="w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-5 shadow-2xl space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Photo location</h3>
            <p className="text-xs text-slate-500 mt-1">Set the location for this photo, without changing any saved place.</p>
          </div>
          <button type="button" className="secondary-button" disabled={saving} onClick={onClose}>Close</button>
        </div>
        <p className="text-xs text-slate-600">
          Android may redact GPS before the browser receives a photo. Import an ordinary image from Files (no ZIP), or search for its location and place a pin.
        </p>
        <input ref={originalInput} type="file" hidden aria-label="Choose original photo file" onChange={readOriginal} />
        <button type="button" disabled={reading || saving} className="secondary-button w-full"
          onClick={browseOriginal}>
          {reading ? <Loader2 size={16} className="animate-spin" /> : <FolderOpen size={16} />}
          {reading ? 'Reading original…' : 'Read GPS from original photo (Files)'}
        </button>
        <button type="button" disabled={locating || saving} className="secondary-button w-full" onClick={locateHereNow}>
          {locating ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
          {locating ? 'Finding position…' : 'Use my location now (for photos just taken here)'}
        </button>
        <div className="space-y-2">
          <label className="block text-xs text-slate-600" htmlFor="photo-location-search">Find a place or address</label>
          <div className="flex items-center gap-2">
            <input id="photo-location-search" type="search" value={searchQuery} onChange={event => setSearchQuery(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void searchForLocation(); } }}
              placeholder="e.g. Chicago Riverwalk" className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3 py-2" />
            <button type="button" onClick={searchForLocation} disabled={searching || !searchQuery.trim()} className="secondary-button">
              {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Find
            </button>
          </div>
          {searchResults.length > 0 && <div className="grid gap-1 max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-1">
            {searchResults.map((result, i) => <button type="button" key={i}
              className="text-left text-xs rounded-lg px-3 py-2 hover:bg-slate-100"
              onClick={() => { setPin(Number(result.lat), Number(result.lon)); setSearchResults([]); setMessage('Place selected. Adjust the pin on the map if necessary.'); }}>
              {result.display_name}
            </button>)}
          </div>}
        </div>
        {message && <p role="status" className="text-xs text-slate-600">{message}</p>}
        <div className="h-64 rounded-xl overflow-hidden border border-slate-200">
          <MapContainer center={mapCenter} zoom={entry.lat && entry.lng ? 13 : 11}
            className="h-full w-full" scrollWheelZoom={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors" />
            <PhotoLocationPicker position={position} onPick={setPin} />
          </MapContainer>
        </div>
        <p className="text-xs text-slate-500 flex gap-2 items-center"><MapPin size={14} /> Tap the map to position the pin, or enter coordinates.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-slate-500">Latitude
            <input type="number" step="any" min="-90" max="90" inputMode="decimal"
              value={latitude} onChange={event => setLatitude(event.target.value)}
              className="w-full mt-1 p-2.5 border rounded-lg" />
          </label>
          <label className="text-xs text-slate-500">Longitude
            <input type="number" step="any" min="-180" max="180" inputMode="decimal"
              value={longitude} onChange={event => setLongitude(event.target.value)}
              className="w-full mt-1 p-2.5 border rounded-lg" />
          </label>
        </div>
        <button type="submit" disabled={!valid || saving || reading}
          className="primary-button w-full">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
          {saving ? 'Saving…' : 'Save location'}
        </button>
      </form>
    </div>
  );
}
