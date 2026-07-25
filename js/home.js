/* ===== Home — render dynamic bits from window.ART ===== */
(function () {
  const B = ART.brand, S = ART.system;

  // hero disciplines + presence
  const pres = document.getElementById("heroPresence");
  if (pres) pres.textContent = B.presence.join(" · ");

  // flagship
  const fb = document.getElementById("flagBadges");
  if (fb) fb.innerHTML = S.badges.slice(0, 6).map(b => `<span class="chip">${b}</span>`).join("");
  const sl = document.getElementById("seqLine");
  if (sl) sl.innerHTML = S.stages.map((st, i) =>
    `${i ? '<span class="arw">›</span>' : ""}<span class="s">${st.name}</span>`).join("");

  // machines preview grid
  const grid = document.getElementById("homeMgrid");
  if (grid) {
    const featured = ["storage-silos", "ribbon-mixer", "control-panel", "dust-collector"];
    grid.innerHTML = featured.map(id => ART.machines.find(m => m.id === id)).filter(Boolean).map(m => {
      const href = `machine?id=${m.id}`;
      return `
      <article class="card hmcard reveal">
        <a class="hmcard__img" href="${href}" aria-label="${m.name}"><img src="${m.image}" alt="${m.name}" loading="lazy"></a>
        <div class="hmcard__b">
          <h3>${m.name}</h3>
          <p>${m.tagline.split("·")[0].trim()}</p>
          <div class="row">
            <a class="view" href="${href}">View details →</a>
            <a class="wa" href="${ART.helper.wa(m.name)}" target="_blank" rel="noopener">Quote</a>
          </div>
        </div>
      </article>`;
    }).join("");
  }

  // cta whatsapp
  const cta = document.getElementById("ctaWa");
  if (cta) cta.href = ART.helper.wa("Automatic Powder Processing Line");

  // hero video: poster + click-to-play (muted loop once started)
  const hv = document.getElementById("heroVideo");
  const hp = document.getElementById("heroPlay");
  if (hv && hp) {
    const shell = hv.closest(".hero-visual--video");
    const playIcon = '<path d="M8 5l11 7-11 7z"/>';
    const pauseIcon = '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>';
    const syncControl = () => {
      const playing = !hv.paused;
      shell.classList.toggle("playing", playing);
      hp.setAttribute("aria-pressed", String(playing));
      hp.setAttribute("aria-label", playing ? "Pause the line running" : "Play the line running");
      hp.querySelector("svg").innerHTML = playing ? pauseIcon : playIcon;
    };
    const toggle = () => {
      if (hv.paused) hv.play().catch(() => {});
      else hv.pause();
    };
    hp.addEventListener("click", toggle);
    hv.addEventListener("click", toggle);
    hv.addEventListener("pause", syncControl);
    hv.addEventListener("play", syncControl);
    syncControl();
  }

  // reveal for injected cards
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.1 });
    document.querySelectorAll("#homeMgrid .reveal").forEach(el => io.observe(el));
  } else {
    document.querySelectorAll("#homeMgrid .reveal").forEach(el => el.classList.add("in"));
  }
})();
