/* ===== Home — counting numbers (credentials band) =========================
   Rebuilt in plain JS from a supplied GSAP module. No dependency, no network,
   no library: the whole effect is one text node, one rAF loop and one observer.

   THE RULE EVERYTHING ELSE SERVES
   The authored number in index.html IS the finished number. In
   `<b data-count>30<span>+</span></b>` that "30" is what ships, what Google
   crawls, what a screen reader reads and what a visitor sees with JS off,
   blocked, broken, or still downloading. This file borrows the number for
   1.4 seconds and gives it back byte for byte. Every exit — normal end, hidden
   tab, reduced motion, .lite, a width change, back/forward cache, a thrown
   frame — goes through finish(), which rewrites the authored string whether or
   not it believes it needs to. There is no `>0<` in the markup and never will be.

   WHY THIS WRITES A TEXT NODE AND NOT textContent
   The module this replaces refuses any element that has element children,
   because it assigns `el.textContent` — that deletes the children and there is
   nothing left to put back. Our markup is exactly the shape it refuses: the
   "+" is a real <span> inside the <b> (home.css colours it var(--accent)), and
   "20K" is not an integer.
   Restructuring the markup — giving the digits their own <span> — satisfies
   the refusal without removing its cause. It just hands the destructive write
   a victim with no children, and it costs four HTML edits plus a CSS override
   to undo the `.stat-band__grid b span { color: var(--accent) }` rule that
   would then paint the number blue.
   Writing `node.data` removes the cause. A Text node has no children and
   cannot reach a sibling, so the <span>+</span> is untouchable by
   construction — the element children the module was afraid of are the one
   thing this physically cannot damage, and the restore is a single assignment
   of a string we still hold.
   The refusal is kept, moved down one level: an element carrying two or more
   non-empty text nodes is skipped, because then "the number" is not one string
   and could not be handed back as one.

   HOUSE STANDARDS
   M1 — this is the "rare / first-time" row: a marketing band, seen once per
        session, never a control anyone operates. Motion is allowed here.
   M2 — STATED EXCEPTION, not a dodge. This animates a text node's data, which
        is a layout-affecting write, not transform/opacity. It is contained
        three ways: the <b> is width-locked before the first character changes
        so the box cannot resize and nothing beside it can reflow;
        white-space:nowrap means the line cannot rewrap; and a frame is only
        written when the rendered string actually differs. Measured at 60fps,
        the band's four numbers cost 31 + 21 + 38 + 31 = 121 text writes in
        total across the whole 1.4s, against the 340 frames those four elements
        are handed. Nothing else on the page is touched.
        (`font-variant-numeric: tabular-nums` is set in home.css and is honest
        insurance rather than the load-bearing part: Monda's digits already
        share one advance width, so the lock is what actually matters and the
        feature only earns its keep on the fallback faces.)
   M3 — nothing here is focusable; no focus state to own.
   M4 — .lite is honoured at init AND live, via a MutationObserver on <html>
        (the footer toggle changes the class with no event to listen to).
   P4 — zero dependencies. GSAP + ScrollTrigger would have been ~40 KB gzipped
        on a page whose hero photograph is 31 KB.

   Exposed as ART.counters — see the bottom of the file.
   ========================================================================= */
