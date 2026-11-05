# BAC Calculator - India Legal Limit

A comprehensive Blood Alcohol Content (BAC) calculator designed specifically for India's legal alcohol limit of 0.03% BAC (30mg/100ml blood).

## Designed for after a few drinks

People open this app when they've been drinking, so the UI is built for shaky thumbs and blurry focus:

- **The answer comes first.** A large card at the top says *Don't drive*, *Too close*, *Under the limit* or *Sober*, and gives the **clock time** you can drive (for example "1:25 AM · in 3 h 10 min") instead of a decimal BAC.
- **Updates live.** There's no Calculate button. The answer changes as you tap, and it keeps counting down while the app is open.
- **Large tap targets.** Drink tiles are at least 120px tall and every button is at least 44–64px. Double-tap zoom is turned off so fast tapping doesn't zoom the page.
- **No layout jumps.** The "Remove one" strip always takes up space, so tiles never move under your finger.
- **Undo everywhere.** Every add, remove or reset shows a toast with an **Undo** button. "Start over" needs a second tap to confirm.
- **No typing needed.** Weight and timing use +/− steppers and quick-pick chips ("2 h ago").
- **Remembers you.** Weight and body type are saved on the device. The current drinking session (drinks plus start time) survives a reload or closed tab and expires after 24 h.
- **Dark, low-glare theme** with high contrast (also follows the system light mode), haptic feedback on tap, and support for reduced motion.
- **Get home safe.** Ride links (Uber, Ola, Rapido), a one-tap "Ask a friend for a ride" message (Web Share or WhatsApp), and emergency numbers 108 and 112 with signs of alcohol poisoning.
- **Bottom status bar.** While you scroll through drinks, a compact bar shows your status and jumps back to the answer.

## Install as an app (PWA)

The site can be installed to the home screen and then opens full-screen like a normal app, **even with no internet**. That matters in bars and basements with bad signal.

- **Android (Chrome, Edge, Samsung Internet):** an **Install the app** banner appears under the answer card. **Install** opens the browser's own install dialog.
- **iPhone / iPad:** the banner shows how to do it: tap **Share**, then **Add to Home Screen**. iOS has no install button that a website can trigger.
- **Instagram, Facebook and other in-app browsers** can't install apps, so the banner tells people to open the page in their real browser.
- **Not now** hides the banner for 14 days. The **Keep it on your phone** card near the bottom always shows the install steps, and disappears once you're using the installed app.
- **Home-screen shortcuts** (long-press the icon on Android): *Add a drink* and *Get home safe*.

How it works:

- `manifest.webmanifest`: app name, colours, icons (including a maskable one for Android's round icons), shortcuts and screenshots for Android's install sheet.
- `sw.js`: a service worker that caches the app. It tries the network first so updates arrive straight away, but uses the cached copy if the network fails or takes more than 3 seconds. When you change which files the app needs, update `SHELL` and bump `CACHE`.
- `icons/`: PNG icons generated from the artwork in `scripts/make-icons.js` (`node scripts/make-icons.js icons`, needs Playwright). The same script also rewrites `favicon.svg`.

To check installability, open Chrome DevTools → **Application → Manifest**. Installing needs HTTPS (Vercel provides it) or `http://localhost`. It won't work when `index.html` is opened as a file.

## Sharing & SEO

- **Link previews:** `og-image.jpg` (1200×630) is the picture shown when the link is shared on WhatsApp, X/Twitter, Facebook, LinkedIn or Slack. Open Graph and Twitter tags use absolute URLs, because many apps ignore relative ones. To change the picture, edit `scripts/make-og-image.js` and run `node scripts/make-og-image.js`.
- **Search:** keyword-focused title and description, a canonical URL, an `<h1>`, a first screen that's readable without JavaScript, a visible FAQ, and JSON-LD structured data (`WebApplication` + `FAQPage`). If you edit the FAQ, change the JSON-LD in `<head>` to match.
- **Crawling:** `robots.txt` allows everything and points to `sitemap.xml`. Update `<lastmod>` in the sitemap when the content changes.
- **If the site moves to a new domain:** update the canonical link, the `og:` and `twitter:` URLs, the JSON-LD, `robots.txt` and `sitemap.xml` (search for `bac-calculator-rho.vercel.app`).

Preview tools: [opengraph.xyz](https://www.opengraph.xyz/), Google's [Rich Results Test](https://search.google.com/test/rich-results), and the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/), which also refreshes Facebook's and WhatsApp's cached preview.

## Drinks

| Category | Options |
| --- | --- |
| Beer (Light 3.5% / Regular 5% / Strong 7%) | Small beer 330 ml, Beer can 500 ml, Big bottle 650 ml, Pitcher 1.5 L |
| Spirits (40%) | Small peg 30 ml, Large peg 60 ml, Patiala peg 90 ml, Quarter 180 ml, Half 375 ml, Full 750 ml |
| Wine & others | Glass of wine 150 ml (12%), Wine bottle 750 ml (12%), Breezer / RTD 275 ml (4.8%) |

## How to Use

1. **About you:** enter your weight and body type (saved for next time).
2. **When was your first drink?** Tap a chip or use +/−.
3. **What did you drink?** Tap a tile once for each drink.
4. Read the answer at the top.

## Technical Details

### BAC Calculation Formula

The calculator uses the Widmark formula:

```
BAC = (Alcohol in grams / (Body weight × Body water ratio)) × 100
```

### Body Water Ratios

- **Male:** 68% of body weight
- **Female:** 55% of body weight

### Alcohol Elimination

- **Rate:** 0.015% BAC per hour (standard metabolism rate)
- **Time Factor:** Subtracts eliminated alcohol based on hours since drinking

### Legal Limits

- **India:** 0.03% BAC (30mg/100ml blood)
- **Warning Threshold:** 80% of legal limit (0.024% BAC). In this "too close" zone the app suggests waiting until you drop below it.

### Times shown

- *Drive after* = when BAC drops below 0.03%. *Sober at* = when BAC reaches 0.
- Times are always rounded **up** to the next 5 minutes so they err on the late side.

## Installation

1. Clone or download the repository
2. Open `index.html` in a web browser, or serve the folder (for example `npx serve .`) to test installing and offline mode
3. No build step and no external dependencies

## Files Structure

```
bac-limit-calculator/
├── index.html             # Main HTML structure
├── styles.css             # CSS styling and responsive design
├── script.js              # BAC calculations, UI and install prompt
├── sw.js                  # Service worker (offline support)
├── manifest.webmanifest   # Makes the site installable
├── favicon.svg            # Tab icon
├── icons/                 # App icons
├── screens/               # Screenshots for the install sheet
├── og-image.jpg           # Link-preview image (1200×630)
├── robots.txt             # Crawler rules
├── sitemap.xml            # Sitemap for search engines
├── scripts/               # Generators for the icons and og-image.jpg
└── README.md              # This documentation file
```

## Browser Compatibility

- ✅ Chrome/Chromium (recommended)
- ✅ Firefox
- ✅ Safari (with webkit prefixes)
- ✅ Edge
- ✅ Mobile browsers

## Important Legal Disclaimer

⚠️ **This calculator provides estimates only and should not be used as the sole basis for determining whether it's safe to drive.**

BAC can vary significantly based on many factors including:

- Food consumption
- Medications
- Individual metabolism
- Health conditions
- Rate of consumption
- Body composition

**Always follow local laws and drink responsibly. When in doubt, don't drive.**

## Development

The calculator is built with vanilla HTML, CSS, and JavaScript with no external dependencies (no fonts or icon CDNs). The calculation helpers in `script.js` are exported for Node so they can be tested without a browser.

### Key Features:

- **Responsive CSS Grid/Flexbox layout**
- **Modern JavaScript ES6+ features**
- **Accessibility considerations**
- **Cross-browser compatibility**
- **Mobile-first design approach**

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

---

**Remember: This tool is for educational purposes. Always drink responsibly and never drive under the influence of alcohol.**
