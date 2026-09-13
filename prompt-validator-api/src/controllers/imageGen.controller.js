/**
 * Public image generation endpoint.
 *
 * Accepts a user photo + an editing prompt, verifies the prompt via the same
 * OpenAI moderation used by the validation API, then generates a new image
 * through OpenAI's Images Edit API.
 */

const { parseBase64DataUrl } = require('../utils/base64Image');
const { checkModeration } = require('../services/moderation.service');
const { generateImage } = require('../services/imageGen.service');
const logger = require('../utils/logger');

async function generateFromImage(req, res, next) {
  const startTime = Date.now();

  try {
    const { prompt, size } = req.body;
    const { buffer, mime } = parseBase64DataUrl(req.body.image);

    const moderation = await checkModeration(prompt);
    if (!moderation || moderation.flagged) {
      logger.info('Image generation blocked — unsafe prompt', {
        endpoint: req.originalUrl,
        flagged: true,
      });
      return res.status(400).json({
        success: false,
        message: 'Prompt violates safety policy.',
      });
    }

    const data = await generateImage({ prompt, imageBuffer: buffer, mime, size });

    logger.info('Image generated successfully', {
      endpoint: req.originalUrl,
      latencyMs: Date.now() - startTime,
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = { generateFromImage };