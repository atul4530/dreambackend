/**
 * Trend Photos data store backed by MongoDB (official driver).
 *
 * The whole feature runs on MongoDB alone: trends, categories, AND thumbnail
 * binaries live in the database (an Atlas free tier is fine). MongoDB is
 * connected lazily so the rest of the app boots regardless; if `MONGODB_URI`
 * is missing, every store method throws a 503 so trend endpoints respond
 * with a clear message instead of crashing the server.
 */

const crypto = require('crypto');
const { httpError } = require('../utils/httpError');
const { sortTrends, isPublished, nowIso } = require('./trendModel');
const logger = require('../utils/logger');

const STORE_PATH = 'trend_prompts';
const CATEGORIES_PATH = 'trend_categories';

const DEFAULT_CATEGORIES = [
  'Trending',
  'Bollywood',
  'Couple',
  'Wedding',
  'Luxury',
  'Travel',
  'Fashion',
  'Traditional',
  'Professional',
  'Festival',
  'Cinematic',
];

const DB_NAME = process.env.MONGODB_DB || 'dreampics';

let _client = null;
let _db = null;

function isConfigured() {
  return Boolean(process.env.MONGODB_URI);
}

async function init() {
  if (_client) return _client;

  if (!isConfigured()) {
    throw httpError(
      503,
      'Trend store is not configured. Set MONGODB_URI in the environment.'
    );
  }

  try {
    const { MongoClient } = require('mongodb');
    _client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    await _client.connect();
    _db = _client.db(DB_NAME);
    logger.info('Trend store initialized (MongoDB)');
  } catch (error) {
    if (error.statusCode) throw error;
    throw httpError(503, `Failed to connect to MongoDB: ${error.message}`);
  }

  return _client;
}

async function db() {
  await init();
  return _db;
}

function docToTrend(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { ...rest, id: String(_id) };
}

function docToCategory(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { ...rest, id: String(_id) };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Trends ──────────────────────────────────────────────────────────

async function listAll() {
  const docs = await (await db()).collection(STORE_PATH).find().toArray();
  return docs.map(docToTrend);
}

async function listPublished() {
  const all = await listAll();
  return sortTrends(all.filter((t) => isPublished(t)));
}

async function get(id) {
  const doc = await (await db()).collection(STORE_PATH).findOne({ _id: id });
  return docToTrend(doc);
}

/**
 * Creates a trend. `trend.id` (uuid) is used as the `_id`.
 * @param {object} trend
 */
async function create(trend) {
  const doc = { ...trend, _id: trend.id, createdAt: trend.createdAt, updatedAt: trend.updatedAt };
  await (await db()).collection(STORE_PATH).insertOne(doc);
  return docToTrend(doc);
}

/**
 * Replaces a trend wholesale (fields missing from `trend` are dropped).
 * @returns {Promise<object|null>} The stored trend, or null if unknown id.
 */
async function update(id, trend) {
  const result = await (await db())
    .collection(STORE_PATH)
    .replaceOne({ _id: id }, { ...trend, updatedAt: nowIso() });
  if (result.matchedCount === 0) return null;
  return get(id);
}

async function remove(id) {
  const result = await (await db()).collection(STORE_PATH).deleteOne({ _id: id });
  return result.deletedCount > 0;
}

async function setStatus(id, published) {
  const result = await (await db())
    .collection(STORE_PATH)
    .updateOne({ _id: id }, { $set: { isPublished: Boolean(published), updatedAt: nowIso() } });
  if (result.matchedCount === 0) return null;
  return get(id);
}

/**
 * Reassigns sortOrder from an ordered list of trend ids (index + 1).
 * @param {string[]} ids
 * @returns {Promise<Array<{id: string, sortOrder: number}>>}
 */
async function reorderTrends(ids) {
  const all = await listAll();
  const map = new Map(all.map((t) => [t.id, t]));
  const ops = [];

  ids.forEach((id, index) => {
    if (!map.has(id)) throw httpError(400, `Trend not found for id: ${id}`);
    ops.push({
      updateOne: {
        filter: { _id: id },
        update: { $set: { sortOrder: index + 1, updatedAt: nowIso() } },
      },
    });
  });

  if (ops.length > 0) {
    await (await db()).collection(STORE_PATH).bulkWrite(ops);
  }

  return ids.map((id, index) => ({ id, sortOrder: index + 1 }));
}

// ── Categories ──────────────────────────────────────────────────────

async function listCategories() {
  const docs = await (await db()).collection(CATEGORIES_PATH).find().toArray();
  return docs.map(docToCategory);
}

async function addCategory(name) {
  const clean = String(name).trim();
  if (!clean) throw httpError(400, 'Category name is required.');

  const coll = (await db()).collection(CATEGORIES_PATH);
  const existing = await coll.findOne({ name: { $regex: `^${escapeRegex(clean)}$`, $options: 'i' } });
  if (existing) return docToCategory(existing);

  const entry = { _id: crypto.randomUUID(), name: clean, createdAt: nowIso() };
  await coll.insertOne(entry);
  return docToCategory(entry);
}

async function removeCategory(name) {
  const clean = String(name).trim();
  const all = await listCategories();
  const match = all.find((c) => c.name.toLowerCase() === clean.toLowerCase());
  if (!match) throw httpError(404, 'Category not found.');

  await (await db()).collection(CATEGORIES_PATH).deleteOne({ _id: match.id });
  return true;
}

async function seedCategoriesIfNeeded() {
  if (!isConfigured()) return;
  try {
    const coll = (await db()).collection(CATEGORIES_PATH);
    const count = await coll.countDocuments();
    if (count > 0) return;
    await coll.insertMany(
      DEFAULT_CATEGORIES.map((name) => ({ _id: crypto.randomUUID(), name, createdAt: nowIso() }))
    );
    logger.info('Seeded default Trend categories');
  } catch (error) {
    logger.warn('Failed to seed Trend categories', { error: error.message });
  }
}

module.exports = {
  isConfigured,
  init,
  STORE_PATH,
  CATEGORIES_PATH,
  DEFAULT_CATEGORIES,
  listAll,
  listPublished,
  get,
  create,
  update,
  remove,
  setStatus,
  reorderTrends,
  listCategories,
  addCategory,
  removeCategory,
  seedCategoriesIfNeeded,
  async close() {
    if (_client) await _client.close();
    _client = null;
    _db = null;
  },
};