/* ===== Social link tree — fixed rail on the left edge =====
   Client, 2026-08-16: a link tree of the social handles plus WhatsApp, pinned
   to the left of every page, vertically centred, expanding on hover.

   SAMPLE MODE. `ONLY_PAGE` limits it to one page so it can be judged before
   it appears on all 428. Set to null to run everywhere.

   Behaviour, and why:
   - Desktop: icons always visible; hovering the rail slides each label out.
     Nobody has to hover to KNOW it is there — hover only adds the names.
   - Touch (<=900px): hover does not exist, so the rail gets a real toggle
     button; tapping it expands the tree. Yash chose tap-to-expand.
   - Keyboard: focus inside the rail expands it, same as hover, so it is not
     a mouse-only feature.
   - WhatsApp routes through the same region picker as every other WhatsApp
     link on the site (js/layout.js intercepts any wa.me href), so an overseas
     buyer is not dropped onto the Kanpur number.
   - Every entry is a real <a href>: script dead, links still work. ===== */
(function () {
  var ONLY_PAGE = "home";              // <- null to run on every page

  if (!window.ART || !ART.brand || !ART.brand.social) return;
  var page = document.body.dataset.page || "";
  if (ONLY_PAGE !== null && page !== ONLY_PAGE) return;
  if (document.querySelector(".srail")) return;

  var ICON = {
    linkedin:  '<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM2.9 21h4.16V9.5H2.9V21zM9.6 9.5h3.99v1.57h.06c.55-1.05 1.9-2.16 3.92-2.16 4.19 0 4.96 2.76 4.96 6.35V21h-4.15v-4.9c0-1.17-.02-2.68-1.63-2.68-1.63 0-1.88 1.28-1.88 2.6V21H9.6V9.5z"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="17.2" cy="6.8" r="1.15"/>',
    facebook:  '<path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z"/>',
    line:      '<path d="M12 3.6c-5.07 0-9.2 3.14-9.2 7.01 0 3.47 3.26 6.38 7.66 6.93.3.06.7.19.81.44.09.23.06.58.03.81 0 0-.11.64-.13.78-.04.23-.19.9.79.49s5.29-3.11 7.22-5.33h-.01c1.33-1.46 1.97-2.94 1.97-4.12 0-3.87-4.13-7.01-9.14-7.01zM8.4 13.1H6.57a.48.48 0 0 1-.48-.48V9a.48.48 0 1 1 .96 0v3.14H8.4a.48.48 0 1 1 0 .96zm1.89-.48a.48.48 0 1 1-.96 0V9a.48.48 0 1 1 .96 0v3.62zm4.36 0a.48.48 0 0 1-.87.29l-1.86-2.54v2.25a.48.48 0 1 1-.96 0V9a.48.48 0 0 1 .87-.29l1.86 2.54V9a.48.48 0 1 1 .96 0v3.62zm2.93-2.29a.48.48 0 1 1 0 .96h-1.35v.87h1.35a.48.48 0 1 1 0 .96h-1.83a.48.48 0 0 1-.48-.48V9a.48.48 0 0 1 .48-.48h1.83a.48.48 0 1 1 0 .96h-1.35v.86h1.35z"/>',
    whatsapp:  '<path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.9.9-2.8-.2-.3A8 8 0 1 1 12 20zm4.5-5.8c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.1-.2 0-.4.1-.5l.4-.5c.1-.2.1-.3 0-.5l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.7.7-.9 1.6-.6 2.6.5 1.7 1.6 3.1 3.2 4.1 1.2.7 2.1.9 2.8.8.6-.1 1.4-.6 1.6-1.2.2-.5.2-1 .1-1.1z"/>',
  };

  var items = ART.brand.social.map(function (s) {
    return { id: s.id, name: s.name, note: s.note, url: s.url, ext: true };
  });
  items.push({ id: "whatsapp", name: "WhatsApp", note: "Chat with us", url: ART.helper.wa(), ext: true, wa: true });

  var rows = items.map(function (s) {
    return '<a class="srail__row srail__row--' + s.id + '" href="' + s.url + '"' +
           (s.ext ? ' target="_blank" rel="noopener"' : "") +
           ' aria-label="' + s.name + (s.note ? " \u2014 " + s.note : "") + '">' +
             '<span class="srail__ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor">' + ICON[s.id] + '</svg></span>' +
             '<span class="srail__tx"><b>' + s.name + '</b><i>' + (s.note || "") + '</i></span>' +
           '</a>';
  }).join("");

  /* ONE tab (client, 2026-08-16). Collapsed the rail is a single handle; the
     five links live in a panel that sits hidden BEHIND it and slides out on
     hover / tap / keyboard focus. The panel is always in the DOM and moved
     with transform only — nothing resizes, so the page never reflows and the
     links stay reachable by assistive tech. */
  var el = document.createElement("aside");
  el.className = "srail";
  el.setAttribute("aria-label", "ART Mechatronics social links");
  el.innerHTML =
    '<div class="srail__panel" id="srailPanel">' + rows + '</div>' +
    '<button class="srail__tab" type="button" aria-expanded="false" aria-controls="srailPanel" aria-label="Social links">' +
      '<span class="srail__tabic" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/>' +
        '<path d="M8.4 10.8 15.6 6.6M8.4 13.2l7.2 4.2"/></svg>' +
      '</span>' +
      '<span class="srail__tabtx">Follow</span>' +
    '</button>';
  document.body.appendChild(el);

  var tab = el.querySelector(".srail__tab");
  function setOpen(open) {
    el.classList.toggle("srail--open", open);
    tab.setAttribute("aria-expanded", open ? "true" : "false");
  }
  tab.addEventListener("click", function () { setOpen(!el.classList.contains("srail--open")); });
  // tapping anywhere else closes it again on touch
  document.addEventListener("click", function (e) {
    if (!el.contains(e.target)) setOpen(false);
  });
  // keyboard users get the same expansion hover gives a mouse user
  el.addEventListener("focusin", function () { setOpen(true); });
  el.addEventListener("focusout", function (e) {
    if (!el.contains(e.relatedTarget)) setOpen(false);
  });
})();
