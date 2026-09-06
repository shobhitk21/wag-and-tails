import { Router } from 'express';
import { z } from 'zod';
import { many, one } from '../../db/pool.js';
import { asyncHandler, httpError } from '../../middleware/error.js';
import { validate } from '../../middleware/validate.js';
import { requireAdmin } from '../../middleware/webAuth.js';

const router = Router();

/* GET /api/catalogue/services — everything the staff booking form needs to
   price a job: packages with their inclusions, add-ons, walk durations and the
   enabled slots. One request, because the form needs all of it at once. */
router.get(
  '/services',
  asyncHandler(async (_req, res) => {
    const packages = await many(`
      SELECT p.id, p.name, p.blurb, p.mrp, p.price, p.mins, p.popular, p.active,
             COALESCE(array_agg(i.item ORDER BY i.sort) FILTER (WHERE i.item IS NOT NULL), '{}') AS inclusions
      FROM packages p
      LEFT JOIN package_inclusions i ON i.package_id = p.id
      GROUP BY p.id ORDER BY p.sort
    `);
    const addons = await many('SELECT id, name, price, note, attach_rate FROM addons ORDER BY sort');
    const walks = await many(
      'SELECT id, mins, price, note, km, provisional FROM walk_durations ORDER BY sort'
    );
    const slots = await many('SELECT label, enabled, tag FROM booking_slots ORDER BY sort');

    res.json({ packages, addons, walks, slots });
  })
);

/* GET /api/catalogue/products — margin is computed, not stored, so it can
   never drift from the two prices it is derived from. */
router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const category = req.query.category;
    const products = await many(
      `SELECT p.id, p.name, p.category_id, c.name AS category_name, p.art, p.tone,
              p.mrp, p.price, p.trade, p.rating, p.reviews, p.sizes, p.default_size,
              p.tag, p.stock,
              round((1 - p.trade::numeric / NULLIF(p.price, 0)) * 100)::int AS margin
       FROM products p
       LEFT JOIN product_categories c ON c.id = p.category_id
       ${category ? 'WHERE p.category_id = $1' : ''}
       ORDER BY p.sort`,
      category ? [category] : []
    );
    const categories = await many('SELECT id, name, icon FROM product_categories ORDER BY sort');
    res.json({ products, categories, total: products.length });
  })
);

router.get(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const product = await one(
      `SELECT p.*, c.name AS category_name,
              round((1 - p.trade::numeric / NULLIF(p.price, 0)) * 100)::int AS margin
       FROM products p
       LEFT JOIN product_categories c ON c.id = p.category_id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (!product) throw httpError(404, 'No product with that ID.');

    /* Units sold and revenue over the last 30 days, from real order lines. */
    const [performance] = await many(
      `SELECT COALESCE(sum(i.qty), 0)::int AS units,
              COALESCE(sum(i.qty * i.unit_price), 0)::int AS revenue
       FROM store_order_items i
       JOIN store_orders o ON o.id = i.order_id
       WHERE i.product_id = $1 AND o.created_at > now() - interval '30 days'`,
      [req.params.id]
    );

    res.json({ product, performance });
  })
);

/* PATCH /api/catalogue/products/:id — editing the catalogue is admin work. */
router.patch(
  '/products/:id',
  requireAdmin,
  validate(z.object({
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().optional(),
    ingredients: z.string().trim().optional(),
    mrp: z.coerce.number().int().nonnegative().optional(),
    price: z.coerce.number().int().nonnegative().optional(),
    trade: z.coerce.number().int().nonnegative().optional(),
    stock: z.string().trim().optional()
  })),
  asyncHandler(async (req, res) => {
    const fields = Object.entries(req.body);
    if (!fields.length) throw httpError(400, 'Nothing to update.');

    const set = fields.map(([k], i) => `${k} = $${i + 2}`).join(', ');
    const product = await one(
      `UPDATE products SET ${set} WHERE id = $1 RETURNING *`,
      [req.params.id, ...fields.map(([, v]) => v)]
    );
    if (!product) throw httpError(404, 'No product with that ID.');
    res.json({ product });
  })
);

/* GET /api/catalogue/packages — the admin packages screen: partner payout is
   derived from the commission rate in settings, so changing the rate moves
   every payout figure at once. */
router.get(
  '/packages',
  asyncHandler(async (_req, res) => {
    const [fees] = await many(`
      SELECT
        COALESCE(max(value) FILTER (WHERE key = 'groomer_fee'), '15%') AS groomer_fee,
        COALESCE(max(value) FILTER (WHERE key = 'walker_fee'),  '12%') AS walker_fee
      FROM settings
    `);
    const groomerRate = 1 - parseFloat(fees.groomer_fee) / 100;
    const walkerRate = 1 - parseFloat(fees.walker_fee) / 100;

    const packages = await many(`
      SELECT p.id, p.name, p.blurb, p.mrp, p.price, p.mins, p.popular, p.active,
             count(i.id)::int AS inclusion_count
      FROM packages p
      LEFT JOIN package_inclusions i ON i.package_id = p.id
      GROUP BY p.id ORDER BY p.sort
    `);
    const addons = await many('SELECT id, name, price, note, attach_rate FROM addons ORDER BY sort');
    const walks = await many(
      'SELECT id, mins, price, note, km, provisional FROM walk_durations ORDER BY sort'
    );

    res.json({
      packages: packages.map((p) => ({ ...p, partner_payout: Math.round(p.price * groomerRate) })),
      addons,
      walks: walks.map((w) => ({ ...w, partner_payout: Math.round(w.price * walkerRate) })),
      fees
    });
  })
);

router.get(
  '/coupons',
  asyncHandler(async (_req, res) => {
    const coupons = await many(
      'SELECT id, code, title, subtitle, applies_to, expires_on, redeemed, active FROM coupons ORDER BY sort'
    );
    res.json({ coupons, active: coupons.filter((c) => c.active).length });
  })
);

router.post(
  '/coupons/:id/toggle',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const coupon = await one(
      'UPDATE coupons SET active = NOT active WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!coupon) throw httpError(404, 'No coupon with that ID.');
    res.json({ coupon });
  })
);

export default router;
