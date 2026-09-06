/* Truncates every seeded table and reloads it from seed-data.js.
   Safe to re-run; it never touches schema_migrations. */
import bcrypt from 'bcryptjs';
import { pool, withTransaction } from './pool.js';
import * as D from './seed-data.js';
import * as A from './seed-apps.js';
import { seedApps } from './seed-apps-run.js';

/* Every seeded staff/admin account signs in with this — matches
   DEMO_PASSWORD in modules/users/auth.routes.js. Hashed once per run rather
   than per row; bcrypt is deliberately slow and there's no benefit to paying
   that cost four times for an identical string. */
const DEMO_PASSWORD_HASH = bcrypt.hashSync('Wagtails@123', 10);

const TABLES = [
  /* app tables first — they reference the console tables below */
  'cart_items', 'carts', 'store_order_steps', 'job_photos', 'job_checklist',
  'walks', 'partner_earnings', 'booking_steps', 'booking_addons',
  'pet_visits', 'pet_vaccines', 'customer_addresses', 'payment_methods',
  'reviews', 'notifications', 'faqs', 'breeds', 'cancel_reasons', 'otp_codes',
  'booking_activity', 'store_order_items', 'store_orders', 'bookings',
  'partner_documents', 'pets', 'package_inclusions', 'packages', 'addons',
  'walk_durations', 'products', 'product_categories', 'coupons',
  'partners', 'customers', 'staff_users',
  'service_areas', 'booking_slots', 'settings', 'integrations', 'staff_permissions',
  'monthly_revenue', 'metrics', 'channel_split', 'revenue_lines'
];

