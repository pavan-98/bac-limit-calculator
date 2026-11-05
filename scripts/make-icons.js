// Regenerates the app icons and favicon.svg.
// Usage (from the repo root): node scripts/make-icons.js icons   (needs Playwright)
const { chromium } = require('playwright');
const out = process.argv[2];
// Artwork on a 64x64 grid: a tumbler of whisky with a clock badge ("when can I drive?")
const art = `
  <path d="M17 50 L41 50 L38 15 L20 15 Z" fill="#ffffff" fill-opacity="0.10" stroke="#e9ecf2" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M20.4 29 L37.6 29 L39 47.5 L19 47.5 Z" fill="url(#liq)"/>
  <path d="M22 18 L23.2 46" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.6" stroke-linecap="round"/>
  <circle cx="44" cy="44" r="12.5" fill="#8c9bff" stroke="#0b0d12" stroke-width="3.5"/>
  <path d="M44 37.5 L44 44 L48.5 44" fill="none" stroke="#0b0d12" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
const svg = (inset, rounded) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><linearGradient id="liq" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f3b95f"/><stop offset="1" stop-color="#b8661f"/></linearGradient></defs>
  <rect width="64" height="64" ${rounded ? 'rx="14"' : ''} fill="#0b0d12"/>
  <g transform="translate(32 32) scale(${1 - inset}) translate(-32 -32)"><g transform="translate(-4.5 -3.5)">${art}</g></g></svg>`;
const jobs = [
  ['apple-touch-icon.png', 180, svg(0.12, false), false],
  ['icon-192.png', 192, svg(0.04, true), true],
  ['icon-512.png', 512, svg(0.04, true), true],
  ['maskable-512.png', 512, svg(0.26, false), false],
  ['favicon-32.png', 32, svg(0, true), true],
];
(async () => {
  require('fs').writeFileSync(`${out}/../favicon.svg`, svg(0.04, true));
  const b = await chromium.launch(); const p = await b.newPage();
  for (const [name, size, s, transparent] of jobs) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<body style="margin:0;background:transparent">${s.replace('<svg ', `<svg width="${size}" height="${size}" style="display:block" `)}</body>`);
    await p.screenshot({ path: `${out}/${name}`, omitBackground: transparent });
  }
  await b.close();
})();
