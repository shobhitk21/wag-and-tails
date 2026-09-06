/* Renders the two apps in real Chrome through Expo's web target: signs in,
   walks the tabs and the key flows, and checks each screen actually painted
   and that its primary control is hit-testable at its own coordinates.

   The Build Book's headline bug was an invisible full-screen layer absorbing
   every tap, which handler-level testing missed entirely — elementFromPoint is
   the check that would have caught it.

   Needs both app dev servers and the API running:
     npm run dev:api
     cd apps/customer-app && npx expo start --web --port 8081
     cd apps/partner-app  && npx expo start --web --port 8082 */
import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CUSTOMER = process.env.CUSTOMER_URL || 'http://localhost:8081';
const PARTNER = process.env.PARTNER_URL || 'http://localhost:8082';

let pass = 0;
const problems = [];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Taps the first element whose visible text matches, the way a person would —
   through the DOM's own hit-testing rather than by calling a handler. */
async function tapText(page, text, { exact = false } = {}) {
  const handle = await page.evaluateHandle((needle, isExact) => {
    const nodes = [...document.querySelectorAll('div[tabindex], button, [role="button"], a, div')];
    /* Prefer the smallest matching element (a button, not its whole screen). */
    const matches = nodes.filter((el) => {
      const t = (el.innerText || '').trim();
      if (!t) return false;
      const ok = isExact ? t === needle : t.includes(needle);
      if (!ok) return false;
      const r = el.getBoundingClientRect();
      return r.width >= 4 && r.height >= 4;
    });
    matches.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return ra.width * ra.height - rb.width * rb.height;
    });
    for (const el of matches) {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (hit && (el.contains(hit) || hit.contains(el))) return el;
    }
    return null;
  }, text, exact);

  const el = handle.asElement();
  if (!el) return false;
  await el.click();
  await sleep(900);
  return true;
}

async function snapshot(page) {
  return page.evaluate(() => {
    const body = document.body.innerText || '';
    const controls = [...document.querySelectorAll('div[tabindex], button, [role="button"]')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 8 && r.height > 8;
      });

    let clickable = null;
    if (controls.length) {
      const r = controls[0].getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      clickable = Boolean(hit && (controls[0].contains(hit) || hit.contains(controls[0])));
    }

    return {
      text: body.slice(0, 4000),
      chars: body.length,
      controls: controls.length,
      clickable,
      brandPainted: [...document.querySelectorAll('*')].some((el) => {
        const bg = getComputedStyle(el).backgroundColor;
        return bg === 'rgb(74, 30, 11)' || bg === 'rgb(240, 123, 44)';
      })
    };
  });
}

async function step(page, name, { expect = [], tap, wait = 1200 } = {}) {
  try {
    if (tap) {
      const tapped = await tapText(page, tap);
      if (!tapped) throw new Error(`could not tap "${tap}"`);
    }
    await sleep(wait);
    const snap = await snapshot(page);

    /* Some labels render through textTransform: uppercase (the eyebrow style),
       so innerText reports the transformed case — match case-insensitively. */
    const haystack = snap.text.toLowerCase();
    const missing = expect.filter((e) => !haystack.includes(e.toLowerCase()));
    const issues = [];
    if (snap.chars < 30) issues.push('screen rendered blank');
    if (missing.length) issues.push(`missing: ${missing.join(', ')}`);
    if (snap.clickable === false) issues.push('primary control is NOT hit-testable');

    if (issues.length) {
      console.log(`  FAIL ${name} — ${issues.join('; ')}`);
      problems.push(`${name}: ${issues.join('; ')}`);
    } else {
      pass += 1;
      console.log(`  ok   ${name.padEnd(34)} ${snap.controls} controls, clickable`);
    }
    return snap;
  } catch (err) {
    console.log(`  FAIL ${name} — ${err.message}`);
    problems.push(`${name}: ${err.message}`);
    return null;
  }
}

