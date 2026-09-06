import { Router } from 'express';
import { z } from 'zod';
import { many, one, withTransaction } from '../../db/pool.js';
import { asyncHandler, httpError } from '../../middleware/error.js';
import { validate } from '../../middleware/validate.js';
import { inr } from '../../utils/money.js';

const router = Router();

const SELECT_BOOKING = `
  SELECT b.id, b.customer_id, b.customer_name, b.pet_id, b.pet_name,
         b.service_kind, b.service_label, b.package_id, b.walk_id,
         b.scheduled_label, b.is_today, b.partner_id, b.partner_name,
         b.status, b.total, b.channel, b.address, b.created_at,
         COALESCE(b.care_note, p.care_note) AS care_note,
         p.breed AS pet_breed, p.weight AS pet_weight
  FROM bookings b
  LEFT JOIN pets p ON p.id = b.pet_id
`;

/* The message staff copy and send by hand. There is no WhatsApp integration —
   the Build Book records that as a deliberate limit, so the portal's job is to
   produce the exact text and let a human send it. */
export function confirmationText(b) {
  const partner =
    b.partner_name && b.partner_name !== 'Unassigned'
      ? `${b.partner_name} will be there.`
      : 'We’ll confirm who’s coming shortly.';
  return (
    `Hi ${b.customer_name.split(' ')[0]}, your Wag & Tails booking is confirmed.\n\n` +
    `Booking: ${b.id}\n${b.service_label} for ${b.pet_name}\n${b.scheduled_label}\n` +
    `Total: ${inr(b.total)} — payable after the service.\n\n` +
    `${partner} Free cancellation up to 4 hours before. Reply here if anything changes.`
  );
}

/* GET /api/bookings?filter=all|today|unassigned|whatsapp */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = req.query.filter || 'all';
    const where = {
      all: '',
      today: `WHERE b.is_today = TRUE`,
      unassigned: `WHERE b.partner_name = 'Unassigned'`,
      whatsapp: `WHERE b.channel = 'WhatsApp'`
    }[filter];
    if (where === undefined) throw httpError(400, `Unknown filter "${filter}".`);

    const rows = await many(`${SELECT_BOOKING} ${where} ORDER BY b.created_at DESC, b.id DESC`);
    const [{ n: total }] = await many('SELECT count(*)::int AS n FROM bookings');
    res.json({ bookings: rows, total });
  })
);

/* GET /api/bookings/:id — detail, activity trail and the confirmation text. */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const booking = await one(`${SELECT_BOOKING} WHERE b.id = $1`, [req.params.id]);
    if (!booking) throw httpError(404, 'No booking with that ID.');

    const activity = await many(
      `SELECT title, detail, state, occurred_at FROM booking_activity
       WHERE booking_id = $1 ORDER BY id`,
      [req.params.id]
    );

    /* Only non-app bookings need a message sending by hand. */
    const confirmation = booking.channel === 'App' ? null : confirmationText(booking);

    res.json({ booking, activity, confirmation });
  })
);

const newBooking = z.object({
  channel: z.enum(['WhatsApp', 'Phone call', 'Instagram', 'Walk-in', 'Referral']),
  customerName: z.string().trim().min(1, 'Enter the customer’s name'),
  phone: z.string().trim().optional().default(''),
  address: z.string().trim().optional().default(''),
  petName: z.string().trim().min(1, 'Enter the pet’s name'),
  breed: z.string().trim().optional().default(''),
  weight: z.string().trim().optional().default(''),
  careNote: z.string().trim().optional().default(''),
  serviceKind: z.enum(['groom', 'walk']),
  packageId: z.string().nullable().optional(),
  walkId: z.string().nullable().optional(),
  dateLabel: z.string().trim().min(1, 'Pick a date'),
  slot: z.string().trim().min(1, 'Pick a slot'),
  partnerName: z.string().trim().default('Unassigned')
});

/* POST /api/bookings — a booking entered by staff on someone's behalf.
   Creates the customer and pet if they are new, so the care note has a real
   row to live on and the partner app can read it. */
