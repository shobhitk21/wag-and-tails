import { Router } from 'express';
import { z } from 'zod';
import { many, one } from '../../db/pool.js';
import { asyncHandler, httpError } from '../../middleware/error.js';
import { validate } from '../../middleware/validate.js';
import { requireAdmin } from '../../middleware/webAuth.js';
import { revokeAllForSubject } from '../../utils/tokens.js';
import { inr } from '../../utils/money.js';

const router = Router();

/* Everything in the admin console is super-admin work. */
router.use(requireAdmin);

const metricsFor = (group) =>
  many(
    'SELECT key, label, value, delta, positive FROM metrics WHERE group_name = $1 ORDER BY sort',
    [group]
  );

/* GET /api/admin/dashboard
   KPI tiles and the two charts are the reporting snapshot (the prototype's
   612 bookings and ₹8,42,300 have no rows behind them yet). Everything in
   "Needs your attention" and the latest-bookings table is counted live. */
router.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const kpis = await metricsFor('dashboard');
    const revenue = await many(
      'SELECT month_label, value_thousands, is_current FROM monthly_revenue ORDER BY sort'
    );
    const channels = await many(
      'SELECT label, percentage, colour FROM channel_split ORDER BY sort'
    );
    const donutTotal = await one("SELECT value FROM metrics WHERE key = 'donut_total'");

    const [attention] = await many(`
      SELECT
        (SELECT count(*) FROM partners WHERE status = 'Pending')::int          AS pending_partners,
        (SELECT count(*) FROM partner_documents WHERE verified = FALSE)::int   AS expiring_docs,
        (SELECT COALESCE(sum(pending_payout), 0) FROM partners)::int           AS payout_total,
        (SELECT count(DISTINCT kind) FROM partners WHERE pending_payout > 0)::int AS payout_batches
    `);

    const topPackages = await many(`
      SELECT p.name, count(b.id)::int AS booked
      FROM packages p
      LEFT JOIN bookings b ON b.package_id = p.id
      GROUP BY p.id, p.name, p.sort
      ORDER BY booked DESC, p.price DESC
      LIMIT 5
    `);

    const bestsellers = await many(`
      SELECT id, name, art, tone, reviews, tag FROM products
      WHERE tag IS NOT NULL ORDER BY reviews DESC LIMIT 4
    `);

    const latest = await many(`
      SELECT id, customer_name, service_label, scheduled_label, partner_name,
             channel, total, status
      FROM bookings ORDER BY created_at DESC, id DESC LIMIT 5
    `);

    res.json({
      kpis,
      revenue,
      channels,
      donutTotal: donutTotal?.value ?? null,
      attention: {
        pendingPartners: attention.pending_partners,
        expiringDocs: attention.expiring_docs,
        payoutTotal: attention.payout_total,
        payoutTotalLabel: inr(attention.payout_total),
        payoutBatches: attention.payout_batches
      },
      topPackages,
      bestsellers,
      latest
    });
  })
);

/* GET /api/admin/reports */
router.get(
  '/reports',
  asyncHandler(async (_req, res) => {
    const kpis = await metricsFor('reports');
    const revenue = await many(
      'SELECT month_label, value_thousands, is_current FROM monthly_revenue ORDER BY sort'
    );
    const lines = await many('SELECT line, revenue, share, growth FROM revenue_lines ORDER BY sort');
    const channels = await many('SELECT label, percentage, colour FROM channel_split ORDER BY sort');
    const donutTotal = await one("SELECT value FROM metrics WHERE key = 'donut_total'");

    /* The Bookings and Partners tabs report on real rows. */
    const byStatus = await many(`
      SELECT status, count(*)::int AS n, COALESCE(sum(total), 0)::int AS revenue
      FROM bookings GROUP BY status ORDER BY n DESC
    `);
    const byChannel = await many(`
      SELECT channel, count(*)::int AS n, COALESCE(sum(total), 0)::int AS revenue
      FROM bookings GROUP BY channel ORDER BY n DESC
    `);
    const byPartner = await many(`
      SELECT p.name, p.kind, p.rating, count(b.id)::int AS bookings,
             COALESCE(sum(b.total), 0)::int AS revenue
      FROM partners p
      LEFT JOIN bookings b ON b.partner_id = p.id
      GROUP BY p.id, p.name, p.kind, p.rating ORDER BY revenue DESC
    `);
    const byProduct = await many(`
      SELECT p.name, COALESCE(sum(i.qty), 0)::int AS units,
             COALESCE(sum(i.qty * i.unit_price), 0)::int AS revenue
      FROM products p
      LEFT JOIN store_order_items i ON i.product_id = p.id
      GROUP BY p.id, p.name HAVING COALESCE(sum(i.qty), 0) > 0
      ORDER BY revenue DESC LIMIT 10
    `);

    res.json({
      kpis, revenue, lines, channels,
      donutTotal: donutTotal?.value ?? null,
      byStatus, byChannel, byPartner, byProduct
    });
  })
);

