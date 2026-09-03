/**
 * FeeTruth fee engine — 23 Aug 2026
 * Every numeric rule is documented in /SOURCES.md.
 * VERIFIED = taken from official public page text we could retrieve or
 *            from official policy text indexed on the official URL.
 * ESTIMATE = official table not publicly fetchable, or unofficial transcription.
 */

const VERIFIED = "23 Aug 2026";

/* ---------- Etsy ---------- */
const ETSY = {
  listingUsd: 0.20, // VERIFIED Fees & Payments Policy
  transactionRate: 0.065, // VERIFIED legal/fees + help: 6.5% on item+shipping+gift wrap
  processing: {
    US: { rate: 0.03, fixed: 0.25, currency: "USD", label: "3% + $0.25" }, // VERIFIED etsy.com/legal/etsy-payments table
    UK: { rate: 0.04, fixed: 0.20, currency: "GBP", label: "4% + £0.20" } // VERIFIED same official table
  },
  offsite: {
    under10k: 0.15, // VERIFIED help + legal/fees
    over10k: 0.12, // VERIFIED; lifetime after first $10k trailing 365-day
    capUsd: 100 // VERIFIED per-order cap
  },
  patternUsd: 15, // VERIFIED legal/fees + Pattern help
  plusUsd: 10 // VERIFIED legal/fees + Etsy Plus help
};

/**
 * Etsy per-order math.
 * Quantity multiplies the displayed listing price (and listing-fee units).
 * Shipping, gift wrap, and tax are order-level: the amounts charged on the
 * sale. They are not multiplied by qty.
 * Official: “6.5% of the price you display for each listing plus the amount
 * you charge for shipping and gift wrapping” (legal/fees). Processing is on
 * the “gross order amount, including shipping and tax” (legal/etsy-payments).
 * Transaction base (US): item×qty + shipping + gift wrap. Not sales tax.
 * Processing base: item×qty + shipping + gift wrap + tax (if charged on the order).
 * Offsite Ads: % of that same order amount (item×qty + shipping + gift wrap),
 * capped at $100 USD. Toggle and cap behavior unchanged.
 * Listing: $0.20 per listed/renewed unit; multi-qty auto-renews $0.20 per additional unit sold.
 * Pattern/Plus: monthly overhead, allocated only if opted in (US only; USD).
 * UK: totals/net/margin/reverse use GBP only (transaction + processing + optional VAT on those).
 *       Listing, Offsite Ads, and Pattern/Plus are USD on Etsy’s schedule — shown separately, not summed (no FX rate).
 */
