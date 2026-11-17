import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Camera, Loader2, MapPin } from 'lucide-react';
import type { DiaryEntry } from '../types';
import { readPhotoExif } from '../lib/photoMetadata';

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

  const readOriginal = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setReading(true);
    setMessage('');
    try {
      const metadata = await readPhotoExif(file);
      if (metadata.lat !== null && metadata.lng !== null && !(metadata.lat === 0 && metadata.lng === 0)) {
        setPin(metadata.lat, metadata.lng);
        setMessage('GPS coordinates read from the original file. Save to attach them to this diary photo.');
      } else {
        setMessage('No GPS was available in the selected file. Android may have removed it, or this image format is not supported for local metadata reading. You can tap the map to set a location instead.');
      }
    } catch {
      setMessage('Could not read GPS from that file. Try the original JPEG from Files, or select a spot on the map.');
    } finally {
      setReading(false);
      if (originalInput.current) originalInput.current.value = '';
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
          Android can hide GPS when you pick a photo from the gallery. To recover it, try the original file via
          <strong> Files → Internal storage → DCIM → Camera</strong>. Otherwise tap its location on the map.
        </p>
        <input ref={originalInput} type="file" hidden aria-label="Choose original photo file" onChange={readOriginal} />
        <button type="button" disabled={reading || saving} className="secondary-button w-full"
          onClick={() => originalInput.current?.click()}>
          {reading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
          {reading ? 'Reading original…' : 'Read GPS from original file'}
        </button>
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
