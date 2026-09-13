/**
 * Base64 image data-url parsing, shared by the trend store (thumbnails are
 * stored as MongoDB binaries and served by the API, so no external storage /
 * CDN is required).
 */

const { httpError } = require('../utils/httpError');

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * Parses a `data:image/...;base64,....` string into { buffer, mime }.
 * Rejects non-image payloads and oversized files.
 */
function parseBase64DataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') {
    throw httpError(400, 'thumbnailBase64 must be a base64 image data URL.');
  }

  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl.trim());
  if (!match) {
    throw httpError(400, 'thumbnailBase64 must be a valid image data URL (jpeg, png or webp).');
  }

  const mime = match[1];
  const buffer = Buffer.from(match[2], 'base64');

  if (buffer.length === 0) {
    throw httpError(400, 'thumbnail image must not be empty.');
  }
  if (buffer.length > MAX_BYTES) {
    throw httpError(400, 'thumbnail image must not exceed 8MB.');
  }

  return { buffer, mime };
}

module.exports = { parseBase64DataUrl, MAX_BYTES };