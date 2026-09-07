/* Drives the console actions that used to say "not wired yet", in real Chrome.

   uicheck.js proves every screen renders; this proves the buttons on them do
   something. Vite builds happily with an undefined reference, so a broken
   handler only shows up when a person — or this — actually clicks it.

   Needs the API and the admin console running:
     npm run dev -w backend
     npm run dev -w web/admin-portal   (port 5174) */
import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ADMIN = process.env.ADMIN_URL || 'http://localhost:5174';

let pass = 0;
let fail = 0;
const failures = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

/* Clicks the first visible element whose text matches, the way a person would,
   rather than calling the handler directly. */
async function clickText(page, text, { within } = {}) {
  const handle = await page.evaluateHandle((needle, scope) => {
    const root = scope ? document.querySelector(scope) : document;
    const nodes = [...root.querySelectorAll('button, a, [role="button"]')];
    const hits = nodes.filter((el) => (el.innerText || '').trim().includes(needle));
    hits.sort((a, b) => a.innerText.length - b.innerText.length);
    return hits[0] ?? null;
  }, text, within ?? null);
  const el = handle.asElement();
  if (!el) throw new Error(`no clickable element matching "${text}"`);
  await el.click();
  return el;
}

async function fillDialog(page, values) {
  await page.waitForSelector('.confirm .formgrid', { timeout: 5000 });
  for (const [label, value] of Object.entries(values)) {
    const filled = await page.evaluate((lbl, val) => {
      const groups = [...document.querySelectorAll('.confirm .formgrid > div')];
      const group = groups.find((g) => (g.querySelector('.formlabel')?.textContent ?? '').trim() === lbl);
      if (!group) return false;
      const input = group.querySelector('input, textarea, select');
      if (!input) return false;

      /* React tracks the DOM value itself, so setting .value directly is
         ignored on the next render. Going through the native setter and
         dispatching the event is what makes React see the change. */
      const proto = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype
        : input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      if (input.type === 'checkbox') {
        Object.getOwnPropertyDescriptor(proto, 'checked').set.call(input, Boolean(val));
        input.dispatchEvent(new Event('click', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, String(val));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, label, value);
    if (!filled) throw new Error(`no field labelled "${label}" in the dialog`);
  }
}

const toastText = (page) =>
  page.evaluate(() => document.querySelector('.wtoast')?.innerText?.trim() ?? null);

const dialogError = (page) =>
  page.evaluate(() => document.querySelector('.confirm .formerror')?.innerText?.trim() ?? null);

/* The toast clears itself after 2.4s, so its text has to be captured in the
   same evaluation that finds it — waiting first and reading after is a race
   the test loses often enough to be useless. `previous` guards against the
   other half of the problem: a toast still on screen from the last action
   would otherwise be read as this action's result. */
async function waitForToast(page, previous = null, timeout = 8000) {
  const handle = await page.waitForFunction((was) => {
    const text = document.querySelector('.wtoast')?.innerText?.trim();
    return text && text !== was ? text : false;
  }, { timeout, polling: 50 }, previous);
  return handle.jsonValue();
}

/* Waits for any toast on screen to clear, so the next action starts clean. */
async function toastSettled(page) {
  await page.waitForFunction(() => !document.querySelector('.wtoast'), { timeout: 6000 })
    .catch(() => {});
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 950 });

const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text()); });

console.log(`\nconsole actions → ${ADMIN}`);

