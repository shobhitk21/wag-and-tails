import { Router } from 'express';
import { z } from 'zod';
import { many, one, withTransaction } from '../../db/pool.js';
import { asyncHandler, httpError } from '../../middleware/error.js';
import { validate } from '../../middleware/validate.js';
import { requireCustomer } from '../../middleware/appUser.js';
import { buildChecklist } from '../jobs/checklist.js';

const router = Router();
router.use(requireCustomer);

const SELECT = `
  SELECT b.id, b.pet_id, b.pet_name, b.service_kind, b.service_label, b.package_id, b.walk_id,
         b.scheduled_label, b.date_label, b.slot_label, b.is_today, b.partner_id, b.partner_name,
         b.status, b.total, b.discount, b.coupon_code, b.paid, b.rating, b.tip, b.eta,
         b.cancel_reason, b.distance_km, b.care_note, b.address_id,
         p.art AS pet_art, pa.rating AS partner_rating, pa.kind AS partner_kind
  FROM bookings b
  LEFT JOIN pets p ON p.id = b.pet_id
  LEFT JOIN partners pa ON pa.id = b.partner_id
`;

/* GET /api/app/bookings — upcoming and past, split the way the app lists them. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await many(
      `${SELECT} WHERE b.customer_id = $1 ORDER BY b.created_at DESC, b.id DESC`,
      [req.app_user.id]
    );
    const closed = new Set(['Completed', 'Cancelled']);
    res.json({
      upcoming: rows.filter((b) => !closed.has(b.status)),
      past: rows.filter((b) => closed.has(b.status)),
      active: rows.find((b) => ['On the way', 'In progress', 'Walking now'].includes(b.status)) ?? null
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const booking = await one(`${SELECT} WHERE b.id = $1 AND b.customer_id = $2`,
      [req.params.id, req.app_user.id]);
    if (!booking) throw httpError(404, 'No booking with that ID on your account.');

    const addons = await many(
      `SELECT a.id, a.name, ba.price FROM booking_addons ba
       JOIN addons a ON a.id = ba.addon_id WHERE ba.booking_id = $1`,
      [req.params.id]
    );
    const steps = await many(
      'SELECT title, detail, state FROM booking_steps WHERE booking_id = $1 ORDER BY sort',
      [req.params.id]
    );
    const address = booking.address_id
      ? await one('SELECT label, line1, line2, landmark FROM customer_addresses WHERE id = $1',
          [booking.address_id])
      : null;
    const photos = await many(
      'SELECT phase, seed FROM job_photos WHERE booking_id = $1 ORDER BY id',
      [req.params.id]
    );
    const walk = booking.service_kind === 'walk'
      ? await one('SELECT * FROM walks WHERE booking_id = $1', [req.params.id])
      : null;

    res.json({ booking, addons, steps, address, photos, walk });
  })
);

const draft = z.object({
  petId: z.coerce.number().int().positive(),
  serviceKind: z.enum(['groom', 'walk']),
  packageId: z.string().nullable().optional(),
  walkId: z.string().nullable().optional(),
  addonIds: z.array(z.string()).optional().default([]),
  dateLabel: z.string().trim().min(1, 'Pick a date'),
  slot: z.string().trim().min(1, 'Pick a slot'),
  addressId: z.coerce.number().int().positive().nullable().optional(),
  couponCode: z.string().trim().optional().default('')
});

/* POST /api/app/bookings — the customer books for themselves.
   Prices, add-on prices and the coupon are all resolved server-side; the app
   sends choices, never amounts. */
