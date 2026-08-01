/* ===== drawline — the five-stage delivery pipeline, drawn on scroll =====

   Replaces the GSAP + DrawSVGPlugin module the owner supplied. Two reasons,
   both recorded so nobody re-opens them: DrawSVGPlugin is a paid Club GreenSock
   plugin and a licensing exposure on a client's commercial site, and GSAP +
   ScrollTrigger is ~40 KB gzipped for two effects on a page whose hero
   photograph is 31 KB. DrawSVG is a convenience wrapper over exactly what this
   file does by hand: a measured path length, stroke-dasharray and
   stroke-dashoffset.

   THE CONTRACT, and everything below exists to keep it:
   the from-state is written HERE, at arm time, and nowhere else. css/home.css
   contains no stroke-dasharray and no stroke-dashoffset, and never may. With
   this file absent, broken, blocked, still loading, or running in a browser
   that cannot measure a shape, what is on screen is the finished diagram —
   fully drawn, fully readable. The animation is the enhancement; the artwork
   is the page.

   Three things follow from that contract and are not negotiable:
   1. arm() measures EVERY shape before it writes ANY of them. A refusal
      halfway through the list must leave nothing written, or the figure is
      permanently half-invisible with no way back — fig.items would never be
      assigned and restore() would have nothing to undo.
   2. The watchdog and the listeners are installed BEFORE the first sync(), and
      that sync() is wrapped. The invisible from-state must never exist for a
      single frame without the machinery that can take it away again.
   3. standDown() is published on ART.drawline on EVERY path, including the two
      early returns, so a caller on a reduced-motion or .lite device does not
      get a TypeError for asking.

   M2 EXCEPTION, stated honestly rather than glossed: the house rule is animate
   transform and opacity only. stroke-dashoffset is neither — it repaints the
   stroke every frame. The cost is contained on purpose: at most fourteen thin
   strokes inside one band, no filter, no shadow, no blur, no layout read per
   frame, a write skipped whenever the rounded offset has not changed, and no
   rAF loop at all unless the page is actually being scrolled. `.lite` and
   prefers-reduced-motion skip the effect entirely.

   WHAT IS ON SCREEN, PRECISELY — no overclaiming:
   the seed draws to the visitor's real scroll position in the same task as the
   arm, so the resting state is always the diagram AT their position, never a
   blank one. It can only fall behind while they are actively scrolling, and
   that is the one case the watchdog detects and answers with the finished
   artwork.

   SCROLL, NOT CURSOR. The owner asked for the diagram to be "responsive to the
   cursor". The module he supplied is scroll-scrubbed, and so is this. Raised
   in buildNotes rather than silently reinterpreted.
   ===================================================================== */
