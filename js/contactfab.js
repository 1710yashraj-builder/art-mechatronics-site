/* ===== Contact Us button — bottom-right, unfolds upward =====
   Founder (Anurag) via Yash, 2026-08-18: the share rail that lived on the left
   edge moves to the bottom-right corner, becomes a proper circle reading
   "Contact Us", and opens on hover exactly the way the rail did.

   Yash's six answers, 2026-08-18:
   - a circle with a chat icon; the words "Contact Us" ride alongside on hover
   - the same five destinations as before, unchanged: LinkedIn, Instagram,
     Facebook, LINE, WhatsApp
   - they unfold straight up in a column
   - on mouse-out it closes after a grace delay, not instantly
   - the left rail is gone, not kept alongside
   - it appears on every page, as the rail did

   Behaviour, and why:
   - Hover opens it on pointer devices ONLY. Hover is bound behind
     (hover: hover) and (pointer: fine) so a phone never inherits a state it
     cannot leave.
   - The grace delay is the point of the delay: a hover menu that shuts the
     instant the pointer clips a corner is the single most irritating version of
     this pattern. The timer is cancelled if the pointer comes back.
   - Tap toggles it, on any device. Nobody has to hover to be able to open it.
   - Keyboard: focus inside opens, focus leaving closes, Esc closes. Same
     reach as a mouse.
   - WhatsApp keeps routing through the region picker in js/layout.js, which
     intercepts any wa.me href — so an overseas buyer is not dropped onto the
     Kanpur number.
   - Every entry is a real <a href>: script dead, links still work. ===== */
(function () {
  if (!window.ART || !ART.brand || !ART.brand.social) return;
  if (document.querySelector(".cfab")) return;

  var ICON = {
    linkedin:  '<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM2.9 21h4.16V9.5H2.9V21zM9.6 9.5h3.99v1.57h.06c.55-1.05 1.9-2.16 3.92-2.16 4.19 0 4.96 2.76 4.96 6.35V21h-4.15v-4.9c0-1.17-.02-2.68-1.63-2.68-1.63 0-1.88 1.28-1.88 2.6V21H9.6V9.5z"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="17.2" cy="6.8" r="1.15"/>',
    facebook:  '<path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z"/>',
    line:      '<path d="M12 3.6c-5.07 0-9.2 3.14-9.2 7.01 0 3.47 3.26 6.38 7.66 6.93.3.06.7.19.81.44.09.23.06.58.03.81 0 0-.11.64-.13.78-.04.23-.19.9.79.49s5.29-3.11 7.22-5.33h-.01c1.33-1.46 1.97-2.94 1.97-4.12 0-3.87-4.13-7.01-9.14-7.01zM8.4 13.1H6.57a.48.48 0 0 1-.48-.48V9a.48.48 0 1 1 .96 0v3.14H8.4a.48.48 0 1 1 0 .96zm1.89-.48a.48.48 0 1 1-.96 0V9a.48.48 0 1 1 .96 0v3.62zm4.36 0a.48.48 0 0 1-.87.29l-1.86-2.54v2.25a.48.48 0 1 1-.96 0V9a.48.48 0 0 1 .87-.29l1.86 2.54V9a.48.48 0 1 1 .96 0v3.62zm2.93-2.29a.48.48 0 1 1 0 .96h-1.35v.87h1.35a.48.48 0 1 1 0 .96h-1.83a.48.48 0 0 1-.48-.48V9a.48.48 0 0 1 .48-.48h1.83a.48.48 0 1 1 0 .96h-1.35v.86h1.35z"/>',
    whatsapp:  '<path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.9.9-2.8-.2-.3A8 8 0 1 1 12 20zm4.5-5.8c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.1-.2 0-.4.1-.5l.4-.5c.1-.2.1-.3 0-.5l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.7.7-.9 1.6-.6 2.6.5 1.7 1.6 3.1 3.2 4.1 1.2.7 2.1.9 2.8.8.6-.1 1.4-.6 1.6-1.2.2-.5.2-1 .1-1.1z"/>',
  };

  var items = ART.brand.social.map(function (s) {
    return { id: s.id, name: s.name, note: s.note, url: s.url };
  });
  items.push({ id: "whatsapp", name: "WhatsApp", note: "Chat with us", url: ART.helper.wa() });

  /* Rows are emitted bottom-up so the first one sits closest to the button:
     the nearest thing to your thumb should be the first thing in the list. */
  var rows = items.slice().reverse().map(function (s) {
    return '<a class="cfab__row cfab__row--' + s.id + '" href="' + s.url + '"' +
           ' target="_blank" rel="noopener"' +
           ' aria-label="' + s.name + (s.note ? " — " + s.note : "") + '">' +
             '<span class="cfab__tip" aria-hidden="true">' + s.name + '</span>' +
             '<span class="cfab__ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor">' + ICON[s.id] + '</svg></span>' +
           '</a>';
  }).join("");

  var el = document.createElement("div");
  el.className = "cfab";
  el.setAttribute("aria-label", "Contact ART Mechatronics");
  el.innerHTML =
    '<div class="cfab__panel" id="cfabPanel">' + rows + '</div>' +
    '<button class="cfab__btn" type="button" aria-expanded="false" aria-controls="cfabPanel" aria-label="Contact us">' +
      '<span class="cfab__tip cfab__tip--btn" aria-hidden="true">Contact Us</span>' +
      '<svg class="cfab__chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/></svg>' +
      '<svg class="cfab__closeic" viewBox="4 4 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
    '</button>';
  document.body.appendChild(el);

  var btn = el.querySelector(".cfab__btn");
  var shutTimer = null;

  function setOpen(open) {
    clearTimeout(shutTimer);
    el.classList.toggle("cfab--open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  function isOpen() { return el.classList.contains("cfab--open"); }

  btn.addEventListener("click", function () { setOpen(!isOpen()); });

  // Hover, on pointer devices only. A phone must never end up in a hover state.
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    el.addEventListener("mouseenter", function () { setOpen(true); });
    el.addEventListener("mouseleave", function () {
      clearTimeout(shutTimer);
      shutTimer = setTimeout(function () { setOpen(false); }, 400);   // grace delay
    });
  }

  // Keyboard parity with hover.
  el.addEventListener("focusin", function () { setOpen(true); });
  el.addEventListener("focusout", function (e) {
    if (!el.contains(e.relatedTarget)) setOpen(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen()) { setOpen(false); btn.focus(); }
  });
  // tapping anywhere else closes it again on touch
  document.addEventListener("click", function (e) {
    if (!el.contains(e.target)) setOpen(false);
  });
})();
