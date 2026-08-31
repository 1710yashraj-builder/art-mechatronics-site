/* ===== /projects — filters and the full-screen viewer =====
   Client, 2026-08-21: the homepage button opens a real page, not a popup, and
   every photograph keeps its own shape there. Clicking one opens it full screen.

   Two rules this obeys:
   - The arrows walk the FILTERED set. If a visitor has narrowed to Dust
     Collection, "next" that jumped into a drying photo would silently undo the
     filter they just set.
   - The filter bar starts hidden and this script unhides it. A filter that
     cannot filter is worse than no filter — and with no JS every photograph is
     on the page already, so nothing is lost.

   Native <dialog>: focus trapping, Esc and the backdrop come from the platform
   rather than from code we would have to keep correct. ===== */
(function () {
  var items = [].slice.call(document.querySelectorAll(".pj-item"));
  if (!items.length) return;

  var TOKEN = (document.querySelector('link[href*="base.css"]') || {}).href || "";
  TOKEN = TOKEN.indexOf("?") > -1 ? "?" + TOKEN.split("?")[1] : "";

  var shots = items.map(function (li) {
    var hit = li.querySelector(".pj-hit");
    var img = li.querySelector("img");
    return {
      li: li,
      id: hit.getAttribute("data-shot"),
      cat: hit.getAttribute("data-cat"),
      title: hit.getAttribute("data-title"),
      alt: img.getAttribute("alt"),
      /* data-full lets other pages (the /infrastructure galleries, 2026-08-31)
         reuse this viewer with their own asset paths; /projects tiles carry no
         data-full and keep the original derived path. */
      full: (hit.getAttribute("data-full") || "assets/projects/v1/full/" + hit.getAttribute("data-shot") + ".webp") + TOKEN,
    };
  });

  /* ---- filters ---- */
  var bar = document.querySelector("[data-pj-filters]");
  var empty = document.querySelector("[data-pj-empty]");
  var active = "All";
  var view = shots.slice();                       // what the arrows walk

  function applyFilter(cat) {
    active = cat;
    view = shots.filter(function (s) { return cat === "All" || s.cat === cat; });
    shots.forEach(function (s) {
      s.li.hidden = !(cat === "All" || s.cat === cat);
    });
    if (empty) empty.hidden = view.length > 0;
    if (bar) [].forEach.call(bar.querySelectorAll(".pj-filter"), function (b) {
      var on = b.getAttribute("data-filter") === cat;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  if (bar) {
    bar.hidden = false;
    [].forEach.call(bar.querySelectorAll(".pj-filter"), function (b) {
      b.setAttribute("aria-pressed", b.classList.contains("is-on") ? "true" : "false");
      b.addEventListener("click", function () { applyFilter(b.getAttribute("data-filter")); });
    });
  }

  /* ---- the viewer ---- */
  var dlg = document.createElement("dialog");
  if (typeof dlg.showModal !== "function") return;   // no dialog: the grid still works
  dlg.className = "gal";
  dlg.innerHTML =
    '<div class="gal__stage">' +
      '<img class="gal__img" alt="">' +
      '<button class="gal__x" type="button" data-gal-close aria-label="Close">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<button class="gal__nav gal__nav--prev" type="button" data-gal-prev aria-label="Previous photo">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>' +
      '<button class="gal__nav gal__nav--next" type="button" data-gal-next aria-label="Next photo">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>' +
      '<div class="gal__bar"><span class="gal__tx"><b class="gal__t"></b><span class="gal__c"></span></span><span class="gal__n"></span></div>' +
    '</div>';
  document.body.appendChild(dlg);

  var imgEl = dlg.querySelector(".gal__img");
  var tEl = dlg.querySelector(".gal__t");
  var cEl = dlg.querySelector(".gal__c");
  var nEl = dlg.querySelector(".gal__n");
  var i = 0, lastFocus = null;

  function show(n) {
    if (!view.length) return;
    i = (n + view.length) % view.length;            // wraps both ways
    var s = view[i];
    imgEl.src = s.full;
    imgEl.alt = s.alt;
    tEl.textContent = s.title;
    cEl.textContent = s.cat;
    nEl.textContent = (i + 1) + " / " + view.length;
  }

  items.forEach(function (li) {
    li.querySelector(".pj-hit").addEventListener("click", function () {
      var id = li.querySelector(".pj-hit").getAttribute("data-shot");
      var n = view.findIndex ? view.findIndex(function (s) { return s.id === id; }) : -1;
      if (n < 0) return;
      lastFocus = document.activeElement;
      show(n);
      dlg.showModal();
    });
  });

  dlg.querySelector("[data-gal-prev]").addEventListener("click", function () { show(i - 1); });
  dlg.querySelector("[data-gal-next]").addEventListener("click", function () { show(i + 1); });
  dlg.querySelector("[data-gal-close]").addEventListener("click", function () { dlg.close(); });
  dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener("close", function () { if (lastFocus && lastFocus.focus) lastFocus.focus(); });
  dlg.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") { e.preventDefault(); show(i + 1); }
    if (e.key === "ArrowLeft")  { e.preventDefault(); show(i - 1); }
  });

  var x0 = null, y0 = null;
  dlg.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  dlg.addEventListener("touchend", function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) show(i + (dx < 0 ? 1 : -1));
    x0 = y0 = null;
  }, { passive: true });
})();
