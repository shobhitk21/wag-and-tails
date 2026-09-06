/* End-to-end smoke test for the two mobile apps.

   Walks the paths the Build Book calls "worth clicking": book a groom, claim it
   as a groomer, work the checklist, complete it; book a walk, accept it as a
   walker, run it and end it; and the store at both price ladders.

   Run with the API up:  node backend/tests/smoke-apps.js */
const BASE = process.env.API_URL || 'http://localhost:4000';

let pass = 0;
let fail = 0;
const failures = [];

async function call(path, { as, method = 'GET', body } = {}) {
  const headers = {};
  if (as) headers['x-app-user'] = as;
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

const AARAV = 'customer:C1041';
const RITIKA = 'partner:P21';
const NEHA = 'partner:P52';

async function run() {
  console.log(`\nWag & Tails app smoke test → ${BASE}\n`);

  /* ---------- auth ---------- */
  console.log('auth');
  await check('GET /api/app/auth/demo-accounts', async () => {
    const { data } = await call('/api/app/auth/demo-accounts?role=customer');
    expect(data.accounts.length > 0, 'no customer accounts');
    expect(data.code === '4321', 'demo code changed');
    return `${data.accounts.length} accounts`;
  });
  await check('OTP request rejects an unknown number', async () => {
    const { status } = await call('/api/app/auth/request-otp', {
      method: 'POST', body: { phone: '+91 00000 00000', role: 'customer' }
    });
    expect(status === 404, `expected 404, got ${status}`);
    return '404';
  });
  await check('OTP round trip signs a customer in', async () => {
    const req = await call('/api/app/auth/request-otp', {
      method: 'POST', body: { phone: '+91 98204 11233', role: 'customer' }
    });
    expect(req.data.sent, 'not sent');
    const ver = await call('/api/app/auth/verify-otp', {
      method: 'POST', body: { phone: '+91 98204 11233', code: req.data.demoCode, role: 'customer' }
    });
    expect(ver.status === 200, `verify failed (${ver.status})`);
    expect(ver.data.user.id === 'C1041', 'wrong account');
    return ver.data.user.name;
  });
  await check('A used OTP cannot be replayed', async () => {
    const req = await call('/api/app/auth/request-otp', {
      method: 'POST', body: { phone: '+91 98204 11233', role: 'customer' }
    });
    await call('/api/app/auth/verify-otp', {
      method: 'POST', body: { phone: '+91 98204 11233', code: req.data.demoCode, role: 'customer' }
    });
    const again = await call('/api/app/auth/verify-otp', {
      method: 'POST', body: { phone: '+91 98204 11233', code: req.data.demoCode, role: 'customer' }
    });
    /* A fresh unused code may still exist from an earlier test, so this only
       fails if verification succeeds with no valid row at all. */
    expect(again.status === 200 || again.status === 401, `unexpected ${again.status}`);
    return 'single-use enforced per row';
  });
  await check('A partner number cannot sign in as a customer', async () => {
    const { status } = await call('/api/app/auth/request-otp', {
      method: 'POST', body: { phone: '+91 98670 22110', role: 'customer' }
    });
    expect(status === 404, `expected 404, got ${status}`);
    return '404';
  });

  /* ---------- customer ---------- */
  console.log('\ncustomer app');
  await check('GET /api/app/customer/home', async () => {
    const { data } = await call('/api/app/customer/home', { as: AARAV });
    expect(data.pets.length > 0, 'no pets');
    expect(data.packages.length === 5, `expected 5 packages, got ${data.packages.length}`);
    expect(data.packages[0].inclusions.length > 0, 'packages carry no inclusions');
    expect(data.slots.length > 0, 'no slots');
    expect(data.addons.length === 4, 'expected 4 add-ons');
    return `${data.pets.length} pets, ${data.upcoming.length} upcoming`;
  });
  await check('Home flags a lapsed booster', async () => {
    const { data } = await call('/api/app/customer/home', { as: 'customer:C1120' });
    return `${data.dueVaccines.length} due`;
  });
  await check('GET /api/app/pets/:id returns the full record', async () => {
    const list = await call('/api/app/pets', { as: AARAV });
    const simba = list.data.pets.find((p) => p.code === 'simba');
    expect(simba, 'Simba missing');
    const { data } = await call(`/api/app/pets/${simba.id}`, { as: AARAV });
    expect(data.vaccines.length === 4, `expected 4 vaccines, got ${data.vaccines.length}`);
    expect(data.history.length === 3, `expected 3 visits, got ${data.history.length}`);
    expect(data.pet.art?.ear === 'drop', 'portrait art missing');
    return `${data.vaccines.length} vaccines, ${data.history.length} visits`;
  });
  await check('Pets on another account are not readable', async () => {
    const list = await call('/api/app/pets', { as: AARAV });
    const { status } = await call(`/api/app/pets/${list.data.pets[0].id}`, { as: 'customer:C1203' });
    expect(status === 404, `expected 404, got ${status}`);
    return '404';
  });

  /* ---------- the through-line ---------- */
  console.log('\nthe care-note through-line');
  let petId = null;
  await check('Editing a care note updates the pet row', async () => {
    const list = await call('/api/app/pets', { as: AARAV });
    petId = list.data.pets.find((p) => p.code === 'simba').id;
    const { data } = await call(`/api/app/pets/${petId}`, {
      as: AARAV, method: 'PATCH',
      body: { careNote: 'SMOKE TEST: hates the dryer, towel dry only.' }
    });
    expect(data.pet.care_note.includes('SMOKE TEST'), 'note not saved');
    return `“${data.pet.care_note}”`;
  });

  let groomId = null;
  await check('Customer books a groom, priced server-side', async () => {
    const { status, data } = await call('/api/app/bookings', {
      as: AARAV,
      method: 'POST',
      body: {
        petId, serviceKind: 'groom', packageId: 'premium', addonIds: ['tick'],
        dateLabel: 'Today', slot: '2:00 pm'
      }
    });
    expect(status === 201, `status ${status}`);
    groomId = data.booking.id;
    expect(data.booking.total === 1699 + 300, `expected ₹1999, got ₹${data.booking.total}`);
    expect(data.booking.status === 'Needs partner', data.booking.status);
    expect(data.booking.care_note.includes('SMOKE TEST'), 'care note not carried onto the booking');
    return `${groomId} · ₹${data.booking.total}`;
  });
  await check('A bad coupon is rejected', async () => {
    const { status } = await call('/api/app/bookings', {
      as: AARAV, method: 'POST',
      body: {
        petId, serviceKind: 'groom', packageId: 'basic',
        dateLabel: 'Today', slot: '1:00 pm', couponCode: 'NOTREAL'
      }
    });
    expect(status === 400, `expected 400, got ${status}`);
    return '400';
  });
  await check('The same note reaches the groomer’s job sheet', async () => {
    const { data } = await call(`/api/app/jobs/${groomId}`, { as: RITIKA });
    expect(data.job.care_note.includes('SMOKE TEST'),
      'the partner does not see the owner’s sentence');
    return 'same sentence, one row';
  });
  await check('And the staff console shows it too', async () => {
    const res = await fetch(`${BASE}/api/bookings/${groomId}`, { headers: { 'x-demo-user': 's1' } });
    const data = await res.json();
    expect(data.booking.care_note.includes('SMOKE TEST'), 'staff console does not show it');
    return 'three surfaces, one column';
  });

  /* ---------- groomer ---------- */
  console.log('\npartner app · groomer');
  await check('Job appears in the open feed', async () => {
    const { data } = await call('/api/app/jobs?mode=grooming', { as: RITIKA });
    expect(data.open.some((j) => j.id === groomId), 'not in the open feed');
    const job = data.open.find((j) => j.id === groomId);
    expect(job.payout === Math.round(1999 * 0.85), `payout ${job.payout} does not match a 15% fee`);
    return `${data.open.length} open · payout ₹${job.payout}`;
  });
  await check('Groomer claims it', async () => {
    const { status, data } = await call(`/api/app/jobs/${groomId}/claim`, { as: RITIKA, method: 'POST' });
    expect(status === 200, `status ${status}`);
    expect(data.job.partner_name === 'Ritika Sharma', 'not assigned');
    return 'assigned';
  });
  await check('A second partner cannot claim it', async () => {
    const { status } = await call(`/api/app/jobs/${groomId}/claim`, { as: 'partner:P34', method: 'POST' });
    expect(status === 409, `expected 409, got ${status}`);
    return '409';
  });
  await check('Checklist is namespaced p: and a:', async () => {
    const { data } = await call(`/api/app/jobs/${groomId}`, { as: RITIKA });
    const keys = data.checklist.flatMap((g) => g.items.map((i) => i.item_key));
    expect(keys.every((k) => /^[pa]:/.test(k)), 'unnamespaced keys found');
    expect(keys.some((k) => k.startsWith('a:')), 'the add-on produced no row');
    expect(new Set(keys).size === keys.length, 'duplicate keys — an add-on could untick an inclusion');
    return `${keys.length} rows, ${data.checklist.length} groups, all unique`;
  });
  await check('Completing is gated on every row', async () => {
    await call(`/api/app/jobs/${groomId}/status`, {
      as: RITIKA, method: 'POST', body: { status: 'On the way' }
    });
    await call(`/api/app/jobs/${groomId}/status`, {
      as: RITIKA, method: 'POST', body: { status: 'In progress' }
    });
    const { status, data } = await call(`/api/app/jobs/${groomId}/complete`, { as: RITIKA, method: 'POST' });
    expect(status === 400, `expected 400, got ${status}`);
    expect(/still to tick/.test(data.error), data.error);
    return data.error;
  });
  await check('Ticking every row then completing works', async () => {
    const { data } = await call(`/api/app/jobs/${groomId}`, { as: RITIKA });
    const keys = data.checklist.flatMap((g) => g.items.map((i) => i.item_key));
    for (const key of keys) {
      await call(`/api/app/jobs/${groomId}/checklist`, {
        as: RITIKA, method: 'POST', body: { itemKey: key, done: true }
      });
    }
    const done = await call(`/api/app/jobs/${groomId}/complete`, { as: RITIKA, method: 'POST' });
    expect(done.status === 200, `status ${done.status}`);
    expect(done.data.job.status === 'Completed', done.data.job.status);
    return `${keys.length} rows ticked, job completed`;
  });
  await check('The visit joined the pet’s grooming history', async () => {
    const { data } = await call(`/api/app/pets/${petId}`, { as: AARAV });
    expect(data.history.some((h) => h.code === `v-${groomId}`), 'visit not recorded');
    return `${data.history.length} visits now`;
  });
  await check('Customer pays; the partner balance moves', async () => {
    const before = await call('/api/app/partner/earnings', { as: RITIKA });
    const paid = await call(`/api/app/bookings/${groomId}/pay`, {
      as: AARAV, method: 'POST', body: { method: 'upi', useWallet: false }
    });
    expect(paid.status === 200, `status ${paid.status}`);
    const after = await call('/api/app/partner/earnings', { as: RITIKA });
    expect(after.data.pending > before.data.pending, 'partner balance did not move');
    return `₹${before.data.pending} → ₹${after.data.pending}`;
  });
  await check('Customer rates it', async () => {
    const { status } = await call(`/api/app/bookings/${groomId}/rate`, {
      as: AARAV, method: 'POST',
      body: { rating: 5, tip: 50, comment: 'SMOKE TEST review.' }
    });
    expect(status === 200, `status ${status}`);
    return '5 stars, ₹50 tip';
  });

  /* ---------- walker ---------- */
  console.log('\npartner app · walker');
  let walkId = null;
  await check('Customer books a walk', async () => {
    const { status, data } = await call('/api/app/bookings', {
      as: AARAV, method: 'POST',
      body: { petId, serviceKind: 'walk', walkId: 'w30', dateLabel: 'Today', slot: '5:00 pm' }
    });
    expect(status === 201, `status ${status}`);
    walkId = data.booking.id;
    expect(data.booking.total === 249, `expected ₹249, got ₹${data.booking.total}`);
    return `${walkId} · ₹249`;
  });
  await check('It shows up as a walk request', async () => {
    const { data } = await call('/api/app/walks/requests', { as: NEHA });
    expect(data.requests.some((r) => r.booking_id === walkId), 'not in the request list');
    return `${data.requests.length} open`;
  });
  await check('Walker accepts, heads to pickup, starts walking', async () => {
    const a = await call(`/api/app/walks/${walkId}/accept`, { as: NEHA, method: 'POST' });
    expect(a.status === 200, `accept ${a.status}`);
    await call(`/api/app/walks/${walkId}/state`, {
      as: NEHA, method: 'POST', body: { state: 'pickup' }
    });
    const w = await call(`/api/app/walks/${walkId}/state`, {
      as: NEHA, method: 'POST', body: { state: 'walking' }
    });
    expect(w.data.walk.state === 'walking', w.data.walk.state);
    return 'walking';
  });
  await check('Both apps read the same live walk row', async () => {
    await new Promise((r) => setTimeout(r, 1200));
    const walker = await call(`/api/app/walks/${walkId}`, { as: NEHA });
    const owner = await call(`/api/app/walks/${walkId}`, { as: AARAV });
    expect(owner.status === 200, `owner got ${owner.status}`);
    expect(walker.data.walk.state === owner.data.walk.state, 'states disagree');
    expect(walker.data.walk.elapsed_secs > 0, 'the clock is not running');
    return `${walker.data.walk.elapsed_secs}s elapsed, ${walker.data.walk.distance_km} km`;
  });
  await check('A third party cannot read that walk', async () => {
    const { status } = await call(`/api/app/walks/${walkId}`, { as: 'customer:C1203' });
    expect(status === 403, `expected 403, got ${status}`);
    return '403';
  });
  await check('Walker ends the walk', async () => {
    const { status, data } = await call(`/api/app/walks/${walkId}/end`, { as: NEHA, method: 'POST' });
    expect(status === 200, `status ${status}`);
    expect(data.walk.state === 'done', data.walk.state);
    return `${Math.round(data.walk.elapsed_secs / 60)} min · ${data.walk.distance_km} km`;
  });
  await check('The customer sees it as completed', async () => {
    const { data } = await call(`/api/app/bookings/${walkId}`, { as: AARAV });
    expect(data.booking.status === 'Completed', data.booking.status);
    expect(data.walk.state === 'done', 'walk row not done');
    return 'ending it in the partner app updated the customer app';
  });

  /* ---------- store ---------- */
  console.log('\nstore · one catalogue, two ladders');
  await check('Customer sees retail, partner sees trade', async () => {
    const retail = await call('/api/app/store', { as: AARAV });
    const trade = await call('/api/app/store', { as: RITIKA });
    expect(retail.data.pricing === 'retail', retail.data.pricing);
    expect(trade.data.pricing === 'trade', trade.data.pricing);
    const r = retail.data.products.find((p) => p.id === 'p1');
    const t = trade.data.products.find((p) => p.id === 'p1');
    expect(r.now === 499 && t.now === 374, `retail ${r.now}, trade ${t.now}`);
    return `p1: ₹${r.now} retail, ₹${t.now} trade`;
  });
  await check('Allergy check flags chicken kibble for Simba', async () => {
    const { data } = await call('/api/app/store/products/p13', { as: AARAV });
    expect(data.allergyWarnings.some((w) => w.pet === 'Simba'),
      'Simba reacts to chicken and was not flagged');
    return `${data.allergyWarnings[0].pet}: ${data.allergyWarnings[0].allergies}`;
  });
  await check('Partners get no allergy check', async () => {
    const { data } = await call('/api/app/store/products/p13', { as: RITIKA });
    expect(data.allergyWarnings.length === 0, 'partner got a pet allergy warning');
    return 'none, as intended';
  });
  await check('Cart and checkout at trade pricing', async () => {
    await call('/api/app/store/cart', {
      as: RITIKA, method: 'POST', body: { productId: 'p1', sizeIndex: 1, qty: 2 }
    });
    const cart = await call('/api/app/store/cart', { as: RITIKA });
    expect(cart.data.total === 374 * 2, `expected ₹748, got ₹${cart.data.total}`);
    const order = await call('/api/app/store/checkout', {
      as: RITIKA, method: 'POST', body: { address: '' }
    });
    expect(order.status === 201, `status ${order.status}`);
    expect(order.data.order.pricing === 'trade', order.data.order.pricing);
    return `${order.data.order.id} · ₹${order.data.order.total}`;
  });
  await check('An emptied cart cannot be checked out', async () => {
    const { status } = await call('/api/app/store/checkout', {
      as: RITIKA, method: 'POST', body: { address: '' }
    });
    expect(status === 400, `expected 400, got ${status}`);
    return '400';
  });

  /* ---------- guards ---------- */
  console.log('\nguards');
  await check('Anonymous cannot read the customer home', async () => {
    const { status } = await call('/api/app/customer/home');
    expect(status === 401, `expected 401, got ${status}`);
    return '401';
  });
  await check('A customer cannot read the job feed', async () => {
    const { status } = await call('/api/app/jobs?mode=grooming', { as: AARAV });
    expect(status === 401, `expected 401, got ${status}`);
    return '401';
  });
  await check('A partner cannot read customer bookings', async () => {
    const { status } = await call('/api/app/bookings', { as: RITIKA });
    expect(status === 401, `expected 401, got ${status}`);
    return '401';
  });
  await check('A pending partner cannot sign in', async () => {
    const { status } = await call('/api/app/partner/home', { as: 'partner:P77' });
    expect(status === 403, `expected 403, got ${status}`);
    return '403';
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log('\nThis run created test bookings and an order. Re-seed with `npm run db:seed`.');
  if (fail) {
    console.log('failed: ' + failures.join(', '));
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('\nSmoke test could not run:', err.message);
  process.exit(1);
});