(function () {
  var ROOT = document.documentElement;

  /* ---------- state (declared first: standDown closes over all of it) ---------- */
  var FIGS = [];
  var stood = false;       /* stood down for good — never re-arms */
  var raf = 0;
  var rt = 0;              /* resize debounce */
  var timer = 0;           /* watchdog interval */
  var mo = null;           /* .lite observer */
  var mq = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : null;

  /* ---------- tuning, all of it in one place ---------- */

  /* Each stroke owns 42% of the scroll range and the starts are spread across
     the remaining 58%. That overlap is what makes it read as one line
     travelling through the diagram rather than N separate reveals. */
  var SPAN = 0.42;

  /* progress 0 when the figure's top edge is 88% of the way down the viewport
     (just arriving, well clear of the 78px sticky header), progress 1 when its
     bottom edge reaches 45% — finished while it is still comfortably on
     screen, never mid-draw as it leaves. */
  var ENTER = 0.88;
  var EXIT = 0.45;

  /* Watchdog. Sampled every 500 ms; a fault has to persist 1000 ms before it
     counts, so a real freeze is corrected inside ~1.5 s — sooner than
     layout.js's own 1600 ms reveal failsafe would have swept the page, and far
     longer than the 200 ms resize debounce or any legitimate catch-up. */
  var WATCH_MS = 500;
  var STALL_MS = 1000;
  var TOL = 0.05;          /* how far off-target counts as "not where it should be" */

  function scrollTop() {
    return window.pageYOffset || ROOT.scrollTop || 0;
  }

  function reduced() { return !!(mq && mq.matches); }
  function lite() { return ROOT.classList.contains("lite"); }

  /* ---------- restore: remove the inline dash properties completely ----------
     removeProperty, not "set it back to none" or "set the offset to 0". An
     inline stroke-dasharray of "none" is still an inline override the
     stylesheet can never outrank; removing it hands the element back to
     css/home.css, which is the finished artwork by definition. */
  function restore(fig) {
    var i, s;
    if (fig.items) {
      for (i = 0; i < fig.items.length; i++) {
        s = fig.items[i].el.style;
        s.removeProperty("stroke-dasharray");
        s.removeProperty("stroke-dashoffset");
        if (!fig.items[i].el.getAttribute("style")) fig.items[i].el.removeAttribute("style");
      }
    }
    fig.items = null;
    fig.live = false;
  }

  /* ---------- stand down for good ----------
     Restores every figure to the finished artwork and removes every listener,
     timer and observer. Called by the watchdog, by a late prefers-reduced-motion
     change, by the .lite toggle, by a thrown frame, by pagehide, and by
     ART.drawline.destroy(). One-way: once the visitor has been given the
     finished diagram, re-arming would take it away again.
     Safe to call before anything is armed — FIGS is [] and every handle is 0. */
  function standDown() {
    var i;
    if (stood) return;
    stood = true;
    for (i = 0; i < FIGS.length; i++) restore(FIGS[i]);
    if (timer) { clearInterval(timer); timer = 0; }
    if (rt) { clearTimeout(rt); rt = 0; }
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    removeEventListener("scroll", onScroll);
    removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisible);
    removeEventListener("pagehide", onPageHide);
    if (mo) { mo.disconnect(); mo = null; }
    if (mq) {
      if (mq.removeEventListener) mq.removeEventListener("change", onMotionChange);
      else if (mq.removeListener) mq.removeListener(onMotionChange);
    }
  }

  /* House extension mechanism: read from ART.*, write back onto ART.* — the
     same shape as ART.picker (layout.js L248) and ART.revealScan (L447).
     Published HERE, above every early return, so that ART.drawline.destroy()
     exists on a reduced-motion device, on a .lite device, and on a page with
     no diagram at all. Previously it was assigned at the bottom and was
     therefore undefined on exactly the three paths a caller is most likely to
     be probing for. window.ART is guarded because js/data.js creates it and a
     blocked data.js must not turn into an uncaught ReferenceError. */
  if (window.ART) window.ART.drawline = { destroy: standDown };

  var nodes = document.querySelectorAll("svg[data-drawline]");
  if (!nodes.length) return;

  /* Both gates are read once here. If either says no we never arm, never write
     an inline style, and return. There is then nothing to restore: the diagram
     the browser already painted from the HTML IS the finished state. */
  if (reduced() || lite()) return;

  /* ---------- the house easing curve, reproduced numerically ----------
     tokens.css --ease is cubic-bezier(.22,.61,.36,1) and it is the ONLY easing
     token on this site. Inventing a second curve in JS would be the first time
     the site had two, so this samples the real one instead. Sampled once, then
     linearly interpolated: x(t) is monotone for 0 <= x1,x2 <= 1, so a table
     lookup is exact enough for a 100-unit stroke and costs nothing per frame.

     Note where the curve is applied: to each stroke's OWN progress, never to
     the scroll-to-progress mapping. The mapping stays 1:1 with the finger — an
     eased scrub desyncs from the scroll and feels like lag. */
  var STEPS = 32;
  var LUTX = new Array(STEPS + 1);
  var LUTY = new Array(STEPS + 1);
  (function buildLut() {
    var i, t, u;
    for (i = 0; i <= STEPS; i++) {
      t = i / STEPS;
      u = 1 - t;
      LUTX[i] = 3 * u * u * t * 0.22 + 3 * u * t * t * 0.36 + t * t * t;
      LUTY[i] = 3 * u * u * t * 0.61 + 3 * u * t * t * 1.00 + t * t * t;
    }
  })();

  function ease(x) {
    if (!(x > 0)) return 0;
    if (x >= 1) return 1;
    var i = 1;
    while (i < STEPS && LUTX[i] < x) i++;
    var span = LUTX[i] - LUTX[i - 1];
    var k = span > 0 ? (x - LUTX[i - 1]) / span : 0;
    return LUTY[i - 1] + (LUTY[i] - LUTY[i - 1]) * k;
  }

  for (var n = 0; n < nodes.length; n++) {
    FIGS.push({
      svg: nodes[n],
      items: null,
      live: false,
      boxW: -1,
      startY: 0,
      endY: 1,
      painted: 0,
      watchP: -1,
      watchY: 0,
      frozenSince: 0
    });
  }

  /* ---------- how long is this shape? ----------
     getTotalLength() on a <path> has worked everywhere for twenty years; on a
     <circle> or a <line> it belongs to SVGGeometryElement, which is newer.
     The diagram needs <line> and <circle> because their coordinates can be
     PERCENTAGES of the rendered box — a <path> `d` attribute cannot take a
     percentage, and percentages are what let one figure stretch from a 267px
     phone column to a 1280px desktop one without a viewBox scaling the labels.
     So the primitive is used and the engine dependency is removed instead:
     both shapes have a length that is one line of arithmetic from their own
     resolved geometry, and baseVal.value hands back user units whether the
     author wrote "10%" or "20".
     Returns -1 for anything it cannot measure, which arm() treats as a refusal
     of the WHOLE figure. */
  function lengthOf(el) {
    var t = el.tagName, dx, dy, v;
    if (typeof el.getTotalLength === "function") {
      try { v = el.getTotalLength(); if (isFinite(v) && v > 0) return v; } catch (e) {}
    }
    if (t === "line" && el.x1 && el.x2) {
      dx = el.x2.baseVal.value - el.x1.baseVal.value;
      dy = el.y2.baseVal.value - el.y1.baseVal.value;
      v = Math.sqrt(dx * dx + dy * dy);
      return isFinite(v) ? v : -1;
    }
    if (t === "circle" && el.r) {
      v = 2 * Math.PI * el.r.baseVal.value;
      return isFinite(v) ? v : -1;
    }
    return -1;
  }

  /* ---------- measure: the ONLY place that reads scroll geometry ----------
     The range is stored as two plain numbers in document coordinates. That is
     not tidiness — it is what lets the watchdog answer "where should this be?"
     from arithmetic alone, with no getBoundingClientRect, no forced layout and
     no animation frame. A setInterval in a backgrounded tab can do arithmetic;
     it cannot usefully measure a page nobody is painting. */
  function measure(fig) {
    var r = fig.svg.getBoundingClientRect();
    var vh = window.innerHeight || ROOT.clientHeight || 0;
    var top = r.top + scrollTop();
    fig.startY = top - vh * ENTER;
    fig.endY = top + r.height - vh * EXIT;
    /* The span works out as figureHeight + viewportHeight * (ENTER - EXIT), so
       on any real page it is positive. It reaches zero only where both terms
       do — a zero-height viewport in a headless or print context — and a
       zero-length range makes every progress reading NaN, which would freeze
       the drawing at its from-state: invisible geometry, silently. Pin a
       floor rather than trust that case never happens. */
    if (!(fig.endY - fig.startY > 1)) {
      fig.endY = fig.startY + Math.max(r.height, vh * 0.5, 1);
    }
  }

  function progressOf(fig, y) {
    var p = (y - fig.startY) / (fig.endY - fig.startY);
    return p < 0 ? 0 : p > 1 ? 1 : p;
  }

  /* ---------- arm: write the from-state ----------
     TWO PASSES, and the split is the whole point. The first pass only reads:
     it decides what is drawable and measures it. The second pass only writes.
     Nothing can therefore refuse after some elements have already been hidden.
     The earlier single-pass version returned false from inside the loop with
     two strokes already dashed to full offset, fig.items still null, and
     restore() a no-op over it — a permanently half-invisible diagram with no
     recovery path and nothing in the console. Reproduced before it was fixed.

     Returns false if there is nothing safe to draw, in which case the figure is
     left exactly as the HTML authored it: the finished artwork. */
  function arm(fig) {
    var els = fig.svg.querySelectorAll("[data-draw]");
    var plan = [], items = [];
    var i, el, cs, w, len, off;

    /* ---- pass 1: read only ---- */
    for (i = 0; i < els.length; i++) {
      el = els[i];
      cs = getComputedStyle(el);

      /* Hidden geometry has no from-state worth writing, and its measured
         length is meaningless. */
      if (cs.display === "none" || cs.visibility === "hidden") continue;

      /* No stroke means nothing to draw — dashing it does nothing but leave an
         inline style to clean up later. This is also what keeps the labels
         safe without a selector anyone has to remember: <text> computes
         stroke: none, so it can never be picked up here. The static hairline
         rules between rows are excluded a second way, by not carrying
         data-draw at all. */
      if (!cs.stroke || cs.stroke === "none") continue;

      w = parseFloat(cs.strokeWidth);
      if (!(w > 0)) continue;

      len = lengthOf(el);

      /* Unmeasurable is an ENVIRONMENT fault, not a degenerate shape — an
         engine we did not anticipate, or a <g>/<rect> somebody added to the
         draw list. Bail on the whole figure rather than ship a diagram where
         the rings draw and the connectors do not. All or nothing is the only
         honest degradation here, and because this is pass 1 it costs nothing. */
      if (len < 0) return false;

      /* A degenerate shape (a zero-length line, a collapsed circle) draws as
         nothing at any offset; dashing it only risks a stray cap artefact. */
      if (!(len > 0.5)) continue;

      plan.push({ el: el, len: len });
    }

    if (!plan.length) return false;

    /* ---- pass 2: the ONLY place this file writes an inline style ---- */
    for (i = 0; i < plan.length; i++) {
      off = plan[i].len.toFixed(2);
      plan[i].el.style.strokeDasharray = off + " " + off;
      plan[i].el.style.strokeDashoffset = off;
      items.push({ el: plan[i].el, len: plan[i].len, shown: 0, last: off });
    }

    fig.items = items;
    fig.boxW = fig.svg.getBoundingClientRect().width;
    fig.painted = 0;
    fig.watchP = -1;
    fig.watchY = scrollTop();
    fig.frozenSince = 0;
    fig.live = true;
    return true;
  }

  /* ---------- paint ----------
     `enableOnly` is the seed's guarantee: it may draw MORE than is already on
     screen, never less. Today arm() runs immediately before the seed in the
     same task, so an item's `shown` is always 0 when the seed arrives and the
     clamp is a no-op — it is here so that a future refactor that moves the
     seed behind an async callback cannot re-hide a diagram the visitor has
     already read. Scrubbing itself is NOT enable-only: scrolling back up must
     un-draw, or it is not a scrub. */
  function paint(fig, p, enableOnly) {
    var items = fig.items;
    if (!items) return;
    var count = items.length;
    var spread = count > 1 ? (1 - SPAN) / (count - 1) : 0;
    var i, it, local, s;

    for (i = 0; i < count; i++) {
      it = items[i];
      /* Document order IS stagger order. The artwork is authored ring 01,
         riser, rail, ring 02, riser, rail … so the cascade cannot drift away
         from the drawing it belongs to.

         p >= 1 is short-circuited rather than left to the clamp. The last
         item's window is [(count-1)*spread, 1], and (count-1)*spread does not
         land on exactly 1 - SPAN in binary — so at p === 1 the arithmetic
         returns 0.99999999 and the final stroke never formally completes. It
         rounds to a finished pixel today, which is exactly the kind of "works
         by accident" that breaks the day someone changes SPAN. */
      local = p >= 1 ? 1 : (p - i * spread) / SPAN;
      local = local < 0 ? 0 : local > 1 ? 1 : local;
      local = ease(local);
      if (enableOnly && local < it.shown) local = it.shown;
      it.shown = local;
      s = (it.len * (1 - local)).toFixed(2);
      /* Skip identical writes: a scroll of two pixels moves most strokes by
         less than a hundredth of a unit, and every write invalidates the
         stroke's paint whether the pixels changed or not. */
      if (s !== it.last) {
        it.last = s;
        it.el.style.strokeDashoffset = s;
      }
    }
    fig.painted = p;
  }

  /* ---------- sync: arm what is laid out, release what is not ----------
     The section ships THREE figures — five-across, five wide rows, and five
     narrow rows — and CSS shows exactly one at a time. A display:none figure
     measures as a zero rect, which would give it a nonsense range, so it is
     never armed; and if the breakpoint flips under a live figure it is handed
     its finished artwork back before it disappears, so it can never reappear
     frozen mid-draw.

     The width check is not cosmetic. The geometry is authored in percentages
     of the rendered box precisely so it can stretch without a viewBox, which
     means every measured length is only true for the width it was measured at.
     A figure that survives a horizontal resize with stale lengths draws to the
     wrong offsets — visibly short or visibly overshooting. Re-arming inside
     the same task means restore() and arm() are never separated by a paint, so
     nothing flashes. */
  function sync() {
    var i, fig, bw;
    if (stood) return;
    for (i = 0; i < FIGS.length; i++) {
      fig = FIGS[i];

      if (!fig.svg.getClientRects().length) {
        if (fig.live) restore(fig);
        continue;
      }

      if (fig.live) {
        bw = fig.svg.getBoundingClientRect().width;
        if (Math.abs(bw - fig.boxW) > 0.5) restore(fig);   // width changed -> lengths are stale
      }

      if (!fig.live) {
        /* SYNCHRONOUS SEED. arm() writes the from-state and the seed draws to
           the real scroll position in the SAME task — the browser never gets a
           chance to paint between the two, so the from-state is never on
           screen on its own. A figure already scrolled past therefore starts
           complete instead of waiting for an IntersectionObserver callback
           that, in a hidden or throttled tab, may never arrive. */
        if (arm(fig)) {
          measure(fig);
          paint(fig, progressOf(fig, scrollTop()), true);
        }
      } else {
        measure(fig);
        paint(fig, progressOf(fig, scrollTop()), false);
      }
    }
  }

  /* Every entry point that can touch the from-state goes through this. A throw
     anywhere inside — a getComputedStyle fault, an engine quirk in
     getClientRects, an exception thrown into a frame — must end with the
     finished diagram on screen, not with invisible geometry and a dead loop. */
  function guarded(fn) {
    try { fn(); } catch (e) { standDown(); }
  }

  /* ---------- the scroll scrub ----------
     One passive listener, rAF-throttled, and no idle loop: when nothing is
     scrolling there is no frame scheduled at all. layout.js already installs a
     passive scroll listener per marquee rail; this adds exactly one more, and
     it does no work of its own beyond asking for a frame. */
  function frame() {
    raf = 0;
    guarded(function () {
      var y = scrollTop(), i;
      for (i = 0; i < FIGS.length; i++) {
        if (FIGS[i].live) paint(FIGS[i], progressOf(FIGS[i], y), false);
      }
    });
  }

  function onScroll() {
    if (!raf && !stood) raf = requestAnimationFrame(frame);
  }

  /* Debounced at 200 ms, the same number layout.js uses for the marquee
     re-measure. A resize can move the figure, change the viewport height the
     range is built from, change the box width every percentage coordinate
     resolves against, AND flip the breakpoint that decides which figure is on
     screen — sync() handles all four. */
  function onResize() {
    clearTimeout(rt);
    rt = setTimeout(function () { rt = 0; guarded(sync); }, 200);
  }

  /* Returning from a hidden tab: rAF was suspended, so the last painted offset
     may be far behind the scroll position the visitor left at. One sync puts
     it right before the watchdog has a chance to call it a fault. */
  function onVisible() {
    if (!document.hidden) guarded(sync);
  }

  /* Back/forward cache keeps the live DOM, inline styles included. Leaving
     mid-scrub and pressing Back would otherwise restore a diagram frozen at
     whatever offset it held, with no scroll event guaranteed to correct it.
     Handing back the finished artwork on the way out is the safe resting
     state; pageshow re-arms from there. */
  function onPageHide() {
    var i;
    for (i = 0; i < FIGS.length; i++) restore(FIGS[i]);
  }

  function onPageShow(e) {
    if (e && e.persisted) guarded(sync);
  }

  /* ---------- the watchdog ----------
     setInterval is the only clock that stays alive in a hidden tab:
     requestAnimationFrame stops and IntersectionObserver callbacks stop with
     it. If the scrub dies for any reason — a frame loop that never resumed
     after a tab switch, an engine that throttled rAF to nothing, an exception
     somewhere upstream — the geometry would sit at a stale offset while the
     page moved on, and at the extreme that offset is INVISIBLE. That failure
     is silent and it is the one this watches for.

     Three conditions must hold together before it acts, so that a paused loop
     on a still page is never mistaken for a fault:
       1. the drawing has not advanced at all since the last sample,
       2. the page HAS moved since the last sample (a real lag, not a rest),
       3. the drawing is meaningfully away from where the scroll says it is.
     Sustained for STALL_MS, that is a freeze, and the answer is the finished
     artwork — never a half-drawn diagram left on a buyer's screen.

     Known and accepted: a still page cannot be distinguished from a rest, so a
     visitor who stops scrolling mid-range with a dead rAF keeps the diagram at
     their own scroll position. That is the correct drawing for where they are
     standing, and the labels are readable either way; it only becomes wrong
     once they move, which is exactly when this trips. */
  function watch() {
    var i, fig, y, now, advanced, scrolled;
    if (stood) return;
    y = scrollTop();
    now = Date.now();
    for (i = 0; i < FIGS.length; i++) {
      fig = FIGS[i];
      if (!fig.live) continue;
      advanced = fig.painted !== fig.watchP;
      scrolled = Math.abs(y - fig.watchY) > 8;
      fig.watchP = fig.painted;
      fig.watchY = y;
      if (advanced || !scrolled || Math.abs(progressOf(fig, y) - fig.painted) <= TOL) {
        fig.frozenSince = 0;
        continue;
      }
      if (!fig.frozenSince) { fig.frozenSince = now; continue; }
      if (now - fig.frozenSince >= STALL_MS) { standDown(); return; }
    }
  }

  /* ---------- late preference changes ----------
     layout.js checks prefers-reduced-motion once, at init, and never again
     (L364). That is defensible for a marquee; it is not for an effect that can
     leave content invisible. A visitor who turns the preference ON mid-page
     gets the finished diagram immediately.

     Turning it OFF mid-page deliberately does nothing. Arming then would hide
     a diagram they have already read, which is worse than missing an
     animation. Same reasoning for .lite. */
  function onMotionChange() {
    if (reduced()) standDown();
  }

  /* ---------- go ----------
     ORDER MATTERS AND IS THE POINT. Every rescue mechanism is installed BEFORE
     the first sync(), because sync() is what writes the invisible from-state.
     Installed after it, a throw inside that first call would leave nine to
     fourteen invisible strokes on the page with no scroll listener, no
     watchdog and no way back. */
  if (mq) {
    if (mq.addEventListener) mq.addEventListener("change", onMotionChange);
    else if (mq.addListener) mq.addListener(onMotionChange);
  }

  /* .lite is toggled on <html> by the footer button in layout.js L127-140 with
     no event, no callback and no custom event — every other consumer is pure
     CSS, which re-evaluates for free. This and count.js are the first JS
     consumers on the site, so they have to watch the attribute themselves.
     MutationObserver is not used anywhere else in js/, hence the feature test. */
  if ("MutationObserver" in window) {
    mo = new MutationObserver(function () { if (lite()) standDown(); });
    mo.observe(ROOT, { attributes: true, attributeFilter: ["class"] });
  }

  timer = setInterval(watch, WATCH_MS);
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisible);
  addEventListener("pagehide", onPageHide);
  addEventListener("pageshow", onPageShow);

  /* Scripts sit at the end of <body>, so the section above has been parsed and
     laid out and this first sync() is a real synchronous seed, not a guess. */
  guarded(sync);

  /* Re-measure once the page has settled. The header and footer are injected
     by layout.js and the hero art may still be decoding, either of which can
     move this section down the page after the first measurement. Monda is
     font-display:swap, so the headings above can also change height when the
     real face lands — `load` does not wait for that, document.fonts.ready
     does. sync() re-derives the range and, if the box width moved with it,
     re-measures the lengths too. Never re-hides anything. */
  function settle() { if (!stood) guarded(sync); }
  if (document.readyState === "complete") settle();
  else addEventListener("load", settle, { once: true });
  if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === "function") {
    document.fonts.ready.then(settle, settle);
  }
})();