(function () {
  const ROOT = document.documentElement;
  const REDUCE = "(prefers-reduced-motion: reduce)";

  /* matchMedia is feature-detected rather than assumed. drawline.js does the
     same; layout.js L364 calls it bare, which is a latent throw this file does
     not copy. A missing matchMedia means "no stated preference", which is the
     same answer the API would give. */
  const mqReduce = window.matchMedia ? matchMedia(REDUCE) : null;
  const reduced = () => !!(mqReduce && mqReduce.matches);

  /* Durations. The site has no duration token — every one is hard-coded per
     rule (.18s micro, .45s image, .7s reveal, 1600ms reveal failsafe), so
     these join that list rather than inventing a second scale. 1400ms is twice
     the .reveal duration on purpose: a reveal only has to be noticed, a number
     has to be READ, and under about a second the digits are a blur rather than
     a claim. GRACE is the failsafe's margin over the animation's own length. */
  const DURATION = 1400;
  const GRACE = 600;

  /* Trigger geometry. The bottom margin matches layout.js's reveal observer
     exactly, so the band and every other entrance on the site agree about what
     "on screen" means. The threshold deliberately does not: 0.12 is right for
     a card, but a number that starts counting when 12% of it is showing spends
     most of the count below the fold. */
  const THRESHOLD = 0.6;
  const BOTTOM_PCT = 8;

  /* The numeric core of an authored string: starts and ends on a digit, so any
     separator inside it is internal and there is no trailing-comma case to
     handle. Only "," and "." are recognised as separators — a number written
     with thin or non-breaking spaces ("1 20 000") parses short, is refused by
     the digit-outside-the-core test below, and is left alone. */
  const NUM = /[0-9][0-9.,]*[0-9]|[0-9]/;

  /* ---------- easing ----------
     cubic-bezier(.22,.61,.36,1) — tokens.css --ease, the only easing token on
     the site. Reproduced numerically rather than approximated, because a
     second easing invented in JS would be the first time this site had two.
     Newton-Raphson with a bisection fallback, the standard solver. */
  const EASE = (function () {
    const X1 = .22, Y1 = .61, X2 = .36, Y2 = 1;
    const A = (a, b) => 1 - 3 * b + 3 * a;
    const B = (a, b) => 3 * b - 6 * a;
    const C = (a) => 3 * a;
    const at = (t, a, b) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t;
    const slope = (t, a, b) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a);
    return (x) => {
      if (!(x > 0)) return 0;      // also catches NaN
      if (x >= 1) return 1;        // t = 1 must return exactly 1, not 0.9999
      let t = x;
      for (let i = 0; i < 8; i++) {
        const e = at(t, X1, X2) - x;
        if (Math.abs(e) < 1e-7) break;
        const d = slope(t, X1, X2);
        if (Math.abs(d) < 1e-7) break;
        t -= e / d;
      }
      if (!(t >= 0) || t > 1) {
        let lo = 0, hi = 1;
        t = x;
        for (let i = 0; i < 24; i++) {
          const v = at(t, X1, X2);
          if (Math.abs(v - x) < 1e-7) break;
          if (v > x) hi = t; else lo = t;
          t = (lo + hi) / 2;
        }
      }
      return at(t, Y1, Y2);
    };
  })();

  /* ---------- state ---------- */
  const items = [];
  const cleanups = [];
  let io = null;
  let dead = false;     // reduced motion / .lite / destroy — never animate again

  /* ---------- parsing ---------- */

  /* The designated text node: exactly one non-empty Text child. Whitespace-only
     nodes are ignored (they survive untouched inside prefix/suffix); two real
     ones are a refusal, per the note at the top of the file. */
  const textNodeOf = (el) => {
    let found = null;
    for (let n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType !== 3 || !/\S/.test(n.data)) continue;
      if (found) return null;
      found = n;
    }
    return found;
  };

  /* Everything about the number comes out of the authored string: its value,
     its decimals, its prefix and suffix, and its grouping convention. Nothing
     is read from the visitor's locale — a German browser must not render
     1.20.000 halfway through a count of an Indian figure. */
  const parse = (el) => {
    if (typeof Intl === "undefined" || !Intl.NumberFormat) return null;
    const node = textNodeOf(el);
    if (!node) return null;

    const raw = node.data;
    const m = raw.match(NUM);
    if (!m) return null;
    const core = m[0];
    const prefix = raw.slice(0, m.index);
    const suffix = raw.slice(m.index + core.length);

    /* The core has to BE the number, not merely the first number in the string.
       "1 20 000" matches its leading "1" and nothing else — the thin/no-break
       space grouping this file deliberately does not recognise leaves "20 000"
       stranded in the suffix — and the proof below would then happily certify
       that counting to 1 lands on "1", while the visitor watched "0 20 000"
       sit on the page. Any digit outside the match means this is not one
       number, so it is not ours to animate. Found in a real browser run; the
       whole equality proof was blind to it. */
    if (/[0-9]/.test(prefix) || /[0-9]/.test(suffix)) return null;

    /* Which separator is which, decided from the string and nothing else.
       Both present  -> the LAST one is the decimal point (the universal rule).
       Only commas   -> grouping. A lone comma on an English site is "20,000",
                        never a decimal comma.
       Only dots     -> more than one can only be grouping ("1.20.000"); a
                        single dot is a decimal point ("99.5"). */
    const lastComma = core.lastIndexOf(",");
    const lastDot = core.lastIndexOf(".");
    let groupSep = "", decSep = "";
    if (lastComma >= 0 && lastDot >= 0) {
      if (lastDot > lastComma) { decSep = "."; groupSep = ","; }
      else { decSep = ","; groupSep = "."; }
    } else if (lastComma >= 0) {
      groupSep = ",";
    } else if (lastDot >= 0) {
      if (core.split(".").length > 2) groupSep = "."; else decSep = ".";
    }

    let intPart = core, fracPart = "";
    if (decSep) {
      const i = core.lastIndexOf(decSep);
      intPart = core.slice(0, i);
      fracPart = core.slice(i + 1);
    }
    if (fracPart && !/^[0-9]+$/.test(fracPart)) return null;
    const dec = fracPart.length;

    const groups = groupSep ? intPart.split(groupSep) : [intPart];
    for (let i = 0; i < groups.length; i++) if (!/^[0-9]+$/.test(groups[i])) return null;

    /* Indian grouping is inferred from the shape of the authored string: with
       three or more groups, a two-digit second-from-last group ("1,20,000") is
       the lakh/crore convention and nothing else. With exactly two groups the
       two conventions are identical for every value at or below the final one,
       so there is nothing to infer and en-US is used. */
    const grouped = groups.length > 1;
    const locale = (groups.length >= 3 && groups[groups.length - 2].length === 2)
      ? "en-IN" : "en-US";

    let nf;
    try {
      nf = new Intl.NumberFormat(locale, {
        useGrouping: grouped,
        minimumFractionDigits: dec,
        maximumFractionDigits: dec
      });
    } catch (e) { return null; }

    /* en-US and en-IN both emit "," for groups and "." for the decimal point.
       Anything the author wrote differently is swapped back afterwards, via a
       token so the two replacements cannot collide. */
    const render = (v) => {
      let s = nf.format(v);
      const swap = groupSep && groupSep !== ",";
      if (swap) s = s.split(",").join(" ");
      if (decSep && decSep !== ".") s = s.split(".").join(decSep);
      if (swap) s = s.split(" ").join(groupSep);
      return s;
    };

    const value = parseFloat(groups.join("") + (dec ? "." + fracPart : ""));
    if (!isFinite(value) || value <= 0) return null;

    /* THE PROOF. The counter is only allowed to run if it can already
       demonstrate that its last frame reproduces the authored string exactly.
       A missing Intl locale, a rounding surprise, a value past float
       precision — any of them fail here and the number is simply never
       touched. This is why "the final number is the authored DOM text" is a
       guarantee and not an intention. */
    if (render(value) !== core) return null;

    return {
      el: el, node: node, raw: raw, prefix: prefix, suffix: suffix,
      value: value, render: render,
      label: el.textContent,                       // "30+" — the whole authored group
      role: el.getAttribute("role"),               // authored attributes, restored verbatim
      aria: el.getAttribute("aria-label"),
      t0: -1, last: "", raf: 0, timer: 0,
      running: false, done: false
    };
  };

  const itemFor = (el) => {
    for (let i = 0; i < items.length; i++) if (items[i].el === el) return items[i];
    return null;
  };

  /* ---------- geometry ----------
     One definition of "on screen", used by both the observer's synchronous
     seed and the return-from-hidden-tab resume, so the two can never disagree. */
  const inView = (el) => {
    const r = el.getBoundingClientRect();
    if (r.height <= 0) return false;
    const vh = window.innerHeight || ROOT.clientHeight || 0;
    const floor = vh * (1 - BOTTOM_PCT / 100);
    const shown = Math.min(r.bottom, floor) - Math.max(r.top, 0);
    return shown / r.height >= THRESHOLD;
  };

  /* ---------- the only exit ----------
     Idempotent, and it never asks whether a step actually happened: it undoes
     everything unconditionally. Called by the normal end, the wall-clock
     failsafe, a width change, a reduced-motion change, the .lite toggle,
     pagehide and destroy(). */
  const finish = (item) => {
    if (item.done) return;
    item.done = true;
    item.running = false;
    if (item.raf) { cancelAnimationFrame(item.raf); item.raf = 0; }
    if (item.timer) { clearTimeout(item.timer); item.timer = 0; }

    if (item.node.data !== item.raw) item.node.data = item.raw;

    item.el.style.removeProperty("width");
    if (!item.el.getAttribute("style")) item.el.removeAttribute("style");

    if (item.role === null) item.el.removeAttribute("role");
    else item.el.setAttribute("role", item.role);
    if (item.aria === null) item.el.removeAttribute("aria-label");
    else item.el.setAttribute("aria-label", item.aria);

    if (io) io.unobserve(item.el);
  };

  const finishRunning = () => {
    for (let i = 0; i < items.length; i++) if (items[i].running) finish(items[i]);
  };
  const finishAll = () => {
    for (let i = 0; i < items.length; i++) finish(items[i]);
  };

  /* ---------- the count ---------- */
  const start = (item) => {
    if (dead || item.done || item.running) return;

    /* Refuse to start in a hidden tab. rAF does not run there, so the number
       would sit on its authored value and then be "finished" by the failsafe —
       motion nobody saw, paid for anyway. Nothing is recorded about the
       refusal because nothing needs to be: the item is still un-started and
       still observed, and seed() re-tests it on visibilitychange. That resume
       is not optional — an IntersectionObserver reports CHANGES, so having
       already reported this element as intersecting it will never mention it
       again, and seed() is the only thing that would ever start it. */
    if (document.hidden) return;
    item.running = true;

    /* FAILSAFE FIRST — armed before a single character or pixel is touched, so
       it already covers every line below it, including its own set-up. Both of
       the things that drive this effect die in a background tab: rAF stops,
       and IntersectionObserver stops delivering. setTimeout is throttled there
       but still fires, so this is the one clock that survives. */
    item.timer = setTimeout(() => finish(item), DURATION + GRACE);

    /* ARIA shield. For the second and a bit that the digits are wrong, the <b>
       is one image announced as the authored value — "30+" — rather than a
       screen reader narrating 7, 13, 21. Removed again by finish(). */
    if (item.label) {
      item.el.setAttribute("role", "img");
      item.el.setAttribute("aria-label", item.label);
    }

    /* WIDTH LOCK, measured from the finished number that is still on screen at
       this instant — this runs before the first frame is written, so what gets
       measured is the authored value, not an intermediate. The <b> is a flex
       item of `.stat-band__grid li` and is therefore blockified and
       shrink-wrapped by align-items:center; an explicit px width is what pins
       it, and `display:inline-block` would be inert here (a flex item's
       display is blockified by the spec), which is why home.css does not
       bother to set it.
       Alignment is deliberately NOT touched. The band inherits
       text-align:center from `.stat-band__grid`, so a shorter intermediate
       string stays on the same optical axis as its caption; writing
       text-align:right instead threw the whole number about 15px off that axis
       for the entire single-digit phase, which read as a rendering fault on a
       band where everything else is centred.
       If the measurement somehow fails, the count still runs unlocked — the
       cost is a little horizontal wobble, not a broken layout. */
    const w = item.el.getBoundingClientRect().width;
    if (w > 0) item.el.style.width = w + "px";

    item.t0 = -1;
    item.last = "";

    const step = (now) => {
      if (!item.running) return;
      if (item.t0 < 0) item.t0 = now;
      const p = Math.min((now - item.t0) / DURATION, 1);
      const s = item.prefix + item.render(p >= 1 ? item.value : item.value * EASE(p)) + item.suffix;
      if (s !== item.last) { item.node.data = s; item.last = s; }   // M2: write only on change
      if (p >= 1) { finish(item); return; }
      item.raf = requestAnimationFrame(step);
    };
    item.raf = requestAnimationFrame(step);
  };

  /* Synchronous seed. Runs in the same task as init, so a band that is already
     on screen at load never waits for an async observer callback that, in an
     embedded or headless renderer, may never arrive. It may only ever START a
     count — there is no path here that stops one. */
  const seed = () => {
    if (dead) return;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.done && !it.running && inView(it.el)) start(it);
    }
  };

  /* ---------- teardown ---------- */
  const destroy = () => {
    if (dead) return;
    dead = true;
    finishAll();
    while (cleanups.length) {
      const fn = cleanups.pop();
      try { fn(); } catch (e) {}
    }
  };

  /* ---------- discovery ----------
     Shaped like ART.revealScan: a function, not a snapshot, so markup injected
     after this file runs can be handed in. Safe to call repeatedly. */
  const scan = (root) => {
    if (dead) return;
    const found = (root || document).querySelectorAll("[data-count]");
    for (let i = 0; i < found.length; i++) {
      const el = found[i];
      if (itemFor(el)) continue;
      const item = parse(el);
      if (!item) continue;          // not countable — its authored number just stays
      items.push(item);
      if (io) io.observe(el);
    }
    seed();
  };

  /* ---------- wiring ---------- */
  const watchReduce = () => {
    if (!mqReduce) return;
    const onChange = () => { if (mqReduce.matches) destroy(); };
    if (mqReduce.addEventListener) {
      mqReduce.addEventListener("change", onChange);
      cleanups.push(() => mqReduce.removeEventListener("change", onChange));
    } else if (mqReduce.addListener) {                 // Safari < 14
      mqReduce.addListener(onChange);
      cleanups.push(() => mqReduce.removeListener(onChange));
    }
  };

  /* .lite can be thrown mid-page by the footer toggle (layout.js), and that
     toggle dispatches no event — it just changes the class on <html>. Every
     other .lite consumer on the site is CSS, which re-evaluates for free; this
     is the first that has to watch. Once lite is on, the counters are done for
     the life of the page: a visitor who turns it on is telling us their device
     is struggling, and starting counts again on that evidence would be
     perverse. */
  const watchLite = () => {
    if (!("MutationObserver" in window)) return;
    const mo = new MutationObserver(() => {
      if (ROOT.classList.contains("lite")) destroy();
    });
    mo.observe(ROOT, { attributes: true, attributeFilter: ["class"] });
    cleanups.push(() => mo.disconnect());
  };

  const watchLifecycle = () => {
    const onVis = () => { if (!document.hidden) seed(); };
    document.addEventListener("visibilitychange", onVis);
    cleanups.push(() => document.removeEventListener("visibilitychange", onVis));

    /* Back/forward cache keeps the live DOM. Without this, leaving mid-count
       and pressing Back restores a frozen, wrong number — permanently, because
       the rAF that would have finished it was cancelled with the page. */
    const onHide = () => finishRunning();
    addEventListener("pagehide", onHide);
    cleanups.push(() => removeEventListener("pagehide", onHide));

    /* WIDTH-ONLY resize. The <b> font-size is a vw clamp and the grid drops to
       two columns at 720px, so a width locked before a horizontal resize is a
       width that is wrong after it — landing every running number is the
       honest response.
       A HEIGHT-only resize must be ignored, and that is not a nicety: iOS
       Safari and Chrome Android fire `resize` when the URL bar collapses, and
       the scroll that collapses it is the same scroll that brings this band to
       the 0.6 threshold. Reacting to it killed the count about 200ms in on
       most phone visits — the effect was, in practice, desktop-only. Debounced
       at 200ms, the same as layout.js's marquee re-measure. */
    let lastW = window.innerWidth;
    let rt = null;
    const onResize = () => {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      clearTimeout(rt);
      rt = setTimeout(finishRunning, 200);
    };
    addEventListener("resize", onResize);
    cleanups.push(() => { clearTimeout(rt); removeEventListener("resize", onResize); });
  };

  const boot = () => {
    if (dead) return;
    /* M4 and reduced motion resolve to the same thing here, and it is the same
       thing as "no JS": the authored number, instantly, with nothing installed.
       There is no CSS half to this switch — the animated property is a text
       node's data, which CSS can neither drive nor stop. */
    if (ROOT.classList.contains("lite") || reduced()) { dead = true; return; }
    if (!document.querySelector("[data-count]")) return;

    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver((entries) => {
        for (let i = 0; i < entries.length; i++) {
          if (!entries[i].isIntersecting) continue;
          const it = itemFor(entries[i].target);
          if (it) start(it);
        }
      }, { threshold: THRESHOLD, rootMargin: "0px 0px -" + BOTTOM_PCT + "% 0px" });
      cleanups.push(() => { if (io) { io.disconnect(); io = null; } });
    }
    /* No observer is not a failure state. Unlike .reveal, nothing here starts
       hidden — the finished numbers are already on the page — so seed() inside
       scan() counts whatever is on screen at load and the rest simply stand. */

    watchReduce();
    watchLite();
    watchLifecycle();
    scan(document);
  };

  /* Measure after load AND after the webfont has actually applied. `load`
     alone is not enough and the older comment here was wrong about it: Monda
     is font-display:swap (tokens.css), so the first paint uses Avenir Next /
     Helvetica and the real face can arrive after `load`. A width locked
     against the fallback and then re-shaped by a swap would overflow its own
     box for up to 1.4s. document.fonts.ready is the event that actually means
     "the faces are applied"; it is feature-detected, and either branch of the
     promise boots, because a font that failed to load is still a settled
     state we can measure. */
  const go = () => {
    const f = document.fonts;
    if (f && f.ready && typeof f.ready.then === "function") f.ready.then(boot, boot);
    else boot();
  };
  if (document.readyState === "complete") go();
  else addEventListener("load", go, { once: true });

  /* Public surface. `scan` for markup injected later, `finish` to land every
     number on its authored value right now, `destroy` to remove every timer,
     listener, observer and inline style this file created.
     window.ART is guarded rather than assumed: js/data.js creates it, and if
     that file is blocked or fails, a bare `ART.counters = …` here would throw
     an uncaught ReferenceError into a console the house rules require to be
     clean. drawline.js guards the same way. */
  if (window.ART) window.ART.counters = { scan: scan, finish: finishAll, destroy: destroy };
})();
