/**
 * Private-admin Trend Photos endpoints (create/edit/delete/publish/reorder).
 *
 * Security: every route in this controller is mounted behind
 * `middleware/adminAuth.js` (X-Admin-Key header). No user-facing read path is
 * wired through it.
 *
 * The admin prompt is validated with the SAME moderation implementation used
 * by the existing `POST /api/v1/prompts/validate` endpoint, i.e.
 * `services/moderation.service.checkModeration` → OpenAI Moderation API.
 * A flagged prompt is never saved.
 */

const crypto = require('crypto');
const express = require('express');
const { Router } = express;

const { httpError } = require('../utils/httpError');
const { parseBase64DataUrl } = require('../utils/base64Image');
const { normalizeTrendInput, sortTrends } = require('../services/trendModel');
const {
  validateRequest,
  createTrendSchema,
  updateTrendSchema,
  statusSchema,
  reorderSchema,
  categorySchema,
} = require('../middleware/validateTrendRequest');

// Defaults are resolved lazily so the module can be imported (and unit-tested)
// without requiring MongoDB or an OpenAI API key.
function buildContext(deps = {}) {
  return {
    store:
      deps.store ||
      require('../services/trendStore'),
    checkModeration:
      deps.checkModeration ||
      (() => {
        return require('../services/moderation.service').checkModeration;
      })(),
  };
}

/** @returns {Error} 400 error with validation-style shape. */
function validationError(...messages) {
  const error = httpError(400, 'Validation failed');
  error.errors = messages;
  return error;
}

async function assertPromptSafe(checkModeration, prompt) {
  const trimmed = prompt ? String(prompt).trim() : '';
  if (!trimmed) return;

  const result = await checkModeration(trimmed);
  if (!result || result.flagged) {
    throw validationError('Prompt violates safety policy.');
  }
}

/**
 * Attaches the thumbnhal fields to a normalized trend.
 *
 * - thumbnailBase64 (admin upload) → stored as a MongoDB binary and served
 *   from `GET /api/v1/trends/:id/image`.
 * - thumbnailUrl (external link) → stored as-is, no binary kept.
 * - neither → carries the existing trend's binary + URL over (partial update).
 *
 * Note: `thumbnail` is a Buffer and must be stripped before any JSON response
 * is sent (see `stripBinary`).
 */
function applyThumbnail(trend, input, id, existing) {
  if (input.thumbnailBase64) {
    const { buffer, mime } = parseBase64DataUrl(input.thumbnailBase64);
    trend.thumbnail = buffer;
    trend.thumbnailContentType = mime;
    trend.thumbnailUrl = `/api/v1/trends/${id}/image`;
  } else if (input.thumbnailUrl) {
    trend.thumbnailUrl = String(input.thumbnailUrl).trim();
    delete trend.thumbnail;
    delete trend.thumbnailContentType;
  } else if (existing) {
    trend.thumbnail = existing.thumbnail;
    trend.thumbnailContentType = existing.thumbnailContentType;
  }
}

/** Drops binary image data before trend objects are written to a response. */
function stripBinary(trend) {
  if (!trend) return trend;
  const { thumbnail, ...rest } = trend;
  return rest;
}

// ── Handlers ─────────────────────────────────────────────────────────

async function handleList(ctx, _req, res, next) {
  try {
    const all = await ctx.store.listAll();
    res.json({ success: true, data: sortTrends(all).map(stripBinary) });
  } catch (error) {
    next(error);
  }
}

async function handleCreate(ctx, req, res, next) {
  try {
    const input = req.body || {};

    if (!input.thumbnailBase64 && !input.thumbnailUrl) {
      throw validationError('Preview image is required.');
    }

    const id = crypto.randomUUID();
    const all = await ctx.store.listAll();
    const nextSortOrder =
      all.reduce((max, t) => Math.max(max, Number.isFinite(t.sortOrder) ? t.sortOrder : 0), 0) + 1;

    const { trend, errors } = normalizeTrendInput({ ...input, id }, { nextSortOrder });
    if (errors && errors.length > 0) throw validationError(...errors);

    // Existing prompt-validation API (OpenAI moderation) — no bypass.
    await assertPromptSafe(ctx.checkModeration, trend.prompt);
    await assertPromptSafe(ctx.checkModeration, trend.negativePrompt);

    applyThumbnail(trend, input, id, null);

    const created = await ctx.store.create(trend);
    res.status(201).json({ success: true, data: stripBinary(created) });
  } catch (error) {
    next(error);
  }
}

