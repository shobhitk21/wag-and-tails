/* Wrap an async handler so a rejected promise reaches the error middleware
   instead of hanging the request. */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function notFound(_req, res) {
  res.status(404).json({ error: 'No such endpoint.' });
}

export function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  if (status >= 500) console.error('[api]', err);
  res.status(status).json({
    error: status >= 500 ? 'Something went wrong on our end.' : err.message,
    ...(err.details ? { details: err.details } : {})
  });
}

export function httpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}
