import { useRef, useState, type ChangeEvent } from 'react';
import { Camera, CheckCircle2, FileImage, FolderOpen, Loader2, X } from 'lucide-react';
import { format } from 'date-fns';
import type { DiaryEntry } from '../types';
import { capturedTripDay } from '../lib/tripVisits';
import { readPhotoExif, cloudinaryPhotoMetadata, type EmbeddedPhotoMetadata } from '../lib/photoMetadata';
import { isImageFile, selectOriginalPhotos } from '../lib/photoPicker';

interface Props {
  password: string | null;
  onUploaded: (entry: DiaryEntry) => void;
  onMessage: (message: string) => void;
  onNeedsLocation?: (entry: DiaryEntry) => void;
}

interface PendingPhoto { file: File; metadata: EmbeddedPhotoMetadata }
const hasGps = (photo: EmbeddedPhotoMetadata) => photo.lat !== null && photo.lng !== null;

export default function GeneralPhotoUpload({ password, onUploaded, onMessage, onNeedsLocation }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [progress, setProgress] = useState('');
  const [inspecting, setInspecting] = useState(false);
  const [useStandardPicker, setUseStandardPicker] = useState(false);

  const prepareFiles = async (files: File[]) => {
    if (!files.length) return;
    const images = files.filter(isImageFile);
    if (!images.length) {
      onMessage('Please choose normal photo files (JPEG, PNG, WebP, HEIC, etc.), not a ZIP.');
      return;
    }
    setInspecting(true);
    try {
      const selected: PendingPhoto[] = [];
      for (const file of images) {
        // Read locally before Cloudinary or an image processor can remove EXIF.
        selected.push({ file, metadata: await readPhotoExif(file) });
      }
      setPending(selected);
      if (images.length !== files.length) {
        onMessage('Skipped ' + (files.length - images.length) + ' non-image files.');
      }
    } catch {
      onMessage('Could not inspect those images. Please choose the originals again.');
    } finally {
      setInspecting(false);
    }
  };

  const chooseFiles = async () => {
    if (inspecting || progress || !password) return;
    if (useStandardPicker) { fileInputRef.current?.click(); return; }
    try {
      const files = await selectOriginalPhotos(fileInputRef.current);
      if (files) await prepareFiles(files);
    } catch (error: any) {
      setUseStandardPicker(true);
      onMessage('The original-file picker is unavailable. Tap Upload original photos again to use the standard Files picker.');
    }
  };

  const fromInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    await prepareFiles(files);
  };

  const uploadPhotos = async () => {
    if (!password || !pending.length || progress) return;
    let saved = 0;
    let missingGps = 0;
    let fallbackDates = 0;
    const missing: DiaryEntry[] = [];
    const failures: string[] = [];
    try {
      setProgress('Preparing upload…');
      const signatureResponse = await fetch('/api/photos', { headers: { Authorization: password } });
      const signature = await signatureResponse.json();
      if (!signatureResponse.ok) throw new Error(signature.error || 'Could not authorize photo upload');

      for (let index = 0; index < pending.length; index++) {
        const { file, metadata: local } = pending[index];
        setProgress('Uploading ' + (index + 1) + '/' + pending.length + '…');
        try {
          const form = new FormData();
          form.append('file', file);
          form.append('api_key', signature.apiKey);
          form.append('timestamp', signature.timestamp);
          form.append('signature', signature.signature);
          form.append('folder', signature.folder);
          form.append('media_metadata', String(signature.mediaMetadata));
          const uploadResponse = await fetch('https://api.cloudinary.com/v1_1/' + signature.cloudName + '/image/upload', {
            method: 'POST', body: form
          });
          const uploaded = await uploadResponse.json();
          if (!uploadResponse.ok || !uploaded.secure_url) {
            throw new Error(uploaded.error?.message || 'Cloudinary upload failed');
          }
          const remote = cloudinaryPhotoMetadata(uploaded.media_metadata || uploaded.image_metadata);
          const originalTakenAt = local.capturedAt || remote.capturedAt;
          const fallbackDate = format(new Date(file.lastModified || Date.now()), 'yyyy-MM-dd HH:mm:ss');
          const capturedAt = originalTakenAt || fallbackDate;
          const lat = local.lat ?? remote.lat;
          const lng = local.lng ?? remote.lng;
          const savedResponse = await fetch('/api/places', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: password },
            body: JSON.stringify({
              type: 'diary', action: 'addPhoto',
              photoUrl: uploaded.secure_url,
              capturedAt,
              uploadedAt: uploaded.created_at || new Date().toISOString(),
              date: capturedTripDay(capturedAt) || format(new Date(file.lastModified || Date.now()), 'yyyy-MM-dd'),
              lat, lng
            })
          });
          const result = await savedResponse.json();
          if (!savedResponse.ok) throw new Error(result.error || 'Could not create diary entry');
          onUploaded(result.entry);
          saved++;
          if (lat === null || lng === null) { missingGps++; missing.push(result.entry); }
          if (!originalTakenAt) fallbackDates++;
        } catch (error: any) {
          failures.push(file.name + ': ' + (error.message || 'Upload failed'));
        }
      }
    } catch (error: any) {
      failures.push(error.message || 'Could not upload photos');
    } finally {
      setProgress('');
      setPending([]);
      const message = [
        saved ? 'Added ' + saved + ' photo' + (saved === 1 ? '' : 's') + ' to Diary.' : '',
        missingGps && saved ? missingGps + ' without GPS supplied to the site; set their locations on the map.' : '',
        fallbackDates && saved ? fallbackDates + ' used the file date (camera timestamp unavailable).' : '',
        failures.length ? failures.length + ' failed: ' + failures.slice(0, 2).join('; ') : ''
      ].filter(Boolean).join(' ');
      if (message) onMessage(message);
      // For a single GPS-less image, offer the map immediately rather than
      // forcing the user to find the new diary card and start another workflow.
      if (pending.length === 1 && missing.length === 1) onNeedsLocation?.(missing[0]);
    }
  };

  const gpsCount = pending.filter(photo => hasGps(photo.metadata)).length;

  return (
    <>
      {/* No accept=image/*: that commonly invokes Android's redacting media picker. */}
      <input ref={fileInputRef} type="file" multiple hidden onChange={fromInput} aria-label="Browse original photos using Files" />
      <input ref={galleryInputRef} type="file" accept="image/*" multiple hidden onChange={fromInput} aria-label="Choose photos from gallery" />
      <button type="button" className="secondary-button collection-add" disabled={Boolean(progress) || inspecting || !password}
        onClick={chooseFiles} title="Select the original JPEG or other image directly from Files, without a ZIP">
        {progress || inspecting ? <Loader2 size={17} className="animate-spin" /> : <FolderOpen size={17} />}
        <span>{inspecting ? 'Inspecting…' : progress || 'Upload original photos'}</span>
      </button>
      {pending.length > 0 && <div className="fixed inset-0 z-[800] flex items-center justify-center bg-slate-950/65 p-3" role="dialog" aria-modal="true" aria-label="Review photos and GPS">
        <div className="photo-gps-review bg-white rounded-2xl p-4 sm:p-5 shadow-2xl w-full max-w-lg max-h-[90dvh] overflow-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Review photo locations</h3>
              <p className="text-xs text-slate-500 mt-1">GPS is read directly from the selected files before upload.</p>
            </div>
            <button type="button" className="secondary-button" disabled={Boolean(progress)} aria-label="Cancel photo upload" onClick={() => setPending([])}><X size={16} /></button>
          </div>
          <div className="photo-gps-summary" role="status">
            <CheckCircle2 size={18} /> {gpsCount} of {pending.length} with GPS coordinates
          </div>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {pending.map((item, index) => <div className="photo-gps-file" key={index}>
              <FileImage size={17} className="shrink-0" />
              <span className="truncate min-w-0 flex-1" title={item.file.name}>{item.file.name}</span>
              <span className={hasGps(item.metadata) ? 'photo-gps-found' : 'photo-gps-missing'}>
                {hasGps(item.metadata) ? 'GPS found' : 'No GPS'}
              </span>
            </div>)}
          </div>
          {gpsCount < pending.length && <p className="photo-gps-warning">
            The selected file didn't expose GPS coordinates. Android sometimes removes them before Chrome can read the image.
            You can upload normally, then set a map pin. For the original, use Files → Internal storage → DCIM → Camera.
            No ZIP needed.
          </p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="secondary-button flex-1" disabled={Boolean(progress)} onClick={() => { setPending([]); void chooseFiles(); }}>
              <FolderOpen size={16} /> Choose different files
            </button>
            <button type="button" className="primary-button flex-1" disabled={Boolean(progress)} onClick={uploadPhotos}>
              {progress ? <Loader2 size={17} className="animate-spin" /> : <Camera size={17} />}
              {progress || 'Upload ' + pending.length + (pending.length === 1 ? ' photo' : ' photos')}
            </button>
          </div>
          <button type="button" disabled={Boolean(progress)} className="photo-gps-gallery-link" onClick={() => galleryInputRef.current?.click()}>
            Choose from gallery instead (Android may remove GPS)
          </button>
        </div>
      </div>}
    </>
  );
}
