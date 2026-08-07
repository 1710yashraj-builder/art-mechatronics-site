/* ===== Homepage: 12-step process tabs + recent-projects carousel =====
   Both enhancements follow the house fail-open law:
   - The process section ships with every step stacked and readable. This file
     adds .proc--tabs (CSS then shows one panel at a time) and wires the rail
     as a real tablist. Script dead => all twelve steps, still complete.
   - The projects track is a native scroll-snap list that works by touch and
     trackpad on its own. This file only reveals the arrows + counter
     (.rp--live) and drives them. Script dead => no dead controls (vault D2).
   No timers, no auto-advance (vault M1): every movement is the visitor's. ===== */
(function () {
  /* ---------- process tabs ---------- */
  var proc = document.querySelector(".proc");
  if (proc) {
    var tabs = [].slice.call(proc.querySelectorAll(".proc__tab"));
    var panels = [].slice.call(proc.querySelectorAll(".proc__panel"));
    if (tabs.length === 12 && panels.length === 12) {
      proc.classList.add("proc--tabs");
      var current = 0;
      var select = function (n, focus) {
        n = (n + 12) % 12;
        tabs[current].classList.remove("is-on");
        tabs[current].setAttribute("aria-selected", "false");
        panels[current].classList.remove("is-on");
        current = n;
        tabs[current].classList.add("is-on");
        tabs[current].setAttribute("aria-selected", "true");
        panels[current].classList.add("is-on");
        tabs[current].scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
        if (focus) tabs[current].focus({ preventScroll: true });
      };
      tabs.forEach(function (t, i) {
        t.addEventListener("click", function () { select(i, false); });
        t.addEventListener("keydown", function (e) {
          if (e.key === "ArrowRight") { e.preventDefault(); select(current + 1, true); }
          if (e.key === "ArrowLeft")  { e.preventDefault(); select(current - 1, true); }
          if (e.key === "Home") { e.preventDefault(); select(0, true); }
          if (e.key === "End")  { e.preventDefault(); select(11, true); }
        });
      });
    }
  }

  /* ---------- recent projects carousel ---------- */
  var sec = document.getElementById("recent-projects");
  if (!sec) return;
  var track = sec.querySelector("[data-rp-track]");
  var ctrl = sec.querySelector("[data-rp-ctrl]");
  if (!track || !ctrl) return;
  var cards = [].slice.call(track.children);
  if (cards.length < 2) return;
  sec.classList.add("rp--live");

  var now = sec.querySelector("[data-rp-now]");
  var step = function () {
    var r = cards[1].getBoundingClientRect();
    return r.left - cards[0].getBoundingClientRect().left; // card width + gap
  };
  sec.querySelector("[data-rp-prev]").addEventListener("click", function () {
    track.scrollBy({ left: -step(), behavior: "smooth" });
  });
  sec.querySelector("[data-rp-next]").addEventListener("click", function () {
    track.scrollBy({ left: step(), behavior: "smooth" });
  });
  var update = function () {
    var i = Math.round(track.scrollLeft / step());
    i = Math.max(0, Math.min(cards.length - 1, i));
    now.textContent = (i + 1 < 10 ? "0" : "") + (i + 1);
  };
  var raf = 0;
  track.addEventListener("scroll", function () {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; update(); });
  }, { passive: true });
  update();
})();
