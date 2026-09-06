/* Drives the real Chrome against both dev servers: signs in, walks every route,
   and verifies each screen actually painted and that its primary control is
   hit-testable at its own coordinates (elementFromPoint), which is the check
   the Build Book says would have caught the "nothing was clickable" bug. */
import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const STAFF = 'http://localhost:5173';
const ADMIN = 'http://localhost:5174';

const STAFF_ROUTES = [
  ['/', 'Dashboard'],
  ['/bookings', 'Bookings'],
  ['/bookings/new', 'New booking'],
  ['/bookings/WT8842', 'Booking detail'],
  ['/orders', 'Store orders'],
  ['/orders/IPC4462', 'Order detail'],
  ['/customers', 'Customers'],
  ['/customers/C1041', 'Customer detail'],
  ['/partners', 'Partners'],
  ['/profile', 'Profile']
];

const ADMIN_ROUTES = [
  ['/', 'Dashboard'],
  ['/reports', 'Reports'],
  ['/bookings', 'Bookings'],
  ['/bookings/WT8869', 'Booking detail'],
  ['/orders', 'Store orders'],
  ['/orders/IPC4462', 'Order detail'],
  ['/payouts', 'Payouts'],
  ['/products', 'Products'],
  ['/products/p1', 'Product detail'],
  ['/packages', 'Grooming packages'],
  ['/coupons', 'Offers & coupons'],
  ['/partners', 'Partners'],
  ['/partners/P77', 'Partner detail'],
  ['/customers', 'Customers'],
  ['/customers/C1041', 'Customer detail'],
  ['/staff', 'Staff'],
  ['/areas', 'Service areas'],
  ['/settings', 'Settings'],
  ['/profile', 'Profile']
];

let pass = 0;
const problems = [];

async function auditConsole(browser, base, routes, label) {
  console.log(`\n${label} → ${base}`);
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  /* Sign in once — the session persists in localStorage for every route after. */
  await page.goto(base, { waitUntil: 'networkidle0', timeout: 30000 });
  const signinBtn = await page.$('button[type="submit"]');
  if (signinBtn) {
    await signinBtn.click();
    await page.waitForSelector('.side', { timeout: 15000 });
    console.log('  ok   signed in');
    pass += 1;
  } else {
    console.log('  FAIL sign-in form did not render');
    problems.push(`${label}: no sign-in form`);
  }

  for (const [route, name] of routes) {
    errors.length = 0;
    try {
      await page.goto(base + route, { waitUntil: 'networkidle0', timeout: 30000 });
      /* Wait for the screen to finish its fetch rather than catching the spinner. */
      await page.waitForFunction(() => !document.querySelector('.spinner'), { timeout: 15000 });

      const report = await page.evaluate(() => {
        const title = document.querySelector('.topbar__t')?.textContent?.trim() ?? null;
        const err = document.querySelector('.errbox')?.textContent?.trim() ?? null;

        /* Hit-test the first real control on the screen: does the element at its
           own centre point actually belong to it, or is something invisible
           sitting on top absorbing the click? */
        const control =
          document.querySelector('.desk__scroll button, .desk__scroll .table tbody tr') ??
          document.querySelector('.topbar button');
        let clickable = null;
        if (control) {
          const r = control.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            clickable = Boolean(hit && (control.contains(hit) || hit.contains(control)));
          }
        }

        return {
          title,
          err,
          clickable,
          cards: document.querySelectorAll('.wcard').length,
          rows: document.querySelectorAll('.table tbody tr').length,
          navItems: document.querySelectorAll('.navitem').length,
          /* Confirms styles.css actually loaded, not just that markup exists. */
          brandApplied: getComputedStyle(document.documentElement)
            .getPropertyValue('--brand-700').trim()
        };
      });

      const issues = [];
      if (!report.title) issues.push('no title rendered');
      if (report.err) issues.push(`error box: ${report.err.slice(0, 80)}`);
      if (report.clickable === false) issues.push('primary control is NOT hit-testable');
      if (report.brandApplied !== '#4A1E0B') issues.push(`brand token is "${report.brandApplied}"`);
      if (errors.length) issues.push(`console: ${errors[0].slice(0, 90)}`);

      if (issues.length) {
        console.log(`  FAIL ${name} (${route}) — ${issues.join('; ')}`);
        problems.push(`${label} ${route}: ${issues.join('; ')}`);
      } else {
        pass += 1;
        console.log(
          `  ok   ${name.padEnd(20)} "${report.title}" · ${report.cards} cards, ${report.rows} rows, clickable`
        );
      }
    } catch (err) {
      console.log(`  FAIL ${name} (${route}) — ${err.message.split('\n')[0]}`);
      problems.push(`${label} ${route}: ${err.message.split('\n')[0]}`);
    }
  }

  await page.close();
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

await auditConsole(browser, STAFF, STAFF_ROUTES, 'STAFF PORTAL');
await auditConsole(browser, ADMIN, ADMIN_ROUTES, 'ADMIN CONSOLE');

await browser.close();

console.log(`\n${pass} screens rendered cleanly, ${problems.length} problem(s)`);
if (problems.length) {
  problems.forEach((p) => console.log('  · ' + p));
  process.exit(1);
}