router.post(
  '/',
  validate(draft),
  asyncHandler(async (req, res) => {
    const d = req.body;
    if (d.serviceKind === 'groom' && !d.packageId) throw httpError(400, 'Pick a package.');
    if (d.serviceKind === 'walk' && !d.walkId) throw httpError(400, 'Pick a duration.');

    const created = await withTransaction(async (c) => {
      const pet = (await c.query(
        'SELECT * FROM pets WHERE id = $1 AND customer_id = $2',
        [d.petId, req.app_user.id]
      )).rows[0];
      if (!pet) throw httpError(404, 'That pet is not on your account.');

      let serviceLabel;
      let base;
      if (d.serviceKind === 'groom') {
        const pkg = (await c.query('SELECT name, price FROM packages WHERE id = $1', [d.packageId])).rows[0];
        if (!pkg) throw httpError(400, 'That package no longer exists.');
        serviceLabel = `${pkg.name} groom`;
        base = pkg.price;
      } else {
        const w = (await c.query('SELECT mins, price FROM walk_durations WHERE id = $1', [d.walkId])).rows[0];
        if (!w) throw httpError(400, 'That duration no longer exists.');
        serviceLabel = `${w.mins} min walk`;
        base = w.price;
      }

      const addons = d.addonIds.length
        ? (await c.query('SELECT id, name, price FROM addons WHERE id = ANY($1)', [d.addonIds])).rows
        : [];
      const addonTotal = addons.reduce((s, a) => s + a.price, 0);

      /* A coupon only counts if it exists and is active. */
      let discount = 0;
      let couponCode = null;
      if (d.couponCode) {
        const coupon = (await c.query(
          'SELECT code, active FROM coupons WHERE upper(code) = upper($1)', [d.couponCode]
        )).rows[0];
        if (!coupon) throw httpError(400, 'That coupon code is not recognised.');
        if (!coupon.active) throw httpError(400, 'That coupon is not active right now.');
        discount = Math.min(Math.round(base * 0.2), 400);
        couponCode = coupon.code;
      }

      const total = base + addonTotal - discount;

      const address = d.addressId
        ? (await c.query('SELECT id FROM customer_addresses WHERE id = $1 AND customer_id = $2',
            [d.addressId, req.app_user.id])).rows[0]
        : (await c.query(
            'SELECT id FROM customer_addresses WHERE customer_id = $1 AND is_default LIMIT 1',
            [req.app_user.id])).rows[0];

      const id = (await c.query(
        `SELECT 'WT' || (COALESCE(MAX(substring(id from 3)::int), 8000) + 1)::text AS id
         FROM bookings WHERE id ~ '^WT[0-9]+$'`
      )).rows[0].id;

      const isToday = /^today/i.test(d.dateLabel);
      const booking = (await c.query(
        `INSERT INTO bookings (id, customer_id, customer_name, pet_id, pet_name, service_kind,
                               service_label, package_id, walk_id, scheduled_label, date_label,
                               slot_label, is_today, partner_name, status, total, discount,
                               coupon_code, channel, care_note, address_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'Unassigned','Needs partner',
                 $14,$15,$16,'App',$17,$18)
         RETURNING *`,
        [id, req.app_user.id, req.app_user.name, pet.id, pet.name, d.serviceKind, serviceLabel,
         d.packageId ?? null, d.walkId ?? null, `${d.dateLabel}, ${d.slot}`, d.dateLabel, d.slot,
         isToday, total, discount, couponCode, pet.care_note, address?.id ?? null]
      )).rows[0];

      for (const a of addons) {
        await c.query(
          'INSERT INTO booking_addons (booking_id, addon_id, price) VALUES ($1,$2,$3)',
          [booking.id, a.id, a.price]
        );
      }

      const steps = [
        ['Booking confirmed', 'Just now', 'done'],
        [d.serviceKind === 'groom' ? 'Groomer assigned' : 'Walker assigned', '', 'todo'],
        ['On the way', '', 'todo'],
        [d.serviceKind === 'groom' ? 'Grooming in progress' : 'Walk in progress', '', 'todo'],
        ['Completed', '', 'todo']
      ];
      let i = 0;
      for (const [title, detail, state] of steps) {
        await c.query(
          'INSERT INTO booking_steps (booking_id, title, detail, state, sort) VALUES ($1,$2,$3,$4,$5)',
          [booking.id, title, detail || null, state, i++]
        );
      }

      await c.query(
        `INSERT INTO booking_activity (booking_id, title, detail, state)
         VALUES ($1, 'Booking created', 'By the customer in the app', 'done')`,
        [booking.id]
      );

      /* Grooms get their checklist now, so a partner claiming the job in the
         feed finds it ready. */
      if (d.serviceKind === 'groom') await buildChecklist(c, booking.id, d.packageId);

      /* A walk needs a row the moment it exists — the customer's live screen
         and the walker's live screen both read it. */
      if (d.serviceKind === 'walk') {
        const w = (await c.query('SELECT mins, price FROM walk_durations WHERE id = $1', [d.walkId])).rows[0];
        await c.query(
          `INSERT INTO walks (booking_id, state, planned_mins, payout)
           VALUES ($1, 'requested', $2, $3)`,
          [booking.id, w.mins, Math.round(w.price * 0.8)]
        );
      }

      return booking;
    });

    res.status(201).json({ booking: created });
  })
);

/* Partner matching. The prototype showed a ~2s spinner; this picks a real
   active partner in the right discipline and assigns them. */
router.post(
  '/:id/match',
  asyncHandler(async (req, res) => {
    const booking = await one(
      'SELECT * FROM bookings WHERE id = $1 AND customer_id = $2',
      [req.params.id, req.app_user.id]
    );
    if (!booking) throw httpError(404, 'No booking with that ID.');

    const kind = booking.service_kind === 'groom' ? 'Groomer' : 'Walker';
    const partner = await one(
      `SELECT id, name, rating, area FROM partners
       WHERE status = 'Active' AND kind = $1
       ORDER BY (area = $2) DESC, rating DESC LIMIT 1`,
      [kind, req.app_user.area]
    );
    if (!partner) throw httpError(503, `No ${kind.toLowerCase()} is available in your area yet.`);

    const updated = await one(
      `UPDATE bookings SET partner_id = $2, partner_name = $3, status = 'Confirmed'
       WHERE id = $1 RETURNING *`,
      [booking.id, partner.id, partner.name]
    );
    await one(
      `UPDATE booking_steps SET state = 'done', detail = 'Just now'
       WHERE booking_id = $1 AND sort = 1 RETURNING id`,
      [booking.id]
    );
    await one(
      `INSERT INTO booking_activity (booking_id, title, detail, state)
       VALUES ($1, 'Partner assigned', $2, 'done') RETURNING id`,
      [booking.id, partner.name]
    );

    res.json({ booking: updated, partner });
  })
);

