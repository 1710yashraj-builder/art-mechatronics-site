/* ===== Tile popup — the tile's own dropdown, shown as a dialog =====
   Client, 2026-08-16: clicking a tile should open its sub-category list in a
   popup instead of navigating, with the full page still reachable from inside.

   SAMPLE MODE. `ONLY` below limits this to one tile (Mouth Freshener) so it
   can be judged before it touches the other 42. Set ONLY = null to enable
   every tile in both grids — that is the whole rollout, one line.

   Fail-open, the house rule: every tile stays a real <a href> and this file
   only ever calls preventDefault AFTER the dialog has been built and shown.
   Script blocked, dialog unsupported, an exception mid-way — the click falls
   through and the visitor gets the full page exactly as before. Nothing here
   can produce a dead tile.

   Uses native <dialog>: focus trapping, Esc-to-close, inertness of the page
   behind and the backdrop all come from the platform rather than from code
   we would have to maintain and get wrong. ===== */
(function () {
  var ONLY = "igd-mouth-freshener";        // <- null to enable every tile

  var dlg = document.getElementById("tileModal");
  if (!dlg || typeof dlg.showModal !== "function") return;   // no dialog: links stay links

  var body = dlg.querySelector("[data-modal-body]");
  var titleEl = dlg.querySelector("[data-modal-title]");
  var moreEl = dlg.querySelector("[data-modal-more]");
  var lastFocus = null;

  function open(tile, drop, name, href) {
    var list = drop.querySelector("ul");
    if (!list) return false;                       // nothing to show -> let the link work

    titleEl.textContent = name;
    body.innerHTML = "";
    body.appendChild(list.cloneNode(true));        // the dropdown's own list, verbatim
    moreEl.href = href;
    moreEl.textContent = "View the full " + name + " page";

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
    var href = link.getAttribute("href");

    link.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;  // let people open tabs
      try {
        if (open(tile, drop, name, href)) e.preventDefault();
      } catch (err) { /* fall through to the page */ }
    });

    if (caret) {
      caret.addEventListener("click", function (e) {
        e.stopPropagation();
        try { if (open(tile, drop, name, href)) e.preventDefault(); } catch (err) {}
      }, true);
    }
  }

  [].forEach.call(document.querySelectorAll(".ig-tile, .mc-tile-wrap"), wire);

  dlg.addEventListener("close", function () {
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  });
  dlg.querySelector("[data-modal-close]").addEventListener("click", function () { dlg.close(); });
  // click on the backdrop (outside the card) closes
  dlg.addEventListener("click", function (e) {
    if (e.target === dlg) dlg.close();
  });
})();
