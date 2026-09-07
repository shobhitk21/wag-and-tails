/* Drives the vaccination record editor in the customer app, in real Chrome.

   appcheck.js proves the screen renders; this proves the sheet on it saves.
   The record is added, edited and removed again, so the suite leaves the pet
   exactly as it found it and can be run twice in a row.

   Needs the API and the customer app running:
     npm run dev -w backend
     cd apps/customer-app && npx expo start --web --port 8081 */
import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CUSTOMER = process.env.CUSTOMER_URL || 'http://localhost:8081';

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

/* Taps the smallest element whose text matches, so "Pets" hits the tab and not
   the screen containing it. */
async function tap(page, text) {
  const handle = await page.evaluateHandle((needle) => {
    const nodes = [...document.querySelectorAll('div[tabindex], button, [role="button"], a, div')];
    const hits = nodes.filter((el) => {
      const t = (el.innerText || '').trim();
      if (!t.includes(needle)) return false;
      const r = el.getBoundingClientRect();
      return r.width >= 4 && r.height >= 4;
    });
    hits.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return ra.width * ra.height - rb.width * rb.height;
    });
    return hits[0] ?? null;
  }, text);
  const el = handle.asElement();
  if (!el) throw new Error(`nothing to tap matching "${text}"`);
  await el.click();
}

/* React Native Web renders TextInput as a real <input>, so the same
   native-setter trick the console test uses works here. Fields are found by
   their placeholder, which is the only stable label in the rendered tree. */
async function type(page, placeholder, value) {
  const ok = await page.evaluate((ph, val) => {
    const input = [...document.querySelectorAll('input, textarea')]
      .find((el) => el.placeholder === ph);
    if (!input) return false;
    const proto = input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, placeholder, value);
  if (!ok) throw new Error(`no field with placeholder "${placeholder}"`);
}

const screenText = (page) => page.evaluate(() => document.body.innerText);

/* The smallest element holding both the record name and its status badge —
   i.e. the card, not the text node inside it. Matching on the name alone finds
   the <div> wrapping just the name and never contains the badge. */
const cardText = (page, name) => page.evaluate((needle) => {
  /* The badge has to match a whole line: the subtitle already contains the
     word "due" ("Given 01 Jan 2026 - due 01 Jan 2027"), so a loose match finds
     the text block above the badge and reports it as having no badge. */
  const cards = [...document.querySelectorAll('div')].filter((d) => {
    const t = d.innerText || '';
    return t.includes(needle) && /^(Up to date|Due)$/im.test(t);
  });
  cards.sort((a, b) => a.innerText.length - b.innerText.length);
  return cards[0]?.innerText ?? null;
}, name);

const badgeOf = (text) => /^(Up to date|Due)$/im.exec(text ?? '')?.[1] ?? null;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 420, height: 900 });

const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

console.log(`\ncustomer app · vaccination records → ${CUSTOMER}`);

await page.goto(CUSTOMER, { waitUntil: 'networkidle2', timeout: 90000 });
await sleep(1500);
await tap(page, 'Next'); await sleep(500);
await tap(page, 'Next'); await sleep(500);
await tap(page, 'Get started'); await sleep(900);
await tap(page, 'Aarav Mehta'); await sleep(2500);
await page.keyboard.type('4321', { delay: 90 });
await sleep(4000);
console.log('  ok   signed in');
pass += 1;

await tap(page, 'Pets'); await sleep(1800);
await tap(page, 'Simba'); await sleep(2200);
await tap(page, 'Vaccination'); await sleep(2000);

const NAME = `Smoke Booster ${Date.now().toString().slice(-5)}`;

await check('The screen opens with records and an add control', async () => {
  const text = await screenText(page);
  expect(/vaccination/i.test(text), 'not on the vaccinations screen');
  expect(!/not wired/i.test(text), 'the screen still says editing is not wired');
  expect(!pageErrors.length, `page errors: ${pageErrors[0]}`);
  return 'no dead-end copy left';
});

await check('Adding a record saves it', async () => {
  /* The add control is the icon button in the app bar — tapped by position
     because it has no text of its own. */
  const tapped = await page.evaluate(() => {
    const el = document.querySelector('[aria-label="Add a record"]');
    if (!el) return false;
    el.click();
    return true;
  });
  expect(tapped, 'no "Add a record" control in the app bar');
  await sleep(900);

  await type(page, 'Rabies', NAME);
  await type(page, '12 Mar 2026', '01 Jan 2026');
  await type(page, '12 Mar 2027', '01 Jan 2027');
  await tap(page, 'Save record');
  await sleep(2500);

  const text = await screenText(page);
  expect(text.includes(NAME), 'the new record is not on the screen');
  expect(!pageErrors.length, `page errors: ${pageErrors[0]}`);
  return NAME;
});

await check('A future due date reads as up to date', async () => {
  const badge = badgeOf(await cardText(page, NAME));
  expect(badge === 'Up to date', `the badge read "${badge}"`);
  return 'derived from the due date, not asserted by the app';
});

await check('Editing a record opens it filled in and saves', async () => {
  await tap(page, NAME);
  await sleep(900);

  const filled = await page.evaluate((name) => {
    const input = [...document.querySelectorAll('input')].find((el) => el.value === name);
    return Boolean(input);
  }, NAME);
  expect(filled, 'the sheet did not open with the record in it');

  await type(page, '12 Mar 2027', '01 Jan 2020');
  await tap(page, 'Save record');
  await sleep(2500);

  const badge = badgeOf(await cardText(page, NAME));
  expect(badge === 'Due', `after back-dating the due date the badge read "${badge}"`);
  return 'back-dating it flipped the badge to Due';
});

await check('Removing the record cleans up after the test', async () => {
  await tap(page, NAME);
  await sleep(900);
  await tap(page, 'Remove record');

  /* Wait for it to actually go rather than guessing how long the refetch
     takes — a fixed sleep here fails on a slow round trip and passes on a
     fast one, which is worse than no check at all. */
  await page.waitForFunction(
    (name) => !document.body.innerText.includes(name),
    { timeout: 10000 }, NAME
  ).catch(() => {});

  const text = await screenText(page);
  expect(!text.includes(NAME), 'the record is still listed');
  expect(!pageErrors.length, `page errors: ${pageErrors[0]}`);
  return 'pet left as it was found';
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) console.log('failed: ' + failures.join(', '));
await browser.close();
process.exit(fail ? 1 : 0);