function etsyFees(input) {
  const qty = Math.max(1, Math.floor(num(input.qty, 1)));
  const item = num(input.item);
  const shipping = num(input.shipping);
  const gift = num(input.gift);
  const tax = num(input.tax);
  const cogs = num(input.cogs);
  const shipCost = num(input.shipCost);
  const region = input.region === "UK" ? "UK" : "US";
  const proc = ETSY.processing[region];
  const currency = region === "UK" ? "GBP" : "USD";

  const listingUnits = input.includeListing === false ? 0 : qty;
  const listing = listingUnits * ETSY.listingUsd;

  const itemTotal = item * qty;
  const txBase = itemTotal + shipping + gift;
  const processingBase = itemTotal + shipping + gift + tax;
  const transaction = txBase * ETSY.transactionRate;
  const processing = processingBase * proc.rate + proc.fixed;

  let adsRate = 0;
  let adsLabel = "Off";
  if (region === "US" && input.ads === "15") {
    adsRate = ETSY.offsite.under10k;
    adsLabel = "15% (under $10k trailing 365-day)";
  } else if (region === "US" && input.ads === "12") {
    adsRate = ETSY.offsite.over10k;
    adsLabel = "12% (ever at/above $10k trailing 365-day)";
  }
  const adsRaw = txBase * adsRate;
  const ads = Math.min(adsRaw, ETSY.offsite.capUsd);

  const monthly = region === "US" ? ((input.pattern ? ETSY.patternUsd : 0) + (input.plus ? ETSY.plusUsd : 0)) : 0;
  const ordersMonth = Math.max(1, num(input.ordersMonth, 1));
  const overhead = region === "US" && input.allocateSubs ? monthly / ordersMonth : 0;

  const vatOnFeesRate = region === "UK" && input.vatOnFees ? num(input.vatRate, 0.20) : 0;
  const gbpServiceFees = transaction + processing;
  const usdServiceFees = listing + ads + overhead;
  const etsyServiceFees = region === "UK" ? gbpServiceFees : (usdServiceFees + gbpServiceFees);
  const vatOnFees = region === "UK" ? gbpServiceFees * vatOnFeesRate : 0;

  const revenue = txBase;
  const totalFees = etsyServiceFees + vatOnFees;
  const profit = revenue - totalFees - cogs * qty - shipCost * qty;

  const usdExcludedNote = "USD — shown for reference; not included in GBP total (no FX rate in calculator)";
  const lines = region === "UK"
    ? [
      { name: "Transaction fee (6.5%)", amount: transaction, currency: "GBP", status: "verified", note: "On item×qty + shipping + gift wrap (order-level ship/wrap)" },
      { name: `Payment processing (${proc.label})`, amount: processing, currency: "GBP", status: "verified", note: "On item×qty + shipping + gift wrap + tax (order-level ship/wrap/tax)" },
      { name: "Listing fee", amount: listing, currency: "USD", status: listing ? "usd" : "off", note: listing ? `${listingUnits} × $0.20 USD · ${usdExcludedNote}` : "Off" },
      { name: `Offsite Ads (${adsLabel})`, amount: 0, currency: "USD", status: input.ads !== "off" ? "usd" : "off", note: input.ads !== "off" ? `Offsite Ads are USD-only ($${ETSY.offsite.capUsd} cap). Switch to US region to model attributed ads in totals.` : "Not applied" },
      { name: "Allocated Pattern / Plus", amount: overhead, currency: "USD", status: (input.pattern || input.plus) && input.allocateSubs ? "usd" : "off", note: (input.pattern || input.plus) && input.allocateSubs ? `Pattern/Plus are USD subscriptions · ${usdExcludedNote}` : "Overhead not allocated" },
      { name: "VAT on Etsy fees (UK)", amount: vatOnFees, currency: "GBP", status: vatOnFees ? "estimate" : "off", note: vatOnFees ? `${(vatOnFeesRate * 100).toFixed(0)}% on GBP Etsy service fees — confirm with your tax advisor / Etsy statement` : "Off" },
      { name: "COGS", amount: cogs * qty, currency: "GBP", status: "input" },
      { name: "Your shipping / fulfillment cost", amount: shipCost * qty, currency: "GBP", status: "input" }
    ]
    : [
      { name: "Listing fee", amount: listing, currency: "USD", status: "verified", note: `${listingUnits} × $0.20 USD` },
      { name: "Transaction fee (6.5%)", amount: transaction, currency: "USD", status: "verified", note: "On item×qty + shipping + gift wrap (order-level ship/wrap)" },
      { name: `Payment processing (${proc.label})`, amount: processing, currency: "USD", status: "verified", note: "On item×qty + shipping + gift wrap + tax (order-level ship/wrap/tax)" },
      { name: `Offsite Ads (${adsLabel})`, amount: ads, currency: "USD", status: adsRate ? "verified" : "off", note: adsRate ? `Capped at $${ETSY.offsite.capUsd} per order` : "Not applied" },
      { name: "Allocated Pattern / Plus", amount: overhead, currency: "USD", status: overhead ? "verified" : "off", note: overhead ? `$${monthly}/mo ÷ ${ordersMonth} orders` : "Overhead not allocated" },
      { name: "VAT on Etsy fees (UK)", amount: vatOnFees, currency: "USD", status: "off", note: "Off" },
      { name: "COGS", amount: cogs * qty, currency: "USD", status: "input" },
      { name: "Your shipping / fulfillment cost", amount: shipCost * qty, currency: "USD", status: "input" }
    ];

  return {
    region,
    currency,
    currencyNote: region === "UK"
      ? "GBP totals include transaction + processing (+ optional VAT on those fees). Listing, Offsite Ads, and Pattern/Plus are USD on Etsy’s schedule — shown separately, not summed into GBP net/margin."
      : "",
    lines,
    revenue,
    totalFees,
    profit,
    margin: revenue > 0 ? profit / revenue : 0,
    qty,
    txBase
  };
}

function etsySolvePrice(input, mode, targetMargin) {
  const test = (item) => {
    const r = etsyFees({ ...input, item });
    if (mode === "breakeven") return r.profit;
    return r.profit - targetMargin * r.revenue;
  };
  return solveNonNegative(test);
}

