const { test } = require('node:test');
const assert = require('node:assert');

const {
  validateImageGenRequest,
  imageGenSchema,
} = require('../src/middleware/validateImageGenRequest');

function runValidator(body) {
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

  validateImageGenRequest(req, res, () => {
    nextCalled = true;
  });

  return { statusCode, bodyOut, nextCalled, reqBody: req.body };
}

function validBody() {
  return {
    prompt: 'Make them stand on a beach at sunset',
    image:
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  };
}

test('image gen schema accepts valid payload and sanitizes it', () => {
  const { nextCalled, reqBody } = runValidator({
    ...validBody(),
    prompt: '  Make them stand on a beach at sunset  ',
    size: '1024x1024',
    unknownField: 'should be stripped',
  });

  assert.strictEqual(nextCalled, true);
  assert.strictEqual(reqBody.prompt, 'Make them stand on a beach at sunset');
  assert.strictEqual(reqBody.size, '1024x1024');
  assert.strictEqual(reqBody.unknownField, undefined);
});

test('image gen schema rejects missing prompt/image', () => {
  const { statusCode, bodyOut, nextCalled } = runValidator({});

  assert.strictEqual(nextCalled, false);
  assert.strictEqual(statusCode, 400);
  assert.strictEqual(bodyOut.success, false);
  assert.ok(bodyOut.errors.some((e) => e.includes('prompt')));
  assert.ok(bodyOut.errors.some((e) => e.includes('image')));
});

test('image gen schema rejects bad size', () => {
  const { statusCode, nextCalled } = runValidator({
    ...validBody(),
    size: 'square',
  });
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(statusCode, 400);
});

test('image gen schema rejects empty prompt', () => {
  const { statusCode, nextCalled } = runValidator({
    ...validBody(),
    prompt: '   ',
  });
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(statusCode, 400);
});