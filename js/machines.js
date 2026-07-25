/* ===== Machines index — render grid from window.ART ===== */
(function () {
  const grid = document.getElementById("miGrid");
  if (!grid) return;
  const machines = [...ART.machines].sort((a, b) => a.order - b.order);

  grid.innerHTML = machines.map(m => {
    const specs = m.specs.slice(0, 3).map(([k, v]) =>
      `<li><span class="k">${k}</span><span class="v">${v}</span></li>`).join("");
    const href = `machine?id=${m.id}`;
    return `
    <article class="card mcard reveal">
      <a class="mcard__img" href="${href}" aria-label="${m.name}">
        <span class="mcard__no">${String(m.order).padStart(2, "0")}</span>
        <img src="${m.image}" alt="${m.name}" loading="lazy">
      </a>
      <div class="mcard__body">
        <h3>${m.name}</h3>
        <div class="mcard__tag">${m.tagline}</div>
        <ul class="mcard__specs">${specs}</ul>
        <div class="mcard__actions">
          <a class="btn btn--primary" href="${href}">View details</a>
          <a class="btn btn--wa" href="${ART.helper.wa(m.name)}" target="_blank" rel="noopener">Quote</a>
        </div>
      </div>
    </article>`;
  }).join("");

  // re-run reveal observer for freshly injected nodes
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.1 });
    grid.querySelectorAll(".reveal").forEach(el => io.observe(el));
  } else {
    grid.querySelectorAll(".reveal").forEach(el => el.classList.add("in"));
  }
})();
