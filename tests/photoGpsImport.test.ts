import test from 'node:test';
import assert from 'node:assert/strict';
import { readPhotoExif } from '../src/lib/photoMetadata';
import { isImageFile, selectOriginalPhotos } from '../src/lib/photoPicker';

function exifTiff(): Uint8Array {
  const tiff = new Uint8Array(256);
  const view = new DataView(tiff.buffer);
  const u16 = (at: number, value: number) => view.setUint16(at, value, true);
  const u32 = (at: number, value: number) => view.setUint32(at, value, true);
  const field = (at: number, tag: number, type: number, count: number, offset: number) => {
    u16(at, tag); u16(at + 2, type); u32(at + 4, count); u32(at + 8, offset);
  };
  u16(0, 0x4949); u16(2, 42); u32(4, 8); u16(8, 2);
  field(10, 0x8769, 4, 1, 40); field(22, 0x8825, 4, 1, 100);
  u16(40, 1); field(42, 0x9003, 2, 20, 60);
  const stamp = '2026:11:19 09:17:05';
  for (let i = 0; i < stamp.length; i++) tiff[60 + i] = stamp.charCodeAt(i);
  u16(100, 4);
  field(102, 1, 2, 2, 0); tiff[110] = 78; // North
  field(114, 2, 5, 3, 160);
  field(126, 3, 2, 2, 0); tiff[134] = 87; // West
  field(138, 4, 5, 3, 184);
  [[30, 16, 2], [97, 44, 35]].forEach((parts, group) => parts.forEach((value, index) => {
    const at = (group ? 184 : 160) + index * 8;
    u32(at, value); u32(at + 4, 1);
  }));
  return tiff;
}

function file(bytes: Uint8Array, name: string, type: string): File {
  return {
    name, type, size: bytes.byteLength,
    slice: (from = 0, to = bytes.byteLength) => ({
      arrayBuffer: async () => bytes.slice(from, to).buffer
    }),
  } as unknown as File;
}

function pngChunk(kind: string, content: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(12 + content.length);
  const v = new DataView(bytes.buffer);
  v.setUint32(0, content.length, false);
  for (let i = 0; i < 4; i++) bytes[4 + i] = kind.charCodeAt(i);
  bytes.set(content, 8);
  return bytes; // CRC not needed for metadata scan
}

function concat(...chunks: Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

test('read GPS from PNG eXIf, including metadata after image data', async () => {
  const image = concat(
    new Uint8Array([137,80,78,71,13,10,26,10]),
    pngChunk('IHDR', new Uint8Array(13)),
    pngChunk('IDAT', new Uint8Array(15000)),
    pngChunk('eXIf', exifTiff()),
    pngChunk('IEND', new Uint8Array())
  );
  const found = await readPhotoExif(file(image,'photo.png','image/png'));
  assert.equal(found.capturedAt,'2026:11:19 09:17:05');
  assert.ok(Math.abs((found.lat || 0) - 30.267222) < 1e-5);
  assert.ok(Math.abs((found.lng || 0) + 97.743056) < 1e-5);
});

test('read GPS from WebP EXIF even when located behind image chunks', async () => {
  const tiff = concat(new Uint8Array([69,120,105,102,0,0]),exifTiff());
  const make = (kind: string, content: Uint8Array) => {
    const bytes = new Uint8Array(8 + content.length + content.length % 2);
    for (let i = 0; i < 4; i++) bytes[i] = kind.charCodeAt(i);
    new DataView(bytes.buffer).setUint32(4, content.length, true);
    bytes.set(content, 8);
    return bytes;
  };
  const chunks = concat(make('VP8 ',new Uint8Array(11230)),make('EXIF',tiff));
  const header = new Uint8Array(12);
  header.set([82,73,70,70],0); // RIFF
  header.set([87,69,66,80],8); // WEBP
  new DataView(header.buffer).setUint32(4, chunks.length + 4, true);
  const found = await readPhotoExif(file(concat(header,chunks),'photo.webp','image/webp'));
  assert.equal(found.capturedAt,'2026:11:19 09:17:05');
  assert.ok((found.lng || 0) < -97);
});

test('reject archive uploads; parse TIFF GPS without relying on filename', async () => {
  assert.equal(isImageFile({name:'photo.zip',type:'application/zip'}),false);
  assert.equal(isImageFile({name:'photo.heic',type:''}),true);
  assert.equal(isImageFile({name:'photo.jpg',type:'application/octet-stream'}),true);
  assert.equal(isImageFile({name:'document.txt',type:'text/plain'}),false);
  assert.equal((await readPhotoExif(file(exifTiff(),'original.bin','application/octet-stream'))).capturedAt,'2026:11:19 09:17:05');
});

test('Files picker uses unrestricted file selection and keeps the chosen file', async () => {
  const originalWindow = (globalThis as any).window;
  const picked = file(exifTiff(),'camera.jpg','image/jpeg');
  let request: unknown;
  (globalThis as any).window = {showOpenFilePicker: async (options: any) => {
    request = options;
    return [{getFile: async () => picked}];
  }};
  try {
    const result = await selectOriginalPhotos(null);
    assert.deepEqual(request,{multiple:true});
    assert.deepEqual(result,[picked]);
  } finally { (globalThis as any).window = originalWindow; }
});

test('unsupported Files API falls back to ordinary no-accept file input', async () => {
  const originalWindow = (globalThis as any).window;
  let clicks=0;
  (globalThis as any).window = {};
  try {
    assert.equal(await selectOriginalPhotos({click: () => {clicks++;}} as unknown as HTMLInputElement),null);
    assert.equal(clicks,1);
  } finally { (globalThis as any).window = originalWindow; }
});
