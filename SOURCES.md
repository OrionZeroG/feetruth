# FeeTruth sources

Compiled **22 Aug 2026**; Etsy order-level qty base re-checked **23 Aug 2026**. Amounts are what official public pages said (or official text indexed on those URLs) on those dates.

Status key:

- **VERIFIED** — official public page text we retrieved, or official policy text on the named URL (search-index excerpt of the live legal/help page).
- **ESTIMATE** — official dollar table not publicly fetchable, or secondary transcription. UI labels these.

---

## Etsy

### Listing fee — VERIFIED

- **Rule:** $0.20 USD per item listed or renewed on Etsy.com / apps. Charged whether or not it sells (except private listings, charged when sold). Listings expire after four months. Multi-quantity: initial $0.20, then $0.20 auto-renewal as additional units sell. Pattern-only listings do not incur this listing fee. Editing a listing is free.
- **Logic:** `listing = 0.20 * units` when the listing toggle is on (default). Units default to order quantity so a multi-qty sale can carry one listing renewal per unit sold.
- **Source:** https://www.etsy.com/legal/fees  
- **Help:** https://help.etsy.com/hc/en-us/articles/115014483627-What-are-the-Fees-and-Taxes-for-Selling-on-Etsy  
- **Effective:** current policy text (no 2026 change notice found).  
- **Last verified:** 22 Aug 2026  
- **Fetch note:** Direct HTML fetch hit Etsy’s JS wall / empty body. Amount taken from official policy text on that URL.

### Transaction fee — VERIFIED

- **Rule:** 6.5% of the price you display plus shipping and gift wrapping. US sellers: transaction fee does **not** apply to sales tax. Non-US: transaction fee applies to listing price (which should include taxes the seller is responsible for), shipping, and gift wrap. Optional paid personalization is part of the displayed listing price.
- **Logic:** `txBase = item * qty + shipping + giftWrap`; `transaction = txBase * 0.065`. Tax is excluded from `txBase`. Shipping, gift wrap, and tax are the amounts charged on the **order** (not multiplied by qty). Quantity applies to the displayed listing price. Official wording: “the price you display for each listing plus the amount you charge for shipping and gift wrapping.” Etsy also treats shipping/taxes/gift wrap as “separately charged” versus `item price × quantity` when defining the Offsite Ads $10k sales threshold.
- **Source:** https://www.etsy.com/legal/fees  
- **Help:** https://help.etsy.com/hc/en-us/articles/115014483627-What-are-the-Fees-and-Taxes-for-Selling-on-Etsy  
- **Effective:** 6.5% has been the published rate since April 2022; still the rate on the 2026 policy text.  
- **Last verified:** 23 Aug 2026 (qty / order-level base confirmed from official legal/fees text)  
- **Not used:** any blended “Etsy take-rate” such as 25.9%. That is not a per-order fee.

### Payment processing — VERIFIED (US and UK)

- **Rule:** Etsy Payments fees vary by **location of the seller’s bank account**. Charged on total sale price. Help text: percent + flat fee on the item’s total sale price, including shipping, and sales tax if you charge tax on the listing.
- **Official table (excerpt we rely on):**
  - United States: **3% + 0.25 USD**
  - United Kingdom: **4% + 0.20 GBP**
- **Logic:** `processingBase = item * qty + shipping + giftWrap + tax`; `processing = processingBase * rate + fixed` (fixed is per order, not per unit). Shipping/gift/tax stay order-level, matching “gross order amount, including shipping and tax” and the official table’s “% of total sale price + flat fee per order.”
- **Source:** https://www.etsy.com/legal/etsy-payments (section B. Fee Amount country chart)  
- **Help:** Fees and Taxes article (processing row)  
- **Effective:** current table (US/UK rows have no 2026 change notice we found).  
- **Last verified:** 23 Aug 2026 (order-level ship/tax base confirmed from official legal/etsy-payments text)  
- **Fetch note:** Official payments-policy HTML retrieved 23 Aug 2026; US/UK rows unchanged. Earlier builds timed out on this URL.

### Offsite Ads — VERIFIED (toggle)

- **Rule:** Charged only on **attributed** orders (buyer clicks an Offsite Ad and purchases within 30 days; last-click Etsy Ad wins if that is the final click).
  - Shop has **always** been under $10,000 USD in any consecutive 365-day period: **15%**, can opt out.
  - Shop has made **$10,000 USD or more** in any consecutive 365-day period: **12%** for the **lifetime** of the shop (still 12% if later under $10k). Participation becomes required.
  - **Cap:** Offsite Ads fee on any one order will not exceed **$100 USD**.
  - Base: total order amount = displayed price + shipping + gift wrap (and in some jurisdictions, taxes).
