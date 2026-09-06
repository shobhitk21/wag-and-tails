import { Router } from 'express';
import { z } from 'zod';
import { many, one } from '../../db/pool.js';
import { asyncHandler, httpError } from '../../middleware/error.js';
import { validate } from '../../middleware/validate.js';
import { requireAdmin } from '../../middleware/webAuth.js';
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

export default router;
