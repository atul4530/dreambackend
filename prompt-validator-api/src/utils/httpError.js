/**
 * Small helper that creates an Error carrying an HTTP status code.
 * The global errorHandler (middleware/errorHandler.js) already maps
 * `err.statusCode` and `err.message` into the standard response shape:
 *   { success: false, message }
 */
function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

module.exports = { httpError };