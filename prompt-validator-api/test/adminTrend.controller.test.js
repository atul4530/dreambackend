const { test } = require('node:test');
const assert = require('node:assert');

const {
  buildContext,
  createAdminTrendController,
  createAdminCategoryController,
  _handlers,
} = require('../src/controllers/adminTrend.controller');

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function fakeStore(overrides = {}) {
  let nextId = 1;
  const rows = new Map();
  const calls = { create: [], update: [], remove: [], reorder: [] };

  const store = {
    rows,
    calls,
    async listAll() {
      return [...rows.values()];
    },
    async get(id) {
      return rows.get(id) || null;
    },
    async create(trend) {
      const stored = { ...trend, id: trend.id || `id-${nextId++}` };
      rows.set(stored.id, stored);
      calls.create.push(stored);
      return stored;
    },
    async update(id, trend) {
      if (!rows.has(id)) return null;
      rows.set(id, { ...trend, id });
      calls.update.push(rows.get(id));
      return rows.get(id);
    },
    async remove(id) {
      if (!rows.has(id)) return null;
      rows.delete(id);
      calls.remove.push(id);
      return true;
    },
    async setStatus(id, isPublished) {
      if (!rows.has(id)) return null;
      rows.set(id, { ...rows.get(id), isPublished, updatedAt: '2026-01-01T00:00:00.000Z' });
      return rows.get(id);
    },
    async reorderTrends(ids) {
      calls.reorder.push(ids);
      ids.forEach((id, index) => {
        if (rows.has(id)) rows.set(id, { ...rows.get(id), sortOrder: index + 1 });
      });
      return ids.map((id, index) => ({ id, sortOrder: index + 1 }));
    },
  };

  Object.assign(store, overrides);
  return store;
}

function makeHarness({ store, checkModeration } = {}) {
  const moderationCalls = [];
  const ctx = buildContext({
    store: store || fakeStore(),
    checkModeration:
      checkModeration ||
      (async (prompt) => {
        moderationCalls.push(prompt);
        return { flagged: false };
      }),
  });

  function call(handler, req = {}) {
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
    let nextError = null;
    const next = (error) => {
      nextError = error;
    };
    const promise = handler(ctx, req, res, next);
    return promise.then(() => ({ res, nextError }));
  }

  return { ctx, store: ctx.store, moderationCalls, call };
}

function validBody() {
  return { title: 'Neon', category: 'Fashion', prompt: 'Safe prompt', thumbnailBase64: PNG };
}

test('create stores a normalized trend (draft) and returns 201', async () => {
  const { call, store, moderationCalls } = makeHarness();
  const { res } = await call(_handlers.handleCreate, {
    body: validBody(),
  });

  assert.strictEqual(res.statusCode, 201);
  const data = res.body.data;
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(data.title, 'Neon');
  assert.strictEqual(data.isPublished, false);
  assert.strictEqual(data.sortOrder, 1);
  assert.strictEqual(data.thumbnailUrl, `/api/v1/trends/${data.id}/image`);
  assert.strictEqual(data.thumbnail, undefined);
  assert.strictEqual(data.requiresPhoto, true);
  assert.strictEqual(store.rows.size, 1);

  const stored = [...store.rows.values()][0];
  assert.ok(Buffer.isBuffer(stored.thumbnail));
  assert.strictEqual(stored.thumbnailContentType, 'image/png');

  assert.ok(moderationCalls.includes('Safe prompt'));
});

test('create rejects a prompt flagged by moderation', async () => {
  const { call } = makeHarness({
    checkModeration: async () => ({ flagged: true }),
  });
  const { res, nextError } = await call(_handlers.handleCreate, { body: validBody() });

  assert.strictEqual(res.statusCode, null);
  assert.strictEqual(nextError.statusCode, 400);
  assert.deepStrictEqual(nextError.errors, ['Prompt violates safety policy.']);
});

test('create rejects a body without any thumbnail', async () => {
  const { call } = makeHarness();
  const { res, nextError } = await call(_handlers.handleCreate, {
    body: { title: 'No img', category: 'Fashion', prompt: 'Safe' },
  });

  assert.strictEqual(nextError.statusCode, 400);
  assert.deepStrictEqual(nextError.errors, ['Preview image is required.']);
});

test('create rejects a malformed base64 image', async () => {
  const { call } = makeHarness();
  const { res, nextError } = await call(_handlers.handleCreate, {
    body: { ...validBody(), thumbnailBase64: 'data:image/png;base64,@@@' },
  });

  assert.strictEqual(res.statusCode, null);
  assert.strictEqual(nextError.statusCode, 400);
});