router.post(
  '/:id/reschedule',
  validate(z.object({
    dateLabel: z.string().trim().min(1),
    slot: z.string().trim().min(1)
  })),
  asyncHandler(async (req, res) => {
    const { dateLabel, slot } = req.body;
    const booking = await one(
      `UPDATE bookings SET date_label = $3, slot_label = $4,
              scheduled_label = $3 || ', ' || $4, is_today = $5
       WHERE id = $1 AND customer_id = $2 AND status NOT IN ('Completed','Cancelled')
       RETURNING *`,
      [req.params.id, req.app_user.id, dateLabel, slot, /^today/i.test(dateLabel)]
    );
    if (!booking) throw httpError(404, 'That booking cannot be rescheduled.');
    res.json({ booking });
  })
);

router.post(
  '/:id/cancel',
  validate(z.object({ reason: z.string().trim().min(1, 'Pick a reason') })),
  asyncHandler(async (req, res) => {
    const booking = await one(
      `UPDATE bookings SET status = 'Cancelled', cancel_reason = $3
       WHERE id = $1 AND customer_id = $2 AND status NOT IN ('Completed','Cancelled')
       RETURNING *`,
      [req.params.id, req.app_user.id, req.body.reason]
    );
    if (!booking) throw httpError(404, 'That booking cannot be cancelled.');
    res.json({ booking });
  })
);

router.post(
  '/:id/pay',
  validate(z.object({ method: z.string().trim().min(1), useWallet: z.boolean().optional() })),
  asyncHandler(async (req, res) => {
    const result = await withTransaction(async (c) => {
      const booking = (await c.query(
        'SELECT * FROM bookings WHERE id = $1 AND customer_id = $2',
        [req.params.id, req.app_user.id]
      )).rows[0];
      if (!booking) throw httpError(404, 'No booking with that ID.');
      if (booking.paid) throw httpError(400, 'This booking is already paid.');

      let walletUsed = 0;
      if (req.body.useWallet) {
        const cust = (await c.query('SELECT wallet_balance FROM customers WHERE id = $1',
          [req.app_user.id])).rows[0];
        walletUsed = Math.min(cust.wallet_balance, booking.total);
        await c.query('UPDATE customers SET wallet_balance = wallet_balance - $2 WHERE id = $1',
          [req.app_user.id, walletUsed]);
      }

      const paid = (await c.query(
        `UPDATE bookings SET paid = TRUE, status = 'Completed' WHERE id = $1 RETURNING *`,
        [booking.id]
      )).rows[0];

      await c.query(
        `UPDATE booking_steps SET state = 'done' WHERE booking_id = $1`, [booking.id]
      );

      /* The partner's balance moves when the customer pays. */
      if (booking.partner_id) {
        const rate = booking.service_kind === 'groom' ? 0.85 : 0.8;
        const amount = Math.round(booking.total * rate);
        await c.query(
          'UPDATE partners SET pending_payout = pending_payout + $2 WHERE id = $1',
          [booking.partner_id, amount]
        );
        await c.query(
          `INSERT INTO partner_earnings (partner_id, booking_id, label, earned_on, amount)
           VALUES ($1,$2,$3,$4,$5)`,
          [booking.partner_id, booking.id,
           `${booking.service_label} · ${booking.pet_name}`, booking.date_label ?? 'Today', amount]
        );
      }

      return { booking: paid, walletUsed, method: req.body.method };
    });
    res.json(result);
  })
);

router.post(
  '/:id/rate',
  validate(z.object({
    rating: z.coerce.number().int().min(1).max(5),
    tip: z.coerce.number().int().min(0).optional().default(0),
    comment: z.string().trim().optional().default('')
  })),
  asyncHandler(async (req, res) => {
    const booking = await one(
      `UPDATE bookings SET rating = $3, tip = $4 WHERE id = $1 AND customer_id = $2 RETURNING *`,
      [req.params.id, req.app_user.id, req.body.rating, req.body.tip]
    );
    if (!booking) throw httpError(404, 'No booking with that ID.');

    if (req.body.comment && booking.partner_id) {
      await one(
        `INSERT INTO reviews (partner_id, author, pet_name, rating, when_label, body, sort)
         VALUES ($1,$2,$3,$4,'Just now',$5,0) RETURNING id`,
        [booking.partner_id, req.app_user.name, booking.pet_name, req.body.rating, req.body.comment]
      );
    }
    if (req.body.tip && booking.partner_id) {
      await one('UPDATE partners SET pending_payout = pending_payout + $2 WHERE id = $1 RETURNING id',
        [booking.partner_id, req.body.tip]);
    }

    res.json({ booking });
  })
);

export default router;