/* ---------- Amazon US FBA ---------- */
const AMZ = {
  proMonthly: 39.99, // VERIFIED sell.amazon.com/pricing
  individualPerItem: 0.99, // VERIFIED
  minReferral: 0.30,
  mediaClosing: 1.80, // VERIFIED sell.amazon.com/pricing footnote 4
  fuelRate: 0.035, // VERIFIED Seller Central announcement (Apr 17, 2026) quoted publicly
  storage: {
    // ESTIMATE — widely published 2026 schedule; official cubic-foot table is Seller Central
    standardOffPeak: 0.78,
    standardPeak: 2.40,
    oversizeOffPeak: 0.56,
    oversizePeak: 1.40
  }
};

/** Referral presets from official https://sell.amazon.com/pricing fetched 22 Aug 2026 */
const REFERRAL = {
  home_kitchen: { name: "Home and Kitchen", kind: "flat", rate: 0.15, min: 0.30 },
  toys: { name: "Toys and Games", kind: "flat", rate: 0.15, min: 0.30 },
  beauty: { name: "Beauty, Health, and Personal Care", kind: "band", below: 10, low: 0.08, high: 0.15, min: 0.30 },
  clothing: {
    name: "Clothing and Accessories",
    kind: "clothing",
    min: 0.30
  },
  electronics: { name: "Consumer Electronics", kind: "flat", rate: 0.08, min: 0.30 },
  electronics_acc: { name: "Electronics Accessories", kind: "split", splitAt: 100, first: 0.15, rest: 0.08, min: 0.30 },
  grocery: { name: "Grocery and Gourmet", kind: "band", below: 15, low: 0.08, high: 0.15, min: 0 },
  media: { name: "Media (Books, DVD, Music, Software, Video)", kind: "flat", rate: 0.15, min: 0, closing: 1.80 },
  custom: { name: "Custom %", kind: "custom", min: 0.30 }
};

function referralFee(catId, totalPrice, customPct) {
  const cat = REFERRAL[catId] || REFERRAL.home_kitchen;
  let fee = 0;
  if (cat.kind === "flat") fee = totalPrice * cat.rate;
  else if (cat.kind === "band") fee = totalPrice * (totalPrice <= cat.below ? cat.low : cat.high);
  else if (cat.kind === "split") {
    fee = Math.min(totalPrice, cat.splitAt) * cat.first + Math.max(0, totalPrice - cat.splitAt) * cat.rest;
  } else if (cat.kind === "clothing") {
    if (totalPrice <= 15) fee = totalPrice * 0.05;
    else if (totalPrice <= 20) fee = totalPrice * 0.10;
    else fee = totalPrice * 0.17;
  } else if (cat.kind === "custom") {
    fee = totalPrice * (num(customPct) / 100);
  }
  const min = cat.min == null ? AMZ.minReferral : cat.min;
  fee = Math.max(fee, min && totalPrice > 0 ? min : fee);
  const closing = cat.closing || 0;
  return { fee, closing, cat };
}

/**
 * ESTIMATE fulfillment: public 2026 Seller Central rate card was not fetchable.
 * Table is a conservative transcription of publicly circulated 2026 non-peak
 * US FBA bands (under $10 / $10–$50 / over $50). Confirm in Seller Central.
 */
const FBA_SMALL_STD = {
  // oz ceiling -> [under10, mid, over50]
  2: [2.43, 3.32, 3.58],
  4: [2.49, 3.42, 3.68],
  6: [2.56, 3.45, 3.71],
  8: [2.66, 3.54, 3.80],
  10: [2.77, 3.68, 3.94],
  12: [2.82, 3.78, 4.04],
  14: [2.92, 3.91, 4.17],
  16: [2.95, 3.96, 4.22]
};

const FBA_LARGE_STD_MID = [
  [4, 3.73],
  [8, 3.95],
  [12, 4.20],
  [16, 4.60],
  [20, 5.04], // 1.25 lb
  [24, 5.42],
  [28, 5.57],
  [32, 5.82],
  [36, 5.92],
  [40, 6.10],
  [44, 6.26],
  [48, 6.67]
];

function priceBandIndex(price) {
  if (price < 10) return 0;
  if (price <= 50) return 1;
  return 2;
}

