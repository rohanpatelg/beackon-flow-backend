/**
 * Tiny structured logger — no dependencies.
 * Adds ISO timestamp + level prefix, supports optional structured payloads.
 *
 * Levels (numeric): debug=10, info=20, warn=30, error=40
 * Set LOG_LEVEL env to one of: debug | info | warn | error (default: info)
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;

const configuredLevel: Level =
  (process.env.LOG_LEVEL?.toLowerCase() as Level) in LEVELS
    ? (process.env.LOG_LEVEL!.toLowerCase() as Level)
    : 'info';

const threshold = LEVELS[configuredLevel];

const fmt = (level: Level, msg: string, meta?: unknown): string => {
  const ts = new Date().toISOString();
  const base = `[${ts}] ${level.toUpperCase().padEnd(5)} ${msg}`;
  if (meta === undefined) return base;
  try {
    return `${base} ${typeof meta === 'string' ? meta : JSON.stringify(meta)}`;
  } catch {
    return `${base} [unserializable meta]`;
  }
};

const emit = (level: Level, msg: string, meta?: unknown) => {
  if (LEVELS[level] < threshold) return;
  const line = fmt(level, msg, meta);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
};

export const log = {
  debug: (msg: string, meta?: unknown) => emit('debug', msg, meta),
  info: (msg: string, meta?: unknown) => emit('info', msg, meta),
  warn: (msg: string, meta?: unknown) => emit('warn', msg, meta),
  error: (msg: string, meta?: unknown) => emit('error', msg, meta),
};

/**
 * Mask a connection string / URL so secrets don't end up in logs.
 *   postgres://user:pass@host:5432/db  →  postgres://user:***@host:5432/db
 *   https://abc.ngrok-free.app         →  https://abc.ngrok-free.app (unchanged)
 */
export const maskUrl = (raw: string | undefined): string => {
  if (!raw) return '(unset)';
  try {
    const u = new URL(raw);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return '(invalid url)';
  }
};

/** Mask any API key for safe display: keep prefix + last 4. */
export const maskKey = (key: string | undefined): string => {
  if (!key) return '(unset)';
  if (key.length <= 10) return '***';
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
};
