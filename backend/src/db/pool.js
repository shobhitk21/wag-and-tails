import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';

/* Resolve .env next to the backend package, not the process cwd, so the
   migrate/seed scripts work no matter where they are launched from. */
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env') });

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to backend/.env.');
  process.exit(1);
}

/* Neon pooled endpoint. It terminates TLS itself, so verification is left off
   the way every Neon example does it; the sslmode=require in the URL still
   forces an encrypted connection. */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000
});

pool.on('error', (err) => console.error('[db] idle client error', err));

export const query = (text, params) => pool.query(text, params);

/* Single row or null — the shape most detail endpoints want. */
export const one = async (text, params) => {
  const { rows } = await pool.query(text, params);
  return rows[0] ?? null;
};

/* All rows. */
export const many = async (text, params) => {
  const { rows } = await pool.query(text, params);
  return rows;
};

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