function classifySize(l, w, h, lb) {
  const sides = [l, w, h].map(num).sort((a, b) => b - a);
  const longest = sides[0], median = sides[1], shortest = sides[2];
  const unitLb = num(lb);
  const cuIn = Math.max(l, 0) * Math.max(w, 0) * Math.max(h, 0);
  const dimLb = cuIn > 0 ? cuIn / 139 : 0; // ESTIMATE US DIM divisor commonly 139
  if (longest <= 15 && median <= 12 && shortest <= 0.75 && unitLb <= 1) {
    return { tier: "Small standard", shippingLb: unitLb, oversize: false, dimLb, note: "Unit weight only (typical small-standard rule)." };
  }
  if (longest <= 18 && median <= 14 && shortest <= 8 && Math.max(unitLb, dimLb) <= 20) {
    return { tier: "Large standard", shippingLb: Math.max(unitLb, dimLb), oversize: false, dimLb, note: "Greater of unit weight and DIM (L×W×H/139) — ESTIMATE." };
  }
  return {
    tier: "Oversize / bulky",
    shippingLb: Math.max(unitLb, dimLb),
    oversize: true,
    dimLb,
    note: "Oversize rate card not modeled in detail. Use a Seller Central fulfillment override."
  };
}

function estimateFulfillment(tier, shippingLb, price, oversize) {
  if (oversize) {
    const base = 9.66 + 0.38 * Math.max(0, Math.ceil(shippingLb) - 1);
    return { amount: base, detail: `Rough bulky sketch ~$${base.toFixed(2)} before fuel. Override recommended.` };
  }
  const oz = shippingLb * 16;
  const band = priceBandIndex(price);
  if (tier === "Small standard") {
    const keys = Object.keys(FBA_SMALL_STD).map(Number).sort((a, b) => a - b);
    const key = keys.find((k) => oz <= k) || 16;
    const amount = FBA_SMALL_STD[key][band];
    const bandName = ["under $10", "$10–$50", "over $50"][band];
    return { amount, detail: `${key} oz band, ${bandName} (ESTIMATE)` };
  }
  // large standard
  let mid;
  if (oz <= 48) {
    const row = FBA_LARGE_STD_MID.find((r) => oz <= r[0]) || FBA_LARGE_STD_MID[FBA_LARGE_STD_MID.length - 1];
    mid = row[1];
  } else {
    const extraIntervals = Math.ceil((oz - 48) / 4);
    mid = 6.97 + 0.08 * extraIntervals;
  }
  // ESTIMATE band deltas vs mid ($10–$50)
  const delta = band === 0 ? -0.70 : band === 2 ? 0.26 : 0;
  return { amount: Math.max(0.01, mid + delta), detail: `Large standard ~${shippingLb.toFixed(2)} lb, band ${band} (ESTIMATE)` };
}

