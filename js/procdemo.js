/* ===== Process stepper — 12 steps on one horizontal track =====
   Four demo variants for the client to choose between, driven by two data
   attributes on the section, so all four share ONE implementation:

     data-motion="scroll"  steps advance with the page scroll (visitor-paced)
     data-motion="auto"    steps advance on a timer
     data-len="phases"     ~3 screens, grouped into 4 named phases
     data-len="compact"    one screen, steps move inside a fixed frame

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

  // Script is alive and the browser can animate: switch the CSS from
  // "readable list" to "one horizontal track".
  if (!reduced) sec.classList.add("pd--live");

  var PHASES = ["Pre-sales", "Engineering", "Production", "After-sales"];
  function phaseOf(n) { return PHASES[Math.min(PHASES.length - 1, Math.floor(n / (N / PHASES.length)))]; }

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
    if (phaseEl) phaseEl.textContent = phaseOf(i);
    tabs[i] && tabs[i].scrollIntoView({ block: "nearest", inline: "center", behavior: reduced ? "auto" : "smooth" });
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
    var onScreen = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { onScreen = !!(es[0] && es[0].isIntersecting); },
        { threshold: 0.3 }).observe(sec);
    }
    // Two different things, which the first cut wrongly conflated:
    //   HOVER = temporary pause. Resume when the pointer leaves. Otherwise a
    //           pointer resting anywhere over the section kills the rail for
    //           the whole visit — which is what happened in testing.
    //   CLICK / KEY / TOUCH = the visitor has taken over. Stop for good;
    //           nothing should move under someone who is driving it.
    var hovering = false;
    timer = setInterval(function () {
      if (document.hidden || !onScreen || hovering || taken) return;
      show((i + 1) % N);
    }, 3800);
    sec.addEventListener("mouseenter", function () { hovering = true; });
    sec.addEventListener("mouseleave", function () { hovering = false; });
    sec.addEventListener("touchstart", function () { taken = true; stopAuto(); }, { passive: true });
    sec.addEventListener("focusin", function () { taken = true; stopAuto(); });
  }

  show(0);
})();
