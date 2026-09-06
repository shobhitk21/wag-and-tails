import { Router } from 'express';
import { z } from 'zod';
import { many, one, withTransaction } from '../../db/pool.js';
import { asyncHandler, httpError } from '../../middleware/error.js';
import { validate } from '../../middleware/validate.js';

const router = Router();

/* Live walks.

   One row per walk, read by both apps: the customer's live screen and the
   walker's live screen show the same object, so ending a walk in the partner
   app updates the customer app. The prototype advanced a local timer at 20×;
   here the elapsed time is derived from started_at, so every client agrees
   without anything being pushed.

   Distance follows the prototype's rule: roughly 12 minutes per kilometre. */
const SPEEDUP = Number(process.env.WALK_SPEEDUP ?? 20);
const MIN_PER_KM = 12;

function project(walk) {
  if (!walk) return null;

  let elapsed = walk.elapsed_secs;
  if (walk.state === 'walking' && walk.started_at) {
    elapsed = Math.round(((Date.now() - new Date(walk.started_at).getTime()) / 1000) * SPEEDUP);
  }

  const plannedSecs = walk.planned_mins * 60;
  const capped = Math.min(elapsed, plannedSecs);
  const progress = plannedSecs ? Math.min(capped / plannedSecs, 1) : 0;
  const km = Number(((capped / 60) / MIN_PER_KM).toFixed(1));

  return {
    ...walk,
    elapsed_secs: capped,
    progress,
    distance_km: walk.state === 'done' ? Number(walk.distance_km) : km,
    remaining_secs: Math.max(plannedSecs - capped, 0),
    /* True once the planned duration has elapsed — the walker's slide-to-end
       control unlocks visually, though ending early is still allowed. */
    complete: progress >= 1
  };
}

const SELECT_WALK = `
  SELECT w.*, b.customer_id, b.customer_name, b.partner_id, b.pet_id, b.pet_name,
         b.service_label, b.care_note, b.total,
         p.art AS pet_art, p.breed AS pet_breed,
         a.line1, a.line2
  FROM walks w
  JOIN bookings b ON b.id = w.booking_id
  LEFT JOIN pets p ON p.id = b.pet_id
  LEFT JOIN customer_addresses a ON a.id = b.address_id
`;

/* Either side may read a walk, but only its own participants. */
async function loadWalk(req, bookingId) {
  const walk = await one(`${SELECT_WALK} WHERE w.booking_id = $1`, [bookingId]);
  if (!walk) throw httpError(404, 'No walk for that booking.');

  const me = req.app_user;
  if (!me) throw httpError(401, 'Sign in to continue.');
  const mine = me.role === 'customer' ? walk.customer_id === me.id : walk.partner_id === me.id;
  if (!mine && !(me.role === 'partner' && walk.state === 'requested')) {
    throw httpError(403, 'That walk is not yours.');
  }
  return walk;
}

/* GET /api/app/walks/requests — open walk requests for a walker.
   The prototype showed this as a full-screen incoming request. */
router.get(
  '/requests',
  asyncHandler(async (req, res) => {
    if (req.app_user?.role !== 'partner') throw httpError(401, 'Sign in to continue.');
    const rows = await many(
      `${SELECT_WALK} WHERE w.state = 'requested' AND b.partner_name = 'Unassigned'
       ORDER BY b.is_today DESC, b.id LIMIT 5`
    );
    res.json({ requests: rows.map(project) });
  })
);

router.get(
  '/:bookingId',
  asyncHandler(async (req, res) => {
    const walk = await loadWalk(req, req.params.bookingId);
    res.json({ walk: project(walk) });
  })
);