- **Logic:** user toggle `off | 15 | 12`. `ads = min(txBase * rate, 100)` on the same order-level `txBase` as the transaction fee (`item * qty + shipping + giftWrap`). Never auto-applied. Cap and rate toggles unchanged.
- **Source:** https://www.etsy.com/legal/fees (Offsite Ads section); https://www.etsy.com/legal/advertising/  
- **Help:** https://help.etsy.com/hc/en-us/articles/360000338367-How-Etsy-s-Offsite-Ads-Work  
- **Guide:** `/guides/etsy-fee-calculator.html` (all official Etsy lines; worked $48+$6.50 and qty=2 examples). `/guides/etsy-offsite-ads.html` (same official URLs; worked $50+$8 example).  
- **Last verified:** 22 Aug 2026  

### Pattern — VERIFIED (overhead, opt-in)

- **Rule:** $15.00 USD per month after a 30-day trial. Auto-renew. Not a per-order fee.
- **Logic:** if opted in **and** “allocate subscriptions,” `15 / ordersThisMonth` is a line item. Otherwise $0 on the order.
- **Source:** https://www.etsy.com/legal/fees (Pattern Fees); https://www.etsy.com/legal/pattern/  
- **Help:** https://help.etsy.com/hc/en-us/articles/360000337067-Pricing-and-Fees-for-Pattern  
- **Last verified:** 22 Aug 2026  

### Etsy Plus — VERIFIED (overhead, opt-in)

- **Rule:** $10 USD per month. Plus includes 15 listing credits and $5 Ads credit per cycle (credits not modeled as a fee reduction in v1).
- **Logic:** same allocation as Pattern.
- **Source:** https://www.etsy.com/legal/fees (Subscription Fees)  
- **Help:** https://help.etsy.com/hc/en-us/articles/360001589928-What-is-Etsy-Plus  
- **Last verified:** 22 Aug 2026  

### UK VAT on Etsy service fees — ESTIMATE (optional toggle)

- **Rule:** UK VAT (typically 20%) may apply to Etsy service fees. We did not independently fetch an official VAT-on-fees schedule.
- **Logic:** if UK + toggle: `vat = (transaction + processing + ads) * 0.20` on GBP service fees. Listing and Pattern/Plus are USD-billed and excluded from the GBP total (no FX in the calculator). US methodology unchanged.
- **Why estimate:** not confirmed on a fetched official page in this build.
- **Last verified:** not independently verified 22 Aug 2026.

### Reverse pricing (Etsy)

- Break-even: smallest list price `P` such that `profit(P) >= 0`.
- Target margin: smallest `P` such that `profit(P) >= m * (P * qty + shipping + gift)`.
- Solved by bisection because Offsite Ads has a $100 cap.

---

## Amazon US

### Selling plans — VERIFIED

- Individual: **$0.99 per item sold**.
- Professional: **$39.99 per month**.
- **Source:** https://sell.amazon.com/pricing  
- **Fetched:** 22 Aug 2026  

### Referral fees — VERIFIED

- Charged on **total price = list + shipping + gift wrap** (not tax). Greater of category percentage or minimum (usually $0.30).
- Category may differ from the browse node shown to customers.
- Presets implemented from the official table on https://sell.amazon.com/pricing (fetched 22 Aug 2026):

| Category | Official rule |
| --- | --- |
| Home and Kitchen | 15%, min $0.30 |
| Toys and Games | 15%, min $0.30 |
| Beauty, Health, and Personal Care | 8% if total ≤ $10; 15% if > $10; min $0.30 |
| Clothing and Accessories | 5% if ≤ $15; 10% if $15.01–$20; 17% if > $20; min $0.30 |
| Consumer Electronics | 8%, min $0.30 |
| Electronics Accessories | 15% of portion ≤ $100 + 8% of portion > $100; min $0.30 |
| Grocery and Gourmet | 8% if ≤ $15; 15% if > $15 |
| Media (Books, DVD, Music, Software, Video) | 15% + **$1.80 closing fee** |
| Custom | user % (still a modeling input) |

- **Logic:** see `referralFee()` in `js/fees.js`.
- **Effective:** public table as of 22 Aug 2026. Amazon’s 15 Oct 2025 letter said 2026 FBA $ changes effective 15 Jan 2026 and did not publish a new public referral percentage rewrite on this page.
- **Source:** https://sell.amazon.com/pricing  

### 2026 FBA program changes — VERIFIED (qualitative)

- Official letter (15 Oct 2025): FBA fees increase by an **average $0.08 per unit** in 2026; **no new FBA fee types**; 90 days’ notice; effective **15 Jan 2026** unless noted. Use Revenue Calculator / Fee and Economics Preview / Profit Analytics.
- **Source:** https://sellingpartners.aboutamazon.com/update-to-u-s-referral-and-fulfillment-by-amazon-fees-for-2026  
- **Fetched:** 22 Aug 2026  

### Fuel and logistics surcharge — VERIFIED

