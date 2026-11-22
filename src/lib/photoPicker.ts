/**
 * Browser-native original-file picker. Unlike an image-only <input>, this asks
 * Chrome for the document/file picker rather than intentionally routing through
 * Android's privacy-redacting photo picker.
 *
 * Android may still redact media metadata before File objects reach the web
 * page; the UI must offer a map fallback, not claim GPS is guaranteed.
 */
export interface OriginalFileHandle { getFile(): Promise<File> }

export function isImageFile(file: Pick<File, 'name' | 'type'>): boolean {
  return /^image\//i.test(file.type) ||
    /\.(jpe?g|png|webp|heic|heif|avif|gif|bmp|tiff?)$/i.test(file.name);
}

export async function selectOriginalPhotos(
  fallbackInput: HTMLInputElement | null
): Promise<File[] | null> {
  const picker = (window as Window & {
    showOpenFilePicker?: (options: { multiple: boolean }) => Promise<OriginalFileHandle[]>
  }).showOpenFilePicker;

  if (typeof picker !== 'function') {
    fallbackInput?.click(); // For Safari/Firefox/older browsers.
    return null;
  }

  try {
    // Deliberately omit MIME restrictions: on Android, an image-only request
    // can invoke the media picker that strips EXIF GPS by default.
    const handles = await picker({ multiple: true });
    return Promise.all(handles.map(handle => handle.getFile()));
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null;
    throw error;
  }
}
