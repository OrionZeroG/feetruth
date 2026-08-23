/**
 * Locks public buy CTAs to the approved live checkout URL only.
 * Run: node test/checkout-cta.test.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const CHECKOUT = "https://whop.com/checkout/plan_oC1FbrBQ9y2yp";
const files = [
  "index.html",
  "workbook.html",
  "guides/etsy-fee-calculator.html",
  "guides/amazon-fba-calculator.html"
];

for (const file of files) {
  const html = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const hrefs = [...html.matchAll(/\bhref="(https:\/\/whop\.com[^"]*)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length > 0, `${file} must contain a Whop checkout CTA`);
  hrefs.forEach((href) => {
    assert.strictEqual(href, CHECKOUT, `${file} must use the exact checkout URL, got ${href}`);
  });
  const otherWhop = [...html.matchAll(/https:\/\/whop\.com\/[^\s"'<>]*/g)].map((m) => m[0]);
  otherWhop.forEach((url) => {
    assert.strictEqual(url, CHECKOUT, `${file} must not add other Whop URLs, got ${url}`);
  });
}

console.log("ok  homepage, workbook, and fee-explainer CTAs use exact checkout URL");
console.log("1 check passed");
