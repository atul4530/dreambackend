/**
 * Trend Photos domain model + pure helpers.
 *
 * Kept free of network/Firebase/OpenAI dependencies so it can be unit tested
 * with `node --test` offline. Controllers combine these helpers with the
 * existing moderation service and the Firebase store.
 */

const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:5', '3:4'];

const DEFAULT_ASPECT_RATIO = '1:1';

function nowIso() {
  return new Date().toISOString();
}

/**
 * Validates/normalizes a trend payload coming from the admin dashboard.
 *
 * @param {object} input  Raw admin input (already Joi-sanitized).
 * @param {object} [options]
 * @param {object} [options.existing] Existing trend when editing (to fill
 *                    missing optional fields and keep unchanging values).
 * @param {number} [options.nextSortOrder] sortOrder used when none is supplied.
 * @returns {{ trend?: object, errors?: string[] }}
 */
function normalizeTrendInput(input, options = {}) {
  const { existing = {}, nextSortOrder = 1 } = options;
  const errors = [];

  const title =
    typeof input.title === 'string' && input.title.trim() ? input.title.trim() : existing.title || '';
  const category =
    typeof input.category === 'string' && input.category.trim()
      ? input.category.trim()
      : existing.category || '';
  const prompt =
    typeof input.prompt === 'string' && input.prompt.trim() ? input.prompt.trim() : existing.prompt || '';

  if (!title) errors.push('title is required');
  if (!category) errors.push('category is required');
  if (!prompt) errors.push('prompt is required');

  if (errors.length > 0) return { errors };

  const description =
    typeof input.description === 'string' ? input.description.trim() : existing.description || '';
  const negativePrompt =
    typeof input.negativePrompt === 'string' ? input.negativePrompt.trim() : existing.negativePrompt || '';

  let aspectRatio = input.aspectRatio || existing.aspectRatio || DEFAULT_ASPECT_RATIO;
  if (!ASPECT_RATIOS.includes(aspectRatio)) {
    errors.push(`aspectRatio must be one of: ${ASPECT_RATIOS.join(', ')}`);
  }

  if (errors.length > 0) return { errors };

  const sortOrder =
    typeof input.sortOrder === 'number' && Number.isInteger(input.sortOrder) && input.sortOrder >= 1
      ? input.sortOrder
      : typeof existing.sortOrder === 'number'
        ? existing.sortOrder
        : nextSortOrder;

  const trend = {
    id: existing.id || input.id || '',
    title,
    description,
    category,
    thumbnailUrl: input.thumbnailUrl ?? existing.thumbnailUrl ?? '',
    prompt,
    negativePrompt,
    allowCustomPrompt: typeof input.allowCustomPrompt === 'boolean' ? input.allowCustomPrompt : existing.allowCustomPrompt || false,
    requiresPhoto: typeof input.requiresPhoto === 'boolean' ? input.requiresPhoto : existing.requiresPhoto ?? true,
    aspectRatio,
    isPublished: typeof input.isPublished === 'boolean' ? input.isPublished : existing.isPublished || false,
    sortOrder,
    createdAt: existing.createdAt || nowIso(),
    updatedAt: nowIso(),
  };

  return { trend };
}

/**
 * Public (mobile-app-facing) representation of a trend.
 * Returns only published, user-safe configuration.
 *
 * @param {object} trend
 * @returns {object}
 */
function toPublicTrend(trend) {
  return {
    id: trend.id,
    title: trend.title,
    description: trend.description || '',
    category: trend.category,
    thumbnailUrl: trend.thumbnailUrl || '',
    prompt: trend.prompt,
    negativePrompt: trend.negativePrompt || '',
    requiresPhoto: trend.requiresPhoto ?? true,
    allowCustomPrompt: trend.allowCustomPrompt || false,
    aspectRatio: trend.aspectRatio || DEFAULT_ASPECT_RATIO,
    sortOrder: trend.sortOrder,
    createdAt: trend.createdAt,
    updatedAt: trend.updatedAt,
  };
}

/**
 * Sorts trends by sortOrder ASC, then createdAt ASC (stable order).
 * @param {object[]} trends
 * @returns {object[]}
 */
function sortTrends(trends) {
  return [...trends].sort((a, b) => {
    const aOrder = typeof a.sortOrder === 'number' ? a.sortOrder : Number.MAX_SAFE_INTEGER;
    const bOrder = typeof b.sortOrder === 'number' ? b.sortOrder : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aTime - bTime;
  });
}

/**
 * @param {object} trend
 * @returns {boolean}
 */
function isPublished(trend) {
  return Boolean(trend && trend.isPublished === true);
}

module.exports = {
  ASPECT_RATIOS,
  DEFAULT_ASPECT_RATIO,
  nowIso,
  normalizeTrendInput,
  toPublicTrend,
  sortTrends,
  isPublished,
};