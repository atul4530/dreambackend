const { test } = require('node:test');
const assert = require('node:assert');

const {
  normalizeTrendInput,
  toPublicTrend,
  sortTrends,
  isPublished,
  ASPECT_RATIOS,
  DEFAULT_ASPECT_RATIO,
} = require('../src/services/trendModel');

function validInput(overrides = {}) {
  return {
    title: 'Neon Portrait',
    category: 'Fashion',
    prompt: 'A neon-lit fashion portrait, studio quality',
    ...overrides,
  };
}

test('normalizeTrendInput builds a trend with defaults', () => {
  const { trend, errors } = normalizeTrendInput(validInput());

  assert.strictEqual(errors, undefined);
  assert.strictEqual(trend.title, 'Neon Portrait');
  assert.strictEqual(trend.category, 'Fashion');
  assert.strictEqual(trend.prompt, 'A neon-lit fashion portrait, studio quality');
  assert.strictEqual(trend.description, '');
  assert.strictEqual(trend.negativePrompt, '');
  assert.strictEqual(trend.allowCustomPrompt, false);
  assert.strictEqual(trend.requiresPhoto, true);
  assert.strictEqual(trend.aspectRatio, DEFAULT_ASPECT_RATIO);
  assert.strictEqual(trend.sortOrder, 1);
  assert.strictEqual(trend.isPublished, false);
  assert.strictEqual(typeof trend.createdAt, 'string');
  assert.strictEqual(typeof trend.updatedAt, 'string');
});

test('normalizeTrendInput honors provided values', () => {
  const { trend } = normalizeTrendInput(
    validInput({
      description: 'Bold look',
      negativePrompt: 'blur, low quality',
      allowCustomPrompt: true,
      requiresPhoto: false,
      aspectRatio: '9:16',
      isPublished: true,
      sortOrder: 7,
    })
  );

  assert.strictEqual(trend.description, 'Bold look');
  assert.strictEqual(trend.negativePrompt, 'blur, low quality');
  assert.strictEqual(trend.allowCustomPrompt, true);
  assert.strictEqual(trend.requiresPhoto, false);
  assert.strictEqual(trend.aspectRatio, '9:16');
  assert.strictEqual(trend.isPublished, true);
  assert.strictEqual(trend.sortOrder, 7);
});

test('normalizeTrendInput rejects missing required fields', () => {
  const missingTitle = normalizeTrendInput({ category: 'x', prompt: 'y' });
  assert.deepStrictEqual(missingTitle.errors, ['title is required']);

  const missingCategory = normalizeTrendInput({ title: 'x', prompt: 'y' });
  assert.deepStrictEqual(missingCategory.errors, ['category is required']);

  const missingPrompt = normalizeTrendInput({ title: 'x', category: 'y' });
  assert.deepStrictEqual(missingPrompt.errors, ['prompt is required']);
});

test('normalizeTrendInput rejects unknown aspect ratio', () => {
  const { errors } = normalizeTrendInput(validInput({ aspectRatio: '99:99' }));
  assert.ok(errors && errors[0].includes('aspectRatio'));
});

test('normalizeTrendInput keeps existing values on partial update', () => {
  const existing = normalizeTrendInput(validInput()).trend;

  const { trend } = normalizeTrendInput({ title: 'Edited title' }, { existing });

  assert.strictEqual(trend.title, 'Edited title');
  assert.strictEqual(trend.category, existing.category);
  assert.strictEqual(trend.prompt, existing.prompt);
  assert.strictEqual(trend.aspectRatio, existing.aspectRatio);
  assert.strictEqual(trend.sortOrder, existing.sortOrder);
  assert.strictEqual(trend.id, existing.id);
  assert.strictEqual(trend.createdAt, existing.createdAt);
});

test('normalizeTrendInput uses nextSortOrder when none supplied', () => {
  const { trend } = normalizeTrendInput(validInput(), { nextSortOrder: 12 });
  assert.strictEqual(trend.sortOrder, 12);
});

test('sortTrends orders by sortOrder then createdAt', () => {
  const a = { id: 'a', sortOrder: 2, createdAt: '2026-01-01T00:00:00.000Z' };
  const b = { id: 'b', sortOrder: 1, createdAt: '2026-01-02T00:00:00.000Z' };
  const c = { id: 'c', sortOrder: 3, createdAt: '2026-01-01T00:00:00.000Z' };
  const d = { id: 'd', createdAt: '2026-01-01T00:00:00.000Z' };

  assert.deepStrictEqual(
    sortTrends([d, c, a, b]).map((t) => t.id),
    ['b', 'a', 'c', 'd']
  );
});

test('toPublicTrend returns only user-safe fields', () => {
  const input = normalizeTrendInput(
    validInput({ thumbnailUrl: 'https://cdn/x.jpg', requiresPhoto: true })
  ).trend;

  const publicTrend = toPublicTrend(input);

  assert.strictEqual(publicTrend.id, input.id);
  assert.strictEqual(publicTrend.title, input.title);
  assert.strictEqual(publicTrend.thumbnailUrl, 'https://cdn/x.jpg');
  assert.strictEqual(publicTrend.prompt, input.prompt);
  assert.strictEqual(publicTrend.requiresPhoto, true);
  assert.strictEqual(publicTrend.allowCustomPrompt, false);
  assert.strictEqual(publicTrend.isPublished, undefined);
});

test('isPublished only returns true for published trends', () => {
  assert.strictEqual(isPublished({ isPublished: true }), true);
  assert.strictEqual(isPublished({ isPublished: false }), false);
  assert.strictEqual(isPublished({}), false);
  assert.strictEqual(isPublished(null), false);
});

test('aspect ratios constant is stable', () => {
  assert.deepStrictEqual(ASPECT_RATIOS, ['1:1', '16:9', '9:16', '4:5', '3:4']);
});