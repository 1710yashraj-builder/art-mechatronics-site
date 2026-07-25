/* ============================================================
   ART Mechatronics · live powder-line digital twin
   Stage-aware machinery, material flow, representative telemetry,
   narration and accessible operator controls.
   ============================================================ */
(function () {
  "use strict";

  const S = window.ART && ART.system;
  const svg = document.getElementById("flow");
  const card = document.getElementById("diagramCard");
  if (!S || !svg || !card) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = id => document.getElementById(id);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const pad = value => String(value).padStart(2, "0");

  /* ---------- static content ---------- */
  $("sysBadges").innerHTML = S.badges.slice(0, 5)
    .map(label => `<span class="chip">${label}</span>`).join("");
  $("legend").innerHTML = S.legend
    .map(item => `<span><i style="background:var(${item.var});box-shadow:0 0 8px var(${item.var})"></i>${item.label}</span>`)
    .join("");
  $("stepsList").innerHTML = S.steps.map(step => `<li>${step}</li>`).join("");
  $("outcomes").innerHTML = S.outcomes.map(item => `<span class="chip">${item}</span>`).join("");

  const NODE = {
    suction: ["node-suction"],
    silos: ["node-silos"],
    weighing: ["node-silos", "node-buffer"],
    buffer: ["node-buffer"],
    mixer: ["node-mixer"],
    sifter: ["node-sifter"],
    trolley: ["node-trolley"],
    dust: ["node-dust"],
  };
  const MACHINE = {
    silos: "storage-silos",
    weighing: "buffer-tank",
    buffer: "buffer-tank",
    mixer: "ribbon-mixer",
    sifter: "vibro-sifter",
    trolley: "collection-trolley",
    dust: "dust-collector",
  };
  const SIGNAL = {
    suction: ["Conveying state", "VACUUM STABLE"],
    silos: ["Silo inlet valves", "SEQUENCED"],
    weighing: ["Dosing sequence", "IN TOLERANCE"],
    buffer: ["Batch collection", "READY"],
    mixer: ["Mixer drive", "BLENDING"],
    sifter: ["Screening state", "ACTIVE"],
    trolley: ["Collection state", "RECEIVING"],
    dust: ["Extraction state", "ONLINE"],
  };

  /* ---------- selector strip ---------- */
  const seq = $("seq");
  seq.innerHTML = S.stages.map((stage, index) =>
    `<button type="button" data-i="${index}" aria-label="Go to stage ${index + 1}: ${stage.name}" aria-current="${index === 0}">
      <span class="n">${pad(index + 1)}</span><span class="t">${stage.name}</span>
    </button>`).join("");

  /* ---------- map real routes to physical process stages ----------
     Paths are paired as glow + core. Extraction remains online as a
     supporting utility during the serial material process. */
  function assignFlowStages(selector, stages) {
    [...svg.querySelectorAll(selector)].forEach((path, index) => {
      path.dataset.flowStage = stages[Math.floor(index / 2)] || "";
    });
  }
  assignFlowStages(".flows .flow.powder, .flows .flow-glow.powder", [
    "suction,silos",
    "silos",
    "silos",
    "silos",
    "weighing",
    "weighing",
    "weighing",
    "buffer,mixer",
    "mixer,sifter",
    "sifter,trolley",
  ]);
  assignFlowStages(".flows .flow.air, .flows .flow-glow.air", ["suction", "suction"]);
  assignFlowStages(".flows .flow.dust, .flows .flow-glow.dust", [
    "utility", "utility", "utility", "utility", "utility", "utility",
  ]);

  let activeParticlePaths = [];
  function applyFlows(stageId) {
    svg.querySelectorAll(".flow, .flow-glow").forEach(path => {
      path.classList.remove("active-flow", "support-flow");
      const stages = (path.dataset.flowStage || "").split(",");
      if (stages.includes(stageId)) path.classList.add("active-flow");
      else if (stages.includes("utility")) {
        path.classList.add(stageId === "dust" ? "active-flow" : "support-flow");
      }
    });
    activeParticlePaths = [...svg.querySelectorAll(".flows .flow.active-flow")];
  }

  /* ---------- restrained particles on only the active routes ---------- */
  const particleGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  particleGroup.setAttribute("class", "live-particles");
  particleGroup.setAttribute("aria-hidden", "true");
  svg.querySelector(".flows").appendChild(particleGroup);
  const particles = Array.from({ length: reduce ? 0 : 24 }, (_, index) => {
    const particle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    particle.setAttribute("r", index % 4 === 0 ? "2.8" : "1.8");
    particle.setAttribute("visibility", "hidden");
    particleGroup.appendChild(particle);
    return particle;
  });
  const pathLength = new WeakMap();
  function updateParticles(now, enabled) {
    if (!enabled || !activeParticlePaths.length) {
      particles.forEach(particle => particle.setAttribute("visibility", "hidden"));
      return;
    }
    particles.forEach((particle, index) => {
      const path = activeParticlePaths[index % activeParticlePaths.length];
      let length = pathLength.get(path);
      if (!length) {
        length = path.getTotalLength();
        pathLength.set(path, length);
      }
      const speed = path.classList.contains("air") ? 780 : path.classList.contains("dust") ? 1450 : 1120;
      const progress = ((now / speed) + index / particles.length + (index % 5) * .07) % 1;
      const point = path.getPointAtLength(progress * length);
      particle.setAttribute("cx", point.x.toFixed(2));
      particle.setAttribute("cy", point.y.toFixed(2));
      particle.setAttribute("visibility", "visible");
      particle.setAttribute("class",
        `fx-particle ${path.classList.contains("air") ? "air" : path.classList.contains("dust") ? "dust" : "powder"}`);
    });
  }

  /* ---------- vessel levels ---------- */
  const SILO_FILLS = ["silo-fill-1", "silo-fill-2", "silo-fill-3"].map($);
  const BUFFER_FILL = $("buffer-fill");
  const TROLLEY_FILL = $("trolley-fill");
  const SILO_LEVEL = [.15, .85, .55, .35, .35, .35, .35, .35];
  const BUFFER_LEVEL = [0, 0, .45, .95, .25, 0, 0, 0];
  const TROLLEY_LEVEL = [0, 0, 0, 0, 0, .25, .85, .95];
  const setFill = (element, value) => {
    if (element) element.style.transform = `scaleY(${value})`;
  };
  function applyFills(index) {
    SILO_FILLS.forEach((silo, offset) => setFill(silo, Math.max(0, SILO_LEVEL[index] - offset * .06)));
    setFill(BUFFER_FILL, BUFFER_LEVEL[index]);
    setFill(TROLLEY_FILL, TROLLEY_LEVEL[index]);
  }

  /* ---------- state and element cache ---------- */
  const STAGE_MS = 4800;
  let stageIndex = 0;
  let stageElapsed = 0;
  let running = true;
  let lastFrame = 0;
  let lastUi = 0;
  let lastTrend = 0;
  let pageVisible = !document.hidden;
  let sceneVisible = true;
  let batchNumber = 1;
  let narrating = false;
  let currentAudio = null;
  let ttsVoice = null;
  let walkRun = 0;

  const el = {
    step: $("pStep"),
    title: $("pTitle"),
    note: $("pNote"),
    link: $("pLink"),
    cycle: $("rCycle"),
    status: $("rStatus"),
    signalLabel: $("rSignalLabel"),
    signal: $("rSignal"),
    interlocks: $("rInterlocks"),
    batch: $("rBatch"),
    sequence: $("rSequence"),
    bar: $("seqBar"),
    playBtn: $("playBtn"),
    playLabel: $("playLabel"),
    mastStatus: $("mastStatus"),
    stageCode: $("sceneStageCode"),
    stageName: $("sceneStageName"),
    sceneState: $("sceneState"),
    clock: $("plantClock"),
    announce: $("stageAnnounce"),
    eventLog: $("eventLog"),
  };
  const hmi = {
    batch: $("hmiBatch"),
    weight: $("hmiWeight"),
    stage: $("hmiStage"),
    status: $("hmiStatus"),
  };

  /* ---------- representative trend renderer ---------- */
  const chart = $("telemetryChart");
  const ctx = chart && chart.getContext("2d");
  const trend = {
    load: Array(46).fill(24),
    flow: Array(46).fill(12),
    extraction: Array(46).fill(44),
  };
  const TREND_BASE = [
    [38, 55, 48], [44, 68, 52], [52, 38, 55], [47, 34, 55],
    [72, 46, 58], [58, 52, 62], [35, 66, 57], [28, 18, 78],
  ];
  function sizeChart() {
    if (!ctx) return;
    const rect = chart.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(rect.width * dpr);
    const height = Math.round(92 * dpr);
    if (chart.width !== width || chart.height !== height) {
      chart.width = width;
      chart.height = height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }
  function pushTrend(now) {
    const base = TREND_BASE[stageIndex];
    const wave = Math.sin(now / 680);
    const values = [
      clamp(base[0] + wave * 5 + Math.sin(now / 310) * 2, 8, 92),
      clamp(base[1] + wave * 7, 6, 92),
      clamp(base[2] + Math.sin(now / 830) * 3, 12, 94),
    ];
    ["load", "flow", "extraction"].forEach((key, index) => {
      trend[key].push(values[index]);
      trend[key].shift();
    });
  }
  function drawTrend() {
    if (!ctx) return;
    sizeChart();
    const width = chart.width / Math.min(window.devicePixelRatio || 1, 2);
    const height = chart.height / Math.min(window.devicePixelRatio || 1, 2);
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(94,126,157,.13)";
    ctx.lineWidth = 1;
    for (let row = 1; row < 4; row += 1) {
      const y = (height / 4) * row;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    const lines = [
      ["load", "#4b9cf1"],
      ["flow", "#45cf82"],
      ["extraction", "#d9a441"],
    ];
    lines.forEach(([key, color]) => {
      ctx.beginPath();
      trend[key].forEach((value, index) => {
        const x = (index / (trend[key].length - 1)) * width;
        const y = height - (value / 100) * (height - 10) - 5;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
    });
  }
  if (window.ResizeObserver && chart) new ResizeObserver(drawTrend).observe(chart);
  else window.addEventListener("resize", drawTrend);

  /* ---------- stage transitions ---------- */
  function formatTime(date) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }
  function updateEventLog(stage) {
    const time = formatTime(new Date());
    el.eventLog.innerHTML = [
      `<li><time>${time}</time><span>${stage.name} active in representative sequence</span></li>`,
      `<li><time>${time}</time><span>Safety interlock chain ready</span></li>`,
      `<li><time>${time}</time><span>Dust extraction auxiliary online</span></li>`,
    ].join("");
  }
  function centerActiveOnMobile(nodes) {
    if (window.innerWidth > 720 || !nodes.length) return;
    requestAnimationFrame(() => {
      const node = nodes[0];
      const box = node.getBBox();
      const centre = box.x + box.width / 2;
      const maxScroll = card.scrollWidth - card.clientWidth;
      const target = clamp((centre / 1180) * card.scrollWidth - card.clientWidth / 2, 0, maxScroll);
      card.scrollTo({ left: target, behavior: reduce ? "auto" : "smooth" });
    });
  }
  function setStage(index, announce) {
    stageIndex = ((index % S.stages.length) + S.stages.length) % S.stages.length;
    const stage = S.stages[stageIndex];
    card.dataset.stage = stage.id;
    svg.querySelectorAll(".mnode.active").forEach(node => node.classList.remove("active"));
    const activeNodes = (NODE[stage.id] || []).map($).filter(Boolean);
    activeNodes.forEach(node => node.classList.add("active"));
    const dustNode = $("node-dust");
    if (dustNode) dustNode.classList.add("utility-online");
    applyFlows(stage.id);
    applyFills(stageIndex);

    el.step.textContent = `Stage ${stageIndex + 1} of ${S.stages.length}`;
    el.title.textContent = stage.name;
    el.note.textContent = stage.note.replace(/[.]+$/, "") + ".";
    el.stageCode.textContent = `STAGE ${pad(stageIndex + 1)} / ${pad(S.stages.length)}`;
    el.stageName.textContent = stage.name.toUpperCase();
    el.sequence.textContent = `${pad(stageIndex + 1)} / ${pad(S.stages.length)}`;
    const signal = SIGNAL[stage.id];
    el.signalLabel.textContent = signal[0];
    el.signal.textContent = signal[1];

    const machineId = MACHINE[stage.id];
    const machine = machineId && ART.helper.get(machineId);
    el.link.innerHTML = machine
      ? `<a class="btn btn--ghost" href="machine?id=${machineId}">Inspect ${machine.name}</a>`
      : "";

    seq.querySelectorAll("button").forEach(button =>
      button.setAttribute("aria-current", String(+button.dataset.i === stageIndex)));
    document.querySelectorAll("#heroProcess [data-stage]").forEach((item, itemIndex) => {
      item.classList.toggle("is-active", item.dataset.stage === stage.id);
      item.classList.toggle("is-complete", itemIndex < stageIndex);
    });
    updateEventLog(stage);
    centerActiveOnMobile(activeNodes);
    if (announce) el.announce.textContent = `Stage ${stageIndex + 1}: ${stage.name}. ${stage.note}.`;
  }
  function advance() {
    stageElapsed = 0;
    if (stageIndex === S.stages.length - 1) batchNumber += 1;
    setStage(stageIndex + 1, true);
  }

  /* ---------- throttled operator UI ---------- */
  function updateUi(now) {
    const fraction = reduce ? 0 : clamp(stageElapsed / STAGE_MS, 0, 1);
    const cycleProgress = (stageIndex + fraction) / S.stages.length;
    const cyclePercent = Math.round(cycleProgress * 100);
    el.bar.style.transform = `scaleX(${cycleProgress.toFixed(4)})`;
    el.cycle.textContent = cyclePercent;
    el.status.textContent = running ? "RUNNING" : "SAFE HOLD";
    el.status.style.color = running ? "#5edd94" : "#d9a441";
    el.interlocks.textContent = running ? "8 / 8 READY" : "SAFE HOLD";
    el.batch.textContent = `#${String(batchNumber).padStart(4, "0")}`;
    el.mastStatus.textContent = running ? "RUNNING" : "SAFE HOLD";
    el.sceneState.textContent = running ? "ACTIVE" : "HOLD";
    el.clock.textContent = formatTime(new Date());

    const batchProgress = clamp((cycleProgress - .2) / .72, 0, 1);
    if (hmi.batch) hmi.batch.textContent = `#${String(batchNumber).padStart(4, "0")}`;
    if (hmi.weight) hmi.weight.textContent = `${Math.round(batchProgress * 100)} %`;
    if (hmi.stage) hmi.stage.textContent = `${stageIndex + 1} / ${S.stages.length}`;
    if (hmi.status) {
      hmi.status.textContent = running ? "RUN" : "HOLD";
      hmi.status.style.fill = running ? "#7FE3AC" : "#D9A441";
    }
    if (now - lastTrend > 320) {
      pushTrend(now);
      drawTrend();
      lastTrend = now;
    }
  }

  /* ---------- animation loop ---------- */
  function frame(now) {
    requestAnimationFrame(frame);
    if (!lastFrame) lastFrame = now;
    let delta = (now - lastFrame) / 1000;
    lastFrame = now;
    if (!pageVisible || !sceneVisible) return;
    delta = Math.min(delta, .1);
    if (running && !narrating && !reduce) {
      stageElapsed += delta * 1000;
      if (stageElapsed >= STAGE_MS) advance();
    }
    if (now - lastUi > 100) {
      updateUi(now);
      lastUi = now;
    }
    updateParticles(now, running && !reduce);
  }

  /* ---------- line controls ---------- */
  function setRunning(next) {
    running = next;
    card.classList.toggle("running", next);
    el.playBtn.setAttribute("aria-pressed", String(next));
    el.playLabel.textContent = next ? "Pause line" : "Start line";
    el.playBtn.querySelector("svg").innerHTML = next
      ? '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>'
      : '<path d="M7 4l12 8-12 8z"/>';
    updateUi(performance.now());
  }
  el.playBtn.addEventListener("click", () => {
    const next = !running;
    if (!next) stopNarration();
    setRunning(next);
  });
  $("restartBtn").addEventListener("click", () => {
    stopNarration();
    batchNumber = 1;
    stageElapsed = 0;
    setStage(0, true);
    setRunning(true);
  });
  seq.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    stopNarration();
    stageElapsed = 0;
    setStage(+button.dataset.i, true);
  });

  /* ---------- full-screen control-room mode ---------- */
  const fullBtn = $("fullBtn");
  const fullLabel = $("fullLabel");
  const sysMain = document.querySelector(".sys-main");
  if (!document.fullscreenEnabled) fullBtn.hidden = true;
  fullBtn.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) await sysMain.requestFullscreen();
      else await document.exitFullscreen();
    } catch (_) {
      fullBtn.hidden = true;
    }
  });
  document.addEventListener("fullscreenchange", () => {
    fullLabel.textContent = document.fullscreenElement ? "Exit full screen" : "Full screen";
  });

  /* ---------- subtle operator-light response ---------- */
  card.addEventListener("pointermove", event => {
    if (reduce) return;
    const bounds = card.getBoundingClientRect();
    card.style.setProperty("--spot-x", `${((event.clientX - bounds.left) / bounds.width * 100).toFixed(1)}%`);
    card.style.setProperty("--spot-y", `${((event.clientY - bounds.top) / bounds.height * 100).toFixed(1)}%`);
  });
  card.addEventListener("pointerleave", () => {
    card.style.setProperty("--spot-x", "52%");
    card.style.setProperty("--spot-y", "38%");
  });

  /* ---------- machine probe and navigation ---------- */
  const probe = $("machineProbe");
  svg.querySelectorAll(".mnode.clickable").forEach(node => {
    const showProbe = () => {
      const machine = node.dataset.machine && ART.helper.get(node.dataset.machine);
      const name = (machine && machine.name) || node.getAttribute("aria-label") || "ART machine";
      probe.innerHTML = `<b>${name}</b>Inspect verified machine details`;
      probe.hidden = false;
    };
    const hideProbe = () => { probe.hidden = true; };
    const go = () => {
      const machineId = node.dataset.machine;
      const href = node.dataset.href;
      if (href) location.href = href;
      else if (machineId) location.href = `machine?id=${machineId}`;
    };
    node.addEventListener("pointerenter", showProbe);
    node.addEventListener("pointerleave", hideProbe);
    node.addEventListener("focus", showProbe);
    node.addEventListener("blur", hideProbe);
    node.addEventListener("click", go);
    node.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        go();
      }
    });
  });

  /* ---------- narrated walkthrough ----------
     Recorded audio is requested only when explicitly enabled in data,
     so missing optional clips never generate failed network requests. */
  const N = S.narration || { audioDir: "assets/audio/", intro: "", outro: "", lines: {} };
  const walkBtn = $("walkBtn");
  const walkLabel = $("walkLabel");
  const caption = $("narrCaption");
  const hasTTS = "speechSynthesis" in window;
  function pickVoice() {
    if (!hasTTS) return;
    const voices = speechSynthesis.getVoices();
    ttsVoice =
      voices.find(voice => /en[-_]IN/i.test(voice.lang)) ||
      voices.find(voice => /india|ravi|heera|neerja|prabhat|aditi/i.test(voice.name)) ||
      voices.find(voice => /en[-_]GB/i.test(voice.lang)) ||
      voices.find(voice => /^en/i.test(voice.lang)) ||
      voices[0] || null;
  }
  if (hasTTS) {
    pickVoice();
    speechSynthesis.addEventListener("voiceschanged", pickVoice);
  }
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  function speakTTS(text) {
    return new Promise(resolve => {
      let finished = false;
      const finish = () => {
        if (!finished) {
          finished = true;
          resolve();
        }
      };
      if (!hasTTS) {
        setTimeout(finish, 1600);
        return;
      }
      try {
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        if (ttsVoice) utterance.voice = ttsVoice;
        utterance.lang = (ttsVoice && ttsVoice.lang) || "en-IN";
        utterance.rate = .98;
        utterance.pitch = 1;
        utterance.onend = finish;
        utterance.onerror = finish;
        speechSynthesis.speak(utterance);
        setTimeout(finish, Math.max(3000, text.split(/\s+/).length * 500) + 2000);
      } catch (_) {
        setTimeout(finish, 1600);
      }
    });
  }
  function playClip(url, text) {
    if (N.recordedAudio !== true) return speakTTS(text);
    return new Promise(resolve => {
      let finished = false;
      const finish = () => {
        if (!finished) {
          finished = true;
          resolve();
        }
      };
      const audio = new Audio();
      currentAudio = audio;
      audio.addEventListener("ended", finish);
      audio.addEventListener("error", () => speakTTS(text).then(finish));
      audio.src = url;
      const promise = audio.play();
      if (promise && promise.catch) promise.catch(() => speakTTS(text).then(finish));
    });
  }
  const clip = name => `${N.audioDir}${name}.mp3`;
  function setCaption(text) {
    caption.hidden = false;
    caption.textContent = text;
  }
  function narrate(text, url) {
    setCaption(text);
    walkBtn.classList.add("speaking");
    const minimum = Math.max(2400, text.split(/\s+/).length * 360);
    const started = performance.now();
    return playClip(url, text).then(() => {
      const remaining = minimum - (performance.now() - started);
      return remaining > 0 ? wait(remaining) : null;
    });
  }
  function updateWalkButton() {
    walkLabel.textContent = narrating ? "Stop walkthrough" : "Play walkthrough";
    walkBtn.setAttribute("aria-pressed", String(narrating));
    walkBtn.classList.toggle("speaking", narrating);
  }
  async function startWalkthrough() {
    if (narrating) return;
    const thisRun = ++walkRun;
    narrating = true;
    updateWalkButton();
    setRunning(true);
    stageElapsed = 0;
    setStage(0, true);
    await narrate(N.intro, clip("intro"));
    for (let index = 0; index < S.stages.length && walkRun === thisRun; index += 1) {
      stageElapsed = 0;
      setStage(index, true);
      const stage = S.stages[index];
      await narrate((N.lines && N.lines[stage.id]) || stage.note, clip(`stage-${stage.id}`));
    }
    if (walkRun === thisRun) await narrate(N.outro, clip("outro"));
    if (walkRun === thisRun) finishWalkthrough();
  }
  function finishWalkthrough() {
    walkRun += 1;
    narrating = false;
    updateWalkButton();
    caption.hidden = true;
    stageElapsed = 0;
  }
  function stopNarration() {
    if (!narrating) return;
    walkRun += 1;
    narrating = false;
    if (hasTTS) speechSynthesis.cancel();
    if (currentAudio) {
      try { currentAudio.pause(); } catch (_) { /* no-op */ }
      currentAudio = null;
    }
    updateWalkButton();
    caption.hidden = true;
  }
  walkBtn.addEventListener("click", () => narrating ? stopNarration() : startWalkthrough());
  window.addEventListener("beforeunload", () => {
    if (hasTTS) speechSynthesis.cancel();
  });

  /* ---------- resource-aware visibility ---------- */
  document.addEventListener("visibilitychange", () => {
    pageVisible = !document.hidden;
    lastFrame = 0;
  });
  if (window.IntersectionObserver) {
    new IntersectionObserver(entries => {
      sceneVisible = entries[0] ? entries[0].isIntersecting : true;
      lastFrame = 0;
    }, { rootMargin: "220px" }).observe(card);
  }

  /* ---------- initialise ---------- */
  setStage(0, false);
  setRunning(true);
  drawTrend();
  requestAnimationFrame(frame);
})();
