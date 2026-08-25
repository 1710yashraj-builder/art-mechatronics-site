/* ============================================================
   ART Mechatronics — shared layout (header, footer, nav, reveals)
   Include AFTER data.js on every page:
     <div data-header></div> ... <div data-footer></div>
   Set <body data-page="home"> to mark the active nav item.
   Set <body data-base="../"> on pages in a subfolder (industries/, products/)
   so all header/footer links & assets resolve correctly.
   ============================================================ */
(function () {
  const B = ART.brand;

  /* ---------- M4 kill switch ----------
     Weak devices, and anyone who asks for it, get `.lite`: no scroll parallax,
     no hero light pass, no backdrop-filter on the sticky header. Runs before
     the header is injected so the blur never paints once and then vanishes.
     It deliberately does NOT touch the hero's one-shot entrance — that has
     already started by the time this file executes, and cancelling it mid-flight
     would produce a visible snap on exactly the phones this protects. */
  const ROOT = document.documentElement;
  let litePref = null;
  try { litePref = localStorage.getItem("art-lite"); } catch (e) {}
  /* THRESHOLDS — corrected 2026-08-01 after the client reported "the animations
     are not working on mobile". They were working exactly as written; the
     detection was wrong.

     It previously read `<= 4` on both signals. Safari on iPhone reports
     navigator.hardwareConcurrency as 4, so EVERY iPhone matched, got `.lite`,
     and lost the hero entrance, the counting stats and the drawn pipeline —
     on the device most of this client's buyers will use.

     `<= 2` is what "too weak to composite a transform" actually looks like in
     2026: a dual-core budget Android, not a flagship phone. deviceMemory is
     undefined in Safari entirely, so on iOS the core count is the only signal
     and it must not be trigger-happy.

     The manual footer toggle is unchanged and still authoritative — anyone who
     wants motion reduced can say so, and prefers-reduced-motion is honoured
     separately and independently of this. */
  const weakDevice = (navigator.deviceMemory && navigator.deviceMemory <= 2) ||
                     (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
  if (litePref === "1" || (litePref === null && weakDevice)) ROOT.classList.add("lite");
  const page = document.body.dataset.page || "";
  const BASE = document.body.dataset.base || "";        // "" at root, "../" in subfolders
  const wa = ART.helper.wa();

  /* Cloudflare Pages serves foo.html at /foo and 308-redirects the .html form,
     so every link we build must already be extensionless. Files stay *.html. */
  const pub = (f) => String(f).replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, "");
  const href = (f) => { const s = pub(f); return s ? BASE + s : (BASE || "./"); };

  /* Order reset on the client's word (2026-08-16): Services sits beside
     Products because both are "what you can buy", About sits beside Contact
     because both are "who you're buying from". Catalogue is now labelled
     Products everywhere; the FILE stays catalog.html and the URL stays
     /catalog so links already shared or indexed keep resolving. */
  const NAV = [
    ["home",      "Home",       "index.html"],
    ["industries","Industries", "industries.html"],
    ["catalog",   "Products",   "catalog.html"],
    ["services",  "Services",   "services.html"],
    ["partner",   "Partner With Us", "partner.html"],
    ["about",     "About",      "about.html"],
    ["contact",   "Contact",    "contact.html"],
  ];

  const navLinks = NAV.map(([id, label, hrefPath]) =>
    `<a href="${href(hrefPath)}"${id === page ? ' aria-current="page"' : ""}>${label}</a>`
  ).join("");

  /* ---------- HEADER ---------- */
  const headerHTML = `
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <div class="wrap site-header__inner">
      <a class="brand" href="${href('index.html')}" aria-label="${B.name} home">
        <img src="${BASE}assets/logo.png" alt="${B.name}" width="460" height="204">
      </a>
      <p class="brand-tag" aria-hidden="true">${B.tagline}</p>
      <button class="nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="primary-nav">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>
        </svg>
      </button>
      <nav class="nav" id="primary-nav">
        ${navLinks}
        <a class="btn btn--primary" href="${href('contact.html')}"${page === "contact" ? ' aria-current="page"' : ""}>Get a Quote</a>
      </nav>
    </div>
  </header>`;

  /* ---------- FOOTER ---------- */
  /* Yash, 2026-08-07 (second pass): the Units/Offices lists made the footer a
     wall — they now live only on the contact page and the homepage network
     band. This column carries the catalogue download instead. ART.brand.network
     stays in data.js as the single source for those two pages. */

  const footerHTML = `
  <footer class="site-footer">
    <div class="wrap">
      <div class="footer-grid">
        <div class="footer-col">
          <img src="${BASE}assets/logo-white.png" alt="${B.name}" width="460" height="204">
          <p class="footer-blurb">Backed by Thermocare Group experience since 1997.</p>
          <div class="footer-flags">${B.presence.map(c => `<span>${c}</span>`).join('<span aria-hidden="true">·</span>')}</div>
        </div>
        <div class="footer-col">
          <h2>Explore our complete company portfolio</h2>
          <p class="footer-cat__lead">The full machine range and manufacturing and service network in one PDF, you can save and forward.</p>
          <div class="footer-cat__act">
            <a class="btn btn--light" href="${BASE}assets/catalogue/ART-Mechatronics-Catalogue-2026.pdf" target="_blank" rel="noopener">Download the catalogue (PDF)</a>
            <small>Opens in a new tab &middot; 20 MB</small>
          </div>
        </div>
        <div class="footer-col">
          <h2>Explore</h2>
          <ul>
            <li><a href="${href('industries.html')}">Industries we serve</a></li>
            <li><a href="${href('catalog.html')}">All products</a></li>
            <li><a href="${href('machines.html')}">Flagship Line</a></li>
            <li><a href="${href('system.html')}">Live System Demo</a></li>
            <li><a href="${href('services.html')}">Services &amp; support</a></li>
            <li><a href="${href('about.html')}">About ART</a></li>
            <li><a href="${href('partner.html')}">Partner with us</a></li>
            <li><a href="${href('careers.html')}">Careers</a></li>
            <li><a href="${href('contact.html')}">Contact</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h2>Contact</h2>
          <ul>
            ${(B.contacts || [{ region: "", display: B.phoneDisplay, dial: B.phoneDial }])
              .map(c => `<li><a href="tel:+${c.dial}">${c.region ? c.region + ": " : ""}${c.display}</a></li>`).join("")}
            <li><a href="mailto:${B.email}">${B.email}</a></li>
            <li><a href="${wa}" target="_blank" rel="noopener">WhatsApp us</a></li>
            <li>${B.web}</li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© <span data-year></span> ${B.name}. All rights reserved.</span>
        <button class="lite-toggle" type="button" data-lite aria-pressed="false">Reduce motion &amp; effects</button>
        <span>${B.disciplines.join(" · ")}</span>
      </div>
    </div>
  </footer>`;

  /* ---------- inject ---------- */
  const hSlot = document.querySelector("[data-header]");
  const fSlot = document.querySelector("[data-footer]");
  if (hSlot) hSlot.outerHTML = headerHTML;
  if (fSlot) fSlot.outerHTML = footerHTML;

  const liteBtn = document.querySelector("[data-lite]");
  if (liteBtn) {
    const paintLite = () => {
      const on = ROOT.classList.contains("lite");
      liteBtn.setAttribute("aria-pressed", String(on));
      liteBtn.textContent = on ? "Motion & effects: reduced" : "Reduce motion & effects";
    };
    liteBtn.addEventListener("click", () => {
      const on = ROOT.classList.toggle("lite");
      try { localStorage.setItem("art-lite", on ? "1" : "0"); } catch (e) {}
      paintLite();
    });
    paintLite();
  }

  const yr = document.querySelector("[data-year]");
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- regional contact picker (WhatsApp / Call) ----------
     ART works from India, UAE and Thailand. WhatsApp deep links and tel:
     can only target ONE number, so every quote / WhatsApp / call action
     opens this small chooser and then routes to the picked region.
     The baked <a href="wa.me/..."> stays a valid fallback if JS fails. */
  const CONTACTS = (B.contacts && B.contacts.length)
    ? B.contacts
    : [{ region: "India", role: "", display: B.phoneDisplay, dial: B.phoneDial }];
  const FLAG = { India: "🇮🇳", UAE: "🇦🇪", Thailand: "🇹🇭" };

  const picker = (function () {
    let overlay = null, lastFocus = null, mode = "wa", payload = "";

    function build() {
      const style = document.createElement("style");
      style.id = "rp-style";
      style.textContent =
        ".rp-ov{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;padding:1.2rem;background:rgba(11,44,94,.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}" +
        ".rp-ov.rp-open{display:flex}" +
        ".rp-panel{width:100%;max-width:430px;background:var(--white,#fff);border-radius:var(--r-lg,14px);box-shadow:var(--shadow-lg,0 24px 60px rgba(11,44,94,.18));overflow:hidden;animation:rp-in .18s var(--ease,ease)}" +
        "@keyframes rp-in{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}" +
        ".rp-head{display:flex;align-items:center;gap:.65rem;padding:1rem 1.15rem;border-bottom:1px solid var(--line,#dde3ec)}" +
        ".rp-ic{width:36px;height:36px;flex:0 0 36px;border-radius:9px;display:grid;place-items:center;color:#fff}" +
        ".rp-wa .rp-ic{background:#25D366}.rp-call .rp-ic{background:var(--blue,#1657b0)}" +
        ".rp-head h3{margin:0;font:700 1.05rem/1.2 var(--font,sans-serif);color:var(--ink,#10233f)}" +
        ".rp-head .rp-sub{margin:.1rem 0 0;font-size:.8rem;color:var(--steel,#5c6678)}" +
        ".rp-x{margin-left:auto;border:0;background:none;cursor:pointer;color:var(--steel,#5c6678);font-size:1.5rem;line-height:1;padding:.1rem .3rem;border-radius:6px}" +
        ".rp-x:hover{background:var(--mist,#f4f7fb);color:var(--ink,#10233f)}" +
        ".rp-list{padding:.7rem;display:flex;flex-direction:column;gap:.5rem}" +
        ".rp-opt{display:flex;align-items:center;gap:.8rem;width:100%;text-align:left;padding:.72rem .9rem;border:1px solid var(--line,#dde3ec);border-radius:var(--r,9px);background:var(--white,#fff);cursor:pointer;transition:border-color .15s,background .15s,transform .08s;font-family:var(--font,sans-serif)}" +
        ".rp-opt:hover,.rp-opt:focus-visible{border-color:var(--blue,#1657b0);background:var(--blue-soft,#eaf2fd);outline:none}" +
        ".rp-opt:active{transform:translateY(1px)}" +
        ".rp-flag{font-size:1.5rem;flex:0 0 auto;line-height:1}" +
        ".rp-r{font:700 1rem/1.15 var(--font,sans-serif);color:var(--ink,#10233f);display:block}" +
        ".rp-role{font-size:.76rem;color:var(--steel,#5c6678);display:block;margin-top:.08rem}" +
        ".rp-num{margin-left:auto;font:600 .9rem/1 var(--font-mono,monospace);color:var(--blue,#1657b0);white-space:nowrap}" +
        "@media(max-width:430px){.rp-num{display:none}}";
      document.head.appendChild(style);

      overlay = document.createElement("div");
      overlay.className = "rp-ov";
      overlay.innerHTML =
        '<div class="rp-panel" role="dialog" aria-modal="true" aria-labelledby="rp-title">' +
        '<div class="rp-head"><span class="rp-ic" aria-hidden="true"></span>' +
        '<div><h3 id="rp-title"></h3><p class="rp-sub">Choose your region</p></div>' +
        '<button class="rp-x" type="button" aria-label="Close">×</button></div>' +
        '<div class="rp-list"></div></div>';
      document.body.appendChild(overlay);

      overlay.querySelector(".rp-x").addEventListener("click", close);
      overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
      document.addEventListener("keydown", e => {
        if (e.key === "Escape" && overlay.classList.contains("rp-open")) close();
      });
    }

    const CALL_IC = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z"/></svg>';
    const WA_IC = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2z"/></svg>';

    function open(opts) {
      opts = opts || {};
      if (!overlay) build();
      mode = opts.mode === "call" ? "call" : "wa";
      payload = opts.text || "";
      const head = overlay.querySelector(".rp-head");
      head.className = "rp-head " + (mode === "call" ? "rp-call" : "rp-wa");
      head.querySelector(".rp-ic").innerHTML = mode === "call" ? CALL_IC : WA_IC;
      overlay.querySelector("#rp-title").textContent = mode === "call" ? "Call ART Mechatronics" : "Chat on WhatsApp";
      const list = overlay.querySelector(".rp-list");
      list.innerHTML = CONTACTS.map((c, i) =>
        '<button class="rp-opt" type="button" data-i="' + i + '">' +
        '<span class="rp-flag" aria-hidden="true">' + (FLAG[c.region] || "📞") + '</span>' +
        '<span><span class="rp-r">' + c.region + '</span><span class="rp-role">' + (c.role || "") + '</span></span>' +
        '<span class="rp-num">' + c.display + '</span></button>'
      ).join("");
      list.querySelectorAll(".rp-opt").forEach(btn =>
        btn.addEventListener("click", () => choose(CONTACTS[+btn.dataset.i]))
      );
      lastFocus = document.activeElement;
      overlay.classList.add("rp-open");
      const first = list.querySelector(".rp-opt");
      if (first) first.focus();
    }

    function choose(c) {
      if (mode === "call") {
        close();
        location.href = "tel:+" + c.dial;
      } else {
        const url = "https://wa.me/" + c.dial + (payload ? "?text=" + encodeURIComponent(payload) : "");
        close();
        window.open(url, "_blank", "noopener");
      }
    }

    function close() {
      if (!overlay) return;
      overlay.classList.remove("rp-open");
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    return { open };
  })();
  ART.picker = picker;

  // Intercept every WhatsApp link so it opens the region picker (href stays the fallback).
  document.addEventListener("click", e => {
    const a = e.target.closest && e.target.closest('a[href*="wa.me/"]');
    if (!a) return;
    e.preventDefault();
    let text = "";
    const m = /[?&]text=([^&]*)/.exec(a.getAttribute("href") || "");
    if (m) { try { text = decodeURIComponent(m[1].replace(/\+/g, " ")); } catch (_) { text = ""; } }
    picker.open({ mode: "wa", text });
  });

  /* ---------- mobile nav ---------- */
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("primary-nav");
  if (toggle && nav) {
    const mobileMenu = window.matchMedia("(max-width: 1024px)");
    const syncNavAccess = () => {
      nav.inert = mobileMenu.matches && nav.getAttribute("data-open") !== "true";
    };
    syncNavAccess();
    toggle.addEventListener("click", () => {
      const open = nav.getAttribute("data-open") === "true";
      nav.setAttribute("data-open", String(!open));
      toggle.setAttribute("aria-expanded", String(!open));
      toggle.setAttribute("aria-label", open ? "Open menu" : "Close menu");
      syncNavAccess();
    });
    nav.addEventListener("click", e => {
      if (e.target.tagName === "A") {
        nav.setAttribute("data-open", "false");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open menu");
        syncNavAccess();
      }
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && nav.getAttribute("data-open") === "true") {
        nav.setAttribute("data-open", "false");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open menu");
        syncNavAccess();
        toggle.focus();
      }
    });
    mobileMenu.addEventListener("change", syncNavAccess);
  }

  /* ---------- quote form → WhatsApp composer (backend-free) ---------- */
  document.querySelectorAll("form[data-quote]").forEach(f => {
    f.addEventListener("submit", e => {
      e.preventDefault();
      const machine = f.dataset.machine || "your requirement";
      const fd = new FormData(f);
      const nm = (fd.get("name") || "").toString().trim();
      const co = (fd.get("company") || "").toString().trim();
      const material = (fd.get("material") || "").toString().trim();
      const capacity = (fd.get("capacity") || "").toString().trim();
      const location = (fd.get("location") || "").toString().trim();
      const rq = (fd.get("req") || "").toString().trim();
      let msg = `Hi ART Mechatronics, I'd like a quote for the ${machine}.`;
      if (nm) msg += `\nName: ${nm}`;
      if (co) msg += `\nCompany: ${co}`;
      if (material) msg += `\nProduct or material: ${material}`;
      if (capacity) msg += `\nTarget capacity: ${capacity}`;
      if (location) msg += `\nPlant location: ${location}`;
      if (rq) msg += `\nRequirement: ${rq}`;
      picker.open({ mode: "wa", text: msg });
    });
  });

  /* ---------- tile caret dropdowns (industries AND machine categories) ----------
     The caret opens the sub-list; it must never navigate, so the click is
     stopped before it reaches the surrounding link. One open at a time, closes
     on outside click and on Escape. Shared by both grids rather than
     duplicated — same behaviour, one place to fix it. */
  const carets = document.querySelectorAll(".ig-caret, .mc-caret");
  if (carets.length) {
    const closeAll = (except) => {
      carets.forEach((btn) => {
        if (btn === except) return;
        btn.setAttribute("aria-expanded", "false");
        const panel = document.getElementById(btn.getAttribute("aria-controls"));
        if (panel) panel.hidden = true;
      });
    };
    carets.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const panel = document.getElementById(btn.getAttribute("aria-controls"));
        const open = btn.getAttribute("aria-expanded") === "true";
        closeAll(btn);
        btn.setAttribute("aria-expanded", String(!open));
        if (panel) panel.hidden = open;
      });
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".ig-tile, .mc-tile-wrap")) closeAll(null);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAll(null);
    });
  }

  /* ---------- seamless ticker (lab marquee pattern) ----------
     rAF-driven translate rather than a CSS animation, so scroll velocity can
     modulate it. The track already contains one visible set plus an
     aria-hidden duplicate; if one duplicate is not wide enough to cover the
     rail we clone more, and only ever clone the hidden set. --live is added
     last: until then the track wraps as a normal list, which is what keeps it
     readable with no JS or a dead animation. */
  // data-marquee-group: rails naming the same group pause and resume as one.
  // Anurag wants the two Recent Projects rails grid-locked (2026-08-21): same
  // speed + same card/gap keeps their columns aligned, and a shared pause is
  // what stops a hover on one rail from drifting it against the other.
  const marqueeGroups = {};
  document.querySelectorAll("[data-marquee]").forEach((rail) => {
    const track = rail.querySelector(".pk-marquee__track");
    if (!track) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const real = [...track.children].filter((c) => c.getAttribute("aria-hidden") !== "true");
    const speed = parseFloat(rail.dataset.marqueeSpeed) || 40;   // px per second
    // data-marquee-dir="right" runs the rail the other way. Two stacked rails
    // drifting in opposite directions read as design; in lockstep they read as
    // one conveyor belt.
    const dir = rail.dataset.marqueeDir === "right" ? 1 : -1;
    let period = 0, x = 0, last = 0, raf = null, paused = false, boost = 0;

    const measure = () => {
      const g = parseFloat(getComputedStyle(track).columnGap) || 0;
      period = real.reduce((sum, el) => sum + el.getBoundingClientRect().width + g, 0);
      // enough copies to cover the rail plus one, so the seam is never on screen
      const need = Math.ceil(rail.clientWidth / Math.max(period, 1)) + 1;
      const have = Math.round((track.children.length - real.length) / real.length);
      for (let c = have; c < need; c++) {
        real.forEach((el) => {
          const d = el.cloneNode(true);
          d.setAttribute("aria-hidden", "true");
          track.appendChild(d);
        });
      }
    };

    const frame = (now) => {
      if (!last) last = now;
      const dt = Math.min((now - last) / 1000, 0.05);   // clamp after a tab switch
      last = now;
      if (!paused && period > 0) {
        x += dir * (speed + boost) * dt;
        // modulo wrap in whichever direction we are travelling, no jump frame
        if (x <= -period) x += period;
        else if (x >= 0) x -= period;
        track.style.transform = `translate3d(${x}px,0,0)`;
      }
      boost *= 0.92;
      raf = requestAnimationFrame(frame);
    };

    // scroll velocity feeds a boost, capped so it never outruns readability
    let prevY = scrollY;
    addEventListener("scroll", () => {
      const dy = Math.abs(scrollY - prevY); prevY = scrollY;
      boost = Math.min(boost + dy * 2.2, speed * 4);
    }, { passive: true });

    const groupName = rail.dataset.marqueeGroup;
    const setPaused = (v) => { paused = v; };
    if (groupName) (marqueeGroups[groupName] = marqueeGroups[groupName] || []).push(setPaused);
    const pauseAll = (v) => {
      if (groupName) marqueeGroups[groupName].forEach((fn) => fn(v));
      else setPaused(v);
    };
    rail.addEventListener("mouseenter", () => pauseAll(true));
    rail.addEventListener("mouseleave", () => pauseAll(false));
    rail.addEventListener("focusin", () => pauseAll(true));
    rail.addEventListener("focusout", () => pauseAll(false));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { cancelAnimationFrame(raf); raf = null; }
      else if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
    });

    const startRail = () => {
      measure();
      rail.classList.add("pk-marquee--live");
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    // measure after images settle, or the widths are wrong and the seam shows
    if (document.readyState === "complete") startRail();
    else addEventListener("load", startRail, { once: true });
    let rt = null;
    addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { x = 0; measure(); }, 200); });
  });

  /* ---------- reveal on scroll ----------
     querySelectorAll returns a STATIC NodeList. This file runs before the
     per-page scripts, so anything a page injects afterwards — the four featured
     machine cards home.js writes into #homeMgrid, for one — was never in that
     list: never observed, and not reachable by the failsafe either, because the
     failsafe iterated the same stale list. Those cards sat at opacity:0 forever,
     on the live site, with nothing in the console to say why.
     So: the scan is a function, it is exposed for late-injected content, and the
     failsafe re-queries the live DOM instead of trusting a snapshot. */
  const REVEAL_IO = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        entries.forEach(en => {
          if (en.isIntersecting) { en.target.classList.add("in"); REVEAL_IO.unobserve(en.target); }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" })
    : null;

  /* Call after injecting markup that contains .reveal elements. Safe to call
     repeatedly — :not(.in) means already-revealed nodes are skipped, and
     re-observing an observed element is a no-op. */
  ART.revealScan = (root) => {
    const els = (root || document).querySelectorAll(".reveal:not(.in)");
    if (REVEAL_IO) els.forEach(el => REVEAL_IO.observe(el));
    else els.forEach(el => el.classList.add("in"));
  };
  ART.revealScan(document);

  /* Failsafe. .reveal starts at opacity 0, so if the observer never fires — a
     broken viewport, an embedded/headless renderer, a print context — the
     content stays invisible for good. Re-queried, not snapshotted, so it also
     catches anything injected between load and now. */
  if (REVEAL_IO) {
    setTimeout(() => {
      document.querySelectorAll(".reveal:not(.in)").forEach(el => el.classList.add("in"));
    }, 1600);
  }
})();
