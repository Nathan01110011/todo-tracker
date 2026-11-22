export interface EmbeddedPhotoMetadata {
  capturedAt: string;
  lat: number | null;
  lng: number | null;
}

const emptyMetadata = (): EmbeddedPhotoMetadata => ({ capturedAt: '', lat: null, lng: null });

// Parse metadata locally before uploading, so a service-side conversion does
// not become the source of truth. JPEG, PNG eXIf, WebP EXIF and TIFF all carry
// the same TIFF metadata block; HEIC/AVIF still use Cloudinary as a fallback.
// This cannot reverse Android's privacy redaction of files delivered to Chrome.
const MAX_EXIF_BYTES = 1024 * 1024;

const readSlice = async (file: File, start: number, length: number): Promise<DataView> =>
  new DataView(await file.slice(start, start + length).arrayBuffer());

const asciiAt = (view: DataView, offset: number, count: number): string =>
  Array.from({ length: count }, (_, i) => String.fromCharCode(view.getUint8(offset + i))).join('');

function fromExifBlock(view: DataView): EmbeddedPhotoMetadata {
  if (view.byteLength >= 6 && asciiAt(view, 0, 6) === 'Exif\u0000\u0000') return readExifTiff(view, 6);
  return readExifTiff(view, 0);
}

export async function readPhotoExif(file: File): Promise<EmbeddedPhotoMetadata> {
  try {
    const head = await readSlice(file, 0, 16);
    if (head.byteLength < 8) return emptyMetadata();

    if (head.getUint16(0) === 0xffd8) {
      const view = await readSlice(file, 0, MAX_EXIF_BYTES);
      let cursor = 2;
      while (cursor + 4 <= view.byteLength) {
        if (view.getUint8(cursor) !== 0xff) break;
        const marker = view.getUint8(cursor + 1);
        if (marker === 0xda || marker === 0xd9) break;
        if (marker >= 0xd0 && marker <= 0xd8) { cursor += 2; continue; }
        const length = view.getUint16(cursor + 2);
        if (length < 2 || cursor + 2 + length > view.byteLength) break;
        const start = cursor + 4;
        if (marker === 0xe1 && length >= 8 &&
            asciiAt(view, start, 6) === 'Exif\u0000\u0000') {
          return readExifTiff(view, start + 6);
        }
        cursor += length + 2;
      }
    } else if (head.getUint32(0) === 0x89504e47 && head.getUint32(4) === 0x0d0a1a0a) {
      // PNG: eXIf chunks can occur after huge IDAT chunks, so seek over image
      // data instead of reading the whole photo into browser memory.
      let offset = 8;
      for (let i = 0; i < 8192 && offset + 12 <= file.size; i++) {
        const header = await readSlice(file, offset, 8);
        if (header.byteLength < 8) break;
        const size = header.getUint32(0, false);
        const kind = asciiAt(header, 4, 4);
        const next = offset + 12 + size;
        if (!Number.isSafeInteger(next) || next > file.size) break;
        if (kind === 'eXIf' && size > 0 && size <= MAX_EXIF_BYTES) {
          return fromExifBlock(await readSlice(file, offset + 8, size));
        }
        if (kind === 'IEND') break;
        offset = next;
      }
    } else if (asciiAt(head, 0, 4) === 'RIFF' && asciiAt(head, 8, 4) === 'WEBP') {
      // WebP EXIF often follows image data, and chunks use little-endian sizes.
      let offset = 12;
      for (let i = 0; i < 8192 && offset + 8 <= file.size; i++) {
        const header = await readSlice(file, offset, 8);
        if (header.byteLength < 8) break;
        const kind = asciiAt(header, 0, 4);
        const size = header.getUint32(4, true);
        const next = offset + 8 + size + (size % 2);
        if (!Number.isSafeInteger(next) || next > file.size) break;
        if (kind === 'EXIF' && size > 0 && size <= MAX_EXIF_BYTES) {
          return fromExifBlock(await readSlice(file, offset + 8, size));
        }
        offset = next;
      }
    } else if (head.getUint16(0) === 0x4949 || head.getUint16(0) === 0x4d4d) {
      return fromExifBlock(await readSlice(file, 0, MAX_EXIF_BYTES));
    }
  } catch {
    // Invalid/unsupported EXIF must not block an otherwise valid image upload.
  }
  return emptyMetadata();
}

interface ExifField {
  type: number;
  count: number;
  data: number;
}