async function handleUpdate(ctx, req, res, next) {
  try {
    const { id } = req.params;
    const existing = await ctx.store.get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Trend not found.' });
    }

    const input = req.body || {};

    const { trend, errors } = normalizeTrendInput(input, { existing });
    if (errors && errors.length > 0) throw validationError(...errors);

    // Validate any prompt change with the existing moderation implementation.
    await assertPromptSafe(ctx.checkModeration, trend.prompt);
    await assertPromptSafe(ctx.checkModeration, trend.negativePrompt);

    applyThumbnail(trend, input, id, existing);

    const updated = await ctx.store.update(id, trend);
    res.json({ success: true, data: stripBinary(updated) });
  } catch (error) {
    next(error);
  }
}

async function handleStatus(ctx, req, res, next) {
  try {
    const { id } = req.params;
    const published = Boolean(req.body && req.body.isPublished);

    const updated = await ctx.store.setStatus(id, published);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Trend not found.' });
    }

    res.json({ success: true, data: stripBinary(updated) });
  } catch (error) {
    next(error);
  }
}

async function handleReorder(ctx, req, res, next) {
  try {
    const ordered = await ctx.store.reorderTrends((req.body && req.body.ids) || []);
    res.json({ success: true, data: ordered });
  } catch (error) {
    next(error);
  }
}

async function handleDelete(ctx, req, res, next) {
  try {
    const { id } = req.params;
    const removed = await ctx.store.remove(id);
    if (!removed) {
      return res.status(404).json({ success: false, message: 'Trend not found.' });
    }
    res.json({ success: true, data: { id } });
  } catch (error) {
    next(error);
  }
}

// ── Categories ───────────────────────────────────────────────────────

async function handleAdminListCategories(ctx, _req, res, next) {
  try {
    const categories = await ctx.store.listCategories();
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
}

async function handleAddCategory(ctx, req, res, next) {
  try {
    const category = await ctx.store.addCategory(req.body.name);
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
}

async function handleDeleteCategory(ctx, req, res, next) {
  try {
    const name = req.params.name;
    await ctx.store.removeCategory(name);
    res.json({ success: true, data: { name } });
  } catch (error) {
    next(error);
  }
}

// ── Router factory (DI-friendly for tests) ───────────────────────────

function createAdminTrendController(deps = {}) {
  const ctx = buildContext(deps);
  const wrap = (handler) => (req, res, next) => handler(ctx, req, res, next);

  const router = Router();

  router.get('/', wrap(handleList));
  router.post('/', validateRequest(createTrendSchema), wrap(handleCreate));
  router.put('/:id', validateRequest(updateTrendSchema), wrap(handleUpdate));
  router.patch('/:id/status', validateRequest(statusSchema), wrap(handleStatus));
  router.patch('/reorder', validateRequest(reorderSchema), wrap(handleReorder));
  router.delete('/:id', wrap(handleDelete));

  return router;
}

function createAdminCategoryController(deps = {}) {
  const ctx = buildContext(deps);
  const wrap = (handler) => (req, res, next) => handler(ctx, req, res, next);

  const router = Router();
  router.get('/', wrap(handleAdminListCategories));
  router.post('/', validateRequest(categorySchema), wrap(handleAddCategory));
  router.delete('/:name', wrap(handleDeleteCategory));

  return router;
}

module.exports = {
  buildContext,
  createAdminTrendController,
  createAdminCategoryController,
  // Exported for unit tests
  _handlers: {
    handleList,
    handleCreate,
    handleUpdate,
    handleStatus,
    handleReorder,
    handleDelete,
    handleAdminListCategories,
    handleAddCategory,
    handleDeleteCategory,
  },
};