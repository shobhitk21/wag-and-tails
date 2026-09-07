import { Router } from 'express';
import { many, one } from '../../db/pool.js';
import { asyncHandler, httpError } from '../../middleware/error.js';
import { validate } from '../../middleware/validate.js';
import { z } from 'zod';

const router = Router();

/* GET /api/staff/dashboard
   Every figure on this screen is counted from the bookings table — the staff
   console is operational, so nothing here is a stored snapshot. */
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const [counts] = await many(`
      SELECT
        count(*) FILTER (WHERE is_today)                       ::int AS today,
        count(*) FILTER (WHERE partner_name = 'Unassigned')    ::int AS unassigned,
        count(*) FILTER (WHERE channel <> 'App')               ::int AS staff_entered
      FROM bookings
    `);

    const [orders] = await many(`
      SELECT count(*) FILTER (WHERE placed_label ILIKE 'today%')::int AS today
      FROM store_orders
    `);

    const unassigned = await many(`
      SELECT id, customer_name, service_label, scheduled_label, pet_name, channel
      FROM bookings WHERE partner_name = 'Unassigned' ORDER BY id
    `);

    const today = await many(`
      SELECT id, customer_name, pet_name, service_label, scheduled_label, partner_name, status
      FROM bookings WHERE is_today = TRUE ORDER BY id
    `);

    const staffEntered = await many(`
      SELECT id, customer_name, service_label, scheduled_label, channel
      FROM bookings WHERE channel <> 'App' ORDER BY created_at DESC, id DESC LIMIT 4
    `);

    const onShift = await many(`
      SELECT id, name, kind, area FROM partners WHERE status = 'Active' ORDER BY id
    `);

    res.json({
      greeting: req.user?.name?.split(' ')[0] ?? null,
      shift: req.user?.shift ?? null,
      kpis: {
        today: counts.today,
        unassigned: counts.unassigned,
        staffEntered: counts.staff_entered,
        ordersToday: orders.today
      },
      unassigned,
      today,
      staffEntered,
      onShift
    });
  })
);

/* GET /api/staff/profile — the signed-in account plus this shift's tallies. */
router.get(
  '/profile',
  asyncHandler(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not signed in.' });

    const [created] = await many(
      `SELECT count(*)::int AS n FROM bookings WHERE created_by = $1`,
      [req.user.id]
    );
    const account = await one(
      `SELECT code, name, email, role, shift, handled_today, art_from, art_to
       FROM staff_users WHERE id = $1`,
      [req.user.id]
    );

    res.json({
      account,
      shiftStats: {
        bookingsCreated: created.n,
        messagesHandled: account.handled_today
      }
    });
  })
);


/* PATCH /api/staff/profile — edit your own account.

   Deliberately narrow: name and shift only. Role and active status are
   somebody else's decision and live under /api/admin/staff, or anyone could
   promote themselves here. Email is the login identifier and changing it is a
   credential change, not a profile edit. */
router.patch(
  '/profile',
  validate(z.object({
    name: z.string().trim().min(1, 'Your name cannot be blank').optional(),
    shift: z.string().trim().optional()
  })),
  asyncHandler(async (req, res) => {
    if (!req.user) throw httpError(401, 'Not signed in.');

    const fields = Object.entries(req.body).filter(([k]) => k === 'name' || k === 'shift');
    if (!fields.length) throw httpError(400, 'Nothing to update.');

    const set = fields.map(([k], i) => `${k} = $${i + 2}`).join(', ');
    const account = await one(
      `UPDATE staff_users SET ${set} WHERE id = $1
       RETURNING code, name, email, role, shift, handled_today, art_from, art_to`,
      [req.user.id, ...fields.map(([, v]) => v)]
    );
    res.json({ account });
  })
);

export default router;
