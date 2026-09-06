import { Router } from 'express';
import { z } from 'zod';
import { many, one } from '../../db/pool.js';
import { asyncHandler, httpError } from '../../middleware/error.js';
import { validate } from '../../middleware/validate.js';
import { requireAdmin } from '../../middleware/webAuth.js';

/* Customers and partners — the Directory group in the staff sidebar, and the
   People group in the admin sidebar. Both consoles read the same rows; only
   the write actions below are admin-only. */

export const customers = Router();

/* Pets, bookings and lifetime value are counted from the rows themselves, not
   read from the stored columns. Those columns were decorative in the prototype,
   and a directory that disagrees with its own detail page is worse than a
   smaller number. `since_label` stays as recorded — it predates this data. */
const CUSTOMER_COUNTS = `
  SELECT c.id, c.name, c.phone, c.area, c.address, c.since_label,
         (SELECT count(*) FROM pets p WHERE p.customer_id = c.id)::int AS pets_count,
         (SELECT count(*) FROM bookings b WHERE b.customer_id = c.id)::int AS bookings_count,
         (SELECT COALESCE(sum(b.total), 0) FROM bookings b
           WHERE b.customer_id = c.id AND b.status <> 'Cancelled')::int AS lifetime_spend
  FROM customers c
`;

customers.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = await many(`${CUSTOMER_COUNTS} ORDER BY c.id`);
    res.json({ customers: rows, total: rows.length });
  })
);

customers.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const customer = await one(`${CUSTOMER_COUNTS} WHERE c.id = $1`, [req.params.id]);
    if (!customer) throw httpError(404, 'No customer with that ID.');

    const bookings = await many(
      `SELECT id, service_label, scheduled_label, partner_name, total, status
       FROM bookings WHERE customer_id = $1 ORDER BY created_at DESC, id DESC`,
      [req.params.id]
    );
    const pets = await many(
      'SELECT id, name, breed, weight, care_note FROM pets WHERE customer_id = $1 ORDER BY id',
      [req.params.id]
    );
    const orders = await many(
      `SELECT id, placed_label, item_count, total, status, channel
       FROM store_orders WHERE customer_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );

    res.json({ customer, bookings, pets, orders });
  })
);

export const partners = Router();

partners.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = await many(`
      SELECT id, name, kind, rating, jobs, area, status, docs_status, pending_payout, phone
      FROM partners ORDER BY id
    `);
    res.json({
      partners: rows,
      total: rows.length,
      pending: rows.filter((p) => p.status === 'Pending').length
    });
  })
);

partners.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const partner = await one('SELECT * FROM partners WHERE id = $1', [req.params.id]);
    if (!partner) throw httpError(404, 'No partner with that ID.');

    const documents = await many(
      'SELECT name, detail, verified FROM partner_documents WHERE partner_id = $1 ORDER BY sort',
      [req.params.id]
    );
    const bookings = await many(
      `SELECT id, customer_name, service_label, scheduled_label, total, status
       FROM bookings WHERE partner_id = $1 ORDER BY created_at DESC, id DESC`,
      [req.params.id]
    );

    res.json({ partner, documents, bookings });
  })
);

/* Approving an applicant is the one partner action the Build Book lists as
   admin-only work, so it is guarded rather than merely hidden in the UI. */
partners.post(
  '/:id/approve',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const partner = await one(
      `UPDATE partners SET status = 'Active', docs_status = 'Verified'
       WHERE id = $1 AND status = 'Pending' RETURNING *`,
      [req.params.id]
    );
    if (!partner) throw httpError(404, 'No pending partner with that ID.');
    await one(
      'UPDATE partner_documents SET verified = TRUE WHERE partner_id = $1 RETURNING id',
      [req.params.id]
    );
    res.json({ partner });
  })
);

partners.post(
  '/:id/status',
  requireAdmin,
  validate(z.object({ status: z.enum(['Active', 'Pending', 'Suspended']) })),
  asyncHandler(async (req, res) => {
    const partner = await one(
      'UPDATE partners SET status = $2 WHERE id = $1 RETURNING *',
      [req.params.id, req.body.status]
    );
    if (!partner) throw httpError(404, 'No partner with that ID.');
    res.json({ partner });
  })
);