test('update merges partial input onto the existing trend and keeps its image', async () => {
  const store = fakeStore();
  const { call, moderationCalls } = makeHarness({ store });
  await call(_handlers.handleCreate, { body: validBody() });

  const existing = [...store.rows.values()][0];
  assert.ok(Buffer.isBuffer(existing.thumbnail));

  const { res } = await call(_handlers.handleUpdate, {
    params: { id: existing.id },
    body: { title: 'Edited' },
  });

  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.title, 'Edited');
  assert.strictEqual(res.body.data.prompt, 'Safe prompt');
  assert.strictEqual(res.body.data.category, 'Fashion');
  assert.strictEqual(res.body.data.thumbnailUrl, existing.thumbnailUrl);
  assert.strictEqual(res.body.data.thumbnail, undefined);
  assert.ok(moderationCalls.includes('Safe prompt'));

  const after = store.rows.get(existing.id);
  assert.ok(Buffer.isBuffer(after.thumbnail));
  assert.strictEqual(after.thumbnailContentType, 'image/png');
});

test('update replaces the thumbnail when a new base64 is provided', async () => {
  const store = fakeStore();
  await store.create(validBody());
  const existing = [...store.rows.values()][0];

  const { call } = makeHarness({ store });
  const { res } = await call(_handlers.handleUpdate, {
    params: { id: existing.id },
    body: { thumbnailBase64: 'data:image/webp;base64,QQ==QQ==QQ==' },
  });

  const after = store.rows.get(existing.id);
  assert.strictEqual(after.thumbnailContentType, 'image/webp');
  assert.strictEqual(after.thumbnailUrl, `/api/v1/trends/${existing.id}/image`);
  assert.ok(res.body.data.thumbnailUrl.startsWith('/api/v1/trends/'));
});

test('update returns 404 for unknown id', async () => {
  const { call } = makeHarness();
  const { res, nextError } = await call(_handlers.handleUpdate, {
    params: { id: 'nope' },
    body: { title: 'x' },
  });

  assert.strictEqual(res.statusCode, 404);
  assert.strictEqual(nextError, null);
});

test('status toggles publish state', async () => {
  const store = fakeStore();
  await store.create(validBody());
  const existing = [...store.rows.values()][0];

  const { call } = makeHarness({ store });
  const { res } = await call(_handlers.handleStatus, {
    params: { id: existing.id },
    body: { isPublished: true },
  });

  assert.strictEqual(res.body.data.isPublished, true);
  assert.strictEqual(res.body.data.thumbnail, undefined);
});

test('reorder forwards ids to the store', async () => {
  const store = fakeStore();
  await store.create(validBody());
  await store.create(validBody());
  const ids = [...store.rows.keys()].reverse();

  const { call } = makeHarness({ store });
  const { res } = await call(_handlers.handleReorder, { body: { ids } });

  assert.deepStrictEqual(res.body.data, ids.map((id, i) => ({ id, sortOrder: i + 1 })));
});

test('delete removes a trend and 404s when missing', async () => {
  const store = fakeStore();
  await store.create(validBody());
  const existing = [...store.rows.values()][0];

  const { call } = makeHarness({ store });
  const ok = await call(_handlers.handleDelete, { params: { id: existing.id } });
  assert.strictEqual(ok.res.body.data.id, existing.id);
  assert.strictEqual(store.rows.size, 0);

  const missing = await call(_handlers.handleDelete, { params: { id: 'ghost' } });
  assert.strictEqual(missing.res.statusCode, 404);
});

test('category handlers add and remove categories', async () => {
  const store = fakeStore();
  store.listCategories = async () => [{ id: 'c1', name: 'Bollywood', createdAt: '2026-01-01' }];
  store.addCategory = async (name) => ({ id: 'c2', name, createdAt: '2026-01-01' });
  store.removeCategory = async () => true;

  const { call } = makeHarness({ store });

  const list = await call(_handlers.handleAdminListCategories, {});
  assert.strictEqual(list.res.body.data[0].name, 'Bollywood');

  const added = await call(_handlers.handleAddCategory, { body: { name: 'Travel' } });
  assert.strictEqual(added.res.statusCode, 201);
  assert.strictEqual(added.res.body.data.name, 'Travel');

  const removed = await call(_handlers.handleDeleteCategory, { params: { name: 'Bollywood' } });
  assert.strictEqual(removed.res.body.data.name, 'Bollywood');
});

test('controller factories build routers', () => {
  const deps = {
    store: fakeStore(),
    checkModeration: async () => ({ flagged: false }),
  };
  const trendRouter = createAdminTrendController(deps);
  const categoryRouter = createAdminCategoryController(deps);

  assert.strictEqual(typeof trendRouter, 'function');
  assert.strictEqual(typeof categoryRouter, 'function');
});