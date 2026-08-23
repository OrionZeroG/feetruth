# FeeTruth MVP

Static marketplace fee calculator. No accounts, no spend, no third-party analytics, no paid host.

Last source check: **22 Aug 2026**.

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
| `data/workbook-template.csv` | Google Sheets–compatible template |
| `js/fees.js` | Fee rules and math |
| `js/app.js` | UI + localStorage counters |
| `css/style.css` | Layout |
| `SOURCES.md` | Every rule, URL, date, logic |

## Analytics

Counters live in `localStorage` key `feetruth.analytics.v1` on your machine only.

## Honesty rules

- Etsy is itemized. We never apply a company “take rate” (e.g. 25.9%) as a per-order fee.
- Amazon fulfillment and storage are **estimates** unless you paste a Seller Central fulfillment fee.
- If a rule varies by ads / region / category / size, the UI exposes a toggle or labels it estimate.
