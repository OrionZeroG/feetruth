(function () {
  const KEY = "feetruth.analytics.v1";

  function loadA() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function saveA(a) { localStorage.setItem(KEY, JSON.stringify(a)); }
  function bump(name) {
    const a = loadA();
    a[name] = (a[name] || 0) + 1;
    a.last = new Date().toISOString();
    saveA(a);
    renderAnalytics();
  }
  function renderAnalytics() {
    const el = document.getElementById("analytics");
    if (!el) return;
    const a = loadA();
    el.textContent = `This-browser calc counters (not sent to FeeTruth) — Etsy calcs: ${a.etsy || 0} · Amazon calcs: ${a.amazon || 0} · Workbook clicks: ${a.workbook || 0} · Checkout clicks: ${a.checkout || 0}. Page traffic: Cloudflare Web Analytics.`;
  }

  function money(n, cur) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "—";
    const prefix = cur === "GBP" ? "£" : "$";
    const sign = v < 0 ? "−" : "";
    return sign + prefix + Math.abs(v).toFixed(2);
  }
  function pct(n) { return (n * 100).toFixed(1) + "%"; }

  function renderLines(tbody, lines) {
    tbody.innerHTML = "";
    lines.forEach((line) => {
      const tr = document.createElement("tr");
      tr.className = "row-" + (line.status || "off");
      tr.innerHTML = `<td><span class="chip ${line.status}">${line.status}</span>${line.name}<div class="note">${line.note || ""}</div></td><td class="amt">${money(line.amount)}</td>`;
      tbody.appendChild(tr);
    });
  }

  function etsyInput() {
    return {
      region: document.getElementById("e-region").value,
      item: document.getElementById("e-item").value,
      shipping: document.getElementById("e-ship").value,
      gift: document.getElementById("e-gift").value,
      tax: document.getElementById("e-tax").value,
      qty: document.getElementById("e-qty").value,
      cogs: document.getElementById("e-cogs").value,
      shipCost: document.getElementById("e-shipcost").value,
      ads: document.getElementById("e-ads").value,
      includeListing: document.getElementById("e-listing").checked,
      pattern: document.getElementById("e-pattern").checked,
      plus: document.getElementById("e-plus").checked,
      allocateSubs: document.getElementById("e-alloc").checked,
      ordersMonth: document.getElementById("e-orders").value,
      vatOnFees: document.getElementById("e-vat").checked,
      vatRate: 0.20
    };
  }

  function runEtsy(count) {
    const input = etsyInput();
    const r = FeeTruth.etsyFees(input);
    renderLines(document.getElementById("e-lines"), r.lines);
    document.getElementById("e-rev").textContent = money(r.revenue);
    document.getElementById("e-fees").textContent = money(r.totalFees);
    document.getElementById("e-profit").textContent = money(r.profit);
    document.getElementById("e-margin").textContent = pct(r.margin);
    document.getElementById("e-profit").style.color = r.profit >= 0 ? "var(--ok)" : "var(--bad)";
    const be = FeeTruth.etsySolvePrice(input, "breakeven");
    const tm = Number(document.getElementById("e-target").value) / 100;
    const tp = FeeTruth.etsySolvePrice(input, "margin", tm);
    document.getElementById("e-be").textContent = be == null ? "No solution" : money(be) + " list price";
    document.getElementById("e-tp").textContent = tp == null ? "No solution" : money(tp) + " list price";
    const note = document.getElementById("e-fx-note");
    if (note) note.textContent = r.region === "UK" ? r.currencyNote : "";
    if (count) bump("etsy");
  }

  function amazonInput() {
    return {
      item: document.getElementById("a-item").value,
      shipping: document.getElementById("a-ship").value,
      gift: document.getElementById("a-gift").value,
      qty: document.getElementById("a-qty").value,
      category: document.getElementById("a-cat").value,
      customPct: document.getElementById("a-custom").value,
      length: document.getElementById("a-l").value,
      width: document.getElementById("a-w").value,
      height: document.getElementById("a-h").value,
      weightLb: document.getElementById("a-wt").value,
      fulfillOverride: document.getElementById("a-override").value,
      fuel: document.getElementById("a-fuel").checked,
      storageMonths: document.getElementById("a-store-mo").value,
      peakStorage: document.getElementById("a-peak").checked,
      cogs: document.getElementById("a-cogs").value,
      ppc: document.getElementById("a-ppc").value,
      plan: document.getElementById("a-plan").value,
      allocatePlan: document.getElementById("a-alloc").checked,
      ordersMonth: document.getElementById("a-orders").value
    };
  }

  function runAmazon(count) {
    const input = amazonInput();
    const r = FeeTruth.amazonFees(input);
    renderLines(document.getElementById("a-lines"), r.lines);
    document.getElementById("a-tier").textContent = `${r.size.tier} · shipping wt ${r.size.shippingLb.toFixed(2)} lb`;
    document.getElementById("a-tier-note").textContent = r.size.note;
    document.getElementById("a-rev").textContent = money(r.revenue);
    const vEl = document.getElementById("a-verified");
    const eEl = document.getElementById("a-estimated");
    if (vEl) vEl.textContent = money(r.verifiedFees);
    if (eEl) eEl.textContent = money(r.estimatedFees);
    document.getElementById("a-fees").textContent = money(r.totalFees);
    document.getElementById("a-profit").textContent = money(r.profit);
    document.getElementById("a-margin").textContent = pct(r.margin);
    document.getElementById("a-profit").style.color = r.profit >= 0 ? "var(--ok)" : "var(--bad)";
    const hasEstimate = r.lines.some((line) => line.status === "estimate");
    const profitLabel = document.getElementById("a-profit-label");
    const mixNote = document.getElementById("a-mix-note");
    if (hasEstimate) {
      if (profitLabel) profitLabel.textContent = "Net after COGS (mixed verified + estimated inputs)";
      if (mixNote) mixNote.textContent = "Combined net uses mixed verified + estimated inputs. Paste a Seller Central fulfillment fee in the override field when you have one.";
    } else {
      if (profitLabel) profitLabel.textContent = "Net after COGS";
      if (mixNote) mixNote.textContent = "";
    }
    const be = FeeTruth.amazonSolvePrice(input, "breakeven");
    const tm = Number(document.getElementById("a-target").value) / 100;
    const tp = FeeTruth.amazonSolvePrice(input, "margin", tm);
    document.getElementById("a-be").textContent = be == null ? "No solution" : money(be) + " list price";
    document.getElementById("a-tp").textContent = tp == null ? "No solution" : money(tp) + " list price";
    if (count) bump("amazon");
  }

  function showPanel(name) {
    document.querySelectorAll("[data-panel]").forEach((p) => {
      p.hidden = p.getAttribute("data-panel") !== name;
    });
    document.querySelectorAll(".tabs button").forEach((b) => {
      b.setAttribute("aria-selected", b.getAttribute("data-tab") === name ? "true" : "false");
    });
  }

  function applyQuery() {
    const params = new URLSearchParams(window.location.search);
    const hash = (window.location.hash || "").replace(/^#/, "");
    const tab = params.get("tab") || hash;
    if (tab === "amazon" || tab === "etsy") showPanel(tab);

    function setIfPresent(id, key) {
      const el = document.getElementById(id);
      if (!el || !params.has(key)) return;
      el.value = params.get(key);
    }
    setIfPresent("e-item", "item");
    setIfPresent("e-qty", "qty");
    setIfPresent("e-ship", "ship");
    setIfPresent("e-gift", "gift");
    setIfPresent("e-tax", "tax");
    setIfPresent("e-ads", "ads");
    setIfPresent("a-override", "override");
  }

  function init() {
    renderAnalytics();
    applyQuery();
    const etsyForm = document.getElementById("etsy-form");
    const amzForm = document.getElementById("amazon-form");
    if (etsyForm) {
      etsyForm.addEventListener("submit", (e) => { e.preventDefault(); runEtsy(true); });
      etsyForm.addEventListener("change", () => { /* live optional */ });
      document.getElementById("e-region").addEventListener("change", () => {
        document.getElementById("e-vat-wrap").hidden = document.getElementById("e-region").value !== "UK";
      });
    }
    if (amzForm) {
      amzForm.addEventListener("submit", (e) => { e.preventDefault(); runAmazon(true); });
      document.getElementById("a-cat").addEventListener("change", () => {
        document.getElementById("a-custom-wrap").hidden = document.getElementById("a-cat").value !== "custom";
      });
    }
    document.querySelectorAll(".tabs button").forEach((b) => {
      b.addEventListener("click", () => showPanel(b.getAttribute("data-tab")));
    });
    document.querySelectorAll("[data-workbook]").forEach((el) => {
      el.addEventListener("click", () => bump("workbook"));
    });
    document.querySelectorAll("[data-checkout]").forEach((el) => {
      el.addEventListener("click", () => bump("checkout"));
    });
    if (document.getElementById("e-item")) runEtsy();
    if (document.getElementById("a-item")) runAmazon();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