/* GET /api/admin/payouts — batches, fees and nets all computed from the
   commission rates in settings. */
router.get(
  '/payouts',
  asyncHandler(async (_req, res) => {
    const [fees] = await many(`
      SELECT
        COALESCE(max(value) FILTER (WHERE key = 'groomer_fee'), '15%') AS groomer_fee,
        COALESCE(max(value) FILTER (WHERE key = 'walker_fee'),  '12%') AS walker_fee
      FROM settings
    `);
    const groomerFee = parseFloat(fees.groomer_fee) / 100;
    const walkerFee = parseFloat(fees.walker_fee) / 100;

    const rows = await many(`
      SELECT id, name, kind, pending_payout, payout_account
      FROM partners WHERE pending_payout > 0 ORDER BY id
    `);

    const build = (kind, feeRate, perJob) =>
      rows
        .filter((p) => p.kind === kind)
        .map((p) => ({
          id: p.id,
          name: p.name,
          jobs: Math.round(p.pending_payout / perJob),
          gross: p.pending_payout,
          fee: Math.round(p.pending_payout * feeRate),
          net: Math.round(p.pending_payout * (1 - feeRate)),
          account: p.payout_account,
          status: 'Due'
        }));

    const groomers = build('Groomer', groomerFee, 1200);
    const walkers = build('Walker', walkerFee, 250);
    const total = rows.reduce((s, p) => s + p.pending_payout, 0);
    const snapshot = await metricsFor('payouts');

    res.json({
      total,
      totalLabel: inr(total),
      batches: [
        { kind: 'Groomers', schedule: 'weekly batch, Monday 10 Aug', feeLabel: fees.groomer_fee, jobsLabel: 'Jobs', rows: groomers },
        { kind: 'Walkers', schedule: 'daily batch, tonight 11:00 pm', feeLabel: fees.walker_fee, jobsLabel: 'Walks', rows: walkers }
      ],
      snapshot
    });
  })
);

/* POST /api/admin/payouts/release — clears a batch. */
router.post(
  '/payouts/release',
  validate(z.object({ kind: z.enum(['Groomer', 'Walker', 'all']) })),
  asyncHandler(async (req, res) => {
    const released = await many(
      req.body.kind === 'all'
        ? `UPDATE partners SET pending_payout = 0 WHERE pending_payout > 0 RETURNING id, name, pending_payout`
        : `UPDATE partners SET pending_payout = 0 WHERE kind = $1 AND pending_payout > 0
           RETURNING id, name, pending_payout`,
      req.body.kind === 'all' ? [] : [req.body.kind]
    );
    res.json({ released: released.length });
  })
);

/* GET /api/admin/staff */
router.get(
  '/staff',
  asyncHandler(async (_req, res) => {
    const staff = await many(`
      SELECT s.code, s.name, s.email, s.role, s.shift, s.active, s.handled_today,
             s.art_from, s.art_to,
             count(b.id)::int AS bookings_created
      FROM staff_users s
      LEFT JOIN bookings b ON b.created_by = s.id
      GROUP BY s.id ORDER BY s.id
    `);
    const permissions = await many(
      'SELECT capability, bookings_staff, support, super_admin FROM staff_permissions ORDER BY sort'
    );
    res.json({ staff, permissions });
  })
);

