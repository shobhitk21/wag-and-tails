/* Screenshots the original prototype next to the rebuilt apps, at matching
   screens, so a visual diff is possible at a glance rather than trusting
   descriptions. Saves PNGs to the given output directory. */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = process.argv[2] || 'C:/Users/shobh/AppData/Local/Temp/visual-compare';
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tap(page, text) {
  const handle = await page.evaluateHandle((needle) => {
    const nodes = [...document.querySelectorAll('div[tabindex], button, [role="button"], a, div')];
    const matches = nodes.filter((el) => {
      const t = (el.innerText || '').trim();
      if (!t || !t.includes(needle)) return false;
      const r = el.getBoundingClientRect();
      return r.width >= 4 && r.height >= 4;
    });
    matches.sort((a, b) => {
      const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect();
      return ra.width * ra.height - rb.width * rb.height;
    });
    for (const el of matches) {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (hit && (el.contains(hit) || hit.contains(el))) return el;
    }
    return null;
  }, text);
  const el = handle.asElement();
  if (!el) return false;
  await el.click();
  await sleep(900);
  return true;
}

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage']
});

/* ---- original prototype, customer surface ---- */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 900 });
  await page.goto('http://localhost:4173/customer', { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(1500);
  // click through splash if present
  await page.mouse.click(215, 450).catch(() => {});
  await sleep(2500);
  await page.screenshot({ path: `${OUT}/original-customer-01-boot.png` });

  // try to reach home by tapping through onboarding/auth if shown
  for (let i = 0; i < 6; i++) {
    const clicked = await tap(page, 'Continue') || await tap(page, 'Log in') || await tap(page, 'Get OTP')
      || await tap(page, 'Verify') || await tap(page, 'Skip') || await tap(page, 'Get started');
    if (!clicked) break;
    await sleep(1200);
  }
  await sleep(1500);
  await page.screenshot({ path: `${OUT}/original-customer-02-home.png` });
  await page.close();
}

/* ---- rebuilt customer app ---- */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 900 });
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(1800);
  await page.screenshot({ path: `${OUT}/rebuilt-customer-01-onboard.png` });

  await tap(page, 'Next'); await sleep(600);
  await tap(page, 'Next'); await sleep(600);
  await tap(page, 'Get started'); await sleep(1200);
  await page.screenshot({ path: `${OUT}/rebuilt-customer-02-phone.png` });

  await tap(page, 'Aarav Mehta'); await sleep(2200);
  await page.keyboard.type('4321', { delay: 90 });
  await sleep(3200);
  await page.screenshot({ path: `${OUT}/rebuilt-customer-03-home.png` });

  await tap(page, 'Simba'); await sleep(1500);
  await page.screenshot({ path: `${OUT}/rebuilt-customer-04-pet.png` });

  await page.goto('http://localhost:8081', { waitUntil: 'networkidle2' });
  await sleep(3500);
  await tap(page, 'Store'); await sleep(2200);
  await page.screenshot({ path: `${OUT}/rebuilt-customer-05-store.png` });

  await page.close();
}

/* ---- rebuilt partner app ---- */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 900 });
  await page.goto('http://localhost:8082', { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(1800);
  await tap(page, 'Next'); await sleep(600);
  await tap(page, 'Next'); await sleep(600);
  await tap(page, 'Get started'); await sleep(1200);
  await tap(page, 'Ritika Sharma'); await sleep(2200);
  await page.keyboard.type('4321', { delay: 90 });
  await sleep(3200);
  await page.screenshot({ path: `${OUT}/rebuilt-partner-01-jobs.png` });
  await page.close();
}

/* ---- original prototype, partner surface ---- */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 900 });
  await page.goto('http://localhost:4173/partner', { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(1500);
  await page.mouse.click(215, 450).catch(() => {});
  await sleep(2000);
  for (let i = 0; i < 6; i++) {
    const clicked = await tap(page, 'Continue') || await tap(page, 'Log in') || await tap(page, 'Get OTP')
      || await tap(page, 'Verify') || await tap(page, 'Skip') || await tap(page, 'Get started');
    if (!clicked) break;
    await sleep(1200);
  }
  await sleep(1500);
  await page.screenshot({ path: `${OUT}/original-partner-01-jobs.png` });
  await page.close();
}

await browser.close();
console.log('Screenshots saved to', OUT);
console.log(fs.readdirSync(OUT).join('\n'));
