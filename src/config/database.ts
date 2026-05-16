import { Pool } from 'pg';
import dotenv from 'dotenv';
import { log, maskUrl } from '../utils/logger';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
const nodeEnv = process.env.NODE_ENV || 'development';

log.info('Database config loaded', {
  url: maskUrl(databaseUrl),
  env: nodeEnv,
});

if (!databaseUrl) {
  log.error('DATABASE_URL is not set — every query will fail');
}

// Single connection pool for the entire application
export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
});

// One-shot connectivity check at startup
log.info('Database connecting…');
pool.query('SELECT NOW() AS now', (err: any, res: any) => {
  if (err) {
    log.error('Database connection FAILED', { message: err.message, code: err.code });
  } else {
    log.info('Database connected', { serverTime: res.rows[0].now });
  }
});

// Pool-level events. Per-connection 'connect' fires often — keep it at debug.
pool.on('connect', () => log.debug('Pool: connection checked out'));
pool.on('error', (err: any) => {
  log.error('Pool error (idle client)', { message: err.message, code: err.code });
});

/**
 * Execute a transaction with the provided callback.
 */
export async function executeTransaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error: any) {
    await client.query('ROLLBACK');
    log.error('Transaction rolled back', { message: error?.message });
    throw error;
  } finally {
    client.release();
  }
}
