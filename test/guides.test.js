/**
 * Locks SEO explainer worked examples to the fee engine.
 * Run: node test/guides.test.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const src = fs.readFileSync(path.join(__dirname, "..", "js", "fees.js"), "utf8");
const context = { window: {} };
vm.runInNewContext(src, context);
const { etsyFees, amazonFees } = context.window.FeeTruth;

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log("ok  " + name);
}

function read(rel) {
  return fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
}

function almost(actual, expected, label, eps) {
  const tol = eps == null ? 1e-9 : eps;
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${label}: expected ${expected}, got ${actual}`
  );
}

function assertContains(html, snippet, label) {
  assert.ok(html.includes(snippet), `${label} must include ${JSON.stringify(snippet)}`);
}

const etsyPage = read("guides/etsy-fee-calculator.html");
const amzPage = read("guides/amazon-fba-calculator.html");
const index = read("index.html");
const sitemap = read("sitemap.xml");

check("homepage and sitemap wire both explainers", () => {
  assertContains(index, "guides/etsy-fee-calculator.html", "homepage");
  assertContains(index, "guides/amazon-fba-calculator.html", "homepage");
  assertContains(sitemap, "http://tryfeetruth.com/guides/etsy-fee-calculator.html", "sitemap");
  assertContains(sitemap, "http://tryfeetruth.com/guides/amazon-fba-calculator.html", "sitemap");
});

check("etsy $48+$6.50 example matches engine", () => {
  const r = etsyFees({
    region: "US",
    item: 48,
    shipping: 6.5,
    gift: 0,
    tax: 0,
    qty: 1,
    ads: "off",
    includeListing: true
  });
  almost(r.txBase, 54.5, "txBase");
  almost(r.totalFees, 5.6275, "totalFees");
  almost(r.lines.find((l) => l.name === "Listing fee").amount, 0.2, "listing");
  almost(r.lines.find((l) => l.name.startsWith("Transaction fee")).amount, 3.5425, "txn");
  almost(r.lines.find((l) => l.name.startsWith("Payment processing")).amount, 1.885, "proc");
  assertContains(etsyPage, "$3.5425", "etsy page txn");
  assertContains(etsyPage, "$1.885", "etsy page proc");
  assertContains(etsyPage, "$5.6275", "etsy page total");
  assertContains(etsyPage, "data-example=\"etsy-us-48-6.50\"", "etsy page example hook");
});

check("etsy qty=2 + tax example matches engine (not the old overstatement)", () => {
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
  almost(r.totalFees, 10.5375, "totalFees");
  assertContains(etsyPage, "$10.5375", "etsy page qty2 total");
  assertContains(etsyPage, "$11.305", "etsy page names the old overstatement");
  assertContains(etsyPage, "data-example=\"etsy-us-qty2-tax\"", "etsy page qty2 hook");
});

check("etsy page keeps fee integrity and does not blend Offsite Ads", () => {
  assertContains(etsyPage, "$0.20", "listing");
  assertContains(etsyPage, "6.5%", "transaction rate");
  assertContains(etsyPage, "3% + $0.25", "US processing");
  assertContains(etsyPage, "$100", "ads cap");
  assertContains(etsyPage, "not a blended take rate", "no mystery percent");
  assertContains(etsyPage, "etsy-offsite-ads.html", "deep-dive link");
  assert.ok(!/25\.9% as a per-order/.test(etsyPage) || etsyPage.includes("will not"), "must refuse take-rate as a fee");
});

check("amazon $24.99 + $5 override example matches engine", () => {
  const r = amazonFees({
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
    plan: "professional",
    fulfillOverride: 5
  });
  const referral = r.lines.find((l) => l.name.startsWith("Referral"));
  const fulfill = r.lines.find((l) => l.name === "FBA fulfillment");
  const fuel = r.lines.find((l) => l.name.startsWith("Fuel"));
  almost(referral.amount, 3.7485, "referral");
  almost(fulfill.amount, 5, "fulfill override");
  almost(fuel.amount, 0.175, "fuel on override");
  almost(r.totalFees, 8.9235, "totalFees");
  assert.strictEqual(fulfill.status, "override");
  assertContains(amzPage, "$3.7485", "amz page referral");
  assertContains(amzPage, "$0.175", "amz page fuel");
  assertContains(amzPage, "$8.9235", "amz page total");
  assertContains(amzPage, "data-example=\"amz-24.99-override-5\"", "amz page example hook");
});

check("amazon page states fuel is on fulfillment, not sale price", () => {
  assertContains(amzPage, "not the sale price", "fuel base");
  assertContains(amzPage, "3.5%", "fuel rate");
  assertContains(amzPage, "amazon-fba-fuel-surcharge-2026.html", "deep-dive link");
  assertContains(amzPage, "estimate", "fulfillment labeled estimate");
  assertContains(amzPage, "sell.amazon.com/pricing", "official referral cite");
});

check("explainers link to calculator prefills and keep existing calc forms", () => {
  assertContains(etsyPage, "../index.html?tab=etsy&amp;item=48", "etsy calc prefill");
  assertContains(amzPage, "../index.html?tab=amazon&amp;override=5", "amz calc prefill");
  assertContains(index, "id=\"etsy-form\"", "homepage etsy form");
  assertContains(index, "id=\"amazon-form\"", "homepage amazon form");
});

console.log("\n" + passed + " checks passed");
