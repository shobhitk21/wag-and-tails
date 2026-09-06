import { Router } from 'express';
import { z } from 'zod';
import { many, one } from '../../db/pool.js';
import { asyncHandler, httpError } from '../../middleware/error.js';
import { validate } from '../../middleware/validate.js';

const router = Router();

/* GET /api/orders — the Store orders table, shared by both consoles. */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const orders = await many(`
      SELECT id, customer_id, customer_name, placed_label, item_count, total, status, channel
      FROM store_orders ORDER BY created_at DESC, id DESC
    `);
    res.json({ orders, total: orders.length });
  })
);

/* GET /api/orders/:id — line items are a real join now, not the first N
   products the prototype sliced off the catalogue. */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await one('SELECT * FROM store_orders WHERE id = $1', [req.params.id]);
    if (!order) throw httpError(404, 'No order with that ID.');

    const items = await many(
      `SELECT i.id, i.qty, i.size_label, i.unit_price,
              p.id AS product_id, p.name, p.art, p.tone
       FROM store_order_items i
       JOIN products p ON p.id = i.product_id
       WHERE i.order_id = $1 ORDER BY i.id`,
      [req.params.id]
    );

    res.json({ order, items });
  })
);

const STATUSES = ['Packed', 'Out for delivery', 'Delivered', 'Cancelled'];

/* POST /api/orders/:id/status — fulfilment, the one thing staff actually do
   to an order from the portal. */
router.post(
  '/:id/status',
  validate(z.object({ status: z.enum(STATUSES) })),
  asyncHandler(async (req, res) => {
    const order = await one(
      'UPDATE store_orders SET status = $2 WHERE id = $1 RETURNING *',
      [req.params.id, req.body.status]
    );
    if (!order) throw httpError(404, 'No order with that ID.');
    res.json({ order });
  })
);

export default router;
