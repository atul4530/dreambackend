const { test } = require('node:test');
const assert = require('node:assert');

const adminAuth = require('../src/middleware/adminAuth');

function makeRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  return res;
}

test('adminAuth returns 503 when ADMIN_API_KEY is not configured', () => {
  delete process.env.ADMIN_API_KEY;
  const res = makeRes();
  adminAuth({ headers: {} }, res, () => assert.fail('should not call next'));

  assert.strictEqual(res.statusCode, 503);
  assert.strictEqual(res.body.success, false);
});

test('adminAuth returns 401 when header is missing', () => {
  process.env.ADMIN_API_KEY = 'secret-key';
  const res = makeRes();
  adminAuth({ headers: {} }, res, () => assert.fail('should not call next'));

  assert.strictEqual(res.statusCode, 401);
});

test('adminAuth returns 401 when key is wrong', () => {
  process.env.ADMIN_API_KEY = 'secret-key';
  const res = makeRes();
  adminAuth({ headers: { 'x-admin-key': 'wrong' } }, res, () =>
    assert.fail('should not call next')
  );
  assert.strictEqual(res.statusCode, 401);
});

test('adminAuth lets a correct key through', () => {
  process.env.ADMIN_API_KEY = 'secret-key';
  let passed = false;
  adminAuth({ headers: { 'x-admin-key': 'secret-key' } }, makeRes(), () => {
    passed = true;
  });
  assert.strictEqual(passed, true);
});

test('adminAuth is case-sensitive on the key', () => {
  process.env.ADMIN_API_KEY = 'secret-key';
  const res = makeRes();
  adminAuth({ headers: { 'x-admin-key': 'SECRET-KEY' } }, res, () =>
    assert.fail('should not call next')
  );
  assert.strictEqual(res.statusCode, 401);
});