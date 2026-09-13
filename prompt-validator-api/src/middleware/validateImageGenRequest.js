/**
 * Joi request validation for the public image generation endpoint.
 * Mirrors the error shape used elsewhere:
 * { success: false, message: 'Validation failed', errors: [...] }.
 */

const Joi = require('joi');
const logger = require('../utils/logger');

const ALLOWED_SIZES = ['1024x1024', '1536x1024', '1024x1536'];

const textMessages = {
  'any.required': '{{#label}} is required',
  'string.empty': '{{#label}} must not be empty',
  'string.min': '{{#label}} must be at least {{#limit}} characters long',
  'string.max': '{{#label}} must not exceed {{#limit}} characters',
  'string.base': '{{#label}} must be a string',
};

const imageGenSchema = Joi.object({
  prompt: Joi.string().trim().min(1).max(32000).required().messages({
    ...textMessages,
    'string.max': 'prompt must not exceed 32000 characters',
  }),
  image: Joi.string().min(10).max(12500000).required().messages({
    'any.required': 'image is required',
    'string.empty': 'image must not be empty',
    'string.min': 'image must be provided as a base64 data URL',
    'string.max': 'image must not exceed 12MB of base64 data',
  }),
  size: Joi.string()
    .valid(...ALLOWED_SIZES)
    .messages({
      'any.only': `size must be one of: ${ALLOWED_SIZES.join(', ')}`,
    }),
});

function validateImageGenRequest(req, res, next) {
  const { error, value } = imageGenSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const details = error.details.map((d) => d.message);

    logger.warn('Image generation validation failed', {
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

module.exports = { validateImageGenRequest, imageGenSchema };