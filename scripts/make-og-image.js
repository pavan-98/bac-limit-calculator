// Generates og-image.jpg, the 1200x630 picture shown when the link is shared
// (WhatsApp, X/Twitter, Facebook, LinkedIn, Slack...).
// Usage (from the repo root): node scripts/make-og-image.js   (needs Playwright)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const icon = fs.readFileSync(path.join(root, 'icons/icon-512.png')).toString('base64');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    color: #f4f6fa;
    background:
      radial-gradient(900px 500px at 85% 20%, rgba(140,155,255,0.18), transparent 60%),
      radial-gradient(700px 400px at 0% 100%, rgba(243,185,95,0.10), transparent 60%),
      #0b0d12;
    display: flex; align-items: center; gap: 44px; padding: 0 60px;
  }
  .left { flex: 1; min-width: 0; }
  .brand { display: flex; align-items: center; gap: 18px; }
  .brand img { width: 92px; height: 92px; border-radius: 24px; }
  h1 { white-space: nowrap; font-size: 76px; line-height: 1; font-weight: 900; letter-spacing: -0.03em; }
  .tag { margin-top: 30px; font-size: 40px; line-height: 1.2; font-weight: 800; }
  .tag em { font-style: normal; color: #8c9bff; }
  .sub { margin-top: 18px; font-size: 27px; line-height: 1.35; color: #a9b3c4; font-weight: 500; }
  .pill { display: inline-block; margin-top: 30px; padding: 10px 22px; border-radius: 999px;
    border: 2px solid #2c3445; background: #151922; font-size: 24px; font-weight: 700; color: #a9b3c4; }
  .pill b { color: #f4f6fa; }

  .card { flex: none; width: 430px; padding: 34px 30px 30px; border-radius: 32px; text-align: center;
    background: #2a1215; border: 3px solid #6b2228; box-shadow: 0 30px 80px rgba(0,0,0,0.5); }
  .icon { font-size: 52px; line-height: 1; }
  .status { margin-top: 8px; font-size: 50px; font-weight: 900; letter-spacing: -0.01em; color: #ff6363; }
  .lead { margin-top: 18px; font-size: 24px; color: #a9b3c4; }
  .time { margin-top: 4px; white-space: nowrap; font-size: 88px; line-height: 1; font-weight: 900; letter-spacing: -0.04em; }
  .count { margin-top: 12px; font-size: 24px; }
  .gauge { position: relative; height: 14px; margin: 26px 6px 0; border-radius: 99px; background: rgba(244,246,250,0.14); }
  .gauge i { position: absolute; inset: 0 auto 0 0; width: 78%; border-radius: inherit; background: #ff6363; }
  .gauge s { position: absolute; top: -7px; bottom: -7px; left: 26%; width: 4px; border-radius: 2px; background: #f4f6fa; }
</style></head><body>
  <div class="left">
    <div class="brand"><img src="data:image/png;base64,${icon}" alt=""><h1>Can I Drive?</h1></div>
    <p class="tag">See the exact time you're<br><em>under India's legal limit.</em></p>
    <p class="sub">Tap the beers, pegs or wine you had.<br>Free BAC calculator · works offline</p>
    <span class="pill">India limit <b>0.03% BAC</b></span>
  </div>
  <div class="card" aria-hidden="true">
    <div class="icon">🚫</div>
    <div class="status">DON'T DRIVE</div>
    <div class="lead">You can drive after</div>
    <div class="time">1:25 AM</div>
    <div class="count">That's in <b>3 h 10 min</b></div>
    <div class="gauge"><i></i><s></s></div>
  </div>
</body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(root, 'og-image.jpg'), type: 'jpeg', quality: 88 });
  await browser.close();
})();
