import { Router } from 'express';
import { z } from 'zod';
import { many, one, withTransaction } from '../../db/pool.js';
import { asyncHandler, httpError } from '../../middleware/error.js';
import { validate } from '../../middleware/validate.js';

const router = Router();

/* The Indian Pet Company store, shared by both apps.
   One catalogue, two price ladders: retail in the customer app, trade in the
   partner app. Which ladder applies is decided here from who is signed in —
   never sent by the client. */
function ladder(req) {
  if (!req.app_user) throw httpError(401, 'Sign in to continue.');
  return req.app_user.role === 'partner'
    ? { pricing: 'trade', column: 'trade' }
    : { pricing: 'retail', column: 'price' };
}

const priceOf = (p, column) => (column === 'trade' ? p.trade : p.price);

/* GET /api/app/store — catalogue at the caller's price ladder. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { pricing, column } = ladder(req);
    const category = req.query.category;

    const rows = await many(
      `SELECT id, name, category_id, art, tone, mrp, price, trade, rating, reviews,
              sizes, default_size, tag, stock, description, bullets, ingredients, contains
       FROM products ${category ? 'WHERE category_id = $1' : ''} ORDER BY sort`,
      category ? [category] : []
    );
    const categories = await many('SELECT id, name, icon FROM product_categories ORDER BY sort');

    const products = rows.map((p) => ({
      ...p,
      pricing,
      now: priceOf(p, column),
      /* Partners see trade against retail; customers see retail against MRP. */
      was: column === 'trade' ? p.price : p.mrp
    }));

    res.json({ pricing, products, categories });
  })
);

/* GET /api/app/store/products/:id
   A customer also gets the allergy check: the product's ingredients are
   cross-referenced against every pet on the account, which is why chicken
   kibble is flagged for a dog that reacts to chicken. */
router.get(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const { pricing, column } = ladder(req);

    const p = await one('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (!p) throw httpError(404, 'No product with that ID.');

    let allergyWarnings = [];
    if (req.app_user.role === 'customer') {
      const pets = await many(
        'SELECT name, allergies FROM pets WHERE customer_id = $1 AND allergies IS NOT NULL',
        [req.app_user.id]
      );
      const haystack = `${p.ingredients ?? ''} ${(p.contains ?? []).join(' ')}`.toLowerCase();
      allergyWarnings = pets
        .filter((pet) => {
          const words = pet.allergies.toLowerCase().match(/[a-z]{4,}/g) ?? [];
          return words.some((w) => haystack.includes(w));
        })
        .map((pet) => ({ pet: pet.name, allergies: pet.allergies }));
    }

    res.json({
      product: { ...p, pricing, now: priceOf(p, column), was: column === 'trade' ? p.price : p.mrp },
      allergyWarnings
    });
  })
);

/* The caller's cart, created on first use. */
async function getCart(c, req) {
  const { pricing } = ladder(req);
  const owner = { kind: req.app_user.role, id: req.app_user.id };

  const existing = (await c.query(
    'SELECT * FROM carts WHERE owner_kind = $1 AND owner_id = $2',
    [owner.kind, owner.id]
  )).rows[0];
  if (existing) return existing;

  return (await c.query(
    `INSERT INTO carts (owner_kind, owner_id, pricing) VALUES ($1,$2,$3) RETURNING *`,
    [owner.kind, owner.id, pricing]
  )).rows[0];
}

async function cartBody(c, cart, column) {
  const items = (await c.query(
    `SELECT i.id, i.qty, i.size_index, p.id AS product_id, p.name, p.art, p.tone,
            p.sizes, p.mrp, p.price, p.trade
     FROM cart_items i JOIN products p ON p.id = i.product_id
     WHERE i.cart_id = $1 ORDER BY i.id`,
    [cart.id]
  )).rows;

  const lines = items.map((i) => {
    const unit = priceOf(i, column);
    const was = column === 'trade' ? i.price : i.mrp;
    return {
      ...i,
      size_label: i.sizes[i.size_index] ?? i.sizes[0] ?? null,
      unit,
      was,
      lineTotal: unit * i.qty,
      lineSaving: Math.max(was - unit, 0) * i.qty
    };
  });

  return {
    pricing: cart.pricing,
    items: lines,
    count: lines.reduce((s, l) => s + l.qty, 0),
    total: lines.reduce((s, l) => s + l.lineTotal, 0),
    savings: lines.reduce((s, l) => s + l.lineSaving, 0)
  };
}

router.get(
  '/cart',
  asyncHandler(async (req, res) => {
    const { column } = ladder(req);
    const result = await withTransaction(async (c) => {
      const cart = await getCart(c, req);
      return cartBody(c, cart, column);
    });
    res.json(result);
  })
);

