/**
 * Joi request validation for the Trend Photos endpoints.
 * Mirrors the style of the existing `middleware/validateRequest.js` (same
 * error shape: { success: false, message: 'Validation failed', errors: [...] }).
 */

const Joi = require('joi');
const { ASPECT_RATIOS } = require('../services/trendModel');
const logger = require('../utils/logger');

const textMessages = {
  'any.required': '{{#label}} is required',
  'string.empty': '{{#label}} must not be empty',
  'string.min': '{{#label}} must be at least {{#limit}} characters long',
  'string.max': '{{#label}} must not exceed {{#limit}} characters',
  'string.base': '{{#label}} must be a string',
};

const promptField = Joi.string().trim().min(1).max(4000).messages(textMessages);

const createTrendSchema = Joi.object({
  title: Joi.string().trim().min(1).max(120).required().messages(textMessages),
  description: Joi.string().allow('').trim().max(1000).messages(textMessages),
  category: Joi.string().trim().min(1).max(60).required().messages(textMessages),
  thumbnailBase64: Joi.string().min(10).max(12000000).messages({
    'string.min': 'thumbnailBase64 must be provided as a base64 data URL',
    'string.max': 'thumbnailBase64 must not exceed 12MB of base64 data',
  }),
  thumbnailUrl: Joi.string().trim().uri().max(2000).messages(textMessages),
  prompt: promptField.required().messages(textMessages),
  negativePrompt: Joi.string().allow('').trim().max(4000).messages(textMessages),
  allowCustomPrompt: Joi.boolean(),
  requiresPhoto: Joi.boolean(),
  aspectRatio: Joi.string().valid(...ASPECT_RATIOS).messages({
    'any.only': `aspectRatio must be one of: ${ASPECT_RATIOS.join(', ')}`,
  }),
  isPublished: Joi.boolean(),
  sortOrder: Joi.number().integer().min(1).messages({
    'number.base': 'sortOrder must be a number',
    'number.integer': 'sortOrder must be an integer',
    'number.min': 'sortOrder must be at least 1',
  }),
});

// All fields optional for partial updates. Defaults are NOT applied at the
// Joi layer here, because the controller fills missing fields from the
// existing trend instead.
const updateTrendSchema = Joi.object({
  title: Joi.string().trim().min(1).max(120).messages(textMessages),
  description: Joi.string().allow('').trim().max(1000).messages(textMessages),
  category: Joi.string().trim().min(1).max(60).messages(textMessages),
  thumbnailBase64: Joi.string().min(10).max(12000000).messages({
    'string.min': 'thumbnailBase64 must be provided as a base64 data URL',
    'string.max': 'thumbnailBase64 must not exceed 12MB of base64 data',
  }),
  thumbnailUrl: Joi.string().trim().uri().max(2000).messages(textMessages),
  prompt: promptField.messages(textMessages),
  negativePrompt: Joi.string().allow('').trim().max(4000).messages(textMessages),
  allowCustomPrompt: Joi.boolean(),
  requiresPhoto: Joi.boolean(),
  aspectRatio: Joi.string().valid(...ASPECT_RATIOS).messages({
    'any.only': `aspectRatio must be one of: ${ASPECT_RATIOS.join(', ')}`,
  }),
  isPublished: Joi.boolean(),
  sortOrder: Joi.number().integer().min(1).messages({
    'number.base': 'sortOrder must be a number',
    'number.integer': 'sortOrder must be an integer',
    'number.min': 'sortOrder must be at least 1',
  }),
}).min(1).messages({ 'object.min': 'At least one field must be provided for an update' });

const statusSchema = Joi.object({
  isPublished: Joi.boolean().required().messages({
    'any.required': 'isPublished is required',
    'boolean.base': 'isPublished must be a boolean',
  }),
});

const reorderSchema = Joi.object({
  ids: Joi.array()
    .items(Joi.string().trim().min(1).max(120).required())
    .min(1)
    .required()
    .messages({
      'any.required': 'ids is required',
      'array.min': 'ids must contain at least one trend id',
      'string.empty': 'trend ids must not be empty',
    }),
});

const categorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(60).required().messages(textMessages),
});

/**
 * Creates a request-validation middleware for a given Joi schema (same shape
 * as the existing validateRequest middleware).
 */
function validateRequest(schema) {
  return function validateTrendRequest(req, res, next) {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((d) => d.message);

      logger.warn('Trend validation failed', {
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
  };
}

module.exports = {
  validateRequest,
  createTrendSchema,
  updateTrendSchema,
  statusSchema,
  reorderSchema,
  categorySchema,
};