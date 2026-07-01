const { checkModeration } = require('../services/moderation.service');
const logger = require('../utils/logger');

async function validatePrompt(req, res, next) {
  const startTime = Date.now();
  const { prompt } = req.body;

  try {
    const { flagged, categories, scores } = await checkModeration(prompt);
    const responseTime = Date.now() - startTime;

    if (flagged) {
      logger.info('Prompt flagged as unsafe', {
        endpoint: req.originalUrl,
        responseTimeMs: responseTime,
        categories: Object.keys(categories).filter((k) => categories[k]),
      });

      return res.json({
        success: true,
        allowed: false,
        flagged: true,
        categories,
        scores,
        message: 'Prompt violates safety policy.',
      });
    }

    logger.info('Prompt validated as safe', {
      endpoint: req.originalUrl,
      responseTimeMs: responseTime,
    });

    return res.json({
      success: true,
      allowed: true,
      flagged: false,
      message: 'Prompt is safe.',
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('Prompt validation failed', {
      endpoint: req.originalUrl,
      responseTimeMs: responseTime,
      error: error.message,
    });

    next(error);
  }
}

module.exports = { validatePrompt };