async function openApp(browser, url, label) {
  console.log(`\n${label} → ${url}`);
  const page = await browser.newPage();
  await page.setViewport({ width: 414, height: 896, isMobile: true, hasTouch: true });

  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  /* Splash auto-advances after 1.4s; give the bundle time to settle past it. */
  await sleep(4000);

  if (errors.length) {
    console.log(`  FAIL boot — ${errors[0].slice(0, 140)}`);
    problems.push(`${label} boot: ${errors[0].slice(0, 140)}`);
  }
  return page;
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

/* ---------------- customer app ---------------- */
{
  const page = await openApp(browser, CUSTOMER, 'CUSTOMER APP');

  await step(page, 'onboarding slide 1', { expect: ['Grooming at your door'], wait: 500 });
  await step(page, 'onboarding slide 2', { tap: 'Next', expect: ['Walks you can watch'] });
  await step(page, 'onboarding slide 3', { tap: 'Next', expect: ['notes travel with them'] });
  await step(page, 'phone screen', { tap: 'Get started', expect: ['number'] });
  await step(page, 'pick a demo account', { tap: 'Aarav Mehta', expect: ['code'], wait: 2500 });

  await page.keyboard.type('4321', { delay: 90 });
  await sleep(3500);

  const home = await step(page, 'home', { expect: ['Book a service'], wait: 1500 });
  if (home && !/Simba|Mochi|Rio/.test(home.text)) {
    problems.push('home: no pets rendered');
    console.log('  FAIL home — no pets rendered');
  }

  await step(page, 'pets tab', { tap: 'Pets', expect: ['pets'], wait: 1800 });
  await step(page, 'pet profile', { tap: 'Simba', expect: ['Care note'], wait: 2200 });
  await step(page, 'vaccination record', { tap: 'Vaccination', expect: ['Rabies'], wait: 1800 });

  await page.goBack({ waitUntil: 'networkidle2' }).catch(() => {});
  await page.goto(CUSTOMER, { waitUntil: 'networkidle2' });
  await sleep(4500);
  await step(page, 'book a groom · pick pet', { tap: 'Grooming', expect: ['Who is it for'], wait: 1800 });
  await step(page, 'book a groom · pick Simba', { tap: 'Simba', wait: 700 });
  await step(page, 'book a groom · packages', { tap: 'Continue', expect: ['Premium'], wait: 1800 });

  await page.goto(CUSTOMER, { waitUntil: 'networkidle2' });
  await sleep(4500);
  await step(page, 'bookings tab', { tap: 'Bookings', expect: ['Upcoming'], wait: 1800 });
  await step(page, 'store tab', { tap: 'Store', expect: ['Indian Pet Company'], wait: 2500 });
  await step(page, 'account tab', { tap: 'Account', expect: ['Aarav'], wait: 1800 });

  await page.close();
}

/* ---------------- partner app ---------------- */
{
  const page = await openApp(browser, PARTNER, 'PARTNER APP');

  await step(page, 'onboarding slide 1', { expect: ['One app, both roles'], wait: 500 });
  await step(page, 'onboarding slide 2', { tap: 'Next', expect: ['Every job has notes'] });
  await step(page, 'onboarding slide 3', { tap: 'Next', expect: ['Paid on a schedule'] });
  await step(page, 'phone screen', { tap: 'Get started', expect: ['number'] });
  await step(page, 'pick a demo partner', { tap: 'Ritika Sharma', expect: ['code'], wait: 2500 });

  await page.keyboard.type('4321', { delay: 90 });
  await sleep(3500);

  await step(page, 'jobs feed', { expect: ['Grooming', 'Walking'], wait: 1800 });
  await step(page, 'switch to walking', { tap: 'Walking', wait: 1800 });
  await step(page, 'switch back to grooming', { tap: 'Grooming', wait: 1800 });
  await step(page, 'schedule tab', { tap: 'Schedule', wait: 1800 });
  await step(page, 'earnings tab', { tap: 'Earnings', expect: ['Pending payout'], wait: 1800 });
  await step(page, 'store at trade pricing', { tap: 'Store', expect: ['trade'], wait: 2500 });
  await step(page, 'account tab', { tap: 'Account', expect: ['Ritika'], wait: 1800 });

  await page.close();
}

await browser.close();

console.log(`\n${pass} checks passed, ${problems.length} problem(s)`);
if (problems.length) {
  problems.forEach((p) => console.log('  · ' + p));
  process.exit(1);
}
