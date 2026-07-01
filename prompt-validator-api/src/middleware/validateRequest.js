const Joi = require('joi');
const logger = require('../utils/logger');

const promptSchema = Joi.object({
  prompt: Joi.string()
    .trim()
    .min(1)
    .max(4000)
    .required()
    .messages({
      'any.required': 'prompt is required',
      'string.empty': 'prompt must not be empty',
      'string.min': 'prompt must be at least 1 character long',
      'string.max': 'prompt must not exceed 4000 characters',
      'string.base': 'prompt must be a string',
    }),
});

function validateRequest(req, res, next) {
  const { error, value } = promptSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const details = error.details.map((d) => d.message);

    logger.warn('Validation failed', {
      endpoint: req.originalUrl,
      errors: details,
    });

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: details,
    });
  }

  req.body = value;
  next();
}

module.exports = validateRequest;
