import { ErrorRequestHandler, RequestHandler } from 'express';
import { log } from '../utils/logger';

/**
 * 404 handler — register AFTER all routes. Returns the same {success,message}
 * envelope every other endpoint uses, so the mobile app can treat it uniformly.
 */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
};

/**
 * Global error handler — catches anything thrown (or passed to next(err))
 * by route handlers, including async errors when wrapped properly.
 *
 * Register LAST (after notFoundHandler) so it's the final layer.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // Express may pass non-Error values; normalize.
  const message = err?.message ?? String(err);
  const status = typeof err?.status === 'number' ? err.status : 500;

  log.error(`Unhandled error on ${req.method} ${req.originalUrl}`, {
    message,
    stack: err?.stack,
    status,
  });

  if (res.headersSent) return; // can't respond if streaming already started
  res.status(status).json({
    success: false,
    message: status >= 500 ? 'Internal server error' : message,
  });
};