- **Rule:** 3.5% of **fulfillment fees** (not sale price) for US/Canada FBA and Remote Fulfillment with FBA from US into CA/MX/BR, starting **17 Apr 2026**. MCF / Buy with Prime: **2 May 2026**. Amazon said ~$0.17/unit average for US FBA.
- **Logic:** if toggle on (default): `fuel = fulfillment * 0.035`.
- **Source:** Seller Central announcement “Fuel and logistics-related surcharge: FBA, MCF, and BWP in US and CA”, public copy: https://sellercentral.amazon.com/seller-forums/discussions/t/7cbc0233-ee5b-4359-978a-dee7cad5c6f4  
- **Guide:** `/guides/amazon-fba-calculator.html` (referral official; fulfillment estimate; 2026 fuel on fulfillment). `/guides/amazon-fba-fuel-surcharge-2026.html` (same official announcement; fulfillment dollars remain estimate unless Fee Preview / override is pasted).  
- **Press quoting the same notice:** https://www.cnbc.com/2026/04/02/amazon-add-3point5percent-fuel-and-logistics-surcharge-for-sellers-amid-iran-war.html  
- **Last verified:** 22 Aug 2026  
- **Note:** Amazon called it temporary and did not publish an end date in the announcement text we have. Toggle remains so you can turn it off if it ends.

### FBA fulfillment $ by size/weight/price — ESTIMATE

- **Why estimate:** The official 2026 dollar rate card is on Seller Central (“FBA fee rates”) and the Revenue Calculator. Public sell.amazon.com pages describe the **method** (size + weight; Low-Price FBA under $10) but do not publish the grid. We could not fetch the login rate card.
- **Logic used for the estimate (clearly labeled):**
  1. Classify packaged size (see next section).
  2. Choose a price band: under $10 / $10–$50 / over $50 (2026 public descriptions of more granular price bands).
  3. Look up a **transcribed** small-standard / large-standard grid shipped in `js/fees.js` (values circulated as 2026 US non-peak FBA). Oversize uses a rough bulky sketch.
  4. Prefer **Seller Central override** when filled — that line is tagged `override`, not estimate.
- **Official method pages:** https://sell.amazon.com/blog/fba-fees-guide (24 Jul 2026, fetched); https://sell.amazon.com/pricing/estimate  
- **Last verified:** method 22 Aug 2026; dollars not officially verified.

### Size tiers / DIM — ESTIMATE

- **Logic:**
  - Small standard: longest ≤ 15 in, median ≤ 12 in, shortest ≤ 0.75 in, unit weight ≤ 1 lb. Shipping weight = unit weight.
  - Large standard: longest ≤ 18 in, median ≤ 14 in, shortest ≤ 8 in, shipping weight ≤ 20 lb. Shipping weight = max(unit lb, L×W×H/139).
  - Else: oversize / bulky — detailed extra-large card not modeled.
- **Why estimate:** thresholds are the long-standing public US FBA cutoffs; we did not fetch the 2026 Seller Central size-tier help page in this build.
- **Confirm:** Seller Central product size-tier / FBA fee rates.

### Monthly storage — ESTIMATE

- Optional: `cuft = L*W*H / 1728`; `storage = cuft * rate * monthsAllocated`.
- Rates shipped (widely published as 2026, **not fetched from Seller Central**):
  - Standard: $0.78 / cu ft (Jan–Sep), $2.40 (Oct–Dec)
  - Oversize: $0.56 / $1.40
- Peak checkbox selects the Oct–Dec rate.
- Official public pages confirm storage is monthly, cubic-foot, seasonal — not the exact dollars.
- **Source (method):** https://sell.amazon.com/blog/fba-fees-guide  
- **Last verified:** method 22 Aug 2026; dollars estimate.

### PPC, COGS — input

- Seller-entered. Not Amazon schedule items.

### Reverse pricing (Amazon)

- Same bisection as Etsy. Fulfillment estimate can change with price band, so we re-run the full fee function at each candidate price.

### Holiday peak fulfillment 2026 — cited, not modeled in $

- Peak fulfillment window announced: **15 Oct 2026 – 14 Jan 2027**.
- **Source:** Seller Central forum “Holiday 2026: Same fees, same eligibility, earlier deadlines”  
  https://sellercentral.amazon.com/seller-forums/discussions/t/3e31fbb7-04e0-4ed4-873e-f74b1052e2ff  
- Dollar peak adders: Seller Central only → not in the calculator grid.

---

## Official URL fetch log

| URL | Result |
| --- | --- |
| https://www.etsy.com/legal/fees | Retrieved 23 Aug 2026 (transaction / Offsite Ads wording used for the qty base) |
| https://www.etsy.com/legal/etsy-payments | Retrieved 23 Aug 2026 (“gross order amount, including shipping and tax”; US/UK table unchanged) |
| https://help.etsy.com/hc/en-us/articles/115014483627-What-are-the-Fees-and-Taxes-for-Selling-on-Etsy | timeout |
| https://help.etsy.com/hc/en-us/articles/360000338367-How-Etsy-s-Offsite-Ads-Work | timeout |
| https://help.etsy.com/hc/en-us/articles/360000337067-Pricing-and-Fees-for-Pattern | timeout |
| Amazon Seller Central 2026 FBA fulfillment rate card | login-walled; not fetched |

---

## Calculation comments in code

See `js/fees.js` header and function comments. UI chips: `verified` | `estimate` | `override` | `input` | `off`.
