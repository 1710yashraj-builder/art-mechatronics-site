/* ============================================================
   ART Mechatronics — shared layout (header, footer, nav, reveals)
   Include AFTER data.js on every page:
     <div data-header></div> ... <div data-footer></div>
   Set <body data-page="home"> to mark the active nav item.
   ============================================================ */
(function () {
  const B = ART.brand;
  const page = document.body.dataset.page || "";
  const wa = ART.helper.wa();

  const NAV = [
    ["home",    "Home",          "index.html"],
    ["system",  "Live System",   "system.html"],
    ["panel",   "Control Panel", "control-panel.html"],
    ["machines","Machines",      "machines.html"],
    ["about",   "About",         "about.html"],
    ["contact", "Contact",       "contact.html"],
  ];

  const navLinks = NAV.map(([id, label, href]) =>
    `<a href="${href}"${id === page ? ' aria-current="page"' : ""}>${label}</a>`
  ).join("");

  /* ---------- HEADER ---------- */
  const headerHTML = `
  <header class="site-header">
    <div class="wrap site-header__inner">
      <a class="brand" href="index.html" aria-label="${B.name} home">
        <img src="assets/logo.svg" alt="${B.name}" width="150" height="51">
      </a>
      <button class="nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="primary-nav">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>
        </svg>
      </button>
      <nav class="nav" id="primary-nav">
        ${navLinks}
        <a class="btn btn--primary" href="contact.html">Get a Quote</a>
      </nav>
    </div>
  </header>`;

  /* ---------- FOOTER ---------- */
  const machineLinks = ART.machines
    .map(m => `<li><a href="machine.html?id=${m.id}">${m.name}</a></li>`).join("");

  const footerHTML = `
  <footer class="site-footer">
    <div class="wrap">
      <div class="footer-grid">
        <div class="footer-col">
          <img src="assets/logo-white.svg" alt="${B.name}">
          <p style="color:#9fb4d4;max-width:34ch">${B.tagline}. Turnkey industrial process &amp; packaging automation — designed, manufactured and integrated in-house.</p>
          <div class="footer-flags">${B.presence.map(c => `<span>${c}</span>`).join('<span aria-hidden="true">·</span>')}</div>
        </div>
        <div class="footer-col">
          <h2>Machines</h2>
          <ul>${machineLinks}</ul>
        </div>
        <div class="footer-col">
          <h2>Explore</h2>
          <ul>
            <li><a href="system.html">Live System Demo</a></li>
            <li><a href="control-panel.html">Virtual Control Panel</a></li>
            <li><a href="machines.html">All Machines</a></li>
            <li><a href="about.html">About ART</a></li>
            <li><a href="contact.html">Contact</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h2>Contact</h2>
          <ul>
            <li><a href="tel:+${B.phoneDial}">${B.phoneDisplay}</a></li>
            <li><a href="mailto:${B.email}">${B.email}</a></li>
            <li><a href="${wa}" target="_blank" rel="noopener">WhatsApp us</a></li>
            <li>${B.web}</li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© <span data-year></span> ${B.name}. All rights reserved.</span>
        <span>${B.disciplines.join(" · ")}</span>
      </div>
    </div>
  </footer>`;

  /* ---------- inject ---------- */
  const hSlot = document.querySelector("[data-header]");
  const fSlot = document.querySelector("[data-footer]");
  if (hSlot) hSlot.outerHTML = headerHTML;
  if (fSlot) fSlot.outerHTML = footerHTML;

  const yr = document.querySelector("[data-year]");
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- mobile nav ---------- */
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("primary-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.getAttribute("data-open") === "true";
      nav.setAttribute("data-open", String(!open));
      toggle.setAttribute("aria-expanded", String(!open));
      toggle.setAttribute("aria-label", open ? "Open menu" : "Close menu");
    });
    nav.addEventListener("click", e => {
      if (e.target.tagName === "A") {
        nav.setAttribute("data-open", "false");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- reveal on scroll ---------- */
  const reveals = document.querySelectorAll(".reveal");
  if (reveals.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add("in"));
  }
})();
