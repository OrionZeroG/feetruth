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

console.log("\n" + passed + " checks passed");