/* GET /api/admin/areas — coverage is counted from the partners in each area,
   so it cannot disagree with the partner table the way a stored count could. */
router.get(
  '/areas',
  asyncHandler(async (_req, res) => {
    const areas = await many(`
      SELECT a.name, a.status,
             count(p.id) FILTER (WHERE p.kind = 'Groomer' AND p.status = 'Active')::int AS groomers,
             count(p.id) FILTER (WHERE p.kind = 'Walker'  AND p.status = 'Active')::int AS walkers
      FROM service_areas a
      LEFT JOIN partners p ON p.area = a.name
      GROUP BY a.id, a.name, a.status, a.sort ORDER BY a.sort
    `);
    const slots = await many('SELECT id, label, enabled, tag FROM booking_slots ORDER BY sort');
    const policy = await many(
      "SELECT key, label, value FROM settings WHERE group_name = 'policy' ORDER BY sort"
    );
    res.json({ areas, slots, policy });
  })
);

router.post(
  '/slots/:id/toggle',
  asyncHandler(async (req, res) => {
    const slot = await one(
      'UPDATE booking_slots SET enabled = NOT enabled WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!slot) throw httpError(404, 'No slot with that ID.');
    res.json({ slot });
  })
);

/* GET /api/admin/settings */
router.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    const rows = await many('SELECT key, value, label, group_name FROM settings ORDER BY sort');
    const integrations = await many(
      'SELECT id, name, detail, icon, status FROM integrations ORDER BY sort'
    );
    const groups = {};
    for (const r of rows) (groups[r.group_name] ??= []).push(r);
    res.json({ groups, integrations });
  })
);

/* PATCH /api/admin/settings — one call saves a whole group of fields. */
router.patch(
  '/settings',
  validate(z.object({ values: z.record(z.string(), z.string()) })),
  asyncHandler(async (req, res) => {
    const entries = Object.entries(req.body.values);
    if (!entries.length) throw httpError(400, 'Nothing to update.');
    for (const [key, value] of entries) {
      await one('UPDATE settings SET value = $2 WHERE key = $1 RETURNING key', [key, value]);
    }
    const rows = await many('SELECT key, value, label, group_name FROM settings ORDER BY sort');
    res.json({ updated: entries.length, settings: rows });
  })
);


/* POST /api/admin/areas — open a new service area.

   New areas start Pending, not Live: an area with no partners in it would
   otherwise accept bookings nobody can take. The GET above counts coverage
   from the partner table, so an area becomes worth switching on exactly when
   real groomers or walkers list it. */
router.post(
  '/areas',
  validate(z.object({
    name: z.string().trim().min(2, 'Name the area'),
    status: z.enum(['Live', 'Pending', 'Paused']).optional()
  })),
  asyncHandler(async (req, res) => {
    const { name, status } = req.body;
    const clash = await one('SELECT id FROM service_areas WHERE lower(name) = lower($1)', [name]);
    if (clash) throw httpError(409, `${name} is already a service area.`);

    const [{ next_sort }] = await many(
      'SELECT COALESCE(max(sort), 0) + 1 AS next_sort FROM service_areas'
    );
    const area = await one(
      'INSERT INTO service_areas (name, status, sort) VALUES ($1, $2, $3) RETURNING *',
      [name, status ?? 'Pending', next_sort]
    );
    res.status(201).json({ area });
  })
);

/* PATCH /api/admin/areas/:name — rename, or change whether it is taking work.

   A rename has to carry the partners with it: `partners.area` is a plain text
   column, so renaming the area alone would silently orphan every partner in it
   and the coverage count would drop to zero. Both happen together. */
