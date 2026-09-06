/* End-to-end smoke test: every endpoint the two consoles call, plus the role
   guard and the care-note through-line. Run with the API up:
     node backend/tests/smoke.js */
const BASE = process.env.API_URL || 'http://localhost:4000';
const DEMO_PASSWORD = 'Wagtails@123';

/* `as: 's1'` in a check reads as a staff code for convenience, same as before
   webAuth started requiring a real JWT — this just signs in for that code
   once and caches the token for the rest of the run. */
const ACCOUNTS = {
  s1: { email: 'nikhil@wagandtails.in', surface: 'staff' },
  a1: { email: 'admin@wagandtails.in', surface: 'admin' }
};
const tokenCache = {};

async function tokenFor(code) {
  if (tokenCache[code]) return tokenCache[code];
  const { email, surface } = ACCOUNTS[code];
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: DEMO_PASSWORD, surface })
  });
  const { token } = await res.json();
  if (!token) throw new Error(`Could not sign in as ${code} — check the demo password.`);
  tokenCache[code] = token;
  return token;
}

let pass = 0;
let fail = 0;
const failures = [];

async function call(path, { as, method = 'GET', body } = {}) {
  const headers = {};
  if (as) headers.authorization = `Bearer ${await tokenFor(as)}`;
  if (body) headers['content-type'] = 'application/json';
  const res = await fetch(BASE + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

async function check(name, fn) {
  try {
    const message = await fn();
    pass += 1;
    console.log(`  ok   ${name}${message ? ` — ${message}` : ''}`);
  } catch (err) {
    fail += 1;
    failures.push(name);
    console.log(`  FAIL ${name} — ${err.message}`);
  }
}

const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

async function run() {
  console.log(`\nWag & Tails API smoke test → ${BASE}\n`);

  console.log('health + auth');
  await check('GET /api/health', async () => {
    const { status, data } = await call('/api/health');
    expect(status === 200 && data.ok, `status ${status}`);
    return `db ${data.db}`;
  });
  await check('GET /api/auth/demo-users?surface=staff', async () => {
    const { data } = await call('/api/auth/demo-users?surface=staff');
    expect(data.users.length >= 2, 'expected staff accounts');
    expect(!data.users.some((u) => u.role === 'super_admin'), 'admin leaked into staff list');
    return `${data.users.length} accounts`;
  });
  await check('POST /api/auth/login rejects wrong console', async () => {
    const { status } = await call('/api/auth/login', {
      method: 'POST',
      body: { email: 'nikhil@wagandtails.in', password: DEMO_PASSWORD, surface: 'admin' }
    });
    expect(status === 403, `expected 403, got ${status}`);
    return 'staff blocked from admin console even with the right password';
  });
  await check('POST /api/auth/login rejects the wrong password', async () => {
    const { status } = await call('/api/auth/login', {
      method: 'POST',
      body: { email: 'nikhil@wagandtails.in', password: 'not-the-password', surface: 'staff' }
    });
    expect(status === 401, `expected 401, got ${status}`);
    return '401';
  });
  await check('GET /api/auth/me', async () => {
    const { data } = await call('/api/auth/me', { as: 's1' });
    expect(data.user.code === 's1', 'wrong user');
    expect(data.permissions.length > 0, 'no permissions');
    return `${data.user.name}, ${data.permissions.filter((p) => p.allowed).length} capabilities`;
  });

  console.log('\nstaff console');
  await check('GET /api/staff/dashboard', async () => {
    const { data } = await call('/api/staff/dashboard', { as: 's1' });
    expect(typeof data.kpis.today === 'number', 'no kpis');
    expect(Array.isArray(data.onShift), 'no partners on shift');
    return `${data.kpis.today} today, ${data.kpis.unassigned} unassigned`;
  });
  await check('GET /api/staff/profile', async () => {
    const { data } = await call('/api/staff/profile', { as: 's1' });
    expect(data.account.code === 's1', 'wrong account');
    return data.account.name;
  });

  console.log('\nbookings');
  for (const f of ['all', 'today', 'unassigned', 'whatsapp']) {
    await check(`GET /api/bookings?filter=${f}`, async () => {
      const { status, data } = await call(`/api/bookings?filter=${f}`, { as: 's1' });
      expect(status === 200, `status ${status}`);
      return `${data.bookings.length} rows`;
    });
  }
  await check('GET /api/bookings/:id carries the care note', async () => {
    const { data } = await call('/api/bookings/WT8842', { as: 's1' });
    expect(data.booking.care_note, 'care note missing');
    expect(data.activity.length === 3, `expected 3 activity rows, got ${data.activity.length}`);
    return `“${data.booking.care_note}”`;
  });
  await check('App bookings get no confirmation text', async () => {
    const { data } = await call('/api/bookings/WT8842', { as: 's1' });
    expect(data.confirmation === null, 'app booking should not need a manual message');
    return 'null, as intended';
  });
  await check('WhatsApp bookings do get one', async () => {
    const { data } = await call('/api/bookings/WT8869', { as: 's1' });
    expect(data.confirmation?.includes('Wag & Tails'), 'no confirmation text');
    expect(data.confirmation.includes('WT8869'), 'confirmation missing booking id');
    return `${data.confirmation.length} chars`;
  });
  await check('POST /api/bookings rejects a bad payload', async () => {
    const { status, data } = await call('/api/bookings', {
      as: 's1', method: 'POST', body: { channel: 'WhatsApp' }
    });
    expect(status === 400, `expected 400, got ${status}`);
    expect(data.details, 'no field errors returned');
    return `${Object.keys(data.details).length} field errors`;
  });

  console.log('\nstore + directory');
  await check('GET /api/orders', async () => {
    const { data } = await call('/api/orders', { as: 's1' });
    expect(data.orders.length > 0, 'no orders');
    return `${data.orders.length} orders`;
  });
  await check('GET /api/orders/:id joins real line items', async () => {
    const { data } = await call('/api/orders/IPC4462', { as: 's1' });
    expect(data.items.length === data.order.item_count,
      `item_count ${data.order.item_count} but ${data.items.length} lines`);
    expect(data.items[0].name, 'line item not joined to a product');
    return `${data.items.length} lines`;
  });
  await check('GET /api/customers', async () => {
    const { data } = await call('/api/customers', { as: 's1' });
    return `${data.total} customers`;
  });
  await check('GET /api/customers/:id returns pets with care notes', async () => {
    const { data } = await call('/api/customers/C1041', { as: 's1' });
    expect(data.pets.length > 0, 'no pets');
    expect(data.pets.some((p) => p.care_note), 'no care notes on any pet');
    return `${data.pets.length} pets, ${data.bookings.length} bookings`;
  });
  await check('GET /api/partners', async () => {
    const { data } = await call('/api/partners', { as: 's1' });
    return `${data.total} partners, ${data.pending} pending`;
  });
  await check('GET /api/partners/:id returns documents', async () => {
    const { data } = await call('/api/partners/P21', { as: 's1' });
    expect(data.documents.length === 4, `expected 4 documents, got ${data.documents.length}`);
    return `${data.documents.filter((d) => d.verified).length}/4 verified`;
  });

  console.log('\ncatalogue');
  await check('GET /api/catalogue/services', async () => {
    const { data } = await call('/api/catalogue/services', { as: 's1' });
    expect(data.packages.length === 5, `expected 5 packages, got ${data.packages.length}`);
    const luxury = data.packages.find((p) => p.id === 'luxury');
    expect(luxury.price === 2199 && luxury.mrp === 3000, 'luxury pricing does not match the client figures');
    expect(luxury.inclusions.length === 14, `luxury should have 14 inclusions, got ${luxury.inclusions.length}`);
    expect(data.walks.every((w) => w.provisional), 'walk pricing should be flagged provisional');
    return `${data.packages.length} packages, ${data.addons.length} add-ons, ${data.walks.length} walks`;
  });
  await check('GET /api/catalogue/products computes margin', async () => {
    const { data } = await call('/api/catalogue/products', { as: 's1' });
    expect(data.products.length === 18, `expected 18 products, got ${data.products.length}`);
    const p1 = data.products.find((p) => p.id === 'p1');
    expect(p1.margin === 25, `p1 margin should be 25%, got ${p1.margin}`);
    return `${data.products.length} products, ${data.categories.length} categories`;
  });
  await check('GET /api/catalogue/packages derives partner payout', async () => {
    const { data } = await call('/api/catalogue/packages', { as: 's1' });
    const premium = data.packages.find((p) => p.id === 'premium');
    expect(premium.partner_payout === Math.round(1699 * 0.85),
      `payout ${premium.partner_payout} does not match a 15% fee`);
    return `premium ₹1699 → ₹${premium.partner_payout} at ${data.fees.groomer_fee}`;
  });
  await check('GET /api/catalogue/coupons', async () => {
    const { data } = await call('/api/catalogue/coupons', { as: 's1' });
    return `${data.coupons.length} coupons, ${data.active} active`;
  });

  console.log('\nrole guard');
  await check('Staff cannot read the admin dashboard', async () => {
    const { status } = await call('/api/admin/dashboard', { as: 's1' });
    expect(status === 403, `expected 403, got ${status}`);
    return '403';
  });
  await check('Staff cannot edit the catalogue', async () => {
    const { status } = await call('/api/catalogue/products/p1', {
      as: 's1', method: 'PATCH', body: { price: 1 }
    });
    expect(status === 403, `expected 403, got ${status}`);
    return '403';
  });
  await check('Staff cannot approve a partner', async () => {
    const { status } = await call('/api/partners/P77/approve', { as: 's1', method: 'POST' });
    expect(status === 403, `expected 403, got ${status}`);
    return '403';
  });
  await check('Anonymous cannot read the admin dashboard', async () => {
    const { status } = await call('/api/admin/dashboard');
    expect(status === 401, `expected 401, got ${status}`);
    return '401';
  });

  console.log('\nadmin console');
  await check('GET /api/admin/dashboard', async () => {
    const { data } = await call('/api/admin/dashboard', { as: 'a1' });
    expect(data.kpis.length === 4, `expected 4 KPIs, got ${data.kpis.length}`);
    expect(data.revenue.length === 6, 'expected 6 months');
    expect(data.channels.length === 4, 'expected 4 channels');
    expect(data.attention.pendingPartners >= 0, 'attention not computed');
    return `${data.latest.length} latest, ${data.attention.pendingPartners} pending partner(s)`;
  });
  await check('GET /api/admin/reports aggregates live rows', async () => {
    const { data } = await call('/api/admin/reports', { as: 'a1' });
    expect(data.byChannel.length > 0, 'no channel aggregate');
    expect(data.byPartner.length > 0, 'no partner aggregate');
    return `${data.byStatus.length} statuses, ${data.byPartner.length} partners`;
  });
  await check('GET /api/admin/payouts derives fee and net', async () => {
    const { data } = await call('/api/admin/payouts', { as: 'a1' });
    const groomers = data.batches.find((b) => b.kind === 'Groomers');
    const r = groomers.rows[0];
    expect(r.gross - r.fee === r.net, `${r.gross} − ${r.fee} ≠ ${r.net}`);
    return `${data.totalLabel} across ${data.batches.length} batches`;
  });
  await check('GET /api/admin/staff', async () => {
    const { data } = await call('/api/admin/staff', { as: 'a1' });
    expect(data.permissions.length === 6, `expected 6 capabilities, got ${data.permissions.length}`);
    return `${data.staff.length} accounts`;
  });
  await check('GET /api/admin/areas computes coverage', async () => {
    const { data } = await call('/api/admin/areas', { as: 'a1' });
    const andheri = data.areas.find((a) => a.name === 'Andheri West');
    expect(andheri.groomers >= 1, 'Andheri West should have a groomer');
    return `${data.areas.length} areas, ${data.slots.filter((s) => s.enabled).length} slots open`;
  });
  await check('GET /api/admin/settings', async () => {
    const { data } = await call('/api/admin/settings', { as: 'a1' });
    expect(data.groups.commission, 'no commission group');
    return `${Object.keys(data.groups).length} groups, ${data.integrations.length} integrations`;
  });
  await check('WhatsApp is not listed as an integration', async () => {
    const { data } = await call('/api/admin/settings', { as: 'a1' });
    expect(!data.integrations.some((i) => /whatsapp/i.test(i.name)),
      'WhatsApp should not appear as a live integration');
    return 'correctly absent';
  });

  console.log('\nwrite path: a booking entered by staff');
  let created = null;
  await check('POST /api/bookings creates customer, pet and care note', async () => {
    const { status, data } = await call('/api/bookings', {
      as: 's1',
      method: 'POST',
      body: {
        channel: 'Phone call',
        customerName: 'Smoke Test Owner',
        phone: '+91 90000 00001',
        petName: 'Smoketest',
        breed: 'Indie',
        weight: '16 kg',
        careNote: 'Smoke test note: nervous around clippers.',
        serviceKind: 'groom',
        packageId: 'premium',
        dateLabel: 'Today',
        slot: '3:00 pm',
        partnerName: 'Unassigned'
      }
    });
    expect(status === 201, `status ${status}`);
    created = data.booking;
    expect(created.total === 1699, `price should come from the catalogue, got ${created.total}`);
    expect(created.status === 'Needs partner', `status ${created.status}`);
    expect(created.care_note.includes('nervous'), 'care note not attached');
    expect(data.confirmation.includes(created.id), 'confirmation missing booking id');
    return `${created.id} for ${created.customer_name}`;
  });
  await check('The care note reached the pets table', async () => {
    const { data } = await call(`/api/customers/${created.customer_id}`, { as: 's1' });
    const pet = data.pets.find((p) => p.name === 'Smoketest');
    expect(pet?.care_note?.includes('nervous'), 'care note not on the pet row');
    return 'same sentence, one row';
  });
  await check('POST /api/bookings/:id/assign', async () => {
    const { status, data } = await call(`/api/bookings/${created.id}/assign`, {
      as: 's1', method: 'POST', body: { partnerId: 'P21' }
    });
    expect(status === 200, `status ${status}`);
    expect(data.booking.partner_name === 'Ritika Sharma', 'partner not assigned');
    expect(data.booking.status === 'Confirmed', `status should flip to Confirmed, got ${data.booking.status}`);
    return 'assigned, status advanced';
  });
  await check('POST /api/bookings/:id/unassign', async () => {
    const { data } = await call(`/api/bookings/${created.id}/unassign`, { as: 's1', method: 'POST' });
    expect(data.booking.partner_name === 'Unassigned', 'still assigned');
    expect(data.booking.status === 'Needs partner', 'status did not revert');
    return 'back in the open-job pool';
  });
  await check('POST /api/orders/:id/status', async () => {
    const { data } = await call('/api/orders/IPC4462/status', {
      as: 's1', method: 'POST', body: { status: 'Out for delivery' }
    });
    expect(data.order.status === 'Out for delivery', 'status not set');
    await call('/api/orders/IPC4462/status', {
      as: 's1', method: 'POST', body: { status: 'Packed' }
    });
    return 'set and restored';
  });
  await check('PATCH /api/admin/settings writes', async () => {
    const { data } = await call('/api/admin/settings', {
      as: 'a1', method: 'PATCH', body: { values: { support_hours: '8:00 am – 10:00 pm' } }
    });
    expect(data.updated === 1, 'nothing updated');
    await call('/api/admin/settings', {
      as: 'a1', method: 'PATCH', body: { values: { support_hours: '9:00 am – 9:00 pm' } }
    });
    return 'written and restored';
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) {
    console.log('failed: ' + failures.join(', '));
    console.log('\nNote: this run left a test booking behind. Re-seed with `npm run db:seed`.');
    process.exit(1);
  }
  console.log('\nThis run left a test booking behind. Re-seed with `npm run db:seed` to clear it.');
}

run().catch((err) => {
  console.error('\nSmoke test could not run:', err.message);
  process.exit(1);
});
