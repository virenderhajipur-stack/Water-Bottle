import ApiError from '../utils/ApiError.js';

export function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(err, req, res, _next) {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong. Please try again.';
  let details = err.details;

  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join('. ');
  } else if (err.code === 11000) {
    status = 400;
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    message = `Duplicate value for ${field}. Please use a different value.`;
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid identifier provided.';
  }

  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json({ success: false, message, details });
}