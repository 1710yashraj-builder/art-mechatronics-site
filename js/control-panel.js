/* ============================================================
   ART Mechatronics — Virtual PLC Control Panel simulation
   A behaviour-faithful batch state machine: idle → fill → weigh →
   discharge → mix → sieve → collect → complete, with E-STOP/fault.
   ============================================================ */
(function () {
  /* ---------- recipes ---------- */
  const RECIPES = [
    { name: "Food: Spice Blend",        sector: "Food",     ings: [["Chilli Powder", 120], ["Turmeric", 60], ["Iodised Salt", 70]] },
    { name: "Pharma: Granule Premix",   sector: "Pharma",   ings: [["Excipient Base", 150], ["Active Blend", 40], ["Lubricant", 60]] },
    { name: "Chemical: Detergent Base", sector: "Chemical", ings: [["Soda Ash", 100], ["STPP", 90], ["Filler", 60]] },
  ];

  const TILES = ["Suction", "Silos", "Weigh", "Buffer", "Mixer", "Sifter", "Trolley", "Dust"];
  const PHASE_TILE = { fill: 1, weigh: 2, discharge: 3, mix: 4, sieve: 5, collect: 6 };
  const DUR = { fill: 2200, weigh: 4500, discharge: 1400, mix: 6000, sieve: 2400, collect: 1800 };
  const MIX_SECS = DUR.mix / 1000;

  /* ---------- elements ---------- */
  const $ = id => document.getElementById(id);
  const els = {
    mimic: $("mimic"), log: $("log"), alarm: $("alarm"), alarmMsg: $("alarmMsg"),
    batch: $("hBatch"), recipe: $("hRecipe"), time: $("hTime"), mode: $("hMode"),
    g: [null, $("g1"), $("g2"), $("g3")], s: [null, $("s1"), $("s2"), $("s3")], b: [null, $("b1"), $("b2"), $("b3")],
    gTotal: $("gTotal"), sTotal: $("sTotal"), bTotal: $("bTotal"), gMix: $("gMix"), gSieve: $("gSieve"),
    stack: { red: document.querySelector('[data-lamp="red"]'), amber: document.querySelector('[data-lamp="amber"]'), green: document.querySelector('[data-lamp="green"]') },
    lamp: { system: $("lampSystem"), auto: $("lampAuto"), fault: $("lampFault") },
    btnStart: $("btnStart"), btnStop: $("btnStop"), btnReset: $("btnReset"), btnEstop: $("btnEstop"),
    recSelect: $("recipe"), recIng: $("recipeIng"), recTotal: $("recipeTotal"),
    report: $("report"), rpBatch: $("rpBatch"), rpRecipe: $("rpRecipe"), rpWeight: $("rpWeight"), rpTime: $("rpTime"), rpQuote: $("rpQuote"),
  };

  /* ---------- state ---------- */
  let phase = "idle", tPhase = 0, running = false, fault = false;
  let batchNo = 0, recipeIdx = 0, elapsed = 0, flags = {};
  let w = [0, 0, 0], sieveOut = 0, bufferTotal = 0;
  let recipe = RECIPES[0];

  /* ---------- build mimic tiles ---------- */
  els.mimic.innerHTML = TILES.map((t, i) =>
    `<div class="tile" data-i="${i}"><div class="ico">${t}</div><div class="st">idle</div></div>`).join("");
  const tileEls = [...els.mimic.querySelectorAll(".tile")];

  /* ---------- recipe select ---------- */
  els.recSelect.innerHTML = RECIPES.map((r, i) => `<option value="${i}">${r.name}</option>`).join("");
  function loadRecipe(i) {
    recipeIdx = i; recipe = RECIPES[i];
    const total = recipe.ings.reduce((a, x) => a + x[1], 0);
    els.recIng.innerHTML = recipe.ings.map((ing, k) =>
      `<div class="row"><span>Silo ${k + 1} · ${ing[0]}</span><b>${ing[1].toFixed(1)} kg</b></div>`).join("");
    els.recTotal.textContent = total.toFixed(1) + " kg";
    els.recipe.textContent = recipe.name;
    for (let k = 1; k <= 3; k++) els.s[k].textContent = recipe.ings[k - 1][1].toFixed(0);
    els.sTotal.textContent = total.toFixed(0);
    els.gMix.textContent = String(MIX_SECS).padStart(2, "0");
  }
  els.recSelect.addEventListener("change", e => { if (!running && !fault) loadRecipe(+e.target.value); else e.target.value = recipeIdx; });

  /* ---------- logging ---------- */
  function fmt(ms) { const s = Math.floor(ms / 1000); return String((s / 60) | 0).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }
  function log(msg, type) {
    const d = document.createElement("div");
    if (type) d.className = type;
    d.innerHTML = `<span class="t">${fmt(elapsed)}</span><span class="m">${msg}</span>`;
    els.log.appendChild(d);
    els.log.scrollTop = els.log.scrollHeight;
  }

  /* ---------- ui helpers ---------- */
  function setStack(color) {
    els.stack.red.classList.toggle("on", color === "red");
    els.stack.amber.classList.toggle("on", color === "amber");
    els.stack.green.classList.toggle("on", color === "green");
  }
  function setTiles(active) {
    tileEls.forEach((t, i) => {
      t.classList.remove("active", "done");
      const st = t.querySelector(".st");
      if (i === 7) { // dust — ambient (stays capturing through the completion frame)
        if (running || phase === "complete") { t.classList.add("active"); st.textContent = "capturing"; } else st.textContent = "idle";
        return;
      }
      if (active < 0) { st.textContent = "idle"; return; }
      if (i < active) { t.classList.add("done"); st.textContent = "done"; }
      else if (i === active) { t.classList.add("active"); st.textContent = "active"; }
      else st.textContent = "waiting";
    });
  }
  function setButtons() {
    els.btnStart.disabled = running || fault;
    els.btnStop.disabled = !running;
    els.btnReset.disabled = !fault && phase !== "complete";
    els.lamp.system.classList.toggle("on", running || phase === "complete");
    els.lamp.auto.classList.toggle("on", running);
    els.lamp.fault.classList.toggle("on", fault);
    els.mode.textContent = fault ? "FAULT" : running ? "AUTO · RUN" : "AUTO";
  }
  function setGauge(i, val, set) {
    els.g[i].textContent = val.toFixed(1);
    els.b[i].style.width = (set ? Math.min(val / set, 1) * 100 : 0) + "%";
  }

  /* ---------- transitions ---------- */
  function resetValues() {
    w = [0, 0, 0]; sieveOut = 0; bufferTotal = 0; flags = {};
    for (let k = 1; k <= 3; k++) setGauge(k, 0, recipe.ings[k - 1][1]);
    els.gTotal.textContent = "0"; els.bTotal.style.width = "0%"; els.gSieve.textContent = "0";
    els.gMix.textContent = String(MIX_SECS).padStart(2, "0");
  }
  function goPhase(p) { phase = p; tPhase = 0; }

  function start() {
    if (running || fault) return;
    batchNo++; elapsed = 0; running = true; fault = false;
    els.report.classList.remove("show");
    els.batch.textContent = "#" + String(batchNo).padStart(4, "0");
    resetValues();
    log("Batch " + els.batch.textContent + " started · recipe: " + recipe.name, "ok");
    log("Pneumatic suction ON. Root blower conveying raw powder");
    setStack("green"); goPhase("fill"); setButtons();
  }
  function stop(byOperator) {
    running = false; goPhase("idle");
    setStack("amber"); setTiles(-1); resetValues(); setButtons();
    if (byOperator) log("Cycle stopped by operator", "warn");
  }
  function estop() {
    if (fault) return;
    running = false; fault = true;
    setStack("red"); els.alarm.classList.add("show");
    els.alarmMsg.textContent = "EMERGENCY STOP ACTIVE. Press RESET to clear.";
    setTiles(-1); setButtons();
    log("✖ EMERGENCY STOP pressed. All drives halted.", "err");
  }
  function reset() {
    fault = false; phase = "idle"; running = false;
    els.alarm.classList.remove("show"); els.report.classList.remove("show");
    setStack("amber"); setTiles(-1); resetValues(); setButtons();
    log("System reset. Ready.", "ok");
  }
  function complete() {
    running = false; goPhase("complete");
    const total = recipe.ings.reduce((a, x) => a + x[1], 0);
    setStack("green"); setTiles(7); setButtons();
    log("✓ Batch complete. " + total.toFixed(1) + " kg collected in trolley.", "ok");
    // report card
    els.rpBatch.textContent = els.batch.textContent;
    els.rpRecipe.textContent = recipe.name;
    els.rpWeight.textContent = total.toFixed(1) + " kg";
    els.rpTime.textContent = fmt(elapsed);
    els.rpQuote.href = ART.helper.wa("Automatic Powder Batching & Mixing Line");
    els.report.classList.add("show");
    // green stays a moment then back to amber ready
    setTimeout(() => { if (!running && !fault) { phase = "idle"; setStack("amber"); setTiles(-1); setButtons(); } }, 2600);
  }

  /* ---------- per-phase update ---------- */
  function update(dt) {
    if (!running) return;
    tPhase += dt; elapsed += dt;
    els.time.textContent = fmt(elapsed);
    const set = recipe.ings;
    const total = set.reduce((a, x) => a + x[1], 0);

    if (phase === "fill") {
      setTiles(1);
      const p = Math.min(tPhase / DUR.fill, 1);
      for (let k = 1; k <= 3; k++) els.b[k].style.width = (p * 8) + "%"; // silos priming
      if (!flags.fill && p > 0.5) { flags.fill = true; log("Silo level low → auto-refill · air filters clean"); }
      if (tPhase >= DUR.fill) { log("Silos filled · load cells zeroed"); goPhase("weigh"); }

    } else if (phase === "weigh") {
      setTiles(2);
      for (let k = 0; k < 3; k++) {
        const prog = Math.min(Math.max((tPhase - k * (DUR.weigh / 3)) / (DUR.weigh / 3), 0), 1);
        w[k] = set[k][1] * prog;
        setGauge(k + 1, w[k], set[k][1]);
        if (prog >= 1 && !flags["w" + k]) { flags["w" + k] = true; log(`Silo ${k + 1} target ${set[k][1].toFixed(1)} kg reached · ${set[k][0]}`, "ok"); }
      }
      if (tPhase >= DUR.weigh) { log("All ingredients dosed · discharging to buffer tank"); goPhase("discharge"); }

    } else if (phase === "discharge") {
      setTiles(3);
      const p = Math.min(tPhase / DUR.discharge, 1);
      bufferTotal = total * p;
      els.gTotal.textContent = bufferTotal.toFixed(1);
      els.bTotal.style.width = (p * 100) + "%";
      if (tPhase >= DUR.discharge) { els.gTotal.textContent = total.toFixed(1); log("Buffer weight confirmed " + total.toFixed(1) + " kg"); goPhase("mix"); }

    } else if (phase === "mix") {
      setTiles(4);
      const remain = Math.max(0, MIX_SECS - tPhase / 1000);
      els.gMix.textContent = String(Math.ceil(remain)).padStart(2, "0");
      if (!flags.mix) { flags.mix = true; log("Ribbon mixer running. Homogeneous blending active."); }
      if (tPhase >= DUR.mix) { els.gMix.textContent = "00"; log("Mixing complete · discharging to vibro sifter"); goPhase("sieve"); }

    } else if (phase === "sieve") {
      setTiles(5);
      const p = Math.min(tPhase / DUR.sieve, 1);
      sieveOut = total * p; els.gSieve.textContent = sieveOut.toFixed(1);
      if (!flags.sieve) { flags.sieve = true; log("Vibro sifter running for quality separation."); }
      if (tPhase >= DUR.sieve) { els.gSieve.textContent = total.toFixed(1); goPhase("collect"); }

    } else if (phase === "collect") {
      setTiles(6);
      if (!flags.collect) { flags.collect = true; log("Dust-free collection into material trolley"); }
      if (tPhase >= DUR.collect) complete();
    }
  }

  /* ---------- loop ---------- */
  let last = 0;
  function frame(now) {
    if (!last) last = now;
    let dt = now - last; last = now;
    if (dt > 120) dt = 120;
    update(dt);
    requestAnimationFrame(frame);
  }

  /* ---------- wire ---------- */
  els.btnStart.addEventListener("click", start);
  els.btnStop.addEventListener("click", () => stop(true));
  els.btnReset.addEventListener("click", reset);
  els.btnEstop.addEventListener("click", estop);
  document.addEventListener("visibilitychange", () => { if (document.hidden) last = 0; });

  /* ---------- init ---------- */
  loadRecipe(0); setStack("amber"); setTiles(-1); setButtons();
  log("Panel powered on · IP65 · 24V DC control", "ok");
  log("Select a recipe and press START");
  requestAnimationFrame(frame);
})();