router.post(
  '/cart',
  validate(z.object({
    productId: z.string().trim().min(1),
    sizeIndex: z.coerce.number().int().min(0).optional().default(0),
    qty: z.coerce.number().int().min(1).max(20).optional().default(1)
  })),
  asyncHandler(async (req, res) => {
    const { column } = ladder(req);
    const result = await withTransaction(async (c) => {
      const cart = await getCart(c, req);
      const product = (await c.query('SELECT id FROM products WHERE id = $1',
        [req.body.productId])).rows[0];
      if (!product) throw httpError(404, 'No product with that ID.');

      await c.query(
        `INSERT INTO cart_items (cart_id, product_id, size_index, qty)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (cart_id, product_id, size_index)
         DO UPDATE SET qty = cart_items.qty + EXCLUDED.qty`,
        [cart.id, req.body.productId, req.body.sizeIndex, req.body.qty]
      );
      await c.query('UPDATE carts SET updated_at = now() WHERE id = $1', [cart.id]);
      return cartBody(c, cart, column);
    });
    res.json(result);
  })
);

router.patch(
  '/cart/:itemId',
  validate(z.object({ qty: z.coerce.number().int().min(0).max(20) })),
  asyncHandler(async (req, res) => {
    const { column } = ladder(req);
    const result = await withTransaction(async (c) => {
      const cart = await getCart(c, req);
      if (req.body.qty === 0) {
        await c.query('DELETE FROM cart_items WHERE id = $1 AND cart_id = $2',
          [req.params.itemId, cart.id]);
      } else {
        await c.query('UPDATE cart_items SET qty = $3 WHERE id = $1 AND cart_id = $2',
          [req.params.itemId, cart.id, req.body.qty]);
      }
      return cartBody(c, cart, column);
    });
    res.json(result);
  })
);

/* POST /api/app/store/checkout — turns the cart into a real order. */
router.post(
  '/checkout',
  validate(z.object({ address: z.string().trim().optional().default('') })),
  asyncHandler(async (req, res) => {
    const { pricing, column } = ladder(req);
    const me = req.app_user;

    const order = await withTransaction(async (c) => {
      const cart = await getCart(c, req);
      const body = await cartBody(c, cart, column);
      if (!body.items.length) throw httpError(400, 'Your cart is empty.');

      const id = (await c.query(
        `SELECT 'IPC' || (COALESCE(MAX(substring(id from 4)::int), 4400) + 1)::text AS id
         FROM store_orders WHERE id ~ '^IPC[0-9]+$'`
      )).rows[0].id;

      let address = req.body.address;
      if (!address && me.role === 'customer') {
        const a = (await c.query(
          `SELECT line1, line2 FROM customer_addresses
           WHERE customer_id = $1 AND is_default LIMIT 1`, [me.id]
        )).rows[0];
        if (a) address = [a.line1, a.line2].filter(Boolean).join(', ');
      }

      const created = (await c.query(
        `INSERT INTO store_orders (id, customer_id, partner_id, customer_name, placed_label,
                                   item_count, total, status, channel, pricing, address)
         VALUES ($1,$2,$3,$4,'Just now',$5,$6,'Packed',$7,$8,$9) RETURNING *`,
        [id,
         me.role === 'customer' ? me.id : null,
         me.role === 'partner' ? me.id : null,
         me.name, body.count, body.total,
         me.role === 'partner' ? 'Partner' : 'App', pricing, address || null]
      )).rows[0];

      for (const l of body.items) {
        await c.query(
          `INSERT INTO store_order_items (order_id, product_id, qty, size_label, unit_price)
           VALUES ($1,$2,$3,$4,$5)`,
          [id, l.product_id, l.qty, l.size_label, l.unit]
        );
      }

      const steps = [
        ['Order placed', 'Just now', true],
        ['Packed', '', false],
        ['Out for delivery', '', false],
        ['Delivered', '', false]
      ];
      let i = 0;
      for (const [title, detail, done] of steps) {
        await c.query(
          `INSERT INTO store_order_steps (order_id, title, detail, done, sort)
           VALUES ($1,$2,$3,$4,$5)`,
          [id, title, detail || null, done, i++]
        );
      }

      await c.query('DELETE FROM cart_items WHERE cart_id = $1', [cart.id]);
      return created;
    });

    res.status(201).json({ order });
  })
);

router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const me = req.app_user;
    if (!me) throw httpError(401, 'Sign in to continue.');
    const orders = await many(
      `SELECT id, placed_label, item_count, total, status, channel, pricing
       FROM store_orders WHERE ${me.role === 'customer' ? 'customer_id' : 'partner_id'} = $1
       ORDER BY created_at DESC, id DESC`,
      [me.id]
    );
    res.json({ orders });
  })
);

router.get(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    const me = req.app_user;
    if (!me) throw httpError(401, 'Sign in to continue.');

    const order = await one(
      `SELECT * FROM store_orders
       WHERE id = $1 AND ${me.role === 'customer' ? 'customer_id' : 'partner_id'} = $2`,
      [req.params.id, me.id]
    );
    if (!order) throw httpError(404, 'No order with that ID on your account.');

    const items = await many(
      `SELECT i.qty, i.size_label, i.unit_price, p.id AS product_id, p.name, p.art, p.tone
       FROM store_order_items i JOIN products p ON p.id = i.product_id
       WHERE i.order_id = $1 ORDER BY i.id`,
      [req.params.id]
    );
    const steps = await many(
      'SELECT title, detail, done FROM store_order_steps WHERE order_id = $1 ORDER BY sort',
      [req.params.id]
    );

    res.json({ order, items, steps });
  })
);

export default router;
