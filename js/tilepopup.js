/* ===== Tile popup — the tile's own dropdown, shown as a dialog =====
   Client, 2026-08-16: clicking a tile should open its sub-category list in a
   popup instead of navigating.

   2026-08-18, client: the "View the full <name> page" button is gone. The list
   itself is the way forward now — every row was always a real link to its own
   page, it just did not look like one, so the rows got a chevron and a proper
   hover/focus state in base.css. And the sub-label is his wording,
   "Find your product below", on both grids.

   Fail-open, the house rule: every tile stays a real <a href> and this file
   only ever calls preventDefault AFTER the dialog has been built and shown.
   Script blocked, dialog unsupported, an exception mid-way — the click falls
   through and the visitor gets the full page exactly as before. Nothing here
   can produce a dead tile.

   Uses native <dialog>: focus trapping, Esc-to-close, inertness of the page
   behind and the backdrop all come from the platform rather than from code
   we would have to maintain and get wrong. ===== */
(function () {
  var ONLY = null;                          // sample mode over: every tile, both grids
  var LEAD = "Find your product below";     // client's wording, 2026-08-18

  var tiles = [].slice.call(document.querySelectorAll(".ig-tile, .mc-tile-wrap"));
  if (!tiles.length) return;                // no grid on this page, nothing to wire

  /* The dialog is built here instead of being authored into the page. It is an
     empty shell that only this script ever fills, so a static copy in the
     markup bought nothing — and it had to be repeated in every page carrying a
     grid, which is exactly why the popup was missing on the Industries page
     and the ten category pages. One definition, every page that has tiles. */
  var dlg = document.createElement("dialog");
  if (typeof dlg.showModal !== "function") return;   // no dialog support: links stay links
  dlg.className = "tile-modal";
  dlg.id = "tileModal";
  dlg.setAttribute("aria-labelledby", "tileModalTitle");
  dlg.innerHTML =
    '<div class="tile-modal__card">' +
      '<div class="tile-modal__head">' +
        '<h2 class="tile-modal__title" id="tileModalTitle" data-modal-title></h2>' +
        '<button class="tile-modal__x" type="button" data-modal-close aria-label="Close">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
          'stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="tile-modal__body" data-modal-body></div>' +
    '</div>';
  document.body.appendChild(dlg);

  var body = dlg.querySelector("[data-modal-body]");
  var titleEl = dlg.querySelector("[data-modal-title]");
  var lastFocus = null;

  function open(tile, drop, name) {
    var list = drop.querySelector("ul");
    if (!list) return false;                       // nothing to show -> let the link work

    titleEl.textContent = name;
    body.innerHTML = "";

    var lead = document.createElement("p");
    lead.className = "tile-modal__lead";
    lead.textContent = LEAD;
    body.appendChild(lead);

    body.appendChild(list.cloneNode(true));        // the dropdown's own list, verbatim

    var n = list.querySelectorAll("li").length;
    dlg.classList.toggle("tile-modal--wide", n > 8);   // 2 columns once it gets long

    lastFocus = document.activeElement;
    dlg.showModal();
    return true;
  }

  function wire(tile) {
    var drop = tile.querySelector(".ig-drop, .mc-drop");
    var link = tile.querySelector(".ig-link, .mc-tile");
    var caret = tile.querySelector(".ig-caret, .mc-caret");
    if (!drop || !link) return;
    if (ONLY && drop.id !== ONLY) return;

    var nameEl = tile.querySelector(".ig-name, .mc-tile__name");
    var name = nameEl ? nameEl.textContent.trim() : "This category";

    link.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;  // let people open tabs
      try {
        if (open(tile, drop, name)) e.preventDefault();
      } catch (err) { /* fall through to the page */ }
    });

    if (caret) {
      caret.addEventListener("click", function (e) {
        e.stopPropagation();
        try { if (open(tile, drop, name)) e.preventDefault(); } catch (err) {}
      }, true);
    }
  }

  tiles.forEach(wire);

  dlg.addEventListener("close", function () {
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  });
  dlg.querySelector("[data-modal-close]").addEventListener("click", function () { dlg.close(); });
  // click on the backdrop (outside the card) closes
  dlg.addEventListener("click", function (e) {
    if (e.target === dlg) dlg.close();
  });
})();
