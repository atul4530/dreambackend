const { test } = require('node:test');
const assert = require('node:assert');

const { parseBase64DataUrl, MAX_BYTES } = require('../src/utils/base64Image');

const PNG_PIXEL_1x1BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test('parseBase64DataUrl extracts mime + buffer', () => {
  const dataUrl = `data:image/png;base64,${PNG_PIXEL_1x1BASE64}`;
  const { buffer, mime } = parseBase64DataUrl(dataUrl);

  assert.strictEqual(mime, 'image/png');
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 0);
});

test('parseBase64DataUrl accepts jpeg and webp mime types', () => {
  const jpeg = parseBase64DataUrl(`data:image/jpeg;base64,${PNG_PIXEL_1x1BASE64}`);
  assert.strictEqual(jpeg.mime, 'image/jpeg');

  const webp = parseBase64DataUrl(`data:image/webp;base64,${PNG_PIXEL_1x1BASE64}`);
  assert.strictEqual(webp.mime, 'image/webp');
});

test('parseBase64DataUrl rejects non-image data URLs', () => {
  assert.throws(
    () => parseBase64DataUrl('data:text/plain;base64,AA=='),
    (error) => error.statusCode === 400
  );
});

test('parseBase64DataUrl rejects empty and oversized payloads', () => {
  assert.throws(
    () => parseBase64DataUrl('data:image/png;base64,'),
    (error) => error.statusCode === 400
  );

  const big = 'data:image/png;base64,' + 'AAAA'.repeat(Math.ceil(MAX_BYTES / 3) + 1);
  assert.throws(
    () => parseBase64DataUrl(big),
    (error) => error.statusCode === 400
  );
});

test('parseBase64DataUrl rejects non-strings', () => {
  assert.throws(
    () => parseBase64DataUrl(undefined),
    (error) => error.statusCode === 400
  );
});