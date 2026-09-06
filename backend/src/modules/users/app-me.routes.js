import { Router } from 'express';
import { z } from 'zod';
import { many, one } from '../../db/pool.js';
import { asyncHandler, httpError } from '../../middleware/error.js';
import { validate } from '../../middleware/validate.js';
import { requireCustomer, requirePartner } from '../../middleware/appUser.js';

/* ============================================================
   Customer: home, account, wallet, offers, notifications, help
   ============================================================ */
export const customerRoutes = Router();
customerRoutes.use(requireCustomer);

/* GET /api/app/customer/home — one call for the whole home screen. */
customerRoutes.get(
  '/home',
  asyncHandler(async (req, res) => {
    const me = req.app_user;

    /* Each pet's most recent visit, for the idle card ("Last groomed 8 weeks
       ago") and the health nudge ("Time for a groom" once it's been 6+ weeks). */
    const pets = await many(
      `SELECT p.id, p.name, p.breed, p.care_note, p.art, p.vaccinated, p.next_vaccine,
              v.visited_on AS last_visit_on,
              CASE WHEN v.visited_on ~ '\\d{4}$'
                THEN floor(extract(epoch FROM now() - to_date(v.visited_on, 'DD Mon YYYY')) / 604800)::int
                ELSE NULL END AS last_visit_weeks_ago
       FROM pets p
       LEFT JOIN LATERAL (
         SELECT visited_on FROM pet_visits WHERE pet_id = p.id ORDER BY sort LIMIT 1
       ) v ON TRUE
       WHERE p.customer_id = $1 ORDER BY p.id`,
      [me.id]
    );

    /* The header's location line — "Home · Andheri West" — reads the default
       address, falling back to the account's own area. */
    const address = await one(
      `SELECT label, line1, line2 FROM customer_addresses
       WHERE customer_id = $1 AND is_default LIMIT 1`,
      [me.id]
    );

    const active = await one(
      `SELECT b.id, b.pet_name, b.service_label, b.status, b.eta, b.scheduled_label,
              b.partner_name, b.service_kind, p.art AS pet_art
       FROM bookings b LEFT JOIN pets p ON p.id = b.pet_id
       WHERE b.customer_id = $1 AND b.status IN ('On the way','In progress','Walking now')
       ORDER BY b.id DESC LIMIT 1`,
      [me.id]
    );

    const upcoming = await many(
      `SELECT b.id, b.pet_name, b.service_label, b.scheduled_label, b.status, p.art AS pet_art
       FROM bookings b LEFT JOIN pets p ON p.id = b.pet_id
       WHERE b.customer_id = $1 AND b.status IN ('Confirmed','Needs partner')
       ORDER BY b.is_today DESC, b.id LIMIT 3`,
      [me.id]
    );

    /* The booking flow needs the catalogue with each package's inclusions —
       they expand in place on the package step rather than pushing a screen. */
    const packages = await many(`
      SELECT p.id, p.name, p.blurb, p.mrp, p.price, p.mins, p.popular,
             COALESCE(array_agg(i.item ORDER BY i.sort) FILTER (WHERE i.item IS NOT NULL), '{}') AS inclusions
      FROM packages p
      LEFT JOIN package_inclusions i ON i.package_id = p.id
      WHERE p.active GROUP BY p.id ORDER BY p.sort
    `);
    const addons = await many('SELECT id, name, price, note FROM addons ORDER BY sort');
    const slots = await many('SELECT label, enabled, tag FROM booking_slots ORDER BY sort');
    const walks = await many(
      'SELECT id, mins, price, note, km, provisional FROM walk_durations ORDER BY sort'
    );
    const offers = await many(
      'SELECT code, title, subtitle, expires_on FROM coupons WHERE active ORDER BY sort'
    );
    const [unread] = await many(
      'SELECT count(*)::int AS n FROM notifications WHERE customer_id = $1 AND unread',
      [me.id]
    );

    /* A booster that has lapsed is worth surfacing on the home screen. */
    const dueVaccines = await many(
      `SELECT p.id AS pet_id, p.name AS pet_name, v.name, v.due_on FROM pet_vaccines v
       JOIN pets p ON p.id = v.pet_id
       WHERE p.customer_id = $1 AND v.up_to_date = FALSE ORDER BY p.id`,
      [me.id]
    );

    /* "Book again" rail — completed visits, most recent first, with the
       package or walk duration for the label the card shows. */
    const recentCompleted = await many(
      `SELECT b.id, b.pet_id, b.pet_name, p.art AS pet_art, b.total,
              COALESCE(pk.name || ' groom', w.mins || ' min walk') AS label,
              COALESCE(b.date_label, split_part(b.scheduled_label, ',', 1)) AS date_label
       FROM bookings b
       LEFT JOIN pets p ON p.id = b.pet_id
       LEFT JOIN packages pk ON pk.id = b.package_id
       LEFT JOIN walk_durations w ON w.id = b.walk_id
       WHERE b.customer_id = $1 AND b.status = 'Completed'
       ORDER BY b.created_at DESC, b.id DESC LIMIT 6`,
      [me.id]
    );

    res.json({
      me,
      pets,
      address: address
        ? { label: address.label, area: (address.line2 || address.line1).split(',')[0].trim() }
        : null,
      active, upcoming, packages, addons, walks, slots, offers,
      unreadCount: unread.n,
      dueVaccines,
      recentCompleted
    });
  })
);