function amazonFees(input) {
  const qty = Math.max(1, Math.floor(num(input.qty, 1)));
  const item = num(input.item);
  const shipping = num(input.shipping);
  const gift = num(input.gift);
  const cogs = num(input.cogs);
  const ppc = num(input.ppc);
  const totalPrice = (item + shipping + gift); // per unit, official: list + shipping + gift wrap
  const ref = referralFee(input.category, totalPrice, input.customPct);

  const size = classifySize(input.length, input.width, input.height, input.weightLb);
  const hasOverride = input.fulfillOverride !== "" && input.fulfillOverride != null && !Number.isNaN(Number(input.fulfillOverride));
  let fulfill;
  if (hasOverride) {
    fulfill = { amount: num(input.fulfillOverride), detail: "Seller Central override (use this when you have the real fee)" };
  } else {
    fulfill = estimateFulfillment(size.tier, size.shippingLb, totalPrice, size.oversize);
  }
  const fulfillStatus = hasOverride ? "override" : "estimate";

  const fuelOn = input.fuel !== false;
  const fuel = fuelOn ? fulfill.amount * AMZ.fuelRate : 0;

  const L = num(input.length), W = num(input.width), H = num(input.height);
  const cuft = (L * W * H) / 1728;
  const months = Math.max(0, num(input.storageMonths));
  const peak = !!input.peakStorage;
  let storageRate = 0;
  if (months > 0 && cuft > 0) {
    storageRate = size.oversize
      ? (peak ? AMZ.storage.oversizePeak : AMZ.storage.oversizeOffPeak)
      : (peak ? AMZ.storage.standardPeak : AMZ.storage.standardOffPeak);
  }
  const storage = cuft * storageRate * months;

  const planMonthly = input.plan === "individual" ? 0 : AMZ.proMonthly;
  const unitsMonth = Math.max(1, num(input.ordersMonth, 1));
  const planPerUnit = input.plan === "professional" && input.allocatePlan ? planMonthly / unitsMonth : 0;
  const planAlloc = planPerUnit * qty;
  const individualFee = input.plan === "individual" ? AMZ.individualPerItem * qty : 0;

  const revenue = totalPrice * qty;
  const referral = ref.fee * qty;
  const closing = ref.closing * qty;
  const fulfillment = fulfill.amount * qty;
  const fuelTot = fuel * qty;
  const storageTot = storage * qty;
  const ppcTot = ppc * qty;
  const cogsTot = cogs * qty;
  const totalFees = referral + closing + fulfillment + fuelTot + storageTot + planAlloc + individualFee + ppcTot;
  const profit = revenue - totalFees - cogsTot;
  const verifiedFees = referral + closing + planAlloc + individualFee;
  const estimatedFees = fulfillment + fuelTot + storageTot;
  const fuelStatus = fuelOn ? fulfillStatus : "off";
  const fuelNote = fuelOn
    ? (hasOverride
      ? "Official 3.5% rate on Seller Central override fulfillment (dollars inherit that base), effective 17 Apr 2026 (US FBA)"
      : "Official 3.5% rate, but dollars inherit the estimated fulfillment base — ESTIMATE, effective 17 Apr 2026 (US FBA)")
    : "On fulfillment fee only, effective 17 Apr 2026 (US FBA)";

  return {
    size,
    fulfill,
    lines: [
      { name: `Referral — ${ref.cat.name}`, amount: referral, status: "verified", note: "Official sell.amazon.com/pricing. Min fee may apply." },
      { name: "Media closing fee", amount: closing, status: closing ? "verified" : "off", note: "$1.80 per media item" },
      { name: "FBA fulfillment", amount: fulfillment, status: fulfillStatus, note: fulfill.detail },
      { name: "Fuel & logistics surcharge (3.5%)", amount: fuelTot, status: fuelStatus, note: fuelNote },
      { name: "Monthly storage (allocated)", amount: storageTot, status: storageTot ? "estimate" : "off", note: storageTot ? `${cuft.toFixed(4)} cu ft × $${storageRate.toFixed(2)} × ${months} mo` : "Off" },
      { name: input.plan === "individual" ? "Individual per-item fee" : "Professional plan (allocated)", amount: planAlloc + individualFee, status: (planAlloc + individualFee) ? "verified" : "off", note: input.plan === "individual" && individualFee ? `${qty} × $${AMZ.individualPerItem}` : (planAlloc ? `$${planMonthly}/mo ÷ ${unitsMonth} units/mo × ${qty}` : "") },
      { name: "PPC / ads (your number)", amount: ppcTot, status: ppcTot ? "input" : "off" },
      { name: "COGS", amount: cogsTot, status: "input" }
    ],
    revenue,
    totalFees,
    verifiedFees,
    estimatedFees,
    profit,
    margin: revenue > 0 ? profit / revenue : 0,
    qty,
    totalPrice
  };
}

function amazonSolvePrice(input, mode, targetMargin) {
  const test = (item) => {
    const r = amazonFees({ ...input, item });
    if (mode === "breakeven") return r.profit;
    return r.profit - targetMargin * r.revenue;
  };
  return solveNonNegative(test);
}

function solveNonNegative(fn) {
  let lo = 0;
  let hi = 1;
  let fhi = fn(hi);
  let guard = 0;
  while (fhi < 0 && hi < 1e7 && guard < 40) {
    hi *= 2;
    fhi = fn(hi);
    guard += 1;
  }
  if (fn(0) >= 0) return 0;
  if (fhi < 0) return null;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (fn(mid) >= 0) hi = mid;
    else lo = mid;
  }
  return hi;
}

function num(v, fallback) {
  if (v === "" || v == null) return fallback == null ? 0 : fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : (fallback == null ? 0 : fallback);
}

if (typeof window !== "undefined") {
  window.FeeTruth = { ETSY, AMZ, REFERRAL, etsyFees, etsySolvePrice, amazonFees, amazonSolvePrice, VERIFIED };
}
