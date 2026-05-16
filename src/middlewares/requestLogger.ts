import { RequestHandler } from 'express';
import { log } from '../utils/logger';

/**
 * Log every HTTP request once it completes (or the client disconnects).
 *   →  METHOD path                  (on receipt, debug)
 *   ←  METHOD path STATUS — Xms     (on finish, info/warn/error by status)
 *
 * Device ID is included when present so you can correlate logs to a user.
 */
export const requestLogger: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();
  const { method, originalUrl } = req;

  log.debug(`→ ${method} ${originalUrl}`);

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
    const status = res.statusCode;
    const deviceId = req.headers['x-device-id'];
    const meta: Record<string, unknown> = { ms: Math.round(ms) };
    if (deviceId) meta.device = String(deviceId).slice(0, 8);

    const line = `← ${method} ${originalUrl} ${status}`;
    if (status >= 500) log.error(line, meta);
    else if (status >= 400) log.warn(line, meta);
    else log.info(line, meta);
  });

  next();
};