/* POST /api/app/walks/:bookingId/accept — the walker takes the request. */
router.post(
  '/:bookingId/accept',
  asyncHandler(async (req, res) => {
    if (req.app_user?.role !== 'partner') throw httpError(401, 'Sign in to continue.');

    const result = await withTransaction(async (c) => {
      const booking = (await c.query(
        `UPDATE bookings SET partner_id = $2, partner_name = $3, status = 'Confirmed'
         WHERE id = $1 AND partner_name = 'Unassigned' RETURNING *`,
        [req.params.bookingId, req.app_user.id, req.app_user.name]
      )).rows[0];
      if (!booking) throw httpError(409, 'Another walker just took that request.');

      const walk = (await c.query(
        `UPDATE walks SET state = 'accepted' WHERE booking_id = $1 RETURNING *`,
        [req.params.bookingId]
      )).rows[0];

      await c.query(
        `UPDATE booking_steps SET state = 'done', detail = 'Just now'
         WHERE booking_id = $1 AND sort = 1`, [booking.id]
      );
      await c.query(
        `INSERT INTO booking_activity (booking_id, title, detail, state)
         VALUES ($1, 'Walker accepted', $2, 'done')`,
        [booking.id, req.app_user.name]
      );

      return walk;
    });

    res.json({ walk: project(result) });
  })
);

const STATE_TO_STEP = { pickup: 2, walking: 3 };

/* POST /api/app/walks/:bookingId/state — heading to pickup, then walking. */
router.post(
  '/:bookingId/state',
  validate(z.object({ state: z.enum(['pickup', 'walking']) })),
  asyncHandler(async (req, res) => {
    if (req.app_user?.role !== 'partner') throw httpError(401, 'Sign in to continue.');

    const result = await withTransaction(async (c) => {
      const walk = (await c.query(
        `UPDATE walks w SET state = $3,
                started_at = CASE WHEN $3 = 'walking' THEN now() ELSE w.started_at END
         FROM bookings b
         WHERE w.booking_id = $1 AND b.id = w.booking_id AND b.partner_id = $2
         RETURNING w.*`,
        [req.params.bookingId, req.app_user.id, req.body.state]
      )).rows[0];
      if (!walk) throw httpError(404, 'That walk is not yours.');

      await c.query(
        `UPDATE bookings SET status = $2 WHERE id = $1`,
        [req.params.bookingId, req.body.state === 'walking' ? 'Walking now' : 'On the way']
      );
      await c.query(
        `UPDATE booking_steps SET state = 'now' WHERE booking_id = $1 AND sort = $2`,
        [req.params.bookingId, STATE_TO_STEP[req.body.state]]
      );
      await c.query(
        `UPDATE booking_steps SET state = 'done' WHERE booking_id = $1 AND sort < $2`,
        [req.params.bookingId, STATE_TO_STEP[req.body.state]]
      );

      return walk;
    });

    res.json({ walk: project(result) });
  })
);

/* POST /api/app/walks/:bookingId/end — the drag-to-end control.
   Deliberately not tap-activated in the app; the server just records the end. */
router.post(
  '/:bookingId/end',
  asyncHandler(async (req, res) => {
    if (req.app_user?.role !== 'partner') throw httpError(401, 'Sign in to continue.');

    const result = await withTransaction(async (c) => {
      const current = (await c.query(
        `SELECT w.* FROM walks w JOIN bookings b ON b.id = w.booking_id
         WHERE w.booking_id = $1 AND b.partner_id = $2`,
        [req.params.bookingId, req.app_user.id]
      )).rows[0];
      if (!current) throw httpError(404, 'That walk is not yours.');
      if (current.state === 'done') throw httpError(400, 'That walk has already ended.');

      const live = project(current);

      const walk = (await c.query(
        `UPDATE walks SET state = 'done', ended_at = now(), elapsed_secs = $2, distance_km = $3
         WHERE booking_id = $1 RETURNING *`,
        [req.params.bookingId, live.elapsed_secs, live.distance_km]
      )).rows[0];

      await c.query(
        `UPDATE bookings SET status = 'Completed', distance_km = $2 WHERE id = $1`,
        [req.params.bookingId, live.distance_km]
      );
      await c.query(`UPDATE booking_steps SET state = 'done' WHERE booking_id = $1`,
        [req.params.bookingId]);
      await c.query(
        `INSERT INTO booking_activity (booking_id, title, detail, state)
         VALUES ($1, 'Walk completed', $2, 'done')`,
        [req.params.bookingId,
         `${Math.round(live.elapsed_secs / 60)} min · ${live.distance_km} km`]
      );

      return walk;
    });

    res.json({ walk: project(result) });
  })
);

export default router;