async function seed() {
  await withTransaction(async (c) => {
    await c.query(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);

    /* ---------- people ---------- */
    for (const s of D.STAFF_USERS) {
      await c.query(
        `INSERT INTO staff_users (code, name, email, role, shift, active, handled_today, art_from, art_to, password_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [s.code, s.name, s.email, s.role, s.shift, s.active, s.handled, s.art[0], s.art[1], DEMO_PASSWORD_HASH]
      );
    }

    for (const x of D.CUSTOMERS) {
      await c.query(
        `INSERT INTO customers (id, name, phone, area, pets_count, bookings_count, lifetime_spend, since_label)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [x.id, x.name, x.phone, x.area, x.pets, x.bookings, x.spend, x.since]
      );
    }

    for (const p of D.PARTNERS) {
      await c.query(
        `INSERT INTO partners (id, name, kind, rating, jobs, area, phone, status, docs_status, pending_payout, payout_account)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [p.id, p.name, p.kind, p.rating, p.jobs, p.area, p.phone, p.status, p.docs, p.payout, p.account]
      );
      /* Every partner carries the same four-document checklist; the police
         verification is the one flagged as due for renewal. */
      let i = 0;
      for (const d of D.PARTNER_DOCUMENTS) {
        await c.query(
          `INSERT INTO partner_documents (partner_id, name, detail, verified, sort) VALUES ($1,$2,$3,$4,$5)`,
          [p.id, d.name, d.detail, p.status === 'Pending' ? false : d.ok, i++]
        );
      }
    }

    /* The three pets with full health records come from seed-apps; Bruno and
       Coco belong to other customers and carry a care note and portrait only. */
    const petIds = {};
    const full = Object.fromEntries(A.PET_RECORDS.map((r) => [r.code, r]));

    for (const p of D.PETS) {
      const r = full[p.code];
      const art = r ? r.art : (A.EXTRA_PET_ART[p.name] ?? {});
      const { rows } = await c.query(
        `INSERT INTO pets (code, customer_id, name, breed, weight, care_note,
                           age, dob, sex, size, neutered, coat, temperament, allergies,
                           vaccinated, next_vaccine, microchip, vet, vet_clinic, vet_phone, art)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         RETURNING id`,
        [p.code, p.customer, p.name, p.breed, p.weight, p.careNote,
         r?.age ?? null, r?.dob ?? null, r?.sex ?? null, r?.size ?? null, r?.neutered ?? null,
         r?.coat ?? null, r?.temperament ?? null, r?.allergies ?? null,
         r?.vaccinated ?? null, r?.nextVaccine ?? null, r?.microchip ?? null,
         r?.vet ?? null, r?.vetClinic ?? null, r?.vetPhone ?? null, JSON.stringify(art)]
      );
      petIds[p.name] = rows[0].id;
    }

    /* ---------- catalogue ---------- */
    let sort = 0;
    for (const p of D.PACKAGES) {
      await c.query(
        `INSERT INTO packages (id, name, blurb, mrp, price, mins, popular, sort)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [p.id, p.name, p.blurb, p.mrp, p.price, p.mins, !!p.popular, sort++]
      );
      let i = 0;
      for (const item of p.incl) {
        await c.query(
          `INSERT INTO package_inclusions (package_id, item, sort) VALUES ($1,$2,$3)`,
          [p.id, item, i++]
        );
      }
    }

    sort = 0;
    for (const a of D.ADDONS) {
      await c.query(
        `INSERT INTO addons (id, name, price, note, attach_rate, sort) VALUES ($1,$2,$3,$4,$5,$6)`,
        [a.id, a.name, a.price, a.note, a.attachRate, sort++]
      );
    }

    sort = 0;
    for (const w of D.WALK_DURATIONS) {
      await c.query(
        `INSERT INTO walk_durations (id, mins, price, note, km, provisional, sort)
         VALUES ($1,$2,$3,$4,$5,TRUE,$6)`,
        [w.id, w.mins, w.price, w.note, w.km, sort++]
      );
    }

    sort = 0;
    for (const cat of D.PRODUCT_CATEGORIES) {
      await c.query(
        `INSERT INTO product_categories (id, name, icon, sort) VALUES ($1,$2,$3,$4)`,
        [cat.id, cat.name, cat.icon, sort++]
      );
    }

    sort = 0;
    for (const p of D.PRODUCTS) {
      await c.query(
        `INSERT INTO products (id, name, category_id, art, tone, mrp, price, trade, rating, reviews,
                               sizes, default_size, tag, stock, description, bullets, ingredients, contains, sort)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [p.id, p.name, p.cat, p.art, p.tone, p.mrp, p.price, p.trade, p.rating, p.reviews,
         p.sizes, p.size, p.tag ?? null, p.stock, p.desc, p.bullets, p.ingredients, p.contains ?? [], sort++]
      );
    }

    sort = 0;
    for (const x of D.COUPONS) {
      await c.query(
        `INSERT INTO coupons (code, title, subtitle, applies_to, expires_on, redeemed, active, sort)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [x.code, x.title, x.subtitle, x.appliesTo, x.expires, x.redeemed, x.active, sort++]
      );
    }

    /* ---------- operations ---------- */
    for (const b of D.BOOKINGS) {
      const pet = petIds[b.pet] ?? null;
      await c.query(
        `INSERT INTO bookings (id, customer_id, customer_name, pet_id, pet_name, service_kind, service_label,
                               package_id, walk_id, scheduled_label, is_today, partner_id, partner_name,
                               status, total, channel, care_note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
                 (SELECT care_note FROM pets WHERE id = $4))`,
        [b.id, b.customer, b.who, pet, b.pet, b.kind, b.svc, b.packageId ?? null, b.walkId ?? null,
         b.when, b.today, b.partnerId, b.partner, b.status, b.total, b.channel]
      );

      const assigned = b.partner !== 'Unassigned';
      const activity = [
        ['Booking created', b.channel === 'App' ? 'By the customer in the app' : `Entered by Nikhil · ${b.channel}`, 'done'],
        [`Partner ${assigned ? 'assigned' : 'not yet assigned'}`, b.partner, 'done'],
        ['Visible in the partner app',
          assigned ? 'With the care notes attached' : 'Published as an open job', 'now']
      ];
      for (const [title, detail, state] of activity) {
        await c.query(
          `INSERT INTO booking_activity (booking_id, title, detail, state) VALUES ($1,$2,$3,$4)`,
          [b.id, title, detail, state]
        );
      }
    }

    for (const o of D.STORE_ORDERS) {
      await c.query(
        `INSERT INTO store_orders (id, customer_id, customer_name, placed_label, item_count, total, status, channel)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [o.id, o.customer, o.who, o.when, o.items, o.total, o.status, o.channel]
      );
      /* The prototype rendered PRODUCTS.slice(0, o.items) as the line items;
         seeding real rows makes the order detail page a genuine join. */
      const picks = D.PRODUCTS.slice(0, o.items);
      for (const p of picks) {
        await c.query(
          `INSERT INTO store_order_items (order_id, product_id, qty, size_label, unit_price)
           VALUES ($1,$2,1,$3,$4)`,
          [o.id, p.id, p.sizes[p.size], p.price]
        );
      }
    }

    /* ---------- configuration ---------- */
    sort = 0;
    for (const a of D.SERVICE_AREAS) {
      await c.query(
        `INSERT INTO service_areas (name, groomers, walkers, status, sort) VALUES ($1,$2,$3,$4,$5)`,
        [a.name, a.groomers, a.walkers, a.status, sort++]
      );
    }

    sort = 0;
    for (const s of D.BOOKING_SLOTS) {
      await c.query(
        `INSERT INTO booking_slots (label, enabled, tag, sort) VALUES ($1,$2,$3,$4)`,
        [s.label, s.enabled, s.tag ?? null, sort++]
      );
    }

    sort = 0;
    for (const s of D.SETTINGS) {
      await c.query(
        `INSERT INTO settings (key, value, label, group_name, sort) VALUES ($1,$2,$3,$4,$5)`,
        [s.key, s.value, s.label, s.group, sort++]
      );
    }

    sort = 0;
    for (const i of D.INTEGRATIONS) {
      await c.query(
        `INSERT INTO integrations (name, detail, icon, status, sort) VALUES ($1,$2,$3,$4,$5)`,
        [i.name, i.detail, i.icon, i.status, sort++]
      );
    }

    sort = 0;
    for (const p of D.STAFF_PERMISSIONS) {
      await c.query(
        `INSERT INTO staff_permissions (capability, bookings_staff, support, super_admin, sort)
         VALUES ($1,$2,$3,$4,$5)`,
        [p.capability, p.bookingsStaff, p.support, p.superAdmin, sort++]
      );
    }

    /* ---------- reporting ---------- */
    sort = 0;
    for (const m of D.MONTHLY_REVENUE) {
      await c.query(
        `INSERT INTO monthly_revenue (month_label, value_thousands, is_current, sort) VALUES ($1,$2,$3,$4)`,
        [m.label, m.value, !!m.current, sort++]
      );
    }

    sort = 0;
    for (const m of D.METRICS) {
      await c.query(
        `INSERT INTO metrics (key, label, value, delta, positive, group_name, sort)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [m.key, m.label, m.value, m.delta, m.positive, m.group, sort++]
      );
    }

    sort = 0;
    for (const x of D.CHANNEL_SPLIT) {
      await c.query(
        `INSERT INTO channel_split (label, percentage, colour, sort) VALUES ($1,$2,$3,$4)`,
        [x.label, x.percentage, x.colour, sort++]
      );
    }

    sort = 0;
    for (const r of D.REVENUE_LINES) {
      await c.query(
        `INSERT INTO revenue_lines (line, revenue, share, growth, sort) VALUES ($1,$2,$3,$4,$5)`,
        [r.line, r.revenue, r.share, r.growth, sort++]
      );
    }

    await seedApps(c, petIds);
  });

  const counts = {};
  for (const t of ['staff_users', 'customers', 'partners', 'pets', 'pet_vaccines', 'pet_visits',
                   'packages', 'products', 'bookings', 'booking_addons', 'booking_steps',
                   'job_checklist', 'partner_earnings', 'store_orders', 'reviews',
                   'notifications', 'coupons', 'service_areas']) {
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${t}`);
    counts[t] = rows[0].n;
  }
  console.log('[seed] done');
  console.table(counts);
}

seed()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error('[seed] FAILED:', err.message);
    await pool.end();
    process.exit(1);
  });
