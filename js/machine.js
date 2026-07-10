/* ===== Machine detail — render from ?id= against window.ART ===== */
(function () {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const m = id && ART.helper.get(id);
  if (!m) { location.replace("machines.html"); return; }

  // sorted for prev/next
  const list = [...ART.machines].sort((a, b) => a.order - b.order);
  const pos = list.findIndex(x => x.id === m.id);
  const prev = list[(pos - 1 + list.length) % list.length];
  const next = list[(pos + 1) % list.length];

  document.title = `${m.name} — ART Mechatronics`;
  const meta = document.getElementById("metaDesc");
  if (meta) meta.setAttribute("content", m.summary);

  const gallery = (m.gallery && m.gallery.length ? m.gallery : [m.image]);
  const thumbs = gallery.length > 1
    ? `<div class="md-thumbs">${gallery.map((g, i) =>
        `<button data-src="${g}" aria-current="${i === 0}" aria-label="View image ${i + 1}"><img src="${g}" alt="${m.name} view ${i + 1}"></button>`).join("")}</div>`
    : "";

  const features = m.features.map(f => `<li>${f}</li>`).join("");
  const comps = m.components.map(([b, d]) => `<div class="comp"><b>${b}</b><span>${d}</span></div>`).join("");
  const specs = m.specs.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join("");
  const note = m.note ? `<p class="spec-note">${m.note}</p>` : "";
  const apps = m.applications.map(a => `<span class="chip">${a}</span>`).join("");

  document.getElementById("mdRoot").innerHTML = `
  <section class="md-hero">
    <div class="wrap">
      <div class="md-hero__grid">
        <div>
          <span class="eyebrow">Machine ${String(m.order).padStart(2, "0")} of ${String(list.length).padStart(2, "0")}</span>
          <h1>${m.name}</h1>
          <div class="md-hero__tag">${m.tagline}</div>
          <p class="lead">${m.summary}</p>
          <div class="md-cta">
            <a class="btn btn--wa btn--lg" href="${ART.helper.wa(m.name)}" target="_blank" rel="noopener">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.9.9-2.8-.2-.3A8 8 0 1 1 12 20zm4.5-5.8c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.1-.2 0-.4.1-.5l.4-.5c.1-.2.1-.3 0-.5l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.7.7-.9 1.6-.6 2.6.5 1.7 1.6 3.1 3.2 4.1 1.2.7 2.1.9 2.8.8.6-.1 1.4-.6 1.6-1.2.2-.5.2-1 .1-1.1z"/></svg>
              Get a quote on WhatsApp
            </a>
            <a class="btn btn--outline-light btn--lg" href="contact.html">Enquire</a>
            <button class="btn btn--outline-light btn--lg" id="printBtn" type="button">Print / PDF</button>
          </div>
        </div>
        <div>
          <figure class="md-figure">
            <div class="md-figure__main"><img id="mdMain" src="${gallery[0]}" alt="${m.name}"></div>
            ${thumbs}
          </figure>
        </div>
      </div>
    </div>
  </section>

  <section class="md-section">
    <div class="wrap">
      <div class="md-cols">
        <div>
          <span class="eyebrow">Key features</span>
          <h2>Built for ${m.tagline.split("·")[0].trim().toLowerCase()}</h2>
          <ul class="checks">${features}</ul>
        </div>
        <div>
          <span class="eyebrow">Key components</span>
          <h2>What's inside</h2>
          <div class="comp-grid">${comps}</div>
        </div>
      </div>
    </div>
  </section>

  <section class="md-section" style="background:var(--mist)">
    <div class="wrap">
      <div class="md-cols">
        <div>
          <span class="eyebrow">Technical specifications</span>
          <h2>The numbers</h2>
          <table class="spec-table"><tbody>${specs}</tbody></table>
          ${note}
        </div>
        <div>
          <span class="eyebrow">Ideal for</span>
          <h2>Industries &amp; applications</h2>
          <div class="app-chips">${apps}</div>
          <p style="margin-top:1.5rem;color:var(--slate)">Every ART machine is customisable in stainless steel 304 / 316 to suit your product, capacity and hygiene requirements.</p>
          <a class="btn btn--primary" href="${ART.helper.wa(m.name)}" target="_blank" rel="noopener">Discuss your requirement</a>
        </div>
      </div>
    </div>
  </section>

  <section class="md-section">
    <div class="wrap">
      <div class="md-line-band">
        <div>
          <h3>Part of the complete automatic line</h3>
          <p>The ${m.name} integrates into ART's fully automatic powder batching, mixing, sieving &amp; collection system — one PLC, minimal manpower.</p>
        </div>
        <div class="btns">
          <a class="btn btn--light" href="system.html">Watch it run →</a>
          <a class="btn btn--outline-light" href="control-panel.html">Virtual control panel</a>
        </div>
      </div>

      <nav class="md-nav" aria-label="Machine navigation">
        <a class="prev" href="machine.html?id=${prev.id}"><span class="dir">← Previous</span><span class="nm">${prev.name}</span></a>
        <a class="next" href="machine.html?id=${next.id}"><span class="dir">Next →</span><span class="nm">${next.name}</span></a>
      </nav>
    </div>
  </section>`;

  // thumbnail switching
  document.querySelectorAll(".md-thumbs button").forEach(b => {
    b.addEventListener("click", () => {
      document.getElementById("mdMain").src = b.dataset.src;
      document.querySelectorAll(".md-thumbs button").forEach(x => x.setAttribute("aria-current", "false"));
      b.setAttribute("aria-current", "true");
    });
  });
  // print
  const pb = document.getElementById("printBtn");
  if (pb) pb.addEventListener("click", () => window.print());
})();
