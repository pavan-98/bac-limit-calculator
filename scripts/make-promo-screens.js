// Generates the promo screenshots shown in Android's "Install app" sheet
// (and on desktop Chrome): a headline + the real app in a phone frame.
// Usage (from the repo root): node scripts/make-promo-screens.js   (needs Playwright)
//
// It serves the repo locally, drives the real app into a few states at a
// fixed time of night, then lays each capture out on a branded 1080x1920
// card (plus one 1920x1080 card for desktop). Output goes to screens/.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'screens');
// 11:10 PM in India: a realistic moment to be checking this app.
const NOW = new Date('2026-11-06T23:10:00+05:30');

const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json',
};

function serve() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, path.normalize(p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

/* ---------- 1. capture the real app ---------- */

async function newAppPage(browser, url) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'dark',
    locale: 'en-US',
    timezoneId: 'Asia/Kolkata',
    serviceWorkers: 'block',
  });
  await context.clock.install({ time: NOW });
  const page = await context.newPage();
  await page.goto(url);
  return { context, page };
}

async function setUp(page, { hoursAgo, drinks }) {
  await page.click('[data-goto=profile]');
  await page.click('[data-weight-step="1"]'); // 70 kg
  await page.click('[data-sex=male]');
  await page.click('#save-profile');
  await page.click(`.chip[data-ago="${hoursAgo}"]`);
  for (const [id, n] of Object.entries(drinks)) {
    for (let i = 0; i < n; i++) await page.click(`[data-add=${id}]`);
  }
}

async function tidy(page) {
  await page.evaluate(() => {
    document.getElementById('toast').hidden = true;
    document.activeElement && document.activeElement.blur();
  });
}

async function scrollTo(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 12);
  }, selector);
  await page.waitForTimeout(150);
}

async function captureApp(browser, url) {
  const shots = {};

  // Over the limit: 3 large pegs + a 650 ml beer, started 2 h ago
  const a = await newAppPage(browser, url);
  await setUp(a.page, { hoursAgo: 2, drinks: { shot60: 3, full: 1 } });
  await tidy(a.page);
  await a.page.evaluate(() => window.scrollTo(0, 0));
  await a.page.waitForTimeout(150);
  shots.answer = await a.page.screenshot();

  await scrollTo(a.page, '#drinks');
  shots.drinks = await a.page.screenshot();

  await a.page.fill('#meter-input', '205');
  await tidy(a.page);
  await scrollTo(a.page, '#police-meter');
  shots.police = await a.page.screenshot();

  await scrollTo(a.page, '#get-home');
  shots.home = await a.page.screenshot();
  await a.context.close();

  // Under the limit: one 650 ml beer, started 3 h ago
  const b = await newAppPage(browser, url);
  await setUp(b.page, { hoursAgo: 3, drinks: { full: 1 } });
  await tidy(b.page);
  await b.page.evaluate(() => window.scrollTo(0, 0));
  await b.page.waitForTimeout(150);
  shots.under = await b.page.screenshot();
  await b.context.close();

  return shots;
}

/* ---------- 2. lay out the promo cards ---------- */

const icon = fs.readFileSync(path.join(ROOT, 'icons/icon-192.png')).toString('base64');
const dataUrl = (buf) => `data:image/png;base64,${buf.toString('base64')}`;

const BASE_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    overflow: hidden; color: #f4f6fa;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    background: #0b0d12;
  }
  .brand { display: flex; align-items: center; gap: 18px; font-weight: 800; letter-spacing: -0.01em; }
  .brand img { border-radius: 16px; }
  h2 { font-weight: 900; letter-spacing: -0.035em; }
  h2 em { font-style: normal; color: var(--glow); }
  .sub { color: #a9b3c4; font-weight: 500; }
  .phone {
    position: absolute; overflow: hidden; background: #000;
    border: 16px solid #1d2330; border-bottom: 0;
    box-shadow: 0 0 0 2px #2c3445, 0 40px 120px rgba(0,0,0,0.6), 0 0 160px color-mix(in srgb, var(--glow) 25%, transparent);
  }
  .phone img { display: block; width: 100%; }
`;

function portraitCard({ glow, headline, sub, shot }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}
    body { width: 1080px; height: 1920px; position: relative; --glow: ${glow};
      background:
        radial-gradient(900px 700px at 50% 85%, color-mix(in srgb, ${glow} 22%, transparent), transparent 70%),
        radial-gradient(700px 500px at 0% 0%, color-mix(in srgb, ${glow} 10%, transparent), transparent 70%),
        #0b0d12; }
    .brand { position: absolute; top: 76px; left: 84px; font-size: 40px; }
    .brand img { width: 72px; height: 72px; }
    .text { position: absolute; top: 210px; left: 84px; right: 84px; }
    h2 { font-size: 96px; line-height: 1.02; }
    .sub { margin-top: 26px; font-size: 40px; line-height: 1.3; }
    .phone { left: 50%; top: 700px; width: 800px; height: 1300px; transform: translateX(-50%);
      border-radius: 84px 84px 0 0; }
  </style></head><body>
    <div class="brand"><img src="data:image/png;base64,${icon}" alt="">Can I Drive?</div>
    <div class="text"><h2>${headline}</h2><p class="sub">${sub}</p></div>
    <div class="phone"><img src="${dataUrl(shot)}" alt=""></div>
  </body></html>`;
}

