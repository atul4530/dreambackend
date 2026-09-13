/**
 * Public (read-only) Trend Photos endpoints consumed by the DreamPics app.
 * Only published trends are ever returned.
 */

const trendStore = require('../services/trendStore');
const { toPublicTrend } = require('../services/trendModel');

async function listTrends(req, res, next) {
  try {
    const published = await trendStore.listPublished();
    res.json({ success: true, data: published.map(toPublicTrend) });
  } catch (error) {
    next(error);
  }
}

async function getTrend(req, res, next) {
  try {
    const { id } = req.params;
    const trend = await trendStore.get(id);

    if (!trend || trend.isPublished !== true) {
      return res.status(404).json({ success: false, message: 'Trend not found.' });
    }

    res.json({ success: true, data: toPublicTrend(trend) });
  } catch (error) {
    next(error);
  }
}

/**
 * Serves the trend thumbnail binary stored in MongoDB (also used by the
 * admin dashboard for draft previews, so it is not restricted to published
 * trends — thumbnails are not sensitive).
 */
async function getTrendImage(req, res, next) {
  try {
    const { id } = req.params;
    const trend = await trendStore.get(id);

    if (!trend || !trend.thumbnail) {
      return res.status(404).json({ success: false, message: 'Image not found.' });
    }

    res.set('Content-Type', trend.thumbnailContentType || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(trend.thumbnail);
  } catch (error) {
    next(error);
  }
}

/**
 * Distinct categories derived from published trends (drives the app's
 * dynamic category chips). Stored categories with no published trend are not
 * exposed to users.
 */
async function listCategories(req, res, next) {
  try {
    const published = await trendStore.listPublished();
    const seen = new Set();
    const categories = [];

    for (const trend of published) {
      const name = trend.category ? String(trend.category).trim() : '';
      const key = name.toLowerCase();
      if (name && !seen.has(key)) {
        seen.add(key);
        categories.push(name);
      }
    }

    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
}

module.exports = { listTrends, getTrend, getTrendImage, listCategories };