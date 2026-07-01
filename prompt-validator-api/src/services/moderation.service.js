const openai = require('../config/openai');
const logger = require('../utils/logger');

/**
 * Calls OpenAI Moderation API to check if a prompt is safe.
 *
 * @param {string} prompt - The user prompt to moderate.
 * @returns {Promise<{flagged: boolean, categories: object, scores: object}>}
 */
async function checkModeration(prompt) {
  const startTime = Date.now();

  try {
    const response = await openai.moderations.create({
      model: 'omni-moderation-latest',
      input: prompt,
    });

    const latency = Date.now() - startTime;
    const result = response.results[0];

    logger.info('OpenAI moderation response received', {
      latencyMs: latency,
      flagged: result.flagged,
    });

    return {
      flagged: result.flagged,
      categories: result.categories || {},
      scores: result.category_scores || {},
    };
  } catch (error) {
    const latency = Date.now() - startTime;

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

    logger.error('OpenAI moderation request failed', {
      latencyMs: latency,
      status: error.status,
      message: error.message,
    });

    const internalError = new Error('Failed to validate prompt. Please try again.');
    internalError.statusCode = 500;
    throw internalError;
  }
}

module.exports = { checkModeration };
