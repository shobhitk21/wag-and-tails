import { Router } from 'express';
import { z } from 'zod';
import { many, one, withTransaction } from '../../db/pool.js';
import { asyncHandler, httpError } from '../../middleware/error.js';
import { validate } from '../../middleware/validate.js';
import { requirePartner } from '../../middleware/appUser.js';
import { groupChecklist } from './checklist.js';

const router = Router();
router.use(requirePartner);

/* The partner app is one app with two roles. `mode` drives the whole feed —
   a groomer sees grooms, a walker sees walks — and defaults to whichever
   discipline the signed-in partner is registered for. */
const modeOf = (req) => {
  const m = req.query.mode ?? (req.app_user.kind === 'Walker' ? 'walking' : 'grooming');
  if (m !== 'grooming' && m !== 'walking') throw httpError(400, 'mode must be grooming or walking.');
  return m;
};

const SELECT_JOB = `
  SELECT b.id, b.customer_name, b.pet_id, b.pet_name, b.service_kind, b.service_label,
         b.package_id, b.walk_id, b.scheduled_label, b.date_label, b.slot_label, b.is_today,
         b.status, b.total, b.care_note, b.partner_id, b.partner_name,
         p.breed AS pet_breed, p.size AS pet_size, p.weight AS pet_weight,
         p.art AS pet_art, p.temperament, p.allergies,
         a.line1, a.line2, a.landmark,
         pk.mins AS package_mins, pk.name AS package_name,
         w.mins AS walk_mins,
         (SELECT count(*)::int FROM booking_addons ba WHERE ba.booking_id = b.id) AS addon_count
  FROM bookings b
  LEFT JOIN pets p ON p.id = b.pet_id
  LEFT JOIN customer_addresses a ON a.id = b.address_id
  LEFT JOIN packages pk ON pk.id = b.package_id
  LEFT JOIN walk_durations w ON w.id = b.walk_id
`;

/* The partner's cut, from the commission rate in settings. */
async function payoutRate(kind) {
  const key = kind === 'groom' ? 'groomer_fee' : 'walker_fee';
  const row = await one('SELECT value FROM settings WHERE key = $1', [key]);
  return 1 - parseFloat(row?.value ?? (kind === 'groom' ? '15%' : '12%')) / 100;
}

/* GET /api/app/jobs?mode=grooming|walking
   Open jobs anyone in that discipline can claim, plus this partner's own. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const mode = modeOf(req);
    const kind = mode === 'grooming' ? 'groom' : 'walk';
    const rate = await payoutRate(kind);

    const open = await many(
      `${SELECT_JOB} WHERE b.service_kind = $1 AND b.partner_name = 'Unassigned'
                       AND b.status NOT IN ('Completed','Cancelled')
       ORDER BY b.is_today DESC, b.id`,
      [kind]
    );
    const mine = await many(
      `${SELECT_JOB} WHERE b.service_kind = $1 AND b.partner_id = $2
                       AND b.status NOT IN ('Completed','Cancelled')
       ORDER BY b.is_today DESC, b.id`,
      [kind, req.app_user.id]
    );

    const withPayout = (rows) => rows.map((j) => ({ ...j, payout: Math.round(j.total * rate) }));

    res.json({ mode, open: withPayout(open), assigned: withPayout(mine) });
  })
);

/* GET /api/app/jobs/:id — the job sheet.
   The care note is the block above the checklist: the owner's own sentence,
   from the pet's row, which is the point of the whole product. */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const job = await one(`${SELECT_JOB} WHERE b.id = $1`, [req.params.id]);
    if (!job) throw httpError(404, 'No job with that ID.');
    if (job.partner_id && job.partner_id !== req.app_user.id) {
      throw httpError(403, 'That job belongs to another partner.');
    }

    const rate = await payoutRate(job.service_kind);
    const checklist = await many(
      `SELECT item_key, label, group_name, done FROM job_checklist
       WHERE booking_id = $1 ORDER BY sort`,
      [req.params.id]
    );
    const addons = await many(
      `SELECT a.name, ba.price FROM booking_addons ba JOIN addons a ON a.id = ba.addon_id
       WHERE ba.booking_id = $1`,
      [req.params.id]
    );
    const photos = await many(
      'SELECT phase, seed FROM job_photos WHERE booking_id = $1 ORDER BY id',
      [req.params.id]
    );
    const walk = job.service_kind === 'walk'
      ? await one('SELECT * FROM walks WHERE booking_id = $1', [req.params.id])
      : null;

    res.json({
      job: { ...job, payout: Math.round(job.total * rate) },
      checklist: groupChecklist(checklist),
      progress: {
        done: checklist.filter((r) => r.done).length,
        total: checklist.length
      },
      addons,
      photos,
      walk
    });
  })
);

/* POST /api/app/jobs/:id/claim */
router.post(
  '/:id/claim',
  asyncHandler(async (req, res) => {
    const job = await one(
      `UPDATE bookings SET partner_id = $2, partner_name = $3, status = 'Confirmed'
       WHERE id = $1 AND partner_name = 'Unassigned' RETURNING *`,
      [req.params.id, req.app_user.id, req.app_user.name]
    );
    if (!job) throw httpError(409, 'Another partner just took that job.');

    await one(
      `INSERT INTO booking_activity (booking_id, title, detail, state)
       VALUES ($1, 'Partner assigned', $2, 'done') RETURNING id`,
      [job.id, `${req.app_user.name} · claimed in the partner app`]
    );
    await one(
      `UPDATE booking_steps SET state = 'done', detail = 'Just now'
       WHERE booking_id = $1 AND sort = 1 RETURNING id`,
      [job.id]
    );

    res.json({ job });
  })
);

