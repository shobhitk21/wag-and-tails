/* Applies every .sql file in migrations/ in filename order, once each.
   `npm run migrate -w backend -- --fresh` drops the public schema first. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, 'migrations');

async function run() {
  const fresh = process.argv.includes('--fresh');

  if (fresh) {
    console.log('[migrate] --fresh: dropping public schema');
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await pool.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`[migrate] skip ${file} (already applied)`);
      continue;
    }
    const sql = await fs.readFile(path.join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`[migrate] applied ${file}`);
      ran += 1;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[migrate] FAILED ${file}\n${err.message}`);
      throw err;
    } finally {
      client.release();
    }
  }

  const { rows: tables } = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1"
  );
  console.log(`[migrate] done — ${ran} applied, ${tables.length} tables present`);
}

run()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(err.message);
    await pool.end();
    process.exit(1);
  });
