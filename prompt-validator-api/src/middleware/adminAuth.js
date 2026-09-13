/**
 * Private-admin authorization middleware.
 *
 * The existing backend has no authentication system, so admin operations are
 * protected with a shared secret API key (`ADMIN_API_KEY`) sent by the private
 * dashboard in the `X-Admin-Key` header. Comparison is constant-time.
 *
 * Regular users never hold this key; the public trend read endpoints do not
 * run this middleware.
 */

const crypto = require('crypto');

function adminAuth(req, res, next) {
  const expected = process.env.ADMIN_API_KEY;

  if (!expected) {
    return res.status(503).json({
      success: false,
      message: 'ADMIN_API_KEY is not configured on the server.',
    });
  }

  const provided = req.headers['x-admin-key'];

  if (!provided) {
    return res.status(401).json({
      success: false,
      message: 'Administrator authorization required.',
    });
  }

  const providedBuffer = Buffer.from(String(provided));
  const expectedBuffer = Buffer.from(expected);

  const authorized =
    providedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, expectedBuffer);

  if (!authorized) {
    return res.status(401).json({
      success: false,
      message: 'Invalid administrator credentials.',
    });
  }

  next();
}

module.exports = adminAuth;