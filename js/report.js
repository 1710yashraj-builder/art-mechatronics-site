/* Private enquiry & visibility report — reads /api/stats (needs the key in the
   URL) and data/report-log.json, and draws everything itself. No library, no
   inline script (the site's CSP forbids inline JS), no cookies. */
(function () {
  var key = new URLSearchParams(location.search).get("key") || "";
  var days = parseInt(new URLSearchParams(location.search).get("days") || "30", 10) || 30;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var n = function (v) { return Number(v || 0).toLocaleString("en-IN"); };
  var TYPE = { whatsapp: "WhatsApp", call: "Call", email: "Email", form: "Form" };
  var MARKET = { india: "India", uae: "UAE", thailand: "Thailand", "": "Not chosen" };
  var COUNTRY = { IN: "India", AE: "UAE", TH: "Thailand", SA: "Saudi Arabia", OM: "Oman", QA: "Qatar", KE: "Kenya", NG: "Nigeria", UG: "Uganda", BD: "Bangladesh", LK: "Sri Lanka", NP: "Nepal", US: "United States", GB: "United Kingdom", SG: "Singapore", MY: "Malaysia", ID: "Indonesia", VN: "Vietnam", PH: "Philippines", EG: "Egypt", ZA: "South Africa", DE: "Germany", AU: "Australia", CA: "Canada", PK: "Pakistan" };

  document.querySelectorAll("[data-days]").forEach(function (b) {
    if (+b.dataset.days === days) b.setAttribute("aria-current", "true");
    b.addEventListener("click", function () {
      var u = new URL(location.href); u.searchParams.set("days", b.dataset.days); location.href = u.toString();
    });
  });

  function state(msg, isError) {
    var el = $("state"); el.hidden = false; el.textContent = msg; el.className = "state" + (isError ? " state--err" : "");
    $("live").hidden = true;
  }

  function bars(container, list, label, valueKey) {
    var max = Math.max.apply(null, list.map(function (r) { return +r[valueKey] || 0; }).concat([1]));
    container.innerHTML = list.length ? list.map(function (r) {
      var v = +r[valueKey] || 0;
      return '<div class="bar"><span class="bar__l">' + esc(label(r)) + '</span><span class="bar__t"><i style="width:' + Math.max(2, Math.round(100 * v / max)) + '%"></i></span><span class="bar__v">' + n(v) + "</span></div>";
    }).join("") : '<p class="empty">Nothing yet in this period.</p>';
  }

  function chart(daily, days) {
    var W = 720, H = 200, padL = 36, padB = 26, padT = 10, innerW = W - padL - 8, innerH = H - padT - padB;
    var byDay = {}; daily.forEach(function (r) { byDay[r.d] = r; });
    var series = [], today = new Date(); today.setUTCHours(0, 0, 0, 0);
    for (var i = days - 1; i >= 0; i--) {
      var d = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10);
      var r = byDay[d] || {}; series.push({ d: d, views: +r.views || 0, enq: +r.enq || 0 });
    }
    var maxV = Math.max(1, Math.max.apply(null, series.map(function (s) { return s.views; })));
    var maxE = Math.max(1, Math.max.apply(null, series.map(function (s) { return s.enq; })));
    var bw = innerW / series.length;
    var svg = ['<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Daily visits and enquiry clicks">'];
    [0, 0.5, 1].forEach(function (f) {
      var y = padT + innerH - f * innerH;
      svg.push('<line x1="' + padL + '" y1="' + y + '" x2="' + (W - 8) + '" y2="' + y + '" class="grid"/>');
      svg.push('<text x="' + (padL - 6) + '" y="' + (y + 4) + '" text-anchor="end" class="axis">' + Math.round(f * maxV) + "</text>");
    });
    series.forEach(function (s, i) {
      var x = padL + i * bw, h = Math.round(innerH * s.views / maxV), he = Math.round(innerH * s.enq / maxE);
      svg.push('<rect x="' + (x + bw * 0.15).toFixed(1) + '" y="' + (padT + innerH - h) + '" width="' + (bw * 0.7).toFixed(1) + '" height="' + h + '" class="v"><title>' + s.d + ": " + s.views + " visits</title></rect>");
      if (s.enq) svg.push('<rect x="' + (x + bw * 0.3).toFixed(1) + '" y="' + (padT + innerH - he) + '" width="' + (bw * 0.4).toFixed(1) + '" height="' + he + '" class="e"><title>' + s.d + ": " + s.enq + " enquiry clicks</title></rect>");
      if (i === 0 || i === series.length - 1 || (days <= 31 && i % 7 === 0) || (days > 31 && i % 30 === 0))
        svg.push('<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" class="axis">' + s.d.slice(5) + "</text>");
    });
    svg.push("</svg>");
    $("chart").innerHTML = svg.join("");
  }

  function renderLog(log) {
    var p = log.plan || {};
    $("fee").textContent = p.fee || ""; $("month1").textContent = p.month1 || ""; $("setup").textContent = p.setup || "";
    $("items").innerHTML = (p.items || []).map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("");
    $("delivered").innerHTML = (log.delivered || []).slice().reverse().map(function (d) {
      return '<li><time datetime="' + esc(d.date) + '">' + esc(d.date) + "</time> " + (d.link ? '<a href="' + esc(d.link) + '" target="_blank" rel="noopener">' + esc(d.item) + "</a>" : esc(d.item)) + "</li>";
    }).join("");
    var g = log.searchConsole || {};
    $("gsc").textContent = g.status === "connected" ? ("Connected — " + (g.note || "")) : ("Not connected yet. " + (g.note || ""));
    $("gsc").className = "pill " + (g.status === "connected" ? "pill--ok" : "pill--wait");
    $("ai").innerHTML = (log.aiChecks || []).length ? log.aiChecks.map(function (a) { return "<li><b>" + esc(a.month) + ":</b> " + esc(a.note) + "</li>"; }).join("") : '<li class="empty">First check is scheduled for the end of Month 1 — we ask ChatGPT, Gemini and Perplexity the questions your buyers ask, and record whether ART is named.</li>';
    $("updated").textContent = log.updated || "";
  }

  function render(s) {
    var t = {}; (s.byType || []).forEach(function (r) { t[r.type] = +r.n; });
    var enq = (t.whatsapp || 0) + (t.call || 0) + (t.email || 0) + (t.form || 0);
    $("kEnq").textContent = n(enq); $("kViews").textContent = n(t.view || 0);
    $("kRate").textContent = t.view ? (100 * enq / t.view).toFixed(1) : "—";
    $("kLife").textContent = n((s.lifetime && s.lifetime.enq) || 0) + " enquiries · " + n((s.lifetime && s.lifetime.views) || 0) + " visits";
    $("since").textContent = s.firstEvent ? new Date(s.firstEvent * 1000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "17 Sep 2026";
    bars($("byType"), ["whatsapp", "call", "email", "form"].map(function (k) { return { k: k, n: t[k] || 0 }; }), function (r) { return TYPE[r.k]; }, "n");
    var m = {}; (s.byMarket || []).forEach(function (r) { m[r.market] = +r.n; });
    bars($("byMarket"), ["india", "uae", "thailand", ""].map(function (k) { return { k: k, n: m[k] || 0 }; }).filter(function (r) { return r.k !== "" || r.n; }), function (r) { return MARKET[r.k]; }, "n");
    bars($("byCountry"), s.byCountry || [], function (r) { return COUNTRY[r.country] || r.country; }, "n");
    bars($("refs"), s.referrers || [], function (r) { return r.ref; }, "n");
    bars($("enqPages"), s.topEnquiryPages || [], function (r) { return r.path || "/"; }, "n");
    bars($("viewPages"), s.topViewPages || [], function (r) { return r.path || "/"; }, "n");
    chart(s.daily || [], s.days);
    $("period").textContent = "last " + s.days + " days";
    $("live").hidden = false; $("state").hidden = true;
  }

  if (!key) { state("This report opens only from its private link — the one Yash shared on WhatsApp. It will not work from a search or a typed address.", true); }
  else {
    fetch("/api/stats?key=" + encodeURIComponent(key) + "&days=" + days, { cache: "no-store" })
      .then(function (r) { if (r.status === 403) throw new Error("wrong-key"); if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(render)
      .catch(function (e) { state(e.message === "wrong-key" ? "The link's key is not valid any more — ask Yash for the current private link." : "The counting service did not answer (" + e.message + "). Try again in a minute.", true); });
  }
  fetch("data/report-log.json", { cache: "no-store" }).then(function (r) { return r.json(); }).then(renderLog).catch(function () { $("updated").textContent = "log unavailable"; });
})();
