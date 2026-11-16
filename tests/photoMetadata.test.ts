import test from 'node:test';
import assert from 'node:assert/strict';
import { readPhotoExif, cloudinaryPhotoMetadata } from '../src/lib/photoMetadata';

test('JPEG EXIF reads camera capture time and signed latitude/longitude', async () => {
  const tiff = new Uint8Array(256);
  const view = new DataView(tiff.buffer);
  const u16 = (at: number, value: number) => view.setUint16(at, value, true);
  const u32 = (at: number, value: number) => view.setUint32(at, value, true);
  const field = (at: number, tag: number, type: number, count: number, offset: number) => {
    u16(at, tag); u16(at + 2, type); u32(at + 4, count); u32(at + 8, offset);
  };
  const rational = (at: number, values: number[]) => {
    values.forEach((value, i) => { u32(at + i * 8, value); u32(at + i * 8 + 4, 1); });
  };

  u16(0, 0x4949);
  u16(2, 42);
  u32(4, 8);
  u16(8, 2);
  field(10, 0x8769, 4, 1, 40);
  field(22, 0x8825, 4, 1, 100);
  u16(40, 1);
  field(42, 0x9003, 2, 20, 60);
  const timestamp = '2026:11:10 15:42:03';
  for (let i = 0; i < timestamp.length; i++) tiff[60 + i] = timestamp.charCodeAt(i);
  tiff[60 + timestamp.length] = 0;

  u16(100, 4);
  field(102, 1, 2, 2, 0);
  tiff[110] = 'N'.charCodeAt(0);
  field(114, 2, 5, 3, 160);
  field(126, 3, 2, 2, 0);
  tiff[134] = 'W'.charCodeAt(0);
  field(138, 4, 5, 3, 184);
  rational(160, [30, 16, 2]);
  rational(184, [97, 44, 35]);

  const header = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x01, 0x08, 69, 120, 105, 102, 0, 0]);
  const jpeg = new Uint8Array(header.length + tiff.length);
  jpeg.set(header);
  jpeg.set(tiff, header.length);
  const fakeFile = {
    name: 'camera.jpg', type: 'image/jpeg',
    slice: () => ({ arrayBuffer: async () => jpeg.buffer })
  } as unknown as File;
  const actual = await readPhotoExif(fakeFile);
  assert.equal(actual.capturedAt, timestamp);
  assert.ok(Math.abs((actual.lat || 0) - 30.267222) < 0.00001);
  assert.ok(Math.abs((actual.lng || 0) - (-97.743056)) < 0.00001);
});

test('Cloudinary metadata is used for non-JPEG camera timestamps and GPS', () => {
  const actual = cloudinaryPhotoMetadata({
    DateTimeOriginal: '2026:11:09 18:02:11',
    GPSLatitude: ['30/1', '16/1', '2/1'],
    GPSLatitudeRef: 'N',
    GPSLongitude: ['97/1', '44/1', '35/1'],
    GPSLongitudeRef: 'W'
  });
  assert.equal(actual.capturedAt, '2026:11:09 18:02:11');
  assert.ok(Math.abs((actual.lat || 0) - 30.267222) < 0.00001);
  assert.ok(Math.abs((actual.lng || 0) - (-97.743056)) < 0.00001);
  assert.deepEqual(cloudinaryPhotoMetadata({}), { capturedAt:'', lat:null, lng:null });
});
