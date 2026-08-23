# FeeTruth MVP

Static marketplace fee calculator. No accounts, no spend, no paid host.

Last source check: **23 Aug 2026** (Etsy order-level shipping / gift wrap / tax base).

## Open locally

From this folder:

```bash
python3 -m http.server 8765
```

Then open http://127.0.0.1:8765/

Or open `index.html` directly via `file://` (works; no server required).

## What’s in the folder

| File | Role |
| --- | --- |
| `index.html` | Etsy US (+ UK processing) and Amazon US FBA calculators |
| `changelog.html` | 2026 fee changes we can cite |
| `sources.html` | Verified vs estimate + fetch status |
| `workbook.html` | Offline seller workbook spec |
| `guides/etsy-fee-calculator.html` | Indexable Etsy fee-calculator explainer (all official lines + worked examples) |
| `guides/amazon-fba-calculator.html` | Indexable Amazon FBA calculator explainer (referral official; fulfillment estimate; 2026 fuel) |
| `guides/etsy-offsite-ads.html` | Standalone Offsite Ads explainer (official Etsy cites) |
| `guides/amazon-fba-fuel-surcharge-2026.html` | Standalone FBA 3.5% fuel-surcharge explainer (official Amazon cite) |
| `robots.txt` | Allow all; points at sitemap (HTTP until HTTPS is live) |
| `sitemap.xml` | Homepage, existing pages, and all guides |
| `.nojekyll` | GitHub Pages: serve static files as-is (no Jekyll) |
| `data/workbook-template.csv` | Google Sheets–compatible template |
| `js/fees.js` | Fee rules and math |
| `js/app.js` | UI + localStorage counters + optional query-string prefills |
| `css/style.css` | Layout |
| `SOURCES.md` | Every rule, URL, date, logic |

## Analytics

Cloudflare Web Analytics is on every HTML page (privacy-oriented page analytics via Cloudflare’s beacon). That is the only off-device traffic measurement.

On-page calc counters live in `localStorage` key `feetruth.analytics.v1` on your machine only; they are not sent to FeeTruth.

## Tests

```bash
node test/fees.test.js
node test/checkout-cta.test.js
node test/guides.test.js
```

Locks the qty=1 US path, the qty&gt;1 order-level shipping / gift wrap / tax base, public checkout URLs, and explainer worked examples.

## Honesty rules

- Etsy is itemized. We never apply a company “take rate” (e.g. 25.9%) as a per-order fee.
- Amazon fulfillment and storage are **estimates** unless you paste a Seller Central fulfillment fee.
- If a rule varies by ads / region / category / size, the UI exposes a toggle or labels it estimate.
