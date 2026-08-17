/* ===== Process stepper — the 16-step process on one horizontal track =====
   Four demo variants for the client to choose between, driven by two data
   attributes on the section, so all four share ONE implementation:

     data-motion="scroll"  steps advance with the page scroll (visitor-paced)
     data-motion="auto"    steps advance on a timer
     data-len="compact"    one screen, steps move inside a fixed frame

   Live on the homepage since 2026-08-16 with Anurag's real 16 steps and the
   Option 4 he chose (auto + compact). The three unchosen demo pages are gone.

   Design rules this obeys (ui-ux-pro-max):
   - transform/opacity only; never animates width/height/left (perf, no CLS)
   - prefers-reduced-motion: no auto-run, no glide — the rail becomes a plain
     readable list and every step is reachable
   - never hover-only: auto mode pauses on hover AND on touch AND when
     off-screen, and the numbered tabs stay clickable in every variant
   - interruptible: clicking or keying a tab takes control immediately; in
     auto mode that also stops the timer, because fighting a moving carousel
     is the single most complained-about pattern in this family
   - keyboard: the tabs are a real tablist with arrow/Home/End support
   FAIL-OPEN: with no JS the track is a wrapped, readable list of all twelve
   steps — nothing is hidden behind a script that might not run. ===== */