customerRoutes.get(
  '/account',
  asyncHandler(async (req, res) => {
    const me = req.app_user;
    const addresses = await many(
      'SELECT id, code, label, kind, line1, line2, landmark, is_default FROM customer_addresses WHERE customer_id = $1 ORDER BY id',
      [me.id]
    );
    const payments = await many(
      'SELECT id, code, label, subtitle, kind, is_default FROM payment_methods WHERE customer_id = $1 ORDER BY id',
      [me.id]
    );
    const [counts] = await many(
      `SELECT count(*)::int AS bookings,
              COALESCE(sum(total) FILTER (WHERE status = 'Completed'), 0)::int AS spent
       FROM bookings WHERE customer_id = $1`,
      [me.id]
    );
    res.json({ me, addresses, payments, stats: counts });
  })
);

customerRoutes.post(
  '/addresses',
  validate(z.object({
    label: z.string().trim().min(1, 'Give it a name'),
    kind: z.string().trim().optional().default('home'),
    line1: z.string().trim().min(1, 'Enter the flat and building'),
    line2: z.string().trim().optional().default(''),
    landmark: z.string().trim().optional().default('')
  })),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const address = await one(
      `INSERT INTO customer_addresses (customer_id, code, label, kind, line1, line2, landmark)
       VALUES ($1, lower($2) || '-' || floor(random()*10000)::text, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.app_user.id, b.label, b.kind, b.line1, b.line2 || null, b.landmark || null]
    );
    res.status(201).json({ address });
  })
);

customerRoutes.post(
  '/addresses/:id/default',
  asyncHandler(async (req, res) => {
    await one('UPDATE customer_addresses SET is_default = FALSE WHERE customer_id = $1 RETURNING id',
      [req.app_user.id]);
    const address = await one(
      'UPDATE customer_addresses SET is_default = TRUE WHERE id = $1 AND customer_id = $2 RETURNING *',
      [req.params.id, req.app_user.id]
    );
    if (!address) throw httpError(404, 'No such address.');
    res.json({ address });
  })
);

customerRoutes.post(
  '/payments/:id/default',
  asyncHandler(async (req, res) => {
    await one('UPDATE payment_methods SET is_default = FALSE WHERE customer_id = $1 RETURNING id',
      [req.app_user.id]);
    const method = await one(
      'UPDATE payment_methods SET is_default = TRUE WHERE id = $1 AND customer_id = $2 RETURNING *',
      [req.params.id, req.app_user.id]
    );
    if (!method) throw httpError(404, 'No such payment method.');
    res.json({ method });
  })
);

customerRoutes.get(
  '/notifications',
  asyncHandler(async (req, res) => {
    const notifications = await many(
      'SELECT id, kind, title, body, when_label, unread FROM notifications WHERE customer_id = $1 ORDER BY sort',
      [req.app_user.id]
    );
    await one('UPDATE notifications SET unread = FALSE WHERE customer_id = $1 RETURNING id',
      [req.app_user.id]);
    res.json({ notifications });
  })
);

customerRoutes.get(
  '/offers',
  asyncHandler(async (_req, res) => {
    const offers = await many(
      'SELECT code, title, subtitle, applies_to, expires_on, active FROM coupons ORDER BY sort'
    );
    res.json({ offers });
  })
);

customerRoutes.get(
  '/help',
  asyncHandler(async (_req, res) => {
    const faqs = await many('SELECT question, answer FROM faqs ORDER BY sort');
    const reasons = await many('SELECT reason FROM cancel_reasons ORDER BY sort');
    const hours = await one("SELECT value FROM settings WHERE key = 'support_hours'");
    res.json({ faqs, cancelReasons: reasons.map((r) => r.reason), supportHours: hours?.value ?? null });
  })
);

/* ============================================================
   Partner: schedule, earnings, reviews, documents
   ============================================================ */
export const partnerRoutes = Router();
partnerRoutes.use(requirePartner);

partnerRoutes.get(
  '/home',
  asyncHandler(async (req, res) => {
    const me = req.app_user;
    const [today] = await many(
      `SELECT count(*)::int AS jobs, COALESCE(sum(total),0)::int AS value
       FROM bookings WHERE partner_id = $1 AND is_today`,
      [me.id]
    );

    /* "Today" on the jobs feed is what has actually been earned so far today —
       the partner's cut of today's completed jobs, at the real commission
       rate, not the gross booking value. */
    const feeKey = me.kind === 'Groomer' ? 'groomer_fee' : 'walker_fee';
    const feeRow = await one('SELECT value FROM settings WHERE key = $1', [feeKey]);
    const rate = 1 - parseFloat(feeRow?.value ?? '15%') / 100;
    const [earnedToday] = await many(
      `SELECT COALESCE(sum(total), 0)::int AS gross
       FROM bookings WHERE partner_id = $1 AND is_today AND status = 'Completed'`,
      [me.id]
    );

    /* "Jobs left" — assigned work that isn't finished or cancelled yet. */
    const [jobsLeft] = await many(
      `SELECT count(*)::int AS n FROM bookings
       WHERE partner_id = $1 AND status NOT IN ('Completed', 'Cancelled')`,
      [me.id]
    );

    const [unread] = await many(
      'SELECT count(*)::int AS n FROM notifications WHERE partner_id = $1 AND unread', [me.id]
    );
    res.json({
      me, today,
      todayEarned: Math.round(earnedToday.gross * rate),
      jobsLeft: jobsLeft.n,
      unreadCount: unread.n
    });
  })
);

/* Grouped by day, which is how the schedule screen lists it. */
partnerRoutes.get(
  '/schedule',
  asyncHandler(async (req, res) => {
    const rows = await many(
      `SELECT b.id, b.pet_name, b.service_label, b.date_label, b.slot_label, b.scheduled_label,
              b.status, b.customer_name, b.total, p.art AS pet_art
       FROM bookings b LEFT JOIN pets p ON p.id = b.pet_id
       WHERE b.partner_id = $1 AND b.status NOT IN ('Cancelled')
       ORDER BY b.is_today DESC, b.id`,
      [req.app_user.id]
    );
    const days = [];
    for (const r of rows) {
      const key = r.date_label ?? 'Scheduled';
      let day = days.find((d) => d.date === key);
      if (!day) days.push((day = { date: key, jobs: [] }));
      day.jobs.push(r);
    }
    res.json({ days });
  })
);

partnerRoutes.get(
  '/earnings',
  asyncHandler(async (req, res) => {
    const me = req.app_user;
    const entries = await many(
      `SELECT id, label, earned_on, weekday, amount, paid_out FROM partner_earnings
       WHERE partner_id = $1 ORDER BY sort, id`,
      [me.id]
    );

    /* The bar chart totals each weekday from the entries themselves. */
    const ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const week = ORDER.map((d) => ({
      day: d,
      value: entries.filter((e) => (e.weekday ?? '').startsWith(d)).reduce((s, e) => s + e.amount, 0)
    }));

    const feeKey = me.kind === 'Groomer' ? 'groomer_fee' : 'walker_fee';
    const fee = await one('SELECT value FROM settings WHERE key = $1', [feeKey]);

    res.json({
      pending: me.pending_payout,
      total: entries.reduce((s, e) => s + e.amount, 0),
      entries,
      week,
      fee: fee?.value ?? null,
      schedule: me.kind === 'Groomer' ? 'Weekly, every Monday' : 'Daily, 11:00 pm'
    });
  })
);

partnerRoutes.get(
  '/reviews',
  asyncHandler(async (req, res) => {
    const reviews = await many(
      'SELECT author, pet_name, rating, when_label, body FROM reviews WHERE partner_id = $1 ORDER BY sort',
      [req.app_user.id]
    );
    res.json({
      reviews,
      rating: req.app_user.rating,
      jobs: req.app_user.jobs
    });
  })
);

partnerRoutes.get(
  '/documents',
  asyncHandler(async (req, res) => {
    const documents = await many(
      'SELECT name, detail, verified FROM partner_documents WHERE partner_id = $1 ORDER BY sort',
      [req.app_user.id]
    );
    res.json({ documents });
  })
);

partnerRoutes.get(
  '/notifications',
  asyncHandler(async (req, res) => {
    const notifications = await many(
      'SELECT id, kind, title, body, when_label, unread FROM notifications WHERE partner_id = $1 ORDER BY sort',
      [req.app_user.id]
    );
    await one('UPDATE notifications SET unread = FALSE WHERE partner_id = $1 RETURNING id',
      [req.app_user.id]);
    res.json({ notifications });
  })
);