/* ---------- sign in ---------- */
await page.goto(ADMIN, { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForFunction(
  () => [...document.querySelectorAll('button')].some((b) => b.innerText.includes('Fill demo credentials')),
  { timeout: 20000 }
);
await clickText(page, 'Fill demo credentials');
await sleep(300);
await (await page.$('button[type="submit"]')).click();
await page.waitForSelector('.side', { timeout: 20000 });
console.log('  ok   signed in');
pass += 1;

const stamp = Date.now().toString().slice(-6);

async function goto(path) {
  await page.goto(ADMIN + path, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector('.wspin'), { timeout: 15000 });
  pageErrors.length = 0;
}

/* ---------- coupons ---------- */
await goto('/coupons');
await check('New coupon dialog opens and creates', async () => {
  await clickText(page, 'New coupon');
  await fillDialog(page, { Code: `ui${stamp}`, 'What it gives': 'UI test offer' });
  await clickText(page, 'Create coupon', { within: '.confirm' });
  const toast = await waitForToast(page);
  expect(/created/i.test(toast ?? ''), `toast said "${toast}"`);
  expect(!pageErrors.length, `page errors: ${pageErrors[0]}`);
  return toast;
});

await check('A duplicate code shows the API refusal in the dialog', async () => {
  await clickText(page, 'New coupon');
  await fillDialog(page, { Code: `ui${stamp}`, 'What it gives': 'Same again' });
  await clickText(page, 'Create coupon', { within: '.confirm' });
  await page.waitForFunction(
    () => Boolean(document.querySelector('.confirm .formerror')), { timeout: 8000 }
  );
  const err = await dialogError(page);
  expect(/already exists/i.test(err ?? ''), `error read "${err}"`);
  const stillOpen = await page.$('.confirm .formgrid');
  expect(stillOpen, 'the dialog closed and threw away what was typed');
  await page.keyboard.press('Escape');
  return err;
});

/* ---------- service areas ---------- */
await goto('/areas');
await check('Add area creates it as pending', async () => {
  await clickText(page, 'Add area');
  await fillDialog(page, { Area: `UI Town ${stamp}` });
  await clickText(page, 'Add area', { within: '.confirm' });
  const toast = await waitForToast(page);
  expect(/pending/i.test(toast ?? ''), `toast said "${toast}"`);
  return toast;
});

await check('Edit area switches it live', async () => {
  await toastSettled(page);
  await page.waitForFunction(
    (name) => [...document.querySelectorAll('td')].some((td) => td.innerText.trim() === name),
    { timeout: 8000 }, `UI Town ${stamp}`
  );
  const opened = await page.evaluate((name) => {
    const row = [...document.querySelectorAll('tr')]
      .find((tr) => tr.innerText.includes(name));
    const btn = row?.querySelector('button');
    if (!btn) return false;
    btn.click();
    return true;
  }, `UI Town ${stamp}`);
  expect(opened, 'no Edit button on the new row');

  await fillDialog(page, { Status: 'Live' });
  await clickText(page, 'Save area', { within: '.confirm' });
  const toast = await waitForToast(page);
  expect(/saved/i.test(toast ?? ''), `toast said "${toast}"`);
  return toast;
});

/* ---------- packages ---------- */
await goto('/packages');
await check('Add package creates it with inclusions', async () => {
  await clickText(page, 'Add package');
  await fillDialog(page, {
    Name: `UI Groom ${stamp}`,
    'MRP (₹)': '1500',
    'Price (₹)': '1299',
    'Takes (minutes)': '75',
    'What is included': 'Bath\nNail trim'
  });
  await clickText(page, 'Create package', { within: '.confirm' });
  const toast = await waitForToast(page);
  expect(/created/i.test(toast ?? ''), `toast said "${toast}"`);

  const shown = await page.evaluate(
    (name) => [...document.querySelectorAll('tr')].some((tr) => tr.innerText.includes(name)),
    `UI Groom ${stamp}`
  );
  expect(shown, 'the new package is not in the table');
  return `${toast} and listed`;
});

await check('A price above MRP is refused with the field named', async () => {
  await clickText(page, 'Add package');
  await fillDialog(page, {
    Name: `Bad ${stamp}`, 'MRP (₹)': '100', 'Price (₹)': '9000', 'Takes (minutes)': '60'
  });
  await clickText(page, 'Create package', { within: '.confirm' });
  await page.waitForFunction(
    () => Boolean(document.querySelector('.confirm .formerror')), { timeout: 8000 }
  );
  const bad = await page.evaluate(
    () => document.querySelector('.confirm .formhint.is-bad')?.innerText?.trim() ?? null
  );
  expect(bad, 'no field-level message was shown');
  await page.keyboard.press('Escape');
  return bad;
});

/* ---------- products ---------- */
await goto('/products');
await check('Add product creates it', async () => {
  await clickText(page, 'Add product');
  await fillDialog(page, {
    Name: `UI Shampoo ${stamp}`, Category: 'grooming', 'MRP (₹)': '700', 'Price (₹)': '599'
  });
  await clickText(page, 'Add product', { within: '.confirm' });
  const toast = await waitForToast(page);
  expect(/added/i.test(toast ?? ''), `toast said "${toast}"`);
  return toast;
});

/* ---------- staff ---------- */
await goto('/staff');
await check('Invite staff creates an inactive account', async () => {
  await clickText(page, 'Invite staff');
  await fillDialog(page, {
    Name: `UI Tester ${stamp}`, 'Work email': `ui${stamp}@wagandtails.in`, Role: 'support'
  });
  await clickText(page, 'Send invite', { within: '.confirm' });
  const toast = await waitForToast(page);
  expect(/cannot sign in/i.test(toast ?? ''), `toast said "${toast}"`);
  return toast;
});

await check('Manage opens with the account filled in', async () => {
  const opened = await page.evaluate((name) => {
    const row = [...document.querySelectorAll('tr')].find((tr) => tr.innerText.includes(name));
    const btn = [...(row?.querySelectorAll('button') ?? [])].find((b) => /manage/i.test(b.innerText));
    if (!btn) return false;
    btn.click();
    return true;
  }, `UI Tester ${stamp}`);
  expect(opened, 'no Manage button on the invited row');

  await page.waitForSelector('.confirm .formgrid', { timeout: 5000 });
  const nameValue = await page.evaluate(() => {
    const groups = [...document.querySelectorAll('.confirm .formgrid > div')];
    const group = groups.find((g) => (g.querySelector('.formlabel')?.textContent ?? '').trim() === 'Name');
    return group?.querySelector('input')?.value ?? null;
  });
  expect(nameValue?.includes('UI Tester'), `name field held "${nameValue}"`);
  await page.keyboard.press('Escape');
  return nameValue;
});

/* ---------- profile ---------- */
await goto('/profile');
await check('Profile saves and updates the sidebar', async () => {
  const before = await page.evaluate(
    () => document.querySelector('.side__foot .navitem span span')?.innerText?.trim() ?? null
  );
  expect(before, 'could not read the sidebar name');

  await page.evaluate((next) => {
    const groups = [...document.querySelectorAll('.wgrid > div')];
    const group = groups.find((g) => (g.querySelector('.formlabel')?.textContent ?? '').trim() === 'Full name');
    const input = group.querySelector('input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, `${before} ✓`);

  await clickText(page, 'Save changes');
  const toast = await waitForToast(page);
  expect(/saved/i.test(toast ?? ''), `toast said "${toast}"`);

  await page.waitForFunction(
    (was) => document.querySelector('.side__foot .navitem span span')?.innerText?.trim() !== was,
    { timeout: 6000 }, before
  );

  /* Put the name back, so the suite can be run again. */
  await page.evaluate((original) => {
    const groups = [...document.querySelectorAll('.wgrid > div')];
    const group = groups.find((g) => (g.querySelector('.formlabel')?.textContent ?? '').trim() === 'Full name');
    const input = group.querySelector('input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, original);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, before);
  await clickText(page, 'Save changes');
  await sleep(800);
  return 'sidebar followed the edit';
});

/* ---------- reschedule ---------- */
await goto('/bookings');
await check('Reschedule moves a booking from its detail screen', async () => {
  await toastSettled(page);
  const id = await page.evaluate(() => {
    const row = [...document.querySelectorAll('tbody tr')]
      .find((tr) => !/completed|cancelled/i.test(tr.innerText));
    if (!row) return null;
    row.click();
    return row.innerText.split('\n')[0].trim();
  });
  expect(id, 'no live booking in the table');
  await page.waitForFunction(() => !document.querySelector('.wspin'), { timeout: 15000 });

  await clickText(page, 'Reschedule');
  await fillDialog(page, { Date: 'Tomorrow' });
  await clickText(page, 'Move booking', { within: '.confirm' });
  const toast = await waitForToast(page);
  expect(/moved to/i.test(toast ?? ''), `toast said "${toast}"`);
  return toast;
});

/* ---------- settings ---------- */
await goto('/settings');
await check('Pause all bookings asks first, then applies', async () => {
  await clickText(page, 'Pause all bookings');
  await page.waitForSelector('.confirm', { timeout: 5000 });
  const title = await page.evaluate(
    () => document.querySelector('.confirm__title')?.innerText?.trim() ?? null
  );
  expect(/pause/i.test(title ?? ''), `dialog said "${title}"`);

  await clickText(page, 'Pause bookings', { within: '.confirm' });
  const toast = await waitForToast(page);
  expect(/paused/i.test(toast ?? ''), `toast said "${toast}"`);

  /* Put it back, and check the button now offers the opposite. */
  await page.waitForFunction(
    () => [...document.querySelectorAll('button')].some((b) => /resume all bookings/i.test(b.innerText)),
    { timeout: 8000 }
  );
  await clickText(page, 'Resume all bookings');
  await clickText(page, 'Resume bookings', { within: '.confirm' });
  await sleep(1200);
  return 'paused, button flipped, resumed';
});

/* Everything this run created is removed again.

   Not politeness: the other suites assert on counts ("expected 5 packages"),
   so a run that leaves a package and a product behind makes smoke.js fail
   afterwards with three failures that have nothing to do with what it tests.
   A suite that breaks its neighbours is worse than one that does not run. */
console.log('\ncleanup');
await check('Removes the rows this run created', async () => {
  const { cleanupByName } = await import('./cleanup-helper.js');
  const removed = await cleanupByName([
    ['coupons', 'code', `UI${stamp}`],
    ['packages', 'name', `UI Groom ${stamp}`],
    ['products', 'name', `UI Shampoo ${stamp}`],
    ['service_areas', 'name', `UI Town ${stamp}`],
    ['staff_users', 'email', `ui${stamp}@wagandtails.in`]
  ]);
  return `${removed} row${removed === 1 ? '' : 's'} removed`;
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) console.log('failed: ' + failures.join(', '));
await browser.close();
process.exit(fail ? 1 : 0);