router.patch(
  '/areas/:name',
  validate(z.object({
    name: z.string().trim().min(2).optional(),
    status: z.enum(['Live', 'Pending', 'Paused']).optional()
  })),
  asyncHandler(async (req, res) => {
    const current = await one('SELECT * FROM service_areas WHERE name = $1', [req.params.name]);
    if (!current) throw httpError(404, 'No service area with that name.');

    const nextName = req.body.name ?? current.name;
    const nextStatus = req.body.status ?? current.status;

    if (nextName !== current.name) {
      const clash = await one(
        'SELECT id FROM service_areas WHERE lower(name) = lower($1) AND id <> $2',
        [nextName, current.id]
      );
      if (clash) throw httpError(409, `${nextName} is already a service area.`);
    }

    const area = await one(
      'UPDATE service_areas SET name = $2, status = $3 WHERE id = $1 RETURNING *',
      [current.id, nextName, nextStatus]
    );
    if (nextName !== current.name) {
      await many('UPDATE partners SET area = $2 WHERE area = $1 RETURNING id', [current.name, nextName]);
    }
    res.json({ area });
  })
);

/* Avatar colours per role, matching roleArt() in the consoles. */
const ROLE_ART = {
  super_admin: ['#4A1E0B', '#2B1206'],
  support: ['#1F7A4D', '#0E4229'],
  bookings_staff: ['#F07B2C', '#A8480C']
};

/* POST /api/admin/staff — invite a colleague.

   No password is set here. The account is created inactive with no hash, so it
   cannot be signed into at all until someone sets one — an invite that created
   a usable login with a default password would be a back door. */
router.post(
  '/staff',
  validate(z.object({
    name: z.string().trim().min(1, 'Who are you inviting?'),
    email: z.string().trim().email('That does not look like an email'),
    role: z.enum(['bookings_staff', 'support', 'super_admin']),
    shift: z.string().trim().optional()
  })),
  asyncHandler(async (req, res) => {
    const { name, email, role, shift } = req.body;
    const clash = await one('SELECT id FROM staff_users WHERE lower(email) = lower($1)', [email]);
    if (clash) throw httpError(409, 'Someone already has that email.');

    /* Staff codes are "s1", "s2", … — the next one is the highest so far plus
       one. Computed here rather than in SQL so the numeric part is parsed by
       something that can simply ignore a code that does not fit the pattern. */
    const codes = await many('SELECT code FROM staff_users');
    const highest = codes.reduce((max, row) => {
      const n = /^s(\d+)$/.exec(row.code)?.[1];
      return n ? Math.max(max, Number(n)) : max;
    }, 0);
    const nextCode = `s${highest + 1}`;

    const art = ROLE_ART[role];
    const member = await one(
      `INSERT INTO staff_users (code, name, email, role, shift, active, art_from, art_to)
       VALUES ($1,$2,$3,$4,$5,FALSE,$6,$7)
       RETURNING code, name, email, role, shift, active, art_from, art_to`,
      [nextCode, name, email, role, shift ?? '—', art[0], art[1]]
    );
    res.status(201).json({
      member,
      note: 'Invited. They cannot sign in until a password is set for them.'
    });
  })
);

/* PATCH /api/admin/staff/:code — change role, shift, or switch access off. */
router.patch(
  '/staff/:code',
  validate(z.object({
    name: z.string().trim().min(1).optional(),
    role: z.enum(['bookings_staff', 'support', 'super_admin']).optional(),
    shift: z.string().trim().optional(),
    active: z.boolean().optional()
  })),
  asyncHandler(async (req, res) => {
    const current = await one('SELECT * FROM staff_users WHERE code = $1', [req.params.code]);
    if (!current) throw httpError(404, 'No staff account with that code.');

    /* Locking yourself out of the console you are standing in is never what
       someone means to do, and there would be no way back from it. */
    if (current.id === req.user?.id && req.body.active === false) {
      throw httpError(400, 'You cannot deactivate your own account.');
    }
    if (current.id === req.user?.id && req.body.role && req.body.role !== current.role) {
      throw httpError(400, 'You cannot change your own role.');
    }

    /* The last super admin must stay one, or nothing can be administered. */
    const demoting = req.body.role && req.body.role !== 'super_admin';
    if (current.role === 'super_admin' && (demoting || req.body.active === false)) {
      const [{ n }] = await many(
        "SELECT count(*)::int AS n FROM staff_users WHERE role = 'super_admin' AND active = TRUE"
      );
      if (n <= 1) throw httpError(400, 'This is the last active super admin.');
    }

    const next = {
      name: req.body.name ?? current.name,
      role: req.body.role ?? current.role,
      shift: req.body.shift ?? current.shift,
      active: req.body.active ?? current.active
    };
    const art = ROLE_ART[next.role];

    const member = await one(
      `UPDATE staff_users SET name = $2, role = $3, shift = $4, active = $5,
              art_from = $6, art_to = $7
       WHERE id = $1
       RETURNING code, name, email, role, shift, active, art_from, art_to`,
      [current.id, next.name, next.role, next.shift, next.active, art[0], art[1]]
    );

    /* A deactivated account must stop working now, not in fifteen minutes when
       its access token expires — so every session it holds is revoked. */
    if (current.active && !next.active) {
      await revokeAllForSubject('staff', current.id);
    }
    res.json({ member });
  })
);

