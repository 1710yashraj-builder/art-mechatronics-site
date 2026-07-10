/* ============================================================
   ART Mechatronics — machine + system data (single source of truth)
   Every specification here is transcribed from the ART product posters.
   ============================================================ */

const ART = {
  brand: {
    name: "ART Mechatronics",
    tagline: "Shaping the Future of the Industrial World",
    disciplines: ["Designing", "Manufacturing", "Automation"],
    presence: ["India", "UAE", "Thailand"],
    web: "www.artmechatronics.com",
    email: "info@artmechatronics.com",
    phoneDisplay: "+91 81918 48660",
    phoneDial: "918191848660",     // for tel: and wa.me
  },

  /* ---- The flagship integrated line (hero + live demo) ---- */
  system: {
    title: "Automatic Powder Batching, Weighing, Dosing, Mixing, Sieving & Collection System",
    short: "Fully automatic powder processing line",
    pitch: "One PLC-controlled line takes raw powder from ground level and delivers a precisely weighed, uniformly mixed, cleanly sieved batch — with almost no manpower and zero dust escape.",
    badges: ["Fully Automatic", "PLC Controlled", "High Accuracy", "Accurate Dosing", "Uniform Mixing", "Sieved Quality Output", "Centralised Dust Collection"],
    legend: [
      { key: "powder", label: "Powder flow", var: "--flow-powder" },
      { key: "air",    label: "Air flow",    var: "--flow-air" },
      { key: "dust",   label: "Dust flow",   var: "--flow-dust" },
      { key: "signal", label: "Control signal", var: "--flow-signal" },
    ],
    // ordered stages used by the animated flow + the sequence strip
    stages: [
      { id: "suction",  name: "Pneumatic Suction", note: "Raw powder sucked from ground level by Root Blower" },
      { id: "silos",    name: "Silos Filling",     note: "Pneumatically conveyed & auto-refilled into 3 silos" },
      { id: "weighing", name: "Weighing & Dosing", note: "Each powder weighed on high-precision load cells" },
      { id: "buffer",   name: "Buffer Tank",       note: "Batched ingredients collected & weighed" },
      { id: "mixer",    name: "Ribbon Mixer",      note: "Uniform, homogeneous blending" },
      { id: "sifter",   name: "Vibro Sifter",      note: "Sieved for quality output" },
      { id: "trolley",  name: "Material Trolley",  note: "Clean collection for packing" },
      { id: "dust",     name: "Dust Collector",    note: "All dust points centrally captured" },
    ],
    steps: [
      "Raw powder is sucked from ground-level storage via the Root Blower.",
      "Powder is pneumatically conveyed to the respective storage silos.",
      "An air filter on top of each silo ensures a clean air outlet.",
      "A proximity sensor continuously monitors the powder level in each silo.",
      "When level drops below the set point, pneumatic conveying starts automatically and refills the silo.",
      "The required set weight of each powder is automatically and accurately weighed using high-precision load cells.",
      "Each powder is discharged one by one into the Buffer Tank through the pneumatic valve system.",
      "After all ingredients are batched, material is discharged from the Buffer Tank into the Ribbon Mixer.",
      "Material is mixed uniformly in the Ribbon Mixer for homogeneous blending.",
      "After mixing, material is discharged into the Vibro Sifter for sieving.",
      "Sieved and mixed powder is collected in the Material Trolley for further processing / packing.",
    ],
    outcomes: ["Complete Automation", "Accurate Dosing", "Uniform Mixing", "High Product Quality", "Minimal Manpower"],
    image: "assets/machines/system.jpg",

    /* ---- Narrated walkthrough ----
       Edit these lines freely. To upgrade to a premium recorded voice, drop MP3s
       into assets/audio/ named:  intro.mp3, outro.mp3, stage-<id>.mp3
       (e.g. stage-suction.mp3). The player uses a clip if present, else the
       browser voice — no code changes needed. */
    narration: {
      voiceHint: "en-IN",           // prefer an Indian-English voice
      audioDir: "assets/audio/",
      intro: "Welcome to ART Mechatronics. Watch our fully automatic powder line turn raw material into a finished, quality batch — all under one PLC.",
      outro: "One line. Fully automatic. Engineered by ART Mechatronics.",
      lines: {
        suction:  "It starts here — raw powder is drawn from ground level by our root blower and conveyed up. No manual lifting, no spillage.",
        silos:    "The powder settles into the storage silos, kept topped up automatically by level sensors.",
        weighing: "Now precision takes over — high-accuracy load cells weigh each ingredient to within a tenth of a percent.",
        buffer:   "Every weighed ingredient collects in the buffer tank as one accurate, repeatable batch.",
        mixer:    "The ribbon mixer blends it into a uniform, homogeneous mix.",
        sifter:   "The vibro sifter screens the batch, so only clean, quality output moves ahead.",
        trolley:  "The finished powder is collected dust-free in a mobile trolley, ready for packing.",
        dust:     "And throughout, our dust collector captures over ninety-nine percent of fines — a cleaner workplace, a contained product.",
      },
    },
  },

  /* ---- The 8 machines ---- */
  machines: [
    {
      id: "storage-silos",
      name: "Storage Silos System",
      order: 1,
      image: "assets/machines/storage-silos.jpg",
      tagline: "Reliable Storage · Accurate Weighing · Automatic Discharge",
      summary: "Load-cell weighed storage silos with top/low level indication and automatic pneumatic discharge — the buffer store that keeps the line continuously fed.",
      features: [
        "Top & low level indication",
        "Load-cell based weighing",
        "Automatic pneumatic discharge system",
        "Stainless Steel 304 / 316 construction",
        "Dust-tight & hygienic design",
      ],
      components: [
        ["Top Level Sensor", "High-level indication"],
        ["Low Level Sensor", "Low-level indication"],
        ["Pneumatic Discharge Valve", "Automatic operation"],
        ["Load Cell", "Weighing system"],
      ],
      specs: [
        ["Construction", "SS 304 / SS 316"],
        ["Level Indication", "Top & low sensors"],
        ["Weighing", "Load-cell based"],
        ["Discharge", "Automatic pneumatic valve"],
        ["Design", "Dust-tight & hygienic"],
      ],
      applications: ["Food", "Pharmaceutical", "Chemical", "Plastics", "Minerals"],
    },
    {
      id: "buffer-tank",
      name: "Buffer Tank with Load Cells",
      order: 2,
      image: "assets/machines/buffer-tank.jpg",
      tagline: "Accurate Weighing · Reliable Storage · Automatic Discharge",
      summary: "Intermediate storage between process & packaging that guarantees a continuous material supply with accurate weighing and controlled, dust-tight discharge.",
      features: [
        "High-precision load-cell weighing (± 0.1 % FS)",
        "Pneumatic, dust-tight automatic discharge",
        "Top & bottom level control",
        "SS 304 / 316, mirror or matt finish",
        "Seamless PLC / process integration",
      ],
      components: [
        ["Load Cell Integration", "High-precision weighing"],
        ["Pneumatic Discharge Valve", "Dust-tight, automatic"],
        ["Top Level Sensor", "High-level indication"],
        ["Low Level Sensor", "Low-level indication"],
      ],
      specs: [
        ["Construction Material", "SS 304 / SS 316"],
        ["Capacity Range", "50 Ltr – 5000 Ltr"],
        ["Load Cell Type", "Compression type"],
        ["Load Cell Accuracy", "± 0.1 % FS"],
        ["Discharge Valve", "Pneumatic operated"],
        ["Finish", "Mirror / Matt"],
        ["Application", "Powders / Granules"],
      ],
      applications: ["Food", "Pharmaceutical", "Chemical", "Plastics", "Minerals"],
    },
    {
      id: "vibro-sifter",
      name: "Vibro Sifter",
      order: 3,
      image: "assets/machines/vibro-sifter.jpg",
      tagline: "High-Efficiency Sieving · Accurate Separation · Maximum Performance",
      summary: "Multi-deck vibratory sieve for powders, granules & dry bulk. A high-performance vibro motor spreads material across the mesh — fines pass through, oversize moves to the outlet.",
      features: [
        "High screening efficiency",
        "Dust-tight & hygienic design",
        "Low noise & low maintenance",
        "Quick screen changeover",
        "SS 304 / 316, food-grade finish",
        "Compact & customisable",
      ],
      components: [
        ["Top Cover", "Dust-tight design"],
        ["Screen Decks", "1 to 4 deck options"],
        ["Vibration System", "High-performance vibro motor"],
        ["Oversize / Fines Outlets", "Clean separation"],
      ],
      specs: [
        ["Model", "ART-VS"],
        ["Diameter", "600 mm – 2000 mm"],
        ["Decks", "1 to 4 decks"],
        ["Material of Construction", "SS 304 / SS 316"],
        ["Mesh Size", "10 micron – 10 mm"],
        ["Motor Power", "0.25 HP – 3 HP"],
        ["Capacity", "Up to 10 TPH*"],
      ],
      note: "*Capacity depends on material characteristics.",
      applications: ["Food", "Pharmaceutical", "Chemical", "Plastics", "Minerals & Metals", "Ceramics", "FMCG"],
    },
    {
      id: "control-panel",
      name: "Centralised Automatic PLC Control Panel",
      order: 4,
      image: "assets/machines/control-panel.jpg",
      tagline: "Smart Automation · Central Control · Maximum Efficiency",
      summary: "The brain of the line. One HMI touchscreen runs the entire process — recipes, weighing, dosing, alarms and reports — with inbuilt safety interlocks and easy expansion.",
      features: [
        "Centralised monitoring & control",
        "High-performance PLC automation",
        "HMI touchscreen interface",
        "Real-time data & alarms",
        "Recipe management",
        "Data logging & reporting",
        "Inbuilt safety interlocks",
        "Easy expansion & scalability",
      ],
      components: [
        ["PLC & I/O Modules", "Reliable, accurate control"],
        ["Variable Frequency Drives", "Motor speed control"],
        ["Relay Interface Modules", "Signal switching"],
        ["Power Supply & Protection", "Safe operation"],
      ],
      specs: [
        ["Control Voltage", "24V DC"],
        ["Operating Voltage", "415V AC, 50 Hz"],
        ["PLC Brand", "Siemens / Allen Bradley / Mitsubishi / Schneider"],
        ["HMI Size", "7\" / 10\" / 15\" touch screen"],
        ["Enclosure", "MS / SS 304"],
        ["Ingress Protection", "IP54 / IP65"],
        ["Mounting", "Floor / Wall mounting"],
        ["Communication", "Modbus TCP / Ethernet IP / Profibus / OPC UA"],
      ],
      applications: ["Mixing & Blending", "Material Handling", "Pneumatic Conveying", "Dust Collection", "Filling & Packaging"],
    },
    {
      id: "ribbon-mixer",
      name: "Ribbon Mixer",
      order: 5,
      image: "assets/machines/ribbon-mixer.jpg",
      gallery: ["assets/machines/ribbon-mixer.jpg", "assets/machines/ribbon-mixer-drive.jpg"],
      tagline: "Uniform Mixing · Homogeneous Blending · Heavy Duty",
      summary: "A precision-welded double-ribbon shaft driven by a helical gearbox blends powders to a homogeneous mix, then discharges through a dust-tight pneumatic gate.",
      features: [
        "Precision-welded double ribbon shaft",
        "Heavy-duty balanced solid shaft",
        "High-efficiency helical gearbox drive",
        "Dust-tight pneumatic discharge gate",
        "SS 304 / 316 contact parts",
        "Smooth, low-noise, long-life operation",
      ],
      components: [
        ["Mixer Shaft (Ribbon Shaft)", "Precision-welded ribbons"],
        ["Shaft Seal & Bearing Housing", "Reliable sealing"],
        ["Helical Gearbox", "High efficiency, low noise"],
        ["Motor & Coupling", "Flexible / rigid coupling"],
      ],
      specs: [
        ["Shaft Material", "SS 304 / SS 316"],
        ["Shaft Type", "Heavy-duty solid, balanced"],
        ["Ribbons", "Precision welded (double ribbon)"],
        ["Gearbox", "Helical, high efficiency"],
        ["Coupling", "Flexible / Rigid"],
        ["Discharge", "Pneumatic gate, dust-tight"],
      ],
      applications: ["Food", "Pharmaceutical", "Chemical", "Plastics"],
    },
    {
      id: "dust-collector",
      name: "Dust Collector",
      order: 6,
      image: "assets/machines/dust-collector.jpg",
      tagline: "High Efficiency · Clean Environment · Reliable Performance",
      summary: "Pulse-jet bag filter that captures fine dust from every process point at over 99.9 % efficiency, keeping the workplace clean and the product contained.",
      features: [
        "High suction efficiency — captures fine dust",
        "Automatic pulse-jet bag cleaning",
        "Low maintenance, easy inspection access",
        "SS 304 / MS corrosion-resistant build",
        "> 99.9 % filtration efficiency",
        "Safe & reliable industrial operation",
      ],
      components: [
        ["Pulse Jet Cleaning System", "Automatic filter-bag cleaning"],
        ["High-Efficiency Filter Bags", "Premium polyester media"],
        ["Collection Hopper", "Efficient dust discharge"],
        ["Rotary Air Lock Valve", "Pneumatic automatic discharge"],
      ],
      specs: [
        ["Construction Material", "SS 304 / MS"],
        ["Filtration Media", "Polyester filter bags"],
        ["Air to Cloth Ratio", "1.2 – 1.5 m²/min/m²"],
        ["Filtration Efficiency", "> 99.9 %"],
        ["Cleaning System", "Pulse Jet"],
        ["Discharge System", "Pneumatic rotary air-lock valve"],
        ["Application", "Powder / Dust collection"],
      ],
      applications: ["Ribbon Mixer", "Paddle Mixer", "Vibro Sifter", "Screw Conveyor"],
    },
    {
      id: "collection-trolley",
      name: "Material Collection Trolley",
      order: 7,
      image: "assets/machines/collection-trolley.jpg",
      tagline: "Dust-Free Powder Collection & Conveyance",
      summary: "A fully enclosed, mobile SS collection vessel that sits under the Vibro Sifter to gather sifted powder with zero dust leakage, then wheels it away for packing.",
      features: [
        "Dust-free, fully enclosed collection",
        "Quick-release clamps with food-grade gasket",
        "Hygienic mirror / matt finish",
        "Easy mobility on heavy-duty castors with brakes",
        "Bottom butterfly-valve discharge",
        "SS 304 / 316 contact parts",
      ],
      components: [
        ["Inlet Connection", "Clamped from Vibro Sifter outlet"],
        ["Dust-Tight Cover", "Food-grade gasket, zero leakage"],
        ["Enclosed Body", "Safe, dust-free handling"],
        ["Bottom Discharge Outlet", "Pneumatic / manual butterfly valve"],
      ],
      specs: [
        ["Material of Construction", "SS 304 / SS 316"],
        ["Capacity", "25 / 50 / 100 Litres (customisable)"],
        ["Surface Finish", "Mirror / Matt"],
        ["Inlet Connection", "Clamp / Flange"],
        ["Discharge Outlet", "Butterfly valve"],
        ["Mobility", "Heavy-duty castor wheels with brakes"],
        ["Gasket", "Food-grade silicone"],
      ],
      applications: ["Food", "Pharmaceutical", "Chemical", "Cosmetic", "Plastics"],
    },
    {
      id: "platform-ladder",
      name: "Platform & Ladder Unit",
      order: 8,
      image: "assets/machines/platform-ladder.jpg",
      tagline: "2-Level Access Platform · Safe Access · Strong Structure",
      summary: "A full-welded, two-level stainless access platform with anti-slip flooring and guardrails — safe operator access to silos, tanks and conveying equipment at height.",
      features: [
        "Two-level platform for better accessibility",
        "Strong & durable SS 304 construction",
        "Anti-slip chequered-plate flooring",
        "Sturdy handrails & guardrails",
        "Heavy-duty, full-welded structure",
        "Easy to install & maintain",
      ],
      components: [
        ["Two-Level Deck", "Better equipment access"],
        ["Anti-Slip Chequered Plate", "Safe footing"],
        ["Handrails & Guardrails", "1100 mm height"],
        ["Access Staircase", "Compliant, safe climb"],
      ],
      specs: [
        ["Material", "SS 304 / SS 316"],
        ["Platform Level", "2 level"],
        ["Floor Type", "Anti-slip chequered plate"],
        ["Handrail Height", "1100 mm"],
        ["Load Capacity", "500 kg/m² (each level)"],
        ["Typical Size", "4000 mm H × 3000 mm (customisable)"],
      ],
      applications: ["Mixing Systems", "Silo Systems", "Conveying Systems", "Packing Systems", "Process Equipment"],
    },
  ],

  helper: {
    // returns a machine by id
    get(id) { return ART.machines.find(m => m.id === id); },
    // WhatsApp quote link, optionally pre-filled with a machine name
    wa(machineName) {
      const base = "https://wa.me/" + ART.brand.phoneDial + "?text=";
      const msg = machineName
        ? `Hi ART Mechatronics, I'd like a quote for the ${machineName}. Please share details.`
        : `Hi ART Mechatronics, I'd like to enquire about your automation systems.`;
      return base + encodeURIComponent(msg);
    },
  },
};

if (typeof window !== "undefined") window.ART = ART;
