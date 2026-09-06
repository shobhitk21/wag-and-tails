/* Second phase of the seed: everything only the two apps need.
   Runs inside the same transaction, after the console tables are loaded. */
import * as A from './seed-apps.js';

/* Groups a package's inclusions the way the groomer's checklist groups them.
   Ported from inclGroup() in js/data.js. */
function inclGroup(item) {
  const s = item.toLowerCase();
  if (/tick/.test(s)) return 'Tick care';
  if (/bath|blow dry|shampoo|conditioner/.test(s)) return 'Bath & dry';
  if (/nail|ear|eye|teeth|mouth/.test(s)) return 'Nails, ears & teeth';
  if (/trim|styl|haircut|de-mat|sanitary|clipping/.test(s)) return 'Trim & style';
  return 'Finishing';
}

const GROUP_ORDER = ['Bath & dry', 'Trim & style', 'Nails, ears & teeth', 'Tick care', 'Finishing'];

export async function seedApps(c, petIds) {
  /* ---------- pet health records ----------
     Seeded here rather than beside the pets themselves because a visit
     references a package, and packages load after pets. */
  for (const r of A.PET_RECORDS) {
    const petId = petIds[r.name];
    if (!petId) continue;

    let n = 0;
    for (const v of r.vaccines) {
      await c.query(
        `INSERT INTO pet_vaccines (pet_id, name, given_on, due_on, up_to_date, sort)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [petId, v.name, v.date, v.next, v.ok, n++]
      );
    }

    n = 0;
    for (const h of r.history) {
      await c.query(
        `INSERT INTO pet_visits (code, pet_id, visited_on, package_id, partner_id, rating, mins, note, sort)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [h.code, petId, h.date, h.pkg, h.partner, h.rating, h.mins, h.note || null, n++]
      );
    }
  }

  /* ---------- customer account ---------- */
  const acc = A.CUSTOMER_ACCOUNT;
  await c.query(
    'UPDATE customers SET email = $2, first_name = $3, wallet_balance = $4 WHERE id = $1',
    [acc.id, acc.email, acc.first, acc.wallet]
  );

  const addressIds = {};
  for (const a of acc.addresses) {
    const { rows } = await c.query(
      `INSERT INTO customer_addresses (customer_id, code, label, kind, line1, line2, landmark, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [acc.id, a.code, a.label, a.kind, a.line1, a.line2, a.landmark, a.isDefault]
    );
    addressIds[a.code] = rows[0].id;
  }

  for (const p of acc.payments) {
    await c.query(
      `INSERT INTO payment_methods (customer_id, code, label, subtitle, kind, is_default)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [acc.id, p.code, p.label, p.subtitle, p.kind, p.isDefault]
    );
  }

  /* Every other customer gets one address so app bookings have somewhere to go. */
  const others = await c.query(
    'SELECT id, area FROM customers WHERE id <> $1 ORDER BY id',
    [acc.id]
  );
  for (const o of others.rows) {
    await c.query(
      `INSERT INTO customer_addresses (customer_id, code, label, kind, line1, line2, is_default)
       VALUES ($1,'home','Home','home','Flat 1, Residency', $2, TRUE)
       ON CONFLICT DO NOTHING`,
      [o.id, `${o.area ?? 'Mumbai'}, Mumbai`]
    );
  }

  /* ---------- extra bookings the apps show as history ---------- */
  for (const b of A.APP_BOOKINGS) {
    const pet = petIds[b.pet] ?? null;
    await c.query(
      `INSERT INTO bookings (id, customer_id, customer_name, pet_id, pet_name, service_kind,
                             service_label, package_id, walk_id, scheduled_label, date_label,
                             slot_label, is_today, partner_id, partner_name, status, total,
                             channel, paid, rating, cancel_reason, care_note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,FALSE,$13,$14,$15,$16,$17,$18,$19,$20,
               (SELECT care_note FROM pets WHERE id = $4))
       ON CONFLICT (id) DO NOTHING`,
      [b.id, b.customer, b.who, pet, b.pet, b.kind, b.svc, b.packageId ?? null, b.walkId ?? null,
       b.when, b.date, b.slot, b.partnerId, b.partner, b.status, b.total, b.channel,
       b.paid ?? false, b.rating ?? null, b.cancelReason ?? null]
    );
  }

  /* Give the console-seeded bookings their app-side detail. */
  await c.query(`
    UPDATE bookings b SET
      address_id = a.id,
      date_label = COALESCE(b.date_label, split_part(b.scheduled_label, ',', 1)),
      slot_label = COALESCE(b.slot_label, NULLIF(trim(split_part(b.scheduled_label, ',', 2)), ''))
    FROM customer_addresses a
    WHERE a.customer_id = b.customer_id AND a.is_default AND b.address_id IS NULL
  `);
  await c.query(`UPDATE bookings SET paid = TRUE WHERE status = 'Completed'`);
  await c.query(`UPDATE bookings SET eta = 'Arriving 10:40 am' WHERE id = 'WT8842'`);
  await c.query(`UPDATE bookings SET distance_km = 3.4, rating = 4 WHERE id = 'WT8511'`);

  /* ---------- add-ons ---------- */
  for (const [bookingId, addons] of Object.entries(A.BOOKING_ADDONS)) {
    for (const addonId of addons) {
      await c.query(
        `INSERT INTO booking_addons (booking_id, addon_id, price)
         VALUES ($1, $2, (SELECT price FROM addons WHERE id = $2))
         ON CONFLICT DO NOTHING`,
        [bookingId, addonId]
      );
    }
  }
  /* Totals include the add-ons, so the app's bill and the console's agree. */
  await c.query(`
    UPDATE bookings b SET total = b.total + x.extra
    FROM (SELECT booking_id, sum(price)::int AS extra FROM booking_addons GROUP BY booking_id) x
    WHERE x.booking_id = b.id AND b.id IN ('WT8842')
  `);

  /* ---------- customer tracking timeline ---------- */
  for (const [bookingId, steps] of Object.entries(A.BOOKING_STEPS)) {
    let i = 0;
    for (const [title, detail, state] of steps) {
      await c.query(
        `INSERT INTO booking_steps (booking_id, title, detail, state, sort) VALUES ($1,$2,$3,$4,$5)`,
        [bookingId, title, detail || null, state, i++]
      );
    }
  }

  /* ---------- the groomer's checklist ----------
     Built from the booked package's inclusions plus its add-ons. Keys are
     namespaced p: and a: so an add-on cannot untick an identically named
     package inclusion — the collision the Build Book records as a bug. */
  const groomJobs = await c.query(
    `SELECT id, package_id FROM bookings
     WHERE service_kind = 'groom' AND package_id IS NOT NULL AND status <> 'Cancelled'`
  );
  for (const job of groomJobs.rows) {
    const incl = await c.query(
      'SELECT item FROM package_inclusions WHERE package_id = $1 ORDER BY sort',
      [job.package_id]
    );
    const rows = incl.rows.map((r) => ({
      key: `p:${r.item}`, label: r.item, group: inclGroup(r.item)
    }));

    const addons = await c.query(
      `SELECT a.name FROM booking_addons ba JOIN addons a ON a.id = ba.addon_id
       WHERE ba.booking_id = $1`,
      [job.id]
    );
    for (const a of addons.rows) {
      rows.push({ key: `a:${a.name}`, label: `${a.name} (add-on)`, group: inclGroup(a.name) });
    }

    rows.sort((x, y) => GROUP_ORDER.indexOf(x.group) - GROUP_ORDER.indexOf(y.group));
    let i = 0;
    for (const r of rows) {
      await c.query(
        `INSERT INTO job_checklist (booking_id, item_key, label, group_name, done, sort)
         VALUES ($1,$2,$3,$4,FALSE,$5) ON CONFLICT DO NOTHING`,
        [job.id, r.key, r.label, r.group, i++]
      );
    }
  }

  /* Completed grooms have a finished checklist and before/after photos. */
  await c.query(`
    UPDATE job_checklist SET done = TRUE
    WHERE booking_id IN (SELECT id FROM bookings WHERE status = 'Completed')
  `);
  const done = await c.query(`SELECT id FROM bookings WHERE status = 'Completed' AND service_kind = 'groom'`);
  for (const b of done.rows) {
    for (const phase of ['before', 'after']) {
      await c.query(
        'INSERT INTO job_photos (booking_id, phase, seed) VALUES ($1,$2,$3)',
        [b.id, phase, `${b.id}-${phase}`]
      );
    }
  }

  /* ---------- walks ---------- */
  const walkBookings = await c.query(
    `SELECT b.id, b.status, w.mins, w.price FROM bookings b
     JOIN walk_durations w ON w.id = b.walk_id WHERE b.service_kind = 'walk'`
  );
  for (const b of walkBookings.rows) {
    const finished = b.status === 'Completed';
    await c.query(
      `INSERT INTO walks (booking_id, state, planned_mins, elapsed_secs, distance_km, payout,
                          started_at, ended_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (booking_id) DO NOTHING`,
      [b.id, finished ? 'done' : 'requested', b.mins,
       finished ? b.mins * 60 : 0, finished ? 3.4 : 0, Math.round(b.price * 0.8),
       finished ? new Date(Date.now() - 86400000) : null,
       finished ? new Date(Date.now() - 86400000 + b.mins * 60000) : null]
    );
  }

  /* ---------- partner earnings ---------- */
  for (const [partnerId, rows] of Object.entries(A.PARTNER_EARNINGS)) {
    let i = 0;
    for (const e of rows) {
      await c.query(
        `INSERT INTO partner_earnings (partner_id, label, earned_on, weekday, amount, paid_out, sort)
         VALUES ($1,$2,$3,$4,$5,FALSE,$6)`,
        [partnerId, e.label, e.on, e.on.split(',')[0], e.amount, i++]
      );
    }
  }

  /* ---------- store order tracking ---------- */
  for (const [orderId, steps] of Object.entries(A.ORDER_STEPS)) {
    let i = 0;
    for (const [title, detail, complete] of steps) {
      await c.query(
        `INSERT INTO store_order_steps (order_id, title, detail, done, sort) VALUES ($1,$2,$3,$4,$5)`,
        [orderId, title, detail || null, complete, i++]
      );
    }
  }
  await c.query(`UPDATE store_orders SET pricing = 'trade' WHERE channel = 'Partner'`);
  await c.query(`
    UPDATE store_orders o SET partner_id = p.id
    FROM partners p WHERE p.name = o.customer_name AND o.channel = 'Partner'
  `);

  /* ---------- content ---------- */
  let i = 0;
  for (const r of A.REVIEWS) {
    await c.query(
      `INSERT INTO reviews (partner_id, author, pet_name, rating, when_label, body, sort)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [r.partner, r.author, r.pet, r.rating, r.when, r.body, i++]
    );
  }

  i = 0;
  for (const n of A.NOTIFICATIONS) {
    await c.query(
      `INSERT INTO notifications (customer_id, partner_id, kind, title, body, when_label, unread, sort)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [n.customer ?? null, n.partner ?? null, n.kind, n.title, n.body, n.when, n.unread, i++]
    );
  }

  i = 0;
  for (const f of A.FAQS) {
    await c.query('INSERT INTO faqs (question, answer, sort) VALUES ($1,$2,$3)', [f.q, f.a, i++]);
  }

  i = 0;
  for (const b of A.BREEDS) {
    await c.query('INSERT INTO breeds (name, sort) VALUES ($1,$2) ON CONFLICT DO NOTHING', [b, i++]);
  }

  i = 0;
  for (const r of A.CANCEL_REASONS) {
    await c.query('INSERT INTO cancel_reasons (reason, sort) VALUES ($1,$2)', [r, i++]);
  }
}