/* GET /api/admin/export/:dataset.csv — the console's export buttons.

   Generated here rather than in the browser because the console only ever
   holds the rows it is currently showing: exporting from the client would
   quietly give you the filtered page instead of the dataset. */
const EXPORTS = {
  bookings: {
    filename: 'bookings',
    sql: `SELECT b.id, b.status, b.service_label, b.pet_name, c.name AS customer,
                 b.partner_name, b.scheduled_label, b.channel, b.total, b.created_at
          FROM bookings b LEFT JOIN customers c ON c.id = b.customer_id
          ORDER BY b.created_at DESC`
  },
  orders: {
    filename: 'store-orders',
    sql: `SELECT o.id, o.status, c.name AS customer, o.channel, o.item_count,
                 o.total, o.placed_label
          FROM store_orders o LEFT JOIN customers c ON c.id = o.customer_id
          ORDER BY o.id DESC`
  },
  customers: {
    filename: 'customers',
    sql: `SELECT id, name, phone, email, area, bookings_count, wallet_balance, since_label
          FROM customers ORDER BY id`
  },
  partners: {
    filename: 'partners',
    sql: `SELECT id, name, kind, phone, area, rating, jobs, status, pending_payout
          FROM partners ORDER BY id`
  }
};

/* RFC 4180: quote every field and double any quote inside it. Without this a
   care note containing a comma silently shifts every later column. */
function toCsv(rows) {
  if (!rows.length) return '';
  const cell = (v) => {
    if (v === null || v === undefined) return '""';
    const text = v instanceof Date ? v.toISOString() : String(v);
    return `"${text.replace(/"/g, '""')}"`;
  };
  const header = Object.keys(rows[0]);
  return [
    header.map(cell).join(','),
    ...rows.map((r) => header.map((k) => cell(r[k])).join(','))
  ].join('\r\n');
}

router.get(
  '/export/:dataset.csv',
  asyncHandler(async (req, res) => {
    const spec = EXPORTS[req.params.dataset];
    if (!spec) throw httpError(404, `Nothing to export called "${req.params.dataset}".`);

    const rows = await many(spec.sql);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', `attachment; filename="${spec.filename}-${stamp}.csv"`);
    res.send(toCsv(rows));
  })
);

/* POST /api/admin/bookings/pause — the console's "pause all bookings" switch.

   Stored as a setting rather than a code path, so the booking endpoints read
   one row and refuse politely instead of every surface needing its own idea of
   whether the business is open. */
router.post(
  '/bookings/pause',
  validate(z.object({ paused: z.boolean() })),
  asyncHandler(async (req, res) => {
    const value = req.body.paused ? 'true' : 'false';
    await one(
      `INSERT INTO settings (key, value, label, group_name, sort)
       VALUES ('bookings_paused', $1, 'New bookings paused', 'policy', 900)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
       RETURNING key`,
      [value]
    );
    res.json({ paused: req.body.paused });
  })
);

export default router;
