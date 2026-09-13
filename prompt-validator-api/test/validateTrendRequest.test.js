const { test } = require('node:test');
const assert = require('node:assert');

const {
  validateRequest,
  createTrendSchema,
  updateTrendSchema,
  statusSchema,
  reorderSchema,
  categorySchema,
} = require('../src/middleware/validateTrendRequest');

function runValidator(schema, body) {
  let statusCode = null;
  let bodyOut = null;
  let nextCalled = false;

  const req = { body };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      bodyOut = value;
      return this;
    },
  };

  validateRequest(schema)(req, res, () => {
    nextCalled = true;
  });

  return { statusCode, bodyOut, nextCalled, reqBody: req.body };
}

function validCreate() {
  return {
    title: 'Neon Portrait',
    category: 'Fashion',
    prompt: 'A studio portrait',
    thumbnailBase64:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  };
}

test('create schema accepts valid payload and sanitizes it', () => {
  const { nextCalled, reqBody } = runValidator(createTrendSchema, {
    ...validCreate(),
    description: '  Bold  ',
    negativePrompt: 'blur',
    unknownField: 'should be stripped',
  });

  assert.strictEqual(nextCalled, true);
  assert.strictEqual(reqBody.description, 'Bold');
  assert.strictEqual(reqBody.unknownField, undefined);
});

test('create schema rejects missing title/category/prompt', () => {
  const { statusCode, bodyOut, nextCalled } = runValidator(createTrendSchema, {
    category: 'Fashion',
    thumbnailBase64: 'data:image/png;base64,AAAA',
  });

  assert.strictEqual(nextCalled, false);
  assert.strictEqual(statusCode, 400);
  assert.strictEqual(bodyOut.success, false);
  assert.ok(bodyOut.errors.some((e) => e.includes('title')));
  assert.ok(bodyOut.errors.some((e) => e.includes('prompt')));
});

test('create schema rejects bad aspect ratio', () => {
  const { statusCode, nextCalled } = runValidator(createTrendSchema, {
    ...validCreate(),
    aspectRatio: 'square',
  });
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(statusCode, 400);
});

test('update schema requires at least one field', () => {
  const { statusCode, nextCalled } = runValidator(updateTrendSchema, {});
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(statusCode, 400);
});

test('update schema accepts partial payload', () => {
  const { nextCalled } = runValidator(updateTrendSchema, { title: 'New' });
  assert.strictEqual(nextCalled, true);
});

test('status schema requires a boolean', () => {
  const ok = runValidator(statusSchema, { isPublished: true });
  assert.strictEqual(ok.nextCalled, true);

  const bad = runValidator(statusSchema, { isPublished: 'yes' });
  assert.strictEqual(bad.nextCalled, false);
  assert.strictEqual(bad.statusCode, 400);
});

test('reorder schema requires a non-empty id array', () => {
  const ok = runValidator(reorderSchema, { ids: ['a', 'b'] });
  assert.strictEqual(ok.nextCalled, true);

  const empty = runValidator(reorderSchema, { ids: [] });
  assert.strictEqual(empty.nextCalled, false);
  assert.strictEqual(empty.statusCode, 400);
});

test('category schema requires a name', () => {
  const ok = runValidator(categorySchema, { name: 'Bollywood' });
  assert.strictEqual(ok.nextCalled, true);

  const empty = runValidator(categorySchema, { name: '   ' });
  assert.strictEqual(empty.nextCalled, false);
  assert.strictEqual(empty.statusCode, 400);
});