function wideCard({ glow, shot }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}
    body { width: 1920px; height: 1080px; position: relative; --glow: ${glow};
      background:
        radial-gradient(1000px 800px at 78% 70%, color-mix(in srgb, ${glow} 22%, transparent), transparent 70%),
        #0b0d12; }
    .text { position: absolute; left: 140px; top: 50%; transform: translateY(-50%); width: 900px; }
    .brand { font-size: 44px; }
    .brand img { width: 84px; height: 84px; }
    h2 { margin-top: 56px; font-size: 104px; line-height: 1.02; }
    ul { margin-top: 48px; list-style: none; display: grid; gap: 22px; }
    li { font-size: 40px; color: #a9b3c4; font-weight: 600; }
    li::before { content: "✓"; color: var(--glow); font-weight: 900; margin-right: 18px; }
    .phone { right: 200px; top: 110px; width: 520px; height: 970px; border-radius: 64px 64px 0 0; border-width: 12px; }
  </style></head><body>
    <div class="text">
      <div class="brand"><img src="data:image/png;base64,${icon}" alt="">Can I Drive?</div>
      <h2>Had a few? Know <em>the exact time</em> you can drive.</h2>
      <ul>
        <li>Tap the beers, pegs or wine you had</li>
        <li>See what a police breathalyser would show</li>
        <li>Free, private, works offline</li>
      </ul>
    </div>
    <div class="phone"><img src="${dataUrl(shot)}" alt=""></div>
  </body></html>`;
}

// Order = carousel order in the install sheet. Keep `label` short and plain.
const SLIDES = [
  { file: 'promo-1-answer.webp', shot: 'answer', glow: '#ff6363',
    headline: 'Had a few? Know <em>the exact time</em> you can drive.',
    sub: 'One big answer. No maths, no guessing.',
    label: 'Shows the exact time you can legally drive again' },
  { file: 'promo-2-police.webp', shot: 'police', glow: '#ffbd4a',
    headline: 'See what the <em>police breathalyser</em> would show.',
    sub: 'Got a reading like 205? Type it in to see when you’ll be under 30.',
    label: 'Converts police breathalyser readings and shows when you will be under 30' },
  { file: 'promo-3-drinks.webp', shot: 'drinks', glow: '#8c9bff',
    headline: 'Just <em>tap what you drank.</em>',
    sub: 'Beers, pegs, wine. Big buttons, easy undo.',
    label: 'Tap the beers, pegs or wine you had' },
  { file: 'promo-4-home.webp', shot: 'home', glow: '#ff6363',
    headline: 'Over the limit? <em>Get home safe.</em>',
    sub: 'Book a cab or ask a friend for a ride in one tap.',
    label: 'Book a cab or ask a friend for a ride' },
  { file: 'promo-5-under.webp', shot: 'under', glow: '#45dd9c',
    headline: 'Watch it <em>count down</em> to sober.',
    sub: 'Free, no sign-up, works offline. Your data stays on your phone.',
    label: 'Counts down to when the alcohol is gone' },
];

// Screenshot the card, then re-encode it as WebP in the browser (about a
// quarter of the PNG size; Chrome downloads these when it opens the sheet).
async function render(browser, html, width, height, file) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  const png = await page.screenshot();
  const webp = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return canvas.toDataURL('image/webp', 0.9).split(',')[1];
  }, dataUrl(png));
  fs.writeFileSync(path.join(OUT, file), Buffer.from(webp, 'base64'));
  await page.close();
}

(async () => {
  const server = await serve();
  const url = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  fs.mkdirSync(OUT, { recursive: true });

  const shots = await captureApp(browser, url);
  for (const s of SLIDES) {
    await render(browser, portraitCard({ ...s, shot: shots[s.shot] }), 1080, 1920, s.file);
  }
  await render(browser, wideCard({ glow: '#ff6363', shot: shots.answer }), 1920, 1080, 'promo-wide.webp');

  await browser.close();
  server.close();

  // Print the manifest entries so they can be pasted into manifest.webmanifest
  const entries = SLIDES.map((s) => ({ src: `screens/${s.file}`, sizes: '1080x1920', type: 'image/webp', form_factor: 'narrow', label: s.label }));
  entries.push({ src: 'screens/promo-wide.webp', sizes: '1920x1080', type: 'image/webp', form_factor: 'wide', label: 'Can I Drive? on a laptop: the exact time you can drive' });
  console.log(JSON.stringify(entries, null, 2));
})();
