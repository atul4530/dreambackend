/**
 * OpenAI image generation (edit) service for the public image API.
 *
 * Uses the Images Edit endpoint (`images.edit`): takes a user photo plus a
 * prompt and returns a newly generated image. The model is server-configured
 * via `IMAGE_GEN_MODEL` (default `gpt-image-1`, which accepts jpeg/png/webp
 * inputs < 25MB and always returns base64 output).
 */

const openai = require('../config/openai');
const { toFile } = require('openai');
const logger = require('../utils/logger');

const MODEL = process.env.IMAGE_GEN_MODEL || 'gpt-image-1';

const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const ALLOWED_SIZES = ['1024x1024', '1536x1024', '1024x1536'];

/**
 * Generates a new image from a source photo + editing prompt.
 *
 * @param {object} params
 * @param {string} params.prompt   Editing prompt (1-32000 chars).
 * @param {Buffer} params.imageBuffer  User photo bytes (jpeg/png/webp).
 * @param {string} params.mime     Image MIME type.
 * @param {string} [params.size]   One of 1024x1024, 1536x1024, 1024x1536.
 * @returns {Promise<{b64_json?: string, url?: string, revised_prompt?: string}>}
 */
async function generateImage({ prompt, imageBuffer, mime, size }) {
  const startTime = Date.now();
  const ext = MIME_EXT[mime] || 'png';
  const file = await toFile(imageBuffer, `input.${ext}`, { type: mime });

  const params = {
    model: MODEL,
    prompt,
    image: file,
  };

  if (size) params.size = size;

  try {
    const response = await openai.images.edit(params);
    const result = response.data[0] || {};

    logger.info('OpenAI image edit completed', {
      latencyMs: Date.now() - startTime,
      model: MODEL,
      size: size || 'auto',
    });

    return result;
  } catch (error) {
    const latency = Date.now() - startTime;

    if (error.status === 400) {
      logger.warn('OpenAI image edit rejected the request', {
        latencyMs: latency,
        message: error.message,
      });
      const badRequest = new Error(error.message || 'Invalid image generation request.');
      badRequest.statusCode = 400;
      throw badRequest;
    }

    if (error.status === 401) {
      logger.error('OpenAI authentication failed — invalid API key', {
        latencyMs: latency,
        status: error.status,
      });
      const authError = new Error('Invalid API key');
      authError.statusCode = 401;
      throw authError;
    }

    if (error.status === 429) {
      logger.warn('OpenAI rate limit exceeded', {
        latencyMs: latency,
        status: error.status,
      });
      const rateError = new Error('Rate limit exceeded. Please try again later.');
      rateError.statusCode = 429;
      throw rateError;
    }

    logger.error('OpenAI image edit request failed', {
      latencyMs: latency,
      status: error.status,
      message: error.message,
    });

    const internalError = new Error('Failed to generate image. Please try again.');
    internalError.statusCode = 500;
    throw internalError;
  }
}

module.exports = { generateImage, MODEL, ALLOWED_SIZES };