import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const databaseUrl = process.env.DATABASE_URL;
console.log(databaseUrl);
console.log(process.env.NODE_ENV);
// Create a single connection pool for the entire application
export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false
});

// Test the connection and log the result
pool.query('SELECT NOW()', (err: any, res: any) => { 
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully at:', res.rows[0].now);
  }
});

// Log pool events
pool.on('connect', () => {
  console.log("PostgreSQL pool connection established");
});

pool.on('error', (err: any) => {
  console.error('PostgreSQL pool error:', err);
});

/**
 * Execute a transaction with the provided callback
 */
export async function executeTransaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transaction error:', error);
    throw error;
  } finally {
    client.release();
  }
} 