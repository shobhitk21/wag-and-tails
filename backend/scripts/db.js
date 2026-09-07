/* A small database browser for this project.

   There is no `db:studio` here because that is a Prisma command and this
   backend talks to Postgres through `pg` directly. Rather than pull in an ORM
   for the sake of its viewer, this does the three things a viewer is actually
   for — what tables exist, what is in one, and what does this query return —
   against the same pool the API uses, so it reads the same database with the
   same credentials and needs no extra setup.

     npm run db -w backend                     every table with its row count
     npm run db -w backend -- bookings         the first rows of one table
     npm run db -w backend -- bookings 50      ...with a row limit
     npm run db -w backend -- --schema pets    a table's columns and indexes
     npm run db -w backend -- --sql "SELECT ..."   any read-only query

   For a full GUI, the Neon console at console.neon.tech has a Tables browser
   and a SQL editor over this same database. */
import { pool } from '../src/db/pool.js';

const argv = process.argv.slice(2);

/* Column widths are measured, then values are clipped to them: a care note or
   a description is longer than a terminal is wide, and one long cell wrapping
   makes every row after it unreadable. */
function table(rows, { maxWidth = 38 } = {}) {
  if (!rows.length) return '  (no rows)';

  const columns = Object.keys(rows[0]);
  const show = (v) => {
    if (v === null || v === undefined) return '·';
    if (v instanceof Date) return v.toISOString().slice(0, 19).replace('T', ' ');
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v).replace(/\s+/g, ' ');
  };

  const clip = (s) => (s.length > maxWidth ? `${s.slice(0, maxWidth - 1)}…` : s);
  const widths = columns.map((c) =>
    Math.min(maxWidth, Math.max(c.length, ...rows.map((r) => show(r[c]).length))));

  const line = (cells) =>
    '  ' + cells.map((cell, i) => clip(cell).padEnd(widths[i])).join('  ');

  return [
    line(columns),
    '  ' + widths.map((w) => '─'.repeat(w)).join('  '),
    ...rows.map((r) => line(columns.map((c) => show(r[c]))))
  ].join('\n');
}

/* Every table with a live row count. count(*) rather than the planner's
   estimate in pg_class: the estimate is stale until something analyses, and
   reading "0 rows" on a table you just seeded is exactly the confusion this
   is meant to clear up. */
async function listTables() {
  const { rows: names } = await pool.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' ORDER BY tablename
  `);
  if (!names.length) {
    console.log('\nNo tables yet. Run:  npm run migrate -w backend\n');
    return;
  }

  const counts = await Promise.all(names.map(async ({ tablename }) => {
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM "${tablename}"`);
    return { table: tablename, rows: rows[0].n };
  }));

  const total = counts.reduce((sum, c) => sum + c.rows, 0);
  console.log(`\n${counts.length} tables, ${total.toLocaleString('en-IN')} rows\n`);
  console.log(table(counts));
  console.log(`\n  npm run db -w backend -- <table>          show rows`);
  console.log(`  npm run db -w backend -- --schema <table>  show columns\n`);
}

/* Table and column names cannot be bound as parameters, so the name is looked
   up in the catalogue first and the real one from that row is what gets
   quoted into the query — never the string the caller typed. */
async function realTableName(name) {
  const { rows } = await pool.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = $1`,
    [name]
  );
  if (rows.length) return rows[0].tablename;

  const { rows: near } = await pool.query(
    `SELECT tablename FROM pg_tables
     WHERE schemaname = 'public' AND tablename ILIKE $1 ORDER BY tablename LIMIT 5`,
    [`%${name}%`]
  );
  const hint = near.length ? `\n  Did you mean: ${near.map((r) => r.tablename).join(', ')}` : '';
  throw new Error(`No table called "${name}".${hint}`);
}

async function showTable(name, limit) {
  const real = await realTableName(name);
  const { rows: countRows } = await pool.query(`SELECT count(*)::int AS n FROM "${real}"`);
  const total = countRows[0].n;

  const { rows } = await pool.query(`SELECT * FROM "${real}" LIMIT ${Number(limit) || 20}`);
  console.log(`\n${real} — ${total} row${total === 1 ? '' : 's'}, showing ${rows.length}\n`);
  console.log(table(rows));
  console.log();
}

async function showSchema(name) {
  const real = await realTableName(name);

  const { rows: columns } = await pool.query(`
    SELECT column_name AS column, data_type AS type,
           is_nullable AS nullable, column_default AS default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `, [real]);

  const { rows: indexes } = await pool.query(
    `SELECT indexname AS index, indexdef AS definition FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = $1 ORDER BY indexname`,
    [real]
  );

  console.log(`\n${real} — columns\n`);
  console.log(table(columns, { maxWidth: 46 }));
  if (indexes.length) {
    console.log(`\n${real} — indexes\n`);
    console.log(table(indexes, { maxWidth: 70 }));
  }
  console.log();
}

/* Reads only. This is a viewer, and one careless UPDATE typed into it with no
   WHERE clause is exactly the accident a viewer should not make possible —
   migrations and seeds are where writes belong, because those are reviewable
   and repeatable. */
const WRITE = /^\s*(insert|update|delete|drop|truncate|alter|create|grant|revoke)\b/i;

async function runSql(sql) {
  if (WRITE.test(sql)) {
    throw new Error(
      'This is a read-only viewer — it runs SELECT and WITH only.\n'
      + '  To change the schema, add a migration in backend/src/db/migrations/.\n'
      + '  To change data, edit backend/src/db/seed-data.js and re-seed.'
    );
  }
  const { rows, rowCount } = await pool.query(sql);
  console.log(`\n${rowCount} row${rowCount === 1 ? '' : 's'}\n`);
  console.log(table(rows, { maxWidth: 46 }));
  console.log();
}

async function main() {
  if (argv[0] === '--sql') {
    const sql = argv.slice(1).join(' ');
    if (!sql.trim()) throw new Error('Give a query:  npm run db -w backend -- --sql "SELECT 1"');
    return runSql(sql);
  }
  if (argv[0] === '--schema') {
    if (!argv[1]) throw new Error('Give a table:  npm run db -w backend -- --schema pets');
    return showSchema(argv[1]);
  }
  if (argv[0] && !argv[0].startsWith('--')) return showTable(argv[0], argv[1]);
  return listTables();
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(`\n${err.message}\n`);
    await pool.end();
    process.exit(1);
  });
