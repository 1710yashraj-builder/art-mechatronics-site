/* ===== Home — render dynamic bits from window.ART =====
   Shrank from 85 lines to this on 2026-08-01, when sections 2, 5 and 7 were
   deleted from index.html. Every block that went was already null-guarded, so
   leaving them would not have thrown — it would just have been ~70 lines that
   can never execute plus five references to ids that no longer exist anywhere
   on the site. Deleted rather than left, for the record:
     #flagBadges / #seqLine  — the flagship section (that also freed the
                               `S = ART.system` binding on the old L3).
     #homeMgrid              — the four featured machine cards, and with them
                               the only call to ART.revealScan on this page and
                               a SECOND IntersectionObserver that duplicated it.
     #heroVideo / #heroPlay  — the video band's play control, 33 lines.
   js/data.js is untouched: layout.js still builds the footer machine list from
   ART.machines, and js/system.js still reads ART.system.badges and .stages.
   The two effects that replaced those sections live in js/count.js and
   js/drawline.js, loaded after this file. ===== */
(function () {
  const B = ART.brand;

  // hero disciplines + presence
  const pres = document.getElementById("heroPresence");
  if (pres) pres.textContent = B.presence.join(" · ");

  // cta whatsapp — rewrites the shipped href="#" into a wa.me URL, which
  // layout.js L251-259 then intercepts into the region picker.
  const cta = document.getElementById("ctaWa");
  if (cta) cta.href = ART.helper.wa("Automatic Powder Processing Line");
})();
