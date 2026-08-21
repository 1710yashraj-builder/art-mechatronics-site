/* ===== Project gallery — every project photo, full screen =====
   Client, 2026-08-21: "View all recent project photos" opens the full set, and
   clicking any card opens the gallery at that photo.

   Built the same way as the tile popup: a native <dialog>, so focus trapping,
   Esc and the backdrop come from the platform instead of from code we would
   have to keep correct. The dialog is created here rather than authored into
   the page — it is an empty shell only this file ever fills, and a static copy
   would have to be repeated in the markup and kept in step.

   FAIL-OPEN: the button starts hidden and this script unhides it, so a visitor
   whose script never runs is never shown a control that does nothing. They lose
   nothing — with no JS the marquee falls back to a wrapped grid and all thirty
   photos are on the page already. ===== */
(function () {
  var hits = [].slice.call(document.querySelectorAll("[data-shot]"));
  if (!hits.length) return;

  var BASE = document.body.dataset.base || "";
  var TOKEN = (document.querySelector('link[href*="base.css"]') || {}).href || "";
  TOKEN = TOKEN.indexOf("?") > -1 ? "?" + TOKEN.split("?")[1] : "";

  /* One list, in the order the rails present them: the top rail first, then
     the bottom. Read from the DOM so the gallery can never disagree with the
     page — no second copy of the running order to keep in step. */
  var shots = hits.map(function (h) {
    var img = h.querySelector("img");
    var cat = h.querySelector(".rp-card__cat");
    var ttl = h.querySelector(".rp-card__h");
    return {
      id: h.getAttribute("data-shot"),
      full: BASE + "assets/projects/v1/full/" + h.getAttribute("data-shot") + ".webp" + TOKEN,
      alt: img ? img.getAttribute("alt") : "",
      cat: cat ? cat.textContent.trim() : "",
      title: ttl ? ttl.textContent.trim() : "",
    };
  });

  var dlg = document.createElement("dialog");
  if (typeof dlg.showModal !== "function") return;      // no dialog support: leave the page as it is
  dlg.className = "gal";
  dlg.innerHTML =
    '<div class="gal__stage">' +
      '<img class="gal__img" alt="">' +
      '<button class="gal__x" type="button" data-gal-close aria-label="Close gallery">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<button class="gal__nav gal__nav--prev" type="button" data-gal-prev aria-label="Previous photo">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>' +
      '<button class="gal__nav gal__nav--next" type="button" data-gal-next aria-label="Next photo">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>' +
      '<div class="gal__bar">' +
        '<span class="gal__tx"><b class="gal__t"></b><span class="gal__c"></span></span>' +
        '<span class="gal__n"></span>' +
      '</div>' +
    '</div>';
  document.body.appendChild(dlg);

  var imgEl = dlg.querySelector(".gal__img");
  var titleEl = dlg.querySelector(".gal__t");
  var catEl = dlg.querySelector(".gal__c");
  var numEl = dlg.querySelector(".gal__n");
  var i = 0, lastFocus = null;

  function show(n) {
    i = (n + shots.length) % shots.length;          // wraps both ways: no dead arrow
    var s = shots[i];
    imgEl.src = s.full;
    imgEl.alt = s.alt;
    titleEl.textContent = s.title;
    catEl.textContent = s.cat;
    numEl.textContent = (i + 1) + " / " + shots.length;
  }

  function open(n) {
    lastFocus = document.activeElement;
    show(n);
    dlg.showModal();
  }

  hits.forEach(function (h, k) {
    h.addEventListener("click", function () { open(k); });
  });

  var openBtn = document.querySelector("[data-gallery-open]");
  if (openBtn) {
    openBtn.hidden = false;                          // the script is alive; the control is real
    openBtn.addEventListener("click", function () { open(0); });
  }

  dlg.querySelector("[data-gal-prev]").addEventListener("click", function () { show(i - 1); });
  dlg.querySelector("[data-gal-next]").addEventListener("click", function () { show(i + 1); });
  dlg.querySelector("[data-gal-close]").addEventListener("click", function () { dlg.close(); });
  dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener("close", function () { if (lastFocus && lastFocus.focus) lastFocus.focus(); });
  dlg.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") { e.preventDefault(); show(i + 1); }
    if (e.key === "ArrowLeft")  { e.preventDefault(); show(i - 1); }
  });

  /* Swipe, because on a phone that is how people move through photos. Only a
     clearly horizontal drag counts, or a vertical scroll would flick the photo. */
  var x0 = null, y0 = null;
  dlg.addEventListener("touchstart", function (e) {
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  dlg.addEventListener("touchend", function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) show(i + (dx < 0 ? 1 : -1));
    x0 = y0 = null;
  }, { passive: true });
})();
