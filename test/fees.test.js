/**
 * FeeTruth fee-engine checks.
 * Run: node test/fees.test.js
 *
 * Locks:
 *  - qty=1 US path (shipping/tax multiplication is a no-op at qty=1)
 *  - qty>1 with nonzero shipping, gift wrap, and/or tax (order-level, not × qty)
 *  - Offsite Ads toggle + $100 cap still apply to the (corrected) txBase
 *  - Amazon estimate vs override labeling unchanged
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const src = fs.readFileSync(path.join(__dirname, "..", "js", "fees.js"), "utf8");
const context = { window: {} };
vm.runInNewContext(src, context);
const { etsyFees, amazonFees, ETSY } = context.window.FeeTruth;

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log("ok  " + name);
}

function almost(actual, expected, label, eps) {
  const tol = eps == null ? 1e-9 : eps;
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${label}: expected ${expected}, got ${actual}`
  );
}

const lockedUsQty1 = {
  region: "US",
  item: 48,
  shipping: 6.5,
  gift: 0,
  tax: 0,
  qty: 1,
  ads: "off",
  includeListing: true,
  cogs: 14,
  shipCost: 4.2
};

check("qty=1 US path matches locked rates", () => {
  const r = etsyFees(lockedUsQty1);
  almost(r.txBase, 54.5, "txBase");
  almost(r.totalFees, 5.6275, "totalFees");
  const listing = r.lines.find((l) => l.name === "Listing fee");
  const txn = r.lines.find((l) => l.name.startsWith("Transaction fee"));
  const proc = r.lines.find((l) => l.name.startsWith("Payment processing"));
  const ads = r.lines.find((l) => l.name.startsWith("Offsite Ads"));
  almost(listing.amount, 0.2, "listing");
  almost(txn.amount, 3.5425, "transaction");
  almost(proc.amount, 1.885, "processing");
  almost(ads.amount, 0, "ads off");
  assert.strictEqual(ads.status, "off");
  almost(r.revenue, 54.5, "revenue");
  almost(r.profit, 30.6725, "profit");
});

check("qty=2 + ship + tax (repro): expected $10.5375, not $11.305", () => {
  const r = etsyFees({
    region: "US",
    item: 48,
    shipping: 6.5,
    gift: 0,
    tax: 5,
    qty: 2,
    ads: "off",
    includeListing: true
  });
  almost(r.txBase, 102.5, "txBase item×2 + ship");
  almost(r.totalFees, 10.5375, "totalFees");
  const txn = r.lines.find((l) => l.name.startsWith("Transaction fee"));
  const proc = r.lines.find((l) => l.name.startsWith("Payment processing"));
  const listing = r.lines.find((l) => l.name === "Listing fee");
  almost(listing.amount, 0.4, "listing 2×$0.20");
  almost(txn.amount, 6.6625, "transaction");
  almost(proc.amount, 3.475, "processing");
  // Old engine: (48+6.50)*2*0.065 + (48+6.50+5)*2*0.03+0.25 + 0.40 = 11.305
  assert.ok(Math.abs(r.totalFees - 11.305) > 0.01, "must not match the pre-fix overstatement");
});

check("qty>1: gift wrap is order-level (not × qty)", () => {
  const r = etsyFees({
    region: "US",
    item: 48,
    shipping: 6.5,
    gift: 3,
    tax: 5,
    qty: 2,
    ads: "off",
    includeListing: true
  });
  almost(r.txBase, 105.5, "txBase includes gift once");
  almost(r.totalFees, 10.8225, "totalFees");
  const txn = r.lines.find((l) => l.name.startsWith("Transaction fee"));
  const proc = r.lines.find((l) => l.name.startsWith("Payment processing"));
  almost(txn.amount, 6.8575, "transaction");
  almost(proc.amount, 3.565, "processing");
});

check("qty>1 ship-only vs tax-only: only the charged order amounts enter the base", () => {
  const shipOnly = etsyFees({
    region: "US", item: 10, shipping: 4, gift: 0, tax: 0, qty: 3, ads: "off", includeListing: true
  });
  // txBase = 30 + 4 = 34; txn=2.21; proc=34*0.03+0.25=1.27; listing=0.60; fees=4.08
  almost(shipOnly.txBase, 34, "ship-only txBase");
  almost(shipOnly.totalFees, 4.08, "ship-only fees");

  const taxOnly = etsyFees({
    region: "US", item: 10, shipping: 0, gift: 0, tax: 6, qty: 3, ads: "off", includeListing: true
  });
  // txBase = 30; txn=1.95; proc=(30+6)*0.03+0.25=1.33; listing=0.60; fees=3.88
  almost(taxOnly.txBase, 30, "tax excluded from txBase");
  almost(taxOnly.totalFees, 3.88, "tax-only fees");
});

check("Offsite Ads: 15% / 12% / $100 cap still apply; qty=1 dollars unchanged", () => {
  const off = etsyFees({ ...lockedUsQty1, ads: "off" });
  const ads15 = etsyFees({ ...lockedUsQty1, ads: "15" });
  const ads12 = etsyFees({ ...lockedUsQty1, ads: "12" });
  almost(off.lines.find((l) => l.name.startsWith("Offsite Ads")).amount, 0, "ads off");
  almost(ads15.lines.find((l) => l.name.startsWith("Offsite Ads")).amount, 54.5 * 0.15, "15% of qty=1 txBase");
  almost(ads12.lines.find((l) => l.name.startsWith("Offsite Ads")).amount, 54.5 * 0.12, "12% of qty=1 txBase");
  assert.strictEqual(ads15.lines.find((l) => l.name.startsWith("Offsite Ads")).status, "verified");

  const capped = etsyFees({
    region: "US", item: 800, shipping: 0, gift: 0, tax: 0, qty: 1, ads: "15", includeListing: true
  });
  almost(capped.lines.find((l) => l.name.startsWith("Offsite Ads")).amount, ETSY.offsite.capUsd, "cap $100");

  const qty2ads = etsyFees({
    region: "US", item: 48, shipping: 6.5, gift: 0, tax: 5, qty: 2, ads: "15", includeListing: true
  });
  almost(qty2ads.lines.find((l) => l.name.startsWith("Offsite Ads")).amount, 102.5 * 0.15, "ads on order-level txBase");
});

check("Amazon estimate vs override labeling unchanged", () => {
  const base = {
    item: 24.99,
    shipping: 0,
    gift: 0,
    qty: 1,
    category: "home_kitchen",
    length: 8,
    width: 6,
    height: 2,
    weightLb: 0.55,
    fuel: true,
    plan: "professional"
  };
  const estimated = amazonFees(base);
  const fulfillEst = estimated.lines.find((l) => l.name === "FBA fulfillment");
  const fuelEst = estimated.lines.find((l) => l.name.startsWith("Fuel"));
  assert.strictEqual(fulfillEst.status, "estimate");
  assert.strictEqual(fuelEst.status, "estimate");
  assert.ok(/ESTIMATE/i.test(fuelEst.note));

  const overridden = amazonFees({ ...base, fulfillOverride: 4.2 });
  const fulfillOv = overridden.lines.find((l) => l.name === "FBA fulfillment");
  const fuelOv = overridden.lines.find((l) => l.name.startsWith("Fuel"));
  assert.strictEqual(fulfillOv.status, "override");
  assert.strictEqual(fuelOv.status, "override");
  almost(fulfillOv.amount, 4.2, "override dollars");
  almost(fuelOv.amount, 4.2 * 0.035, "fuel on override");
  assert.ok(!/ESTIMATE/i.test(fuelOv.note) || /override/i.test(fuelOv.note));
});

check("Amazon Individual $0.99 per item scales with quantity", () => {
  const base = {
    item: 20,
    shipping: 0,
    gift: 0,
    category: "home_kitchen",
    length: 8,
    width: 6,
    height: 2,
    weightLb: 0.55,
    fuel: false,
    plan: "individual"
  };
  const one = amazonFees({ ...base, qty: 1 });
  const three = amazonFees({ ...base, qty: 3 });
  const planLine1 = one.lines.find((l) => l.name === "Individual per-item fee");
  const planLine3 = three.lines.find((l) => l.name === "Individual per-item fee");
  almost(planLine1.amount, 0.99, "individual fee qty=1");
  almost(planLine3.amount, 2.97, "individual fee qty=3");
  almost(planLine3.amount - planLine1.amount, 1.98, "two extra $0.99 units on plan line");
});

check("Amazon Professional plan allocation scales per unit and with quantity", () => {
  const base = {
    item: 24.99,
    shipping: 0,
    gift: 0,
    category: "home_kitchen",
    length: 8,
    width: 6,
    height: 2,
    weightLb: 0.55,
    fuel: false,
    plan: "professional",
    allocatePlan: true,
    ordersMonth: 200
  };
  const one = amazonFees({ ...base, qty: 1 });
  const two = amazonFees({ ...base, qty: 2 });
  const perUnit = 39.99 / 200;
  const plan1 = one.lines.find((l) => l.name === "Professional plan (allocated)");
  const plan2 = two.lines.find((l) => l.name === "Professional plan (allocated)");
  almost(plan1.amount, perUnit, "one unit allocation");
  almost(plan2.amount, perUnit * 2, "two units allocation");
  almost(plan2.amount - plan1.amount, perUnit, "extra unit adds one allocation share");
});

check("Etsy UK: GBP totals include Offsite Ads on txBase; listing/subs USD-only", () => {
  const r = etsyFees({
    region: "UK",
    item: 48,
    shipping: 6.5,
    gift: 0,
    tax: 0,
    qty: 1,
    ads: "15",
    includeListing: true,
    pattern: true,
    plus: true,
    allocateSubs: true,
    ordersMonth: 40,
    cogs: 14,
    shipCost: 4.2
  });
  assert.strictEqual(r.currency, "GBP");
  almost(r.txBase, 54.5, "txBase GBP");
  const adsAmt = 54.5 * 0.15;
  almost(r.totalFees, 3.5425 + 2.38 + adsAmt, "GBP fees = txn + proc + ads");
  const txn = r.lines.find((l) => l.name.startsWith("Transaction fee"));
  const proc = r.lines.find((l) => l.name.startsWith("Payment processing"));
  const listing = r.lines.find((l) => l.name === "Listing fee");
  const ads = r.lines.find((l) => l.name.startsWith("Offsite Ads"));
  const subs = r.lines.find((l) => l.name.startsWith("Allocated Pattern"));
  almost(txn.amount, 3.5425, "txn GBP");
  almost(proc.amount, 2.38, "proc 4% + £0.20");
  assert.strictEqual(txn.currency, "GBP");
  assert.strictEqual(proc.currency, "GBP");
  assert.strictEqual(ads.currency, "GBP");
  assert.strictEqual(ads.status, "verified");
  almost(ads.amount, adsAmt, "ads on GBP txBase");
  assert.ok(ads.note.includes("$100 USD"), "cap disclosed in USD");
  assert.ok(ads.note.includes("no FX"), "no invented FX");
  assert.strictEqual(listing.currency, "USD");
  assert.strictEqual(listing.status, "usd");
  almost(listing.amount, 0.2, "listing shown in USD");
  assert.strictEqual(subs.status, "usd");
  almost(r.profit, 54.5 - r.totalFees - 14 - 4.2, "profit uses GBP fees incl ads");
});

check("Etsy UK Offsite Ads: large order marks cap estimate without zeroing ads", () => {
  const r = etsyFees({
    region: "UK",
    item: 800,
    shipping: 0,
    gift: 0,
    tax: 0,
    qty: 1,
    ads: "15",
    includeListing: false
  });
  const ads = r.lines.find((l) => l.name.startsWith("Offsite Ads"));
  almost(ads.amount, 800 * 0.15, "uncapped GBP ads (no FX for USD cap)");
  assert.strictEqual(ads.status, "estimate");
  assert.ok(ads.note.includes("processing-time rate"), "cap conversion disclosed");
  almost(r.totalFees, 800 * 0.065 + (800 * 0.04 + 0.2) + 800 * 0.15, "ads in GBP total");
});

check("Etsy UK reverse pricing includes Offsite Ads in GBP solve", () => {
  const { etsySolvePrice } = context.window.FeeTruth;
  const input = {
    region: "UK",
    item: 48,
    shipping: 6.5,
    gift: 0,
    tax: 0,
    qty: 1,
    ads: "15",
    includeListing: false,
    cogs: 14,
    shipCost: 4.2
  };
  const be = etsySolvePrice(input, "breakeven");
  const atBe = etsyFees({ ...input, item: be });
  almost(atBe.profit, 0, "breakeven profit ~0 with ads", 0.01);
  assert.strictEqual(atBe.currency, "GBP");
  almost(atBe.lines.find((l) => l.name.startsWith("Offsite Ads")).amount, atBe.txBase * 0.15, "ads in reverse path");
});

check("Etsy US locked path unchanged after UK split", () => {
  const r = etsyFees(lockedUsQty1);
  assert.strictEqual(r.currency, "USD");
  almost(r.totalFees, 5.6275, "US totalFees locked");
  almost(r.profit, 30.6725, "US profit locked");
  const ads15 = etsyFees({ ...lockedUsQty1, ads: "15" });
  almost(ads15.lines.find((l) => l.name.startsWith("Offsite Ads")).amount, 54.5 * 0.15, "US ads still in total");
});

console.log("\n" + passed + " checks passed");
