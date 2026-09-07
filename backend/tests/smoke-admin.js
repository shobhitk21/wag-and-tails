/* Smoke test for the endpoints that back the console's create/edit actions.

   These are the buttons that used to say "not wired yet": adding products,
   packages, coupons, service areas and staff, rescheduling a booking, editing
   your own profile, exporting CSV, and pausing bookings.

   Run with the API up:  node backend/tests/smoke-admin.js */
const BASE = process.env.API_URL || 'http://localhost:4000';

let pass = 0;
let fail = 0;
const failures = [];

let token = null;

async function call(path, { method = 'GET', body, raw = false } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body) headers['content-type'] = 'application/json';
  const res = await fetch(BASE + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined
  });
  if (raw) return { status: res.status, text: await res.text(), res };
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

function expect(cond, message) {
  if (!cond) throw new Error(message);
}

/* Everything created here is removed at the end, so the suite can run twice
   in a row without the second run tripping over the first one's rows. */
const cleanup = [];

async function run() {
  console.log(`\nconsole write endpoints → ${BASE}`);

  const login = await call('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@wagandtails.in', password: 'Wagtails@123', surface: 'admin' }
  });
  if (login.status !== 200) {
    console.log(`  FAIL could not sign in (${login.status}) — is the DB seeded?`);
    process.exit(1);
  }
  token = login.data.token;
  console.log('  ok   signed in as super admin');
  pass += 1;

  const stamp = Date.now().toString().slice(-6);

  /* ---------- catalogue ---------- */
  console.log('\ncatalogue');

  let productId;
  await check('POST /api/catalogue/products creates one', async () => {
    const { status, data } = await call('/api/catalogue/products', {
      method: 'POST',
      body: {
        name: `Smoke Test Shampoo ${stamp}`,
        categoryId: 'grooming',
        mrp: 700, price: 599, description: 'Created by the smoke test.'
      }
    });
    expect(status === 201, `expected 201, got ${status} ${JSON.stringify(data)}`);
    productId = data.product.id;
    cleanup.push(['products', productId]);
    expect(data.product.trade > 0, 'no trade price was derived');
    return `${productId}, trade ₹${data.product.trade}`;
  });

  await check('It rejects a price above MRP', async () => {
    const { status } = await call('/api/catalogue/products', {
      method: 'POST',
      body: { name: `Bad ${stamp}`, categoryId: 'grooming', mrp: 100, price: 900 }
    });
    expect(status === 400, `expected 400, got ${status}`);
    return '400';
  });

  await check('It rejects an unknown category', async () => {
    const { status } = await call('/api/catalogue/products', {
      method: 'POST',
      body: { name: `Bad cat ${stamp}`, categoryId: 'not-a-category', mrp: 900, price: 800 }
    });
    expect(status === 400, `expected 400, got ${status}`);
    return '400';
  });

  await check('The new product appears in the catalogue', async () => {
    const { data } = await call('/api/catalogue/products');
    expect(data.products.some((p) => p.id === productId), 'not in the list');
    return 'listed';
  });

  let packageId;
  await check('POST /api/catalogue/packages creates one with inclusions', async () => {
    const { status, data } = await call('/api/catalogue/packages', {
      method: 'POST',
      body: {
        name: `Smoke Groom ${stamp}`,
        mrp: 1500, price: 1299, mins: 90,
        inclusions: ['Bath and blow dry', 'Nail trim', 'Ear clean']
      }
    });
    expect(status === 201, `expected 201, got ${status} ${JSON.stringify(data)}`);
    packageId = data.package.id;
    cleanup.push(['packages', packageId]);
    expect(data.package.inclusion_count === 3, `expected 3 inclusions, got ${data.package.inclusion_count}`);
    return `${packageId}, 3 inclusions`;
  });

  await check('PATCH /api/catalogue/packages/:id edits it', async () => {
    const { status, data } = await call(`/api/catalogue/packages/${packageId}`, {
      method: 'PATCH', body: { price: 1199, popular: true }
    });
    expect(status === 200, `expected 200, got ${status}`);
    expect(data.package.price === 1199 && data.package.popular === true, 'not applied');
    return '₹1199, popular';
  });

  await check('The package carries its payout into the catalogue', async () => {
    const { data } = await call('/api/catalogue/packages');
    const created = data.packages.find((p) => p.id === packageId);
    expect(created, 'not in the list');
    expect(created.partner_payout > 0 && created.partner_payout < created.price,
      `payout ${created.partner_payout} makes no sense against ${created.price}`);
    return `payout ₹${created.partner_payout}`;
  });

  let couponId;
  await check('POST /api/catalogue/coupons creates one, inactive', async () => {
    const { status, data } = await call('/api/catalogue/coupons', {
      method: 'POST',
      body: { code: `smoke${stamp}`, title: '10% off', subtitle: 'Smoke test' }
    });
    expect(status === 201, `expected 201, got ${status} ${JSON.stringify(data)}`);
    couponId = data.coupon.id;
    cleanup.push(['coupons', couponId]);
    expect(data.coupon.active === false, 'a new coupon should not be live');
    expect(data.coupon.code === `SMOKE${stamp}`, `code was not upper-cased: ${data.coupon.code}`);
    return `${data.coupon.code}, inactive`;
  });

  await check('A duplicate coupon code is refused', async () => {
    const { status } = await call('/api/catalogue/coupons', {
      method: 'POST', body: { code: `smoke${stamp}`, title: 'Again' }
    });
    expect(status === 409, `expected 409, got ${status}`);
    return '409';
  });

  /* ---------- areas ---------- */
  console.log('\nservice areas');

  const areaName = `Smoketown ${stamp}`;
  await check('POST /api/admin/areas opens one, Pending', async () => {
    const { status, data } = await call('/api/admin/areas', {
      method: 'POST', body: { name: areaName }
    });
    expect(status === 201, `expected 201, got ${status} ${JSON.stringify(data)}`);
    cleanup.push(['service_areas', data.area.id]);
    expect(data.area.status === 'Pending', `expected Pending, got ${data.area.status}`);
    return 'Pending, no partners yet';
  });

  await check('A duplicate area name is refused', async () => {
    const { status } = await call('/api/admin/areas', { method: 'POST', body: { name: areaName } });
    expect(status === 409, `expected 409, got ${status}`);
    return '409';
  });

  await check('PATCH /api/admin/areas/:name switches it live', async () => {
    const { status, data } = await call(`/api/admin/areas/${encodeURIComponent(areaName)}`, {
      method: 'PATCH', body: { status: 'Live' }
    });
    expect(status === 200, `expected 200, got ${status}`);
    expect(data.area.status === 'Live', 'not applied');
    return 'Live';
  });

  /* ---------- staff ---------- */
  console.log('\nstaff');

  let staffCode;
  await check('POST /api/admin/staff invites, but cannot sign in yet', async () => {
    const { status, data } = await call('/api/admin/staff', {
      method: 'POST',
      body: { name: `Smoke Tester ${stamp}`, email: `smoke${stamp}@wagandtails.in`, role: 'support' }
    });
    expect(status === 201, `expected 201, got ${status} ${JSON.stringify(data)}`);
    staffCode = data.member.code;
    expect(data.member.active === false, 'an invite should not be active');

    const attempt = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: `smoke${stamp}@wagandtails.in`, password: 'Wagtails@123', surface: 'staff'
      })
    });
    expect(attempt.status !== 200, 'an invited account signed in with the demo password');
    return `${staffCode}, login refused (${attempt.status})`;
  });

  await check('PATCH /api/admin/staff/:code activates them', async () => {
    const { status, data } = await call(`/api/admin/staff/${staffCode}`, {
      method: 'PATCH', body: { active: true, shift: 'Evenings' }
    });
    expect(status === 200, `expected 200, got ${status}`);
    expect(data.member.active === true && data.member.shift === 'Evenings', 'not applied');
    return 'active, Evenings';
  });

  await check('You cannot deactivate your own account', async () => {
    const { data: me } = await call('/api/auth/me');
    const { status, data } = await call(`/api/admin/staff/${me.user.code}`, {
      method: 'PATCH', body: { active: false }
    });
    expect(status === 400, `expected 400, got ${status} ${JSON.stringify(data)}`);
    return 'refused';
  });

  await check('The last super admin cannot be demoted', async () => {
    const { data: list } = await call('/api/admin/staff');
    const admins = list.staff.filter((s) => s.role === 'super_admin' && s.active);
    if (admins.length !== 1) return `skipped — ${admins.length} active super admins`;
    const { status } = await call(`/api/admin/staff/${admins[0].code}`, {
      method: 'PATCH', body: { role: 'support' }
    });
    expect(status === 400, `expected 400, got ${status}`);
    return 'refused';
  });

  /* ---------- own profile ---------- */
  console.log('\nyour profile');

  await check('PATCH /api/staff/profile edits name and shift', async () => {
    const before = await call('/api/staff/profile');
    const original = before.data.account;

    const { status, data } = await call('/api/staff/profile', {
      method: 'PATCH', body: { name: `${original.name} (smoke)`, shift: 'Nights' }
    });
    expect(status === 200, `expected 200, got ${status}`);
    expect(data.account.shift === 'Nights', 'shift not applied');

    await call('/api/staff/profile', {
      method: 'PATCH', body: { name: original.name, shift: original.shift }
    });
    return 'edited and restored';
  });

  await check('It will not let you promote yourself', async () => {
    const { status, data } = await call('/api/staff/profile', {
      method: 'PATCH', body: { role: 'super_admin' }
    });
    /* role is not in the schema, so zod strips it and there is nothing left. */
    expect(status === 400, `expected 400, got ${status} ${JSON.stringify(data)}`);
    return 'role is not editable here';
  });

  /* ---------- reschedule ---------- */
  console.log('\nreschedule');

  await check('POST /api/bookings/:id/reschedule moves a live booking', async () => {
    const { data: list } = await call('/api/bookings?filter=all');
    const movable = list.bookings.find(
      (b) => b.status !== 'Completed' && b.status !== 'Cancelled'
    );
    expect(movable, 'no live booking to move');

    const { data: areas } = await call('/api/admin/areas');
    const slot = areas.slots.find((s) => s.enabled);
    expect(slot, 'no enabled slot');

    const { status, data } = await call(`/api/bookings/${movable.id}/reschedule`, {
      method: 'POST', body: { dateLabel: 'Tomorrow', slot: slot.label }
    });
    expect(status === 200, `expected 200, got ${status} ${JSON.stringify(data)}`);
    expect(data.booking.scheduled_label === `Tomorrow, ${slot.label}`,
      `label is "${data.booking.scheduled_label}"`);

    const { data: detail } = await call(`/api/bookings/${movable.id}`);
    expect(detail.activity.some((a) => /rescheduled/i.test(a.title)), 'no activity row written');
    return `${movable.id} → ${data.booking.scheduled_label}, logged`;
  });

  await check('An unknown slot is refused', async () => {
    const { data: list } = await call('/api/bookings?filter=all');
    const movable = list.bookings.find((b) => b.status !== 'Completed' && b.status !== 'Cancelled');
    const { status } = await call(`/api/bookings/${movable.id}/reschedule`, {
      method: 'POST', body: { dateLabel: 'Tomorrow', slot: 'Whenever' }
    });
    expect(status === 400, `expected 400, got ${status}`);
    return '400';
  });

  await check('A cancelled booking cannot be rescheduled', async () => {
    const { data: list } = await call('/api/bookings?filter=all');
    const dead = list.bookings.find((b) => b.status === 'Cancelled' || b.status === 'Completed');
    if (!dead) return 'skipped — none in the data';
    const { status } = await call(`/api/bookings/${dead.id}/reschedule`, {
      method: 'POST', body: { dateLabel: 'Tomorrow', slot: 'Morning · 9–12' }
    });
    expect(status === 409 || status === 400, `expected 409, got ${status}`);
    return `${status}`;
  });

  /* ---------- export and pause ---------- */
  console.log('\nexport and pause');

  for (const dataset of ['bookings', 'orders', 'customers', 'partners']) {
    await check(`GET /api/admin/export/${dataset}.csv`, async () => {
      const { status, text, res } = await call(`/api/admin/export/${dataset}.csv`, { raw: true });
      expect(status === 200, `expected 200, got ${status}`);
      expect(res.headers.get('content-type').includes('text/csv'), 'not served as CSV');
      expect(res.headers.get('content-disposition').includes('attachment'), 'not an attachment');
      const lines = text.trim().split('\r\n');
      expect(lines.length > 1, 'no rows');
      expect(lines[0].startsWith('"'), 'header is not quoted');
      return `${lines.length - 1} rows`;
    });
  }

  await check('An unknown export is a 404, not an empty file', async () => {
    const { status } = await call('/api/admin/export/secrets.csv', { raw: true });
    expect(status === 404, `expected 404, got ${status}`);
    return '404';
  });

  await check('POST /api/admin/bookings/pause toggles and restores', async () => {
    const on = await call('/api/admin/bookings/pause', { method: 'POST', body: { paused: true } });
    expect(on.status === 200 && on.data.paused === true, 'did not pause');

    const { data: settings } = await call('/api/admin/settings');
    const policy = settings.groups.policy ?? [];
    expect(policy.some((s) => s.key === 'bookings_paused' && s.value === 'true'),
      'the setting was not written');

    const off = await call('/api/admin/bookings/pause', { method: 'POST', body: { paused: false } });
    expect(off.data.paused === false, 'did not resume');
    return 'paused and resumed';
  });

  /* ---------- guards ---------- */
  console.log('\nguards');

  await check('A staff-role account cannot reach admin writes', async () => {
    const staffLogin = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'ritu@wagandtails.in', password: 'Wagtails@123', surface: 'staff'
      })
    }).then((r) => r.json());
    if (!staffLogin.token) return 'skipped — no bookings_staff demo account';

    const res = await fetch(`${BASE}/api/admin/areas`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${staffLogin.token}` },
      body: JSON.stringify({ name: 'Should not exist' })
    });
    expect(res.status === 403, `expected 403, got ${res.status}`);
    return '403';
  });

  await check('Anonymous cannot export anything', async () => {
    const res = await fetch(`${BASE}/api/admin/export/customers.csv`);
    expect(res.status === 401, `expected 401, got ${res.status}`);
    return '401';
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) {
    console.log('failed: ' + failures.join(', '));
  }
  return fail;
}

run()
  .then(async (failed) => {
    /* Remove what this run created so it can be run again immediately. */
    if (cleanup.length) {
      const { cleanupRows } = await import('./cleanup-helper.js');
      await cleanupRows(cleanup);
    }
    process.exit(failed ? 1 : 0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
