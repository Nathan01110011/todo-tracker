import { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import type { DiaryEntry } from '../types';
import { readPhotoExif, cloudinaryPhotoMetadata } from '../lib/photoMetadata';

interface Props {
  password: string | null;
  onUploaded: (entry: DiaryEntry) => void;
  onMessage: (message: string) => void;
}

export default function GeneralPhotoUpload({ password, onUploaded, onMessage }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState('');

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!password || !files.length) return;
    let saved = 0;
    let missingGps = 0;
    let fallbackDates = 0;
    const failures: string[] = [];
    try {
      setProgress('Preparing upload…');
      const signatureResponse = await fetch('/api/photos', { headers: { Authorization: password } });
      const signature = await signatureResponse.json();
      if (!signatureResponse.ok) throw new Error(signature.error || 'Could not authorize photo upload');

      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        setProgress('Uploading ' + (index + 1) + '/' + files.length + '…');
        try {
          const local = await readPhotoExif(file);
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
          const capturedAt = local.capturedAt || remote.capturedAt ||
            format(new Date(file.lastModified || Date.now()), 'yyyy-MM-dd HH:mm:ss');
          if (!local.capturedAt && !remote.capturedAt) fallbackDates++;
          const lat = local.lat ?? remote.lat;
          const lng = local.lng ?? remote.lng;
          if (lat === null || lng === null) missingGps++;

          const savedResponse = await fetch('/api/places', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: password },
            body: JSON.stringify({
              type: 'diary', action: 'addPhoto',
              photoUrl: uploaded.secure_url,
              capturedAt,
              uploadedAt: uploaded.created_at || new Date().toISOString(),
              date: format(new Date(file.lastModified || Date.now()), 'yyyy-MM-dd'),
              lat, lng
            })
          });
          const result = await savedResponse.json();
          if (!savedResponse.ok) throw new Error(result.error || 'Could not create diary entry');
          onUploaded(result.entry);
          saved++;
        } catch (error: any) {
          failures.push(file.name + ': ' + (error.message || 'Upload failed'));
        }
      }
    } catch (error: any) {
      failures.push(error.message || 'Could not upload photos');
    } finally {
      setProgress('');
      if (inputRef.current) inputRef.current.value = '';
      const message = [
        saved ? 'Added ' + saved + ' general photo' + (saved === 1 ? '' : 's') + ' to Diary.' : '',
        missingGps && saved ? missingGps + ' without GPS (no map pin).' : '',
        fallbackDates && saved ? fallbackDates + ' used the file date (no camera timestamp).' : '',
        failures.length ? failures.length + ' failed: ' + failures.slice(0, 2).join('; ') : ''
      ].filter(Boolean).join(' ');
      if (message) onMessage(message);
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*,.heic,.heif" multiple hidden
        aria-label="Choose general diary photos" onChange={handleFiles} />
      <button type="button" className="secondary-button collection-add" disabled={!!progress || !password}
        onClick={() => inputRef.current?.click()}>
        {progress ? <Loader2 size={17} className="animate-spin" /> : <Camera size={17} />}
        <span>{progress || 'Upload photos'}</span>
      </button>
    </>
  );
}
