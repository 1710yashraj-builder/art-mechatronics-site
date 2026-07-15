/* ============================================================
   ART Mechatronics — Live System Demo engine
   Drives: particle flow along SVG pipes + an 8-stage auto-stepper
   + live readouts. Fully controllable (play / pause / restart / jump).
   ============================================================ */
(function () {
  const S = ART.system;
  const svg = document.getElementById("flow");
  if (!svg) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- fill static content ---------- */
  document.getElementById("sysBadges").innerHTML =
    S.badges.map(b => `<span class="chip">${b}</span>`).join("");

  document.getElementById("legend").innerHTML =
    S.legend.map(l => `<span><i style="background:var(${l.var});box-shadow:0 0 8px var(${l.var})"></i>${l.label}</span>`).join("");

  document.getElementById("stepsList").innerHTML =
    S.steps.map(t => `<li>${t}</li>`).join("");

  document.getElementById("outcomes").innerHTML =
    S.outcomes.map(o => `<span class="chip">${o}</span>`).join("");

  /* stage → node id + machine link */
  const NODE = { suction:"node-suction", silos:"node-silos", weighing:"node-silos",
    buffer:"node-buffer", mixer:"node-mixer", sifter:"node-sifter", trolley:"node-trolley", dust:"node-dust" };
  const MACHINE = { silos:"storage-silos", weighing:"buffer-tank", buffer:"buffer-tank",
    mixer:"ribbon-mixer", sifter:"vibro-sifter", trolley:"collection-trolley", dust:"dust-collector" };

  /* ---------- sequence strip ---------- */
  const seq = document.getElementById("seq");
  seq.innerHTML = S.stages.map((st, i) =>
    `<button type="button" data-i="${i}" aria-label="Go to stage ${i+1}: ${st.name}" aria-current="${i===0 ? "true" : "false"}">
       <span class="n">${i+1}</span><span class="t">${st.name}</span>
     </button>`).join("");

  /* ---------- machine behaviour: powder levels inside the vessels ----------
     Each vessel's fill rect spans its full inner bounds and is clipped to the
     vessel shape; we scale it from the bottom (0 = empty, 1 = full).        */
  const SILO_FILLS = ["silo-fill-1", "silo-fill-2", "silo-fill-3"].map(i => document.getElementById(i));
  const BUFFER_FILL = document.getElementById("buffer-fill");
  const TROLLEY_FILL = document.getElementById("trolley-fill");

  //                 suction silos weigh buffer mixer sifter trolley dust
  const SILO_LVL  = [ .15,   .85,  .55,  .35,   .35,  .35,   .35,   .35 ];
  const BUF_LVL   = [ 0,     0,    .45,  .95,   .25,  0,     0,     0   ];
  const TROL_LVL  = [ 0,     0,    0,    0,     0,    .25,   .85,   .95 ];

  const setFill = (elm, k) => { if (elm) elm.style.transform = `scaleY(${k})`; };

  function applyFills(i) {
    // stagger the three silos slightly so they don't read as one object
    SILO_FILLS.forEach((s, n) => setFill(s, Math.max(0, SILO_LVL[i] - n * 0.06)));
    setFill(BUFFER_FILL, BUF_LVL[i]);
    setFill(TROLLEY_FILL, TROL_LVL[i]);
  }

  /* ---------- state ---------- */
  const STAGE_MS = 2600;
  let idx = 0, tIn = 0, running = true, last = 0, cycleProg = 0;
  let narrating = false, currentAudio = null, ttsVoice = null, walkRun = 0;
  const card = document.getElementById("diagramCard");

  const el = {
    step: document.getElementById("pStep"), title: document.getElementById("pTitle"),
    note: document.getElementById("pNote"), link: document.getElementById("pLink"),
    weight: document.getElementById("rWeight"), status: document.getElementById("rStatus"),
    tph: document.getElementById("rTph"), bar: document.getElementById("seqBar"),
    playBtn: document.getElementById("playBtn"), playLabel: document.getElementById("playLabel"),
  };
  if (reduce && el.bar) el.bar.style.transition = "none";  // no animated width for reduced-motion

  // live text on the scene's PLC/HMI glass screen
  const hmi = {
    weight: document.getElementById("hmiWeight"),
    stage:  document.getElementById("hmiStage"),
    status: document.getElementById("hmiStatus"),
  };

  function clearActive() {
    svg.querySelectorAll(".mnode.active").forEach(n => n.classList.remove("active"));
  }
  function setStage(i) {
    idx = ((i % S.stages.length) + S.stages.length) % S.stages.length;
    const st = S.stages[idx];
    clearActive();
    const node = document.getElementById(NODE[st.id]);
    if (node) node.classList.add("active");
    applyFills(idx);

    el.step.textContent = `Stage ${idx + 1} of ${S.stages.length}`;
    el.title.textContent = st.name;
    el.note.textContent = st.note + ".";

    const mid = MACHINE[st.id];
    el.link.innerHTML = mid
      ? `<a class="btn btn--ghost" href="machine.html?id=${mid}">View the ${ART.helper.get(mid).name} →</a>`
      : "";

    seq.querySelectorAll("button").forEach(b =>
      b.setAttribute("aria-current", String(+b.dataset.i === idx)));
  }

  function advance() { tIn = 0; setStage(idx + 1); }

  /* ---------- readouts ---------- */
  const TARGET_KG = 250, TARGET_TPH = 2.4;
  function updateReadouts() {
    // cycleProg = 0..1 across all 8 stages (discrete per-stage when reduced-motion)
    const frac = reduce ? 0 : Math.min(tIn / STAGE_MS, 1);
    cycleProg = (idx + frac) / S.stages.length;
    el.bar.style.width = (cycleProg * 100).toFixed(1) + "%";
    // batch weight builds through weighing+buffer, holds after
    const wPhase = Math.min(Math.max((cycleProg - 0.20) / 0.35, 0), 1);
    const kg = Math.round(wPhase * TARGET_KG);
    el.weight.textContent = kg;
    el.tph.textContent = (running ? TARGET_TPH : 0).toFixed(1);
    el.status.textContent = running ? "RUNNING" : "PAUSED";
    el.status.style.color = running ? "var(--run)" : "var(--warn)";

    // mirror onto the PLC/HMI panel's glass screen inside the scene
    if (hmi.weight) hmi.weight.textContent = kg + " kg";
    if (hmi.stage)  hmi.stage.textContent = (idx + 1) + " / " + S.stages.length;
    if (hmi.status) {
      hmi.status.textContent = running ? "RUN" : "HOLD";
      hmi.status.style.fill = running ? "#7FE3AC" : "#F5A524";
    }
  }

  /* ---------- main loop ---------- */
  function frame(now) {
    if (!last) last = now;
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.1) dt = 0.1; // tab refocus guard

    if (running) {
      // material flow + machine motion are driven by CSS on the .running stage.
      // stepper (paused while the walkthrough drives stages, and off for reduced-motion)
      if (!narrating && !reduce) {
        tIn += dt * 1000;
        if (tIn >= STAGE_MS) advance();
      }
    }
    updateReadouts();
    requestAnimationFrame(frame);
  }

  /* ---------- controls ---------- */
  function setRunning(on) {
    running = on;
    card.classList.toggle("running", on);
    el.playBtn.setAttribute("aria-pressed", String(on));
    el.playLabel.textContent = on ? "Pause line" : "Start line";
    el.playBtn.querySelector("svg").innerHTML = on
      ? '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>'
      : '<path d="M7 4l12 8-12 8z"/>';
  }
  el.playBtn.addEventListener("click", () => {
    const next = !running;
    if (!next) stopNarration();   // pausing the line also stops the tour
    setRunning(next);
  });
  document.getElementById("restartBtn").addEventListener("click", () => { stopNarration(); tIn = 0; setStage(0); setRunning(true); });

  seq.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    stopNarration(); tIn = 0; setStage(+b.dataset.i);
  });

  /* ---------- narrated walkthrough ---------- */
  const N = S.narration || { audioDir: "assets/audio/", intro: "", outro: "", lines: {} };
  const walkBtn = document.getElementById("walkBtn");
  const walkLabel = document.getElementById("walkLabel");
  const cap = document.getElementById("narrCaption");
  const hasTTS = "speechSynthesis" in window;

  function pickVoice() {
    if (!hasTTS) return;
    const vs = speechSynthesis.getVoices();
    ttsVoice = vs.find(v => /en[-_]IN/i.test(v.lang)) ||
               vs.find(v => /india|ravi|heera|neerja|prabhat|aditi/i.test(v.name)) ||
               vs.find(v => /en[-_]GB/i.test(v.lang)) ||
               vs.find(v => /^en/i.test(v.lang)) || vs[0] || null;
  }
  if (hasTTS) { pickVoice(); speechSynthesis.addEventListener("voiceschanged", pickVoice); }

  const wait = ms => new Promise(r => setTimeout(r, ms));

  function speakTTS(text) {
    return new Promise(resolve => {
      let done = false; const fin = () => { if (!done) { done = true; resolve(); } };
      if (!hasTTS) { setTimeout(fin, 1600); return; }
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        if (ttsVoice) u.voice = ttsVoice;
        u.lang = (ttsVoice && ttsVoice.lang) || "en-IN";
        u.rate = 0.98; u.pitch = 1;
        u.onend = fin; u.onerror = fin;
        speechSynthesis.speak(u);
        // safety cap: some engines never fire onend (e.g. no installed voice)
        setTimeout(fin, Math.max(3000, text.split(/\s+/).length * 500) + 2000);
      } catch (e) { setTimeout(fin, 1600); }
    });
  }

  // play a recorded clip if it exists, else speak with the browser voice
  function playClipOrSpeak(url, text) {
    return new Promise(resolve => {
      let done = false, fellBack = false;
      const fin = () => { if (!done) { done = true; resolve(); } };
      const fallback = () => { if (!fellBack) { fellBack = true; speakTTS(text).then(fin); } };
      const audio = new Audio();
      currentAudio = audio;
      audio.addEventListener("ended", fin);
      audio.addEventListener("error", fallback);
      audio.src = url;
      const p = audio.play();
      if (p && p.catch) p.catch(fallback);
    });
  }

  const clip = name => N.audioDir + name + ".mp3";
  function setCaption(text) { cap.hidden = false; cap.textContent = text; }

  function narrate(text, url) {
    setCaption(text);
    walkBtn.classList.add("speaking");
    const minMs = Math.max(2400, text.split(/\s+/).length * 360);
    const t0 = performance.now();
    return playClipOrSpeak(url, text).then(() => {
      const rem = minMs - (performance.now() - t0);
      return rem > 0 ? wait(rem) : null;
    });
  }

  function updateWalkBtn() {
    walkLabel.textContent = narrating ? "Stop walkthrough" : "Play walkthrough";
    walkBtn.setAttribute("aria-pressed", String(narrating));
    walkBtn.classList.toggle("speaking", narrating);
  }

  async function startWalkthrough() {
    if (narrating) return;                 // re-entry guard
    const myRun = ++walkRun;               // stale loops (any run != myRun) must bail
    narrating = true; updateWalkBtn(); setRunning(true);
    tIn = 0; setStage(0);
    await narrate(N.intro, clip("intro"));
    for (let i = 0; i < S.stages.length && walkRun === myRun; i++) {
      tIn = 0; setStage(i);
      const st = S.stages[i];
      await narrate((N.lines && N.lines[st.id]) || st.note, clip("stage-" + st.id));
    }
    if (walkRun === myRun) await narrate(N.outro, clip("outro"));
    if (walkRun === myRun) finishWalkthrough();
  }
  function finishWalkthrough() {
    walkRun++; narrating = false; updateWalkBtn(); cap.hidden = true; tIn = 0; // resume auto stepping
  }
  function stopNarration() {
    if (!narrating) return;
    walkRun++;                              // invalidate any in-flight walkthrough loop
    narrating = false;
    if (hasTTS) speechSynthesis.cancel();
    if (currentAudio) { try { currentAudio.pause(); } catch (e) {} currentAudio = null; }
    updateWalkBtn(); cap.hidden = true;
  }

  walkBtn.addEventListener("click", () => { narrating ? stopNarration() : startWalkthrough(); });
  window.addEventListener("beforeunload", () => { if (hasTTS) speechSynthesis.cancel(); });

  /* node navigation */
  svg.querySelectorAll(".mnode.clickable").forEach(n => {
    const go = () => {
      const m = n.dataset.machine, href = n.dataset.href;
      if (href) location.href = href;
      else if (m) location.href = "machine.html?id=" + m;
    };
    n.addEventListener("click", go);
    n.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  });

  /* pause when tab hidden (saves battery) */
  document.addEventListener("visibilitychange", () => { if (document.hidden) last = 0; });

  /* ---------- go ---------- */
  setStage(0);
  setRunning(true);
  requestAnimationFrame(frame);
})();