const STATUS_FLOW = {
  'On the way': 2,
  'In progress': 3
};

/* POST /api/app/jobs/:id/status — start travelling, then start work.
   Moves the customer's tracking timeline at the same time, because both read
   the same booking. */
router.post(
  '/:id/status',
  validate(z.object({ status: z.enum(['On the way', 'In progress']) })),
  asyncHandler(async (req, res) => {
    const job = await one(
      `UPDATE bookings SET status = $3 WHERE id = $1 AND partner_id = $2 RETURNING *`,
      [req.params.id, req.app_user.id, req.body.status]
    );
    if (!job) throw httpError(404, 'That job is not assigned to you.');

    await one(
      `UPDATE booking_steps SET state = 'now' WHERE booking_id = $1 AND sort = $2 RETURNING id`,
      [job.id, STATUS_FLOW[req.body.status]]
    );
    await one(
      `UPDATE booking_steps SET state = 'done' WHERE booking_id = $1 AND sort < $2 RETURNING id`,
      [job.id, STATUS_FLOW[req.body.status]]
    );

    res.json({ job });
  })
);

/* POST /api/app/jobs/:id/checklist — tick one row. */
router.post(
  '/:id/checklist',
  validate(z.object({ itemKey: z.string().trim().min(1), done: z.boolean() })),
  asyncHandler(async (req, res) => {
    const owned = await one(
      'SELECT id FROM bookings WHERE id = $1 AND partner_id = $2',
      [req.params.id, req.app_user.id]
    );
    if (!owned) throw httpError(404, 'That job is not assigned to you.');

    const row = await one(
      `UPDATE job_checklist SET done = $3 WHERE booking_id = $1 AND item_key = $2 RETURNING *`,
      [req.params.id, req.body.itemKey, req.body.done]
    );
    if (!row) throw httpError(404, 'No such checklist row.');

    const [progress] = await many(
      `SELECT count(*) FILTER (WHERE done)::int AS done, count(*)::int AS total
       FROM job_checklist WHERE booking_id = $1`,
      [req.params.id]
    );

    res.json({ item: row, progress });
  })
);

router.post(
  '/:id/photos',
  validate(z.object({ phase: z.enum(['before', 'after']) })),
  asyncHandler(async (req, res) => {
    const owned = await one(
      'SELECT id FROM bookings WHERE id = $1 AND partner_id = $2',
      [req.params.id, req.app_user.id]
    );
    if (!owned) throw httpError(404, 'That job is not assigned to you.');

    /* Photographs are generated illustrations in this build, as the Build Book
       records — the seed is what makes each one stable. */
    const photo = await one(
      `INSERT INTO job_photos (booking_id, phase, seed) VALUES ($1,$2,$3) RETURNING *`,
      [req.params.id, req.body.phase, `${req.params.id}-${req.body.phase}-${Date.now()}`]
    );
    res.json({ photo });
  })
);

/* POST /api/app/jobs/:id/complete — gated on every checklist row, exactly as
   the prototype gated it. */
router.post(
  '/:id/complete',
  asyncHandler(async (req, res) => {
    const result = await withTransaction(async (c) => {
      const job = (await c.query(
        'SELECT * FROM bookings WHERE id = $1 AND partner_id = $2',
        [req.params.id, req.app_user.id]
      )).rows[0];
      if (!job) throw httpError(404, 'That job is not assigned to you.');

      const [{ pending }] = (await c.query(
        `SELECT count(*) FILTER (WHERE NOT done)::int AS pending
         FROM job_checklist WHERE booking_id = $1`,
        [job.id]
      )).rows;
      if (pending > 0) {
        throw httpError(400, `${pending} checklist row${pending === 1 ? '' : 's'} still to tick.`);
      }

      const done = (await c.query(
        `UPDATE bookings SET status = 'Completed' WHERE id = $1 RETURNING *`, [job.id]
      )).rows[0];

      await c.query(`UPDATE booking_steps SET state = 'done' WHERE booking_id = $1`, [job.id]);
      await c.query(
        `INSERT INTO booking_activity (booking_id, title, detail, state)
         VALUES ($1, 'Service completed', $2, 'done')`,
        [job.id, `Completed by ${req.app_user.name}`]
      );

      /* The visit joins the pet's grooming history, which is what the owner
         sees on the pet profile afterwards. */
      if (job.pet_id && job.package_id) {
        await c.query(
          `INSERT INTO pet_visits (code, pet_id, visited_on, package_id, partner_id, mins, sort)
           VALUES ($1,$2,$3,$4,$5,$6,0) ON CONFLICT (code) DO NOTHING`,
          [`v-${job.id}`, job.pet_id, job.date_label ?? 'Today', job.package_id,
           req.app_user.id, null]
        );
      }

      return done;
    });

    res.json({ job: result });
  })
);

export default router;