function readExifTiff(view: DataView, start: number): EmbeddedPhotoMetadata {
  const result = emptyMetadata();
  if (start + 8 > view.byteLength) return result;
  const byteOrder = view.getUint16(start);
  if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) return result;
  const little = byteOrder === 0x4949;
  const u16 = (at: number) => view.getUint16(at, little);
  const u32 = (at: number) => view.getUint32(at, little);
  const within = (at: number, len: number) => at >= start && len >= 0 && at + len <= view.byteLength;
  if (u16(start + 2) !== 42) return result;

  const fieldsAt = (relative: number): Map<number, ExifField> => {
    const fields = new Map<number, ExifField>();
    const at = start + relative;
    if (!within(at, 2)) return fields;
    const count = u16(at);
    if (count > 256 || !within(at + 2, count * 12)) return fields;
    const sizes: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 10: 8 };
    for (let i = 0; i < count; i++) {
      const entry = at + 2 + i * 12;
      const type = u16(entry + 2);
      const units = u32(entry + 4);
      const size = sizes[type] || 0;
      const length = units * size;
      if (!size || !Number.isSafeInteger(length) || length > 4096) continue;
      const data = length <= 4 ? entry + 8 : start + u32(entry + 8);
      if (within(data, length)) fields.set(u16(entry), { type, count: units, data });
    }
    return fields;
  };
  const str = (field?: ExifField): string => {
    if (!field || field.type !== 2) return '';
    let value = '';
    for (let i = 0; i < field.count; i++) {
      const c = view.getUint8(field.data + i);
      if (c === 0) break;
      value += String.fromCharCode(c);
    }
    return value.trim();
  };
  const pointer = (field?: ExifField): number => field?.type === 4 && field.count === 1 ? u32(field.data) : 0;
  const dms = (field?: ExifField): number | null => {
    if (!field || field.type !== 5 || field.count !== 3) return null;
    const parts = [0, 1, 2].map(i => {
      const at = field.data + i * 8;
      const denominator = u32(at + 4);
      return denominator ? u32(at) / denominator : NaN;
    });
    return parts.every(Number.isFinite) ? parts[0] + parts[1] / 60 + parts[2] / 3600 : null;
  };

  const root = fieldsAt(u32(start + 4));
  const exif = fieldsAt(pointer(root.get(0x8769)));
  result.capturedAt = str(exif.get(0x9003)) || str(exif.get(0x9004)) || str(root.get(0x0132));
  const gps = fieldsAt(pointer(root.get(0x8825)));
  const lat = dms(gps.get(0x0002));
  const lng = dms(gps.get(0x0004));
  if (lat !== null && lng !== null && lat <= 90 && lng <= 180 && !(lat === 0 && lng === 0)) {
    result.lat = /^s/i.test(str(gps.get(0x0001))) ? -lat : lat;
    result.lng = /^w/i.test(str(gps.get(0x0003))) ? -lng : lng;
  }
  return result;
}

const asNumber = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'numerator' in value && 'denominator' in value) {
    const number = Number(value.numerator), divisor = Number(value.denominator);
    return divisor ? number / divisor : NaN;
  }
  if (typeof value === 'string' && value.includes('/')) {
    const [numerator, divisor] = value.split('/');
    return Number(divisor) ? Number(numerator) / Number(divisor) : NaN;
  }
  return Number(value);
};

function coordinate(value: unknown, hemisphere: unknown, limit: number): number | null {
  if (value === undefined || value === null) return null;
  let degree: number;
  if (Array.isArray(value)) {
    const parts = value.map(asNumber);
    degree = parts[0] + (parts[1] || 0) / 60 + (parts[2] || 0) / 3600;
  } else if (typeof value === 'string' && /[°'"\s,]/.test(value.trim())) {
    const parts = value.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
    degree = (parts[0] || 0) + (parts[1] || 0) / 60 + (parts[2] || 0) / 3600;
  } else {
    degree = asNumber(value);
  }
  if (!Number.isFinite(degree) || Math.abs(degree) > limit) return null;
  const ref = String(hemisphere || '');
  if (/^[sw]/i.test(ref) || (typeof value === 'string' && /[SW]\s*$/i.test(value))) return -Math.abs(degree);
  return degree;
}

// Cloudinary exposes metadata for some non-JPEG formats, including HEIC.
// Use it as a fallback when client-side EXIF is unavailable.
export function cloudinaryPhotoMetadata(raw: unknown): EmbeddedPhotoMetadata {
  if (!raw || typeof raw !== 'object') return emptyMetadata();
  const metadata = raw as Record<string, unknown>;
  const gps = metadata.GPS && typeof metadata.GPS === 'object'
    ? metadata.GPS as Record<string, unknown> : metadata;
  const lat = coordinate(gps.GPSLatitude ?? gps.Latitude, gps.GPSLatitudeRef ?? gps.LatitudeRef, 90);
  const lng = coordinate(gps.GPSLongitude ?? gps.Longitude, gps.GPSLongitudeRef ?? gps.LongitudeRef, 180);
  const capturedAt = metadata.DateTimeOriginal ?? metadata.DateTimeDigitized ?? metadata.CreateDate ?? metadata.DateTime ?? '';
  return { capturedAt: typeof capturedAt === 'string' ? capturedAt : '', lat, lng };
}
