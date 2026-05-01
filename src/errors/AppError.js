/**
 * Custom error class that extends Error with an HTTP status code.
 * Used throughout the app to distinguish operational errors (known,
 * expected issues like 404/400) from programming errors.
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // marks this as a known, handled error
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
