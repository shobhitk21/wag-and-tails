/* Removes rows a smoke run created, so the suite can be run twice in a row
   without the second run tripping over the first one's data. Goes straight to
   the database because the console has no delete endpoints — deleting a
   product someone has ordered is not an operation the product should offer. */
import { pool } from '../src/db/pool.js';

const ALLOWED = new Set(['products', 'packages', 'coupons', 'service_areas']);

export async function cleanupRows(rows) {
  for (const [table, id] of rows) {
    if (!ALLOWED.has(table)) continue;
    try {
      await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    } catch {
      /* Left behind on purpose if something references it — better a stray
         test row than a failed cleanup masking the real result. */
    }
  }
  await pool.end();
}

/* Deletes rows a browser run created, matched on a natural key rather than an
   id — the console never shows ids, so a UI-driven test does not learn them.
   Table and column are checked against a fixed list because they cannot be
   parameterised in SQL, and the value always is. */
const NAMED = {
  coupons: ['code'],
  packages: ['name'],
  products: ['name'],
  service_areas: ['name'],
  staff_users: ['email']
};

export async function cleanupByName(rows) {
  let removed = 0;
  for (const [table, column, value] of rows) {
    if (!NAMED[table]?.includes(column)) continue;
    try {
      /* Inclusions and any other child rows go with the parent via
         ON DELETE CASCADE, so one delete per row is enough. */
      const res = await pool.query(`DELETE FROM ${table} WHERE ${column} = $1`, [value]);
      removed += res.rowCount;
    } catch {
      /* A row a booking or an order now references cannot be deleted, and
         should not be: better a stray test row than a cascade through real
         data. It shows up as a lower count rather than a thrown error. */
    }
  }
  await pool.end();
  return removed;
}