router.post(
  '/',
  validate(newBooking),
  asyncHandler(async (req, res) => {
    const b = req.body;

    if (b.serviceKind === 'groom' && !b.packageId) throw httpError(400, 'Pick a grooming package.');
    if (b.serviceKind === 'walk' && !b.walkId) throw httpError(400, 'Pick a walk duration.');

    const created = await withTransaction(async (c) => {
      /* Service label and price come from the catalogue, never from the client. */
      let serviceLabel;
      let total;
      if (b.serviceKind === 'groom') {
        const pkg = (await c.query('SELECT name, price FROM packages WHERE id = $1', [b.packageId])).rows[0];
        if (!pkg) throw httpError(400, 'That package no longer exists.');
        serviceLabel = `${pkg.name} groom`;
        total = pkg.price;
      } else {
        const walk = (await c.query('SELECT mins, price FROM walk_durations WHERE id = $1', [b.walkId])).rows[0];
        if (!walk) throw httpError(400, 'That walk duration no longer exists.');
        serviceLabel = `${walk.mins} min walk`;
        total = walk.price;
      }

      /* Match an existing customer on phone, then name; otherwise mint one. */
      let customer = null;
      if (b.phone) {
        customer = (await c.query('SELECT * FROM customers WHERE phone = $1', [b.phone])).rows[0] ?? null;
      }
      if (!customer) {
        customer = (await c.query('SELECT * FROM customers WHERE lower(name) = lower($1)', [b.customerName])).rows[0] ?? null;
      }
      if (!customer) {
        const nextId = (await c.query(
          `SELECT 'C' || (COALESCE(MAX(substring(id from 2)::int), 1000) + 1)::text AS id FROM customers`
        )).rows[0].id;
        customer = (await c.query(
          `INSERT INTO customers (id, name, phone, area, address, pets_count, since_label)
           VALUES ($1,$2,$3,$4,$5,0,'Today') RETURNING *`,
          [nextId, b.customerName, b.phone || null, null, b.address || null]
        )).rows[0];
      } else if (b.address) {
        await c.query('UPDATE customers SET address = $2 WHERE id = $1', [customer.id, b.address]);
      }

      /* Same for the pet — and the care note lands on the pet row, which is
         what makes it visible to the groomer and walker later. */
      let pet = (await c.query(
        'SELECT * FROM pets WHERE customer_id = $1 AND lower(name) = lower($2)',
        [customer.id, b.petName]
      )).rows[0] ?? null;

      if (!pet) {
        pet = (await c.query(
          `INSERT INTO pets (customer_id, name, breed, weight, care_note)
           VALUES ($1,$2,$3,$4,$5) RETURNING *`,
          [customer.id, b.petName, b.breed || null, b.weight || null, b.careNote || null]
        )).rows[0];
      } else if (b.careNote && b.careNote !== pet.care_note) {
        pet = (await c.query('UPDATE pets SET care_note = $2 WHERE id = $1 RETURNING *', [pet.id, b.careNote])).rows[0];
      }

      const partner = b.partnerName === 'Unassigned'
        ? null
        : (await c.query('SELECT id, name FROM partners WHERE name = $1', [b.partnerName])).rows[0] ?? null;

      const id = (await c.query(
        `SELECT 'WT' || (COALESCE(MAX(substring(id from 3)::int), 8000) + 1)::text AS id
         FROM bookings WHERE id ~ '^WT[0-9]+$'`
      )).rows[0].id;

      const scheduledLabel = `${b.dateLabel}, ${b.slot}`;
      const isToday = /^today/i.test(b.dateLabel);

      const booking = (await c.query(
        `INSERT INTO bookings (id, customer_id, customer_name, pet_id, pet_name, service_kind, service_label,
                               package_id, walk_id, scheduled_label, is_today, partner_id, partner_name,
                               status, total, channel, care_note, address, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         RETURNING *`,
        [id, customer.id, customer.name, pet.id, pet.name, b.serviceKind, serviceLabel,
         b.packageId ?? null, b.walkId ?? null, scheduledLabel, isToday,
         partner?.id ?? null, partner?.name ?? 'Unassigned',
         partner ? 'Confirmed' : 'Needs partner', total, b.channel,
         pet.care_note, b.address || null, req.user?.id ?? null]
      )).rows[0];

      const staffName = req.user?.name ?? 'Staff';
      const trail = [
        ['Booking created', `Entered by ${staffName} · ${b.channel}`, 'done'],
        [`Partner ${partner ? 'assigned' : 'not yet assigned'}`, partner?.name ?? 'Unassigned', 'done'],
        ['Visible in the partner app',
          partner ? 'With the care notes attached' : 'Published as an open job', 'now']
      ];
      for (const [title, detail, state] of trail) {
        await c.query(
          'INSERT INTO booking_activity (booking_id, title, detail, state) VALUES ($1,$2,$3,$4)',
          [booking.id, title, detail, state]
        );
      }

      return booking;
    });

    res.status(201).json({ booking: created, confirmation: confirmationText(created) });
  })
);

/* POST /api/bookings/:id/assign — assign or reassign a partner. */
router.post(
  '/:id/assign',
  validate(z.object({ partnerId: z.string().trim().min(1) })),
  asyncHandler(async (req, res) => {
    const partner = await one('SELECT id, name FROM partners WHERE id = $1', [req.body.partnerId]);
    if (!partner) throw httpError(404, 'No such partner.');

    const booking = await one(
      `UPDATE bookings
       SET partner_id = $2, partner_name = $3,
           status = CASE WHEN status = 'Needs partner' THEN 'Confirmed' ELSE status END
       WHERE id = $1 RETURNING *`,
      [req.params.id, partner.id, partner.name]
    );
    if (!booking) throw httpError(404, 'No booking with that ID.');

    await one(
      `INSERT INTO booking_activity (booking_id, title, detail, state)
       VALUES ($1, 'Partner assigned', $2, 'done') RETURNING id`,
      [booking.id, `${partner.name} · by ${req.user?.name ?? 'staff'}`]
    );

    res.json({ booking });
  })
);

/* POST /api/bookings/:id/unassign — back to the open-job pool. */
router.post(
  '/:id/unassign',
  asyncHandler(async (req, res) => {
    const booking = await one(
      `UPDATE bookings SET partner_id = NULL, partner_name = 'Unassigned', status = 'Needs partner'
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!booking) throw httpError(404, 'No booking with that ID.');

    await one(
      `INSERT INTO booking_activity (booking_id, title, detail, state)
       VALUES ($1, 'Partner unassigned', $2, 'now') RETURNING id`,
      [booking.id, `Published as an open job by ${req.user?.name ?? 'staff'}`]
    );

    res.json({ booking });
  })
);

/* POST /api/bookings/:id/cancel */
router.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const booking = await one(
      `UPDATE bookings SET status = 'Cancelled' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!booking) throw httpError(404, 'No booking with that ID.');
    await one(
      `INSERT INTO booking_activity (booking_id, title, detail, state)
       VALUES ($1, 'Booking cancelled', $2, 'done') RETURNING id`,
      [booking.id, `Cancelled by ${req.user?.name ?? 'staff'}`]
    );
    res.json({ booking });
  })
);

export default router;