(function () {
  var sec = document.querySelector("[data-proc]");
  if (!sec) return;

  var track = sec.querySelector("[data-proc-track]");
  var panels = [].slice.call(sec.querySelectorAll(".pd-panel"));
  var tabs = [].slice.call(sec.querySelectorAll(".pd-tab"));
  var fill = sec.querySelector("[data-proc-fill]");
  var nowEl = sec.querySelector("[data-proc-now]");
  var phaseEl = sec.querySelector("[data-proc-phase]");
  if (!track || !panels.length) return;

  var motion = sec.dataset.motion || "scroll";
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var N = panels.length;
  var i = 0, taken = false, timer = null;

  // The track is N panels wide and each panel is 1/N of it. Publish the real
  // count to CSS instead of hard-coding it there, so adding or removing a step
  // in the markup can never leave the track mis-sized.
  sec.style.setProperty("--pd-n", N);

  // Script is alive and the browser can animate: switch the CSS from
  // "readable list" to "one horizontal track".
  if (!reduced) sec.classList.add("pd--live");

  /* No phase labels any more: Anurag's document does not group the steps, so
     inventing four phase names would have put words on screen he never wrote.
     phaseEl is absent from the markup; the guard below keeps this safe if a
     future layout adds one back. */

  function show(n) {
    n = Math.max(0, Math.min(N - 1, n));
    if (n === i) return;
    i = n;
    if (!reduced) track.style.transform = "translate3d(" + (-i * (100 / N)) + "%,0,0)";
    panels.forEach(function (p, k) { p.classList.toggle("is-on", k === i); p.setAttribute("aria-hidden", k === i ? "false" : "true"); });
    tabs.forEach(function (t, k) {
      t.classList.toggle("is-on", k === i);
      t.setAttribute("aria-selected", k === i ? "true" : "false");
      t.tabIndex = k === i ? 0 : -1;
    });
    if (fill) fill.style.transform = "scaleX(" + ((i + 1) / N) + ")";
    if (nowEl) nowEl.textContent = (i + 1 < 10 ? "0" : "") + (i + 1);
    revealTab(tabs[i]);
  }

  /* Sixteen tabs do not fit one screen, so the rail scrolls to follow the
     active step. This scrolls the RAIL, not the document: scrollIntoView with
     block:"nearest" also nudges the page vertically when the rail is partly
     out of view, and with a step landing every 3 seconds that reads as the
     page twitching under whoever is reading. Rects, not offsetLeft, so it does
     not depend on which ancestor happens to be positioned. */
  var rail = sec.querySelector(".pd__rail");
  function revealTab(t) {
    if (!rail || !t || rail.scrollWidth <= rail.clientWidth) return;
    var rr = rail.getBoundingClientRect(), tr = t.getBoundingClientRect();
    var want = rail.scrollLeft + (tr.left + tr.width / 2) - (rr.left + rr.width / 2);
    var left = Math.max(0, Math.min(rail.scrollWidth - rail.clientWidth, want));
    if (rail.scrollTo) rail.scrollTo({ left: left, behavior: reduced ? "auto" : "smooth" });
    else rail.scrollLeft = left;
  }

  // ---- tabs: always available, in every variant ----
  tabs.forEach(function (t, k) {
    t.addEventListener("click", function () { taken = true; stopAuto(); show(k); });
    t.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (d) { e.preventDefault(); taken = true; stopAuto(); show(i + d); tabs[i].focus(); }
      if (e.key === "Home") { e.preventDefault(); taken = true; stopAuto(); show(0); tabs[0].focus(); }
      if (e.key === "End") { e.preventDefault(); taken = true; stopAuto(); show(N - 1); tabs[N - 1].focus(); }
    });
  });

  // ---- motion: scroll ----
  if (motion === "scroll" && !reduced) {
    var stage = sec.querySelector("[data-proc-stage]");
    var onScroll = function () {
      var r = sec.getBoundingClientRect();
      var vh = innerHeight;
      var travel = sec.offsetHeight - vh;           // how far the sticky stage rides
      if (travel <= 0) return;
      var p = Math.min(1, Math.max(0, -r.top / travel));
      show(Math.round(p * (N - 1)));
    };
    var ticking = false;
    addEventListener("scroll", function () {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () { ticking = false; onScroll(); });
    }, { passive: true });
    onScroll();
  }

  // ---- motion: auto ----
  function stopAuto() { if (timer) { clearInterval(timer); timer = null; } }
  if (motion === "auto" && !reduced) {
    /* "Is the visitor actually looking at this?" measured against the VIEWPORT,
       not against the section's own height.

       This was an IntersectionObserver at threshold 0.3, and it never fired:
       the section is taller than one screen, so the visible fraction OF THE
       SECTION peaks around 0.4 on a laptop and lower on a phone — on a short
       screen it can never reach 0.3, and the rail would sit frozen on step 01
       forever with nothing in the console to say why. A ratio threshold is the
       wrong instrument for an element bigger than the window.

       The timer already wakes every 3s, so measuring here costs one rect read
       per tick — far too cheap to need an observer, and it cannot latch. */
    var inView = function () {
      var r = sec.getBoundingClientRect();
      var visible = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
      return visible >= Math.min(240, innerHeight * 0.4);
    };
    // Two different things, which the first cut wrongly conflated:
    //   HOVER = temporary pause. Resume when the pointer leaves. Otherwise a
    //           pointer resting anywhere over the section kills the rail for
    //           the whole visit — which is what happened in testing.
    //   CLICK / KEY / TOUCH = the visitor has taken over. Stop for good;
    //           nothing should move under someone who is driving it.
    var hovering = false;
    timer = setInterval(function () {
      if (document.hidden || hovering || taken || !inView()) return;
      show((i + 1) % N);
    }, 3000);   // 3s — client's choice, 2026-08-16
    sec.addEventListener("mouseenter", function () { hovering = true; });
    sec.addEventListener("mouseleave", function () { hovering = false; });
    sec.addEventListener("touchstart", function () { taken = true; stopAuto(); }, { passive: true });
    sec.addEventListener("focusin", function () { taken = true; stopAuto(); });
  }

  /* Prev / next, added at the client's request 2026-08-16. Same contract as a
     tab click: stepping by hand means the visitor has taken over, so the timer
     stops rather than yanking the panel away mid-read. Wraps at both ends so
     neither button is ever a dead control. */
  var prev = sec.querySelector("[data-proc-prev]");
  var next = sec.querySelector("[data-proc-next]");
  function step(d) { taken = true; stopAuto(); show((i + d + N) % N); }
  if (prev) prev.addEventListener("click", function () { step(-1); });
  if (next) next.addEventListener("click", function () { step(1); });

  show(0);
})();
