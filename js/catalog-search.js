/* ============================================================
   ART Mechatronics — catalogue / industries live search + filter
   Purely client-side. Cards carry data-name and data-cat.
   ============================================================ */
(function () {
  const search = document.getElementById("catSearch");
  const grid = document.getElementById("catGrid");
  const empty = document.getElementById("catEmpty");
  const filterBar = document.getElementById("catFilters");
  if (!grid) return;

  const cards = Array.from(grid.querySelectorAll(".cat-card"));
  let q = "";
  let cat = "all";

  function apply() {
    let shown = 0;
    cards.forEach((c) => {
      const name = c.dataset.name || "";
      const okQ = !q || name.includes(q);
      const okC = cat === "all" || c.dataset.cat === cat;
      const show = okQ && okC;
      c.hidden = !show;
      if (show) shown++;
    });
    if (empty) empty.hidden = shown !== 0;
  }

  if (search) {
    search.addEventListener("input", () => { q = search.value.trim().toLowerCase(); apply(); });
  }
  if (filterBar) {
    filterBar.addEventListener("click", (e) => {
      const b = e.target.closest(".fbtn");
      if (!b) return;
      filterBar.querySelectorAll(".fbtn").forEach((x) => x.classList.toggle("is-on", x === b));
      cat = b.dataset.cat || "all";
      apply();
    });
  }
})();
