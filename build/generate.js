/* ============================================================
   ART Mechatronics — static page generator ("the content machine")
   Reads build/data/*.json → writes SEO-ready static HTML:
     industries/<slug>.html   product/machine landing pages
     products/<slug>.html
     industries.html          industries hub (listing)
     catalog.html             product catalogue w/ live search + filter
     sitemap.xml
   Reuses the site's existing CSS (tokens/base/machine) + adds catalog.css.

   Batch (default): curated ~15 industries + their core machines.
   Full run:  node build/generate.js --all      (generates everything)
   ============================================================ */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA = path.join(__dirname, "data");
const ALL = process.argv.includes("--all");
const CSSV = "?v=20260727a";

const industries = JSON.parse(fs.readFileSync(path.join(DATA, "industries.json"), "utf8"));
const products = JSON.parse(fs.readFileSync(path.join(DATA, "products.json"), "utf8"));
const imageManifest = JSON.parse(fs.readFileSync(path.join(ROOT, "assets", "machines", "v2", "manifest.json"), "utf8"));
const v3ManifestFile = path.join(ROOT, "assets", "machines", "v3", "pilot", "manifest.json");
const v3Manifest = fs.existsSync(v3ManifestFile)
  ? JSON.parse(fs.readFileSync(v3ManifestFile, "utf8"))
  : null;
const v3Products = new Map();

if (v3Manifest) {
  if (!/^approved(?:-\d{4}-\d{2}-\d{2})?$/.test(String(v3Manifest.approvalStatus || ""))) {
    throw new Error(`Refusing to use unapproved v3 image manifest: ${String(v3Manifest.approvalStatus || "missing status")}`);
  }
  if (!["pilot", "incremental", "complete"].includes(v3Manifest.coverageMode)) {
    throw new Error(`Invalid v3 image coverage mode: ${String(v3Manifest.coverageMode)}`);
  }
  if (!Array.isArray(v3Manifest.assets) || !v3Manifest.assets.length) {
    throw new Error("Approved v3 image manifest contains no products");
  }
  for (const entry of v3Manifest.assets) {
    if (!entry || !entry.slug) throw new Error("V3 image manifest contains a product without a slug");
    if (v3Products.has(entry.slug)) throw new Error(`Duplicate v3 image manifest entry: ${entry.slug}`);
    if (!products.some((product) => product.slug === entry.slug)) throw new Error(`Unknown v3 product slug: ${entry.slug}`);
    if (!imageManifest.categories || !imageManifest.categories[entry.category]) {
      throw new Error(`Unknown v3 image category for ${entry.slug}: ${String(entry.category)}`);
    }
    v3Products.set(entry.slug, entry);
  }
  if (v3Manifest.coverageMode === "complete" && v3Products.size !== products.length) {
    throw new Error(`Complete v3 image manifest must cover ${products.length} products; found ${v3Products.size}`);
  }
}

/* ---- brand (mirrors js/data.js) ---- */
const BRAND = {
  name: "ART Mechatronics",
  tagline: "Shaping the Future of the Industrial World",
  site: "https://artmechatronics.com",
  email: "info@artmechatronics.com",
  phoneDisplay: "+91 80903 15151",
  phoneDial: "918090315151",
  presence: ["India", "UAE", "Thailand"],
};

/* ---- helpers ---- */
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const attr = (s = "") => esc(s).replace(/'/g, "&#39;");
const firstPara = (t = "") => (t.split("\n").find((l) => l.trim()) || "").trim();
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s);

/* The client's source docs paste tick-lists into a single paragraph
   ("used for: ✔ a ✔ b ✔ c"). Rendered as prose that reads as a wall and is
   invisible to answer engines, which favour real lists. Split it back apart. */
function checkRun(text) {
  const marks = (text.match(/[✔✓]/g) || []).length;
  if (marks < 2) return null;
  const parts = text.split(/\s*[✔✓]\s*/).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  const startsWithMark = /^\s*[✔✓]/.test(text);
  return { leadIn: startsWithMark ? "" : parts[0], items: startsWithMark ? parts : parts.slice(1) };
}

/* Paragraph renderer that promotes a pasted tick-run to a real <ul>. */
function proseP(text, cls) {
  const run = checkRun(text);
  const open = cls ? `<p class="${cls}">` : "<p>";
  if (!run) return `${open}${esc(text)}</p>`;
  const intro = run.leadIn ? `${open}${esc(run.leadIn)}</p>` : "";
  return `${intro}<ul class="checks">${run.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}

/* Visible body copy must never end mid-sentence. Drop any tick-run tail, then
   cut on a sentence boundary — the "…" clip is fine for meta, not for the page. */
function leadText(raw, max = 320) {
  const stripped = String(raw).replace(/\s*[✔✓].*$/s, "").trim();
  const base = stripped.length > 40 ? stripped : String(raw).trim();
  if (base.length <= max) return base;
  const sentences = base.match(/[^.!?]+[.!?]+(?:\s|$)/g);
  if (!sentences || !sentences.length) return base;  // no punctuation: leave copy alone
  let out = "";
  for (const s of sentences) {
    if (out && (out + s).trim().length > max) break;
    out += s;
  }
  // A first sentence longer than max is kept whole — an over-long lead reads far
  // better than one that stops mid-clause.
  return (out.trim() || sentences[0].trim());
}

/* Index focus (notebook 2026-07-16 + 07-17): every product image is a disclosed
   RECONSTRUCTED render, and a brand-new domain should not ask Google to swallow
   315 near-template pages at once. These are the pages mapped to the measured
   Ahrefs demand (UAE commercial terms + Thai bag-sealing cluster); they stay
   indexable and everything else ships noindex,follow until real photos land.
   Widening the launch = add slugs here, regenerate, resubmit the sitemap. */
const KEYWORD_PAGES = new Set([
  "band-sealer", "sealing", "pouch-sealing", "l-sealer", "web-sealer",
  "center-seal", "3-side-seal", "4-side-seal",
  "vacuum",
  "heat-shrink-tunnel", "l-sealer-with-heat-shrink-tunnel", "stretch-wrapping",
  "flow-wrap", "overwrapping",
  "impact-pulverizer-machine", "micro-pulverizer-machine", "pulverizer-with-dust-collector",
  "ribbon-mixer",
  "pouch", "pouch-filling", "premade-pouch", "standup-pouch", "doypack",
  "zip-lock-zipper-pouch", "retort-pouch",
  "vibro", "sifter", "siever", "plan-sifter", "screener",
  "auger-filler", "servo-auger-filling", "multi-head-weigher", "cup-filler",
  "spray-dryer", "tray-dryer-tray-oven", "rotary-dryer-drum-dryer",
  "fluidized-bed-dryer-fbd", "flash-dryer", "freeze-dryer",
  "checkweigher-with-printer",
  "form-fill-seal", "vertical-form-fill-seal", "horizontal-form-fill-seal",
]);
const productIndexable = (slug) => KEYWORD_PAGES.has(slug);

/* ---- public URL shape ----
   Cloudflare Pages serves foo.html at /foo and 308-redirects the .html form.
   If we advertise .html URLs, every canonical, sitemap entry and internal link
   points at a redirect — Google is told the canonical URL is one that moves.
   So every URL we EMIT is extensionless, while the files on disk stay *.html.
   pubPath: "products/x.html" -> "products/x", "index.html" -> "".
   abs:     absolute production URL.   rel: base-relative href for a page. */
const pubPath = (p) => String(p).replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, "");
const abs = (p) => `${BRAND.site}/${pubPath(p)}`;
const rel = (base, p) => {
  const s = pubPath(p);
  return s ? `${base}${s}` : (base || "./");
};

/* Organization entity reused by the generated listing pages, mirroring the block
   injected into the hand-maintained core pages. 1997 + the patents belong to the
   parent company, so they are modelled there rather than on ART itself. */
const ORG_NODE = {
  "@type": "Organization", "@id": `${BRAND.site}/#organization`,
  name: BRAND.name, url: `${BRAND.site}/`, logo: `${BRAND.site}/assets/logo.svg`,
  email: BRAND.email,
  areaServed: BRAND.presence.map((c) => ({ "@type": "Country", name: c === "UAE" ? "United Arab Emirates" : c })),
  parentOrganization: { "@type": "Organization", name: "Thermocare Industries Limited", url: "https://thermocaregroup.com/", foundingDate: "1997" },
};
const listingSchema = (url, name, desc) => ({
  "@context": "https://schema.org",
  "@graph": [ORG_NODE, { "@type": "CollectionPage", "@id": `${url}#page`, url, name, description: desc, about: { "@id": `${BRAND.site}/#organization` } }],
});


// Clean HUMAN-FACING name: drop the client's long keyword dumps ("Spices – (Herbs,
// Turmeric, …)" → "Spices") but keep a short acronym and upper-case it
// ("Form Fill Seal (Ffs)" → "Form Fill Seal (FFS)"). SEO strings stay in <title>/meta.
function displayName(raw = "") {
  const paren = raw.match(/\(([^)]+)\)\s*$/);
  const dash = raw.match(/\s[–-]\s*([^–-]+)$/);
  const base = raw.replace(/\s*[–(].*$/s, "").trim();
  const tail = paren ? paren[1].trim() : dash ? dash[1].trim() : "";
  const acro = tail && !tail.includes(",") && tail.length <= 8 && /^[A-Za-z0-9 /]+$/.test(tail)
    ? " (" + tail.toUpperCase() + ")" : "";
  return (base + acro).trim() || raw;
}
// SERP-capped page title (~60 chars): primary keyword + brand, drop the tail synonyms
function pageTitle(metaTitle, display) {
  const t = (metaTitle || display || "").trim();
  if (t.length <= 60) return t;
  const primary = t.split(/\s\|\s|\||\s[–-]\s/)[0].trim();
  let out = primary + " | " + BRAND.name;
  if (out.length > 62) out = clip(display || primary, 42) + " | " + BRAND.name;
  return out;
}
// SERP-safe meta description (~155 chars, clean word-boundary cut, never mid-bullet)
const metaDescOf = (raw, fallback) => clip(((raw && raw.trim()) || fallback || "").replace(/\s*[✔•].*$/s, "").trim() || fallback || "", 155);

function assertUniqueMetadata(items, field, label) {
  const groups = new Map();
  for (const item of items) {
    const value = item[field];
    if (!value) continue;
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item.slug);
  }
  const duplicates = [...groups.entries()].filter(([, slugs]) => slugs.length > 1);
  if (duplicates.length) {
    const detail = duplicates.map(([value, slugs]) => `${JSON.stringify(value)} => ${slugs.join(", ")}`).join("; ");
    throw new Error(`Duplicate ${label}: ${detail}`);
  }
}

// Preserve the current branded title where possible. Only collision groups fall
// back to the source meta title, clipped at a word boundary, so no facts are added.
function assignOutputMetadata(items, kind) {
  const candidates = items.map((item) => pageTitle(item.metaTitle, item.display));
  const counts = new Map();
  candidates.forEach((title) => counts.set(title, (counts.get(title) || 0) + 1));

  items.forEach((item, i) => {
    const sourceTitle = (item.metaTitle || item.h1 || item.display || "").trim();
    item.seoTitle = counts.get(candidates[i]) > 1 ? clip(sourceTitle, 60) : candidates[i];
    const fallback = firstPara(item.intro) || (kind === "product"
      ? `${item.h1} — engineered, manufactured and supplied by ${BRAND.name}.`
      : `Complete turnkey ${item.display} plant & machinery by ${BRAND.name}.`);
    item.seoDesc = metaDescOf(item.metaDesc, fallback);
  });

  assertUniqueMetadata(items, "seoTitle", "page titles");
  assertUniqueMetadata(items, "seoDesc", "meta descriptions");
}

function wa(text) {
  return "https://wa.me/" + BRAND.phoneDial + "?text=" + encodeURIComponent(text);
}
/* Market-tagged prefill (setup artifact #9): every inquiry must arrive already
   labelled with the machine and the page it came from, so inquiries — the KPI
   we actually sell — are countable per market instead of anonymous chats.
   The runtime region picker rewrites the number; this tags the message. */
const waQuote = (name, market = "Global") =>
  wa(`Hi ART Mechatronics, I'd like a quote for the ${name}. [${market}] Please share details.`);

/* Clean product categories via keyword map (the doc's own dividers are noisy).
   Match keyword as a WORD-START (\b + prefix) so "industrial" can't match "dust",
   while still catching plurals/gerunds ("mill"→milling, "grind"→grinding). */
function deriveCategory(p) {
  const s = (p.shortName + " " + p.h1).toLowerCase();
  const has = (...w) => w.some((x) => new RegExp("\\b" + x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(s));
  if (has("dust", "scrubber", "fume", "pollution", "de-dust", "bag house", "bag filter", "pulse jet", "cyclone dust", "cyclone separ", "air pollution", "wet scrub")) return "Pollution Control";
  if (has("pulveriz", "mill", "grind", "crush", "shred", "micron", "disintegrat", "powderiz", "expeller")) return "Size Reduction & Grinding";
  if (has("dry", "roast", "oven", "boiler", "heater", "furnace", "thermic", "steam", "pasteuriz", "steriliz", "retort", "fryer", "blanch", "incinerat", "cook", "heat exchang", "heat recov")) return "Heating & Drying";
  if (has("mixer", "blend", "agitat", "homogeniz", "granulat", "stirrer", "knead", "shaker")) return "Mixing & Blending";
  if (has("sifter", "siev", "separat", "grader", "sorter", "cleaner", "destoner", "de-stoner", "scourer", "washer", "peeler", "polisher", "screen", "classifier", "aspirat", "winnow", "metal detect", "x-ray", "color sort")) return "Cleaning, Sorting & Grading";
  if (has("conveyor", "convey", "elevator", "feeder", "trolley", "collecting table")) return "Conveying & Handling";
  if (has("silo", "hopper", "storage", "bag dump", "goods lift", "scissor", "stacker", "day bin")) return "Storage & Elevation";
  if (has("robot", "agv", "amr", "plc", "automation", "control panel", "palletiz", "pick & place")) return "Automation & Robotics";
  if (has("pack", "seal", "wrap", "filler", "weigher", "pouch", "carton", "sachet", "collator", "flow wrap", "shrink", "label", "nitrogen")) return "Packaging";
  return "Process Equipment";
}
function categoryForProduct(product) {
  const category = v3Products.get(product.slug)?.category
    || imageManifest.products?.[product.slug]?.category
    || deriveCategory(product);
  if (!imageManifest.categories || !imageManifest.categories[category]) {
    throw new Error(`Unknown catalogue category for ${product.slug}: ${String(category)}`);
  }
  return category;
}
products.forEach((p) => (p.category = categoryForProduct(p)));
[...industries, ...products].forEach((it) => {
  let d = displayName(it.shortName);
  // a bare one-word name ("Filling") reads poorly as a card title — prefer the richer H1 name
  if (d.split(/\s+/).length < 2 && it.h1) {
    const dh = displayName(it.h1), w = dh.split(/\s+/).length;
    if (w >= 2 && w <= 6) d = dh;
  }
  it.display = d;
});

/* ---- selection (curated batch) ---- */
const INDUSTRY_PICK = [
  "supari", "pan-masala", "mouth-freshner", "spices", "savoury",
  "foxnut", "wheat-flour", "rice", "pulses", "cashew-nut",
  "tea", "coffee", "biscuit-and-cookies", "dairy", "feed",
];
const PRODUCT_KEYWORDS = [
  "dust collector", "pulverizer", "hammer mill", "roaster", "spray dryer", "tray dryer",
  "ribbon", "paddle", "destoner", "pre cleaner", "vibro", "sifter", "grader", "color sorter",
  "screw conveyor", "belt", "bucket elevator", "multi head weigher", "auger filler",
  "form fill seal", "pouch", "boiler", "fluidized bed", "rotary dryer", "double cone", "sigma",
  "impact pulverizer", "cyclone", "storage silo", "hopper", "vacuum conveyor", "coating pan",
  "flour mill", "extruder", "fryer", "planetary", "flow wrap",
];

const bySlug = new Map(products.map((p) => [p.slug, p]));
function pickIndustries() {
  if (ALL) return industries;
  const out = [];
  for (const key of INDUSTRY_PICK) {
    const m = industries.find((i) => i.slug === key) ||
              industries.find((i) => i.slug.startsWith(key)) ||
              industries.find((i) => i.slug.includes(key));
    if (m && !out.includes(m)) out.push(m);
  }
  return out;
}
function pickProducts(selectedIndustries) {
  if (ALL) return products;
  const chosen = new Map();
  // 1) curated keyword machines
  for (const kw of PRODUCT_KEYWORDS) {
    const m = products.find((p) => (p.shortName + " " + p.h1).toLowerCase().includes(kw));
    if (m) chosen.set(m.slug, m);
  }
  // 2) machines referenced by the selected industries (best-effort name match)
  for (const ind of selectedIndustries) {
    for (const name of ind.machines) {
      const m = matchProduct(name);
      if (m) chosen.set(m.slug, m);
    }
  }
  return [...chosen.values()];
}

/* fuzzy: match a free-text machine name to a product */
const STOP = new Set(["machine", "system", "unit", "type", "the", "and", "for", "with", "of", "industrial",
  "application", "applications", "process", "products", "product", "material", "materials", "high", "quality",
  "based", "automatic", "used", "using", "line", "plant", "solution", "solutions", "equipment"]);
function sig(str) {
  return str.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
}
// precompute per-product token sets + normalized name key (memoized), + a result cache
const prodSig = new Map(products.map((p) => [p, new Set(sig(p.shortName + " " + p.h1))]));
const prodKey = new Map(products.map((p) => [p, sig(p.shortName).join(" ")]));
const matchCache = new Map();
function matchProduct(name) {
  if (matchCache.has(name)) return matchCache.get(name);
  const want = sig(name);
  let result = null;
  if (want.length) {
    const key = want.join(" ");
    // 1) exact normalized name match — keeps legit one-word links (Roaster→roaster, Grader→grader)
    result = products.find((p) => prodKey.get(p) === key) || null;
    // 2) else require >=2 shared significant tokens (kills arbitrary single-generic-token links)
    if (!result && want.length >= 2) {
      let best = null, bestScore = 0;
      for (const p of products) {
        const hay = prodSig.get(p);
        const matched = want.filter((w) => hay.has(w)).length;
        const score = matched / want.length;
        if (matched >= 2 && score > bestScore) { bestScore = score; best = p; }
      }
      if (bestScore >= 0.6) result = best;
    }
  }
  matchCache.set(name, result);
  return result;
}

/* ---- images: manifest is the sole source of catalogue media ---- */
function mediaEntry(item, kind) {
  if (kind === "products" && v3Products.has(item.slug)) {
    const entry = v3Products.get(item.slug);
    const files = entry.files && typeof entry.files === "object" ? entry.files : {};
    if (!["exact", "representative", "reconstructed"].includes(entry.status)) {
      throw new Error(`Invalid v3 image status for ${item.slug}: ${String(entry.status)}`);
    }
    if (entry.disclosure !== (entry.status !== "exact")) {
      throw new Error(`V3 disclosure does not match image status for ${item.slug}`);
    }
    if (!entry.alt) throw new Error(`Missing exact v3 image alt text for product entry: ${item.slug}`);
    for (const key of ["card", "detail", "social"]) {
      if (!files[key]) throw new Error(`Missing v3 ${key} image for product entry: ${item.slug}`);
    }
    return {
      mapping: {
        category: entry.category,
        detail: files.detail,
        disclosure: entry.disclosure,
        alt: entry.alt,
      },
      asset: {
        category: entry.category,
        status: entry.status,
        files,
        alt: entry.alt,
      },
      version: 3,
    };
  }

  const collection = kind === "products" ? imageManifest.products : imageManifest.industries;
  const mapping = collection && collection[item.slug];
  if (!mapping) throw new Error(`Missing ${kind} image manifest entry: ${item.slug}`);
  if (!mapping.alt) throw new Error(`Missing exact image alt text for ${kind} entry: ${item.slug}`);

  if (kind === "products") {
    const asset = imageManifest.assets && imageManifest.assets[mapping.assetId];
    if (!asset) throw new Error(`Missing image asset ${mapping.assetId} for product ${item.slug}`);
    return { mapping, asset };
  }

  const assets = (mapping.assetIds || []).map((assetId) => {
    const asset = imageManifest.assets && imageManifest.assets[assetId];
    if (!asset) throw new Error(`Missing image asset ${assetId} for industry ${item.slug}`);
    return asset;
  });
  if (!assets.length) throw new Error(`Industry image manifest has no assets: ${item.slug}`);
  return { mapping, assets };
}

function localWebp(file, label = "catalogue media") {
  const clean = String(file || "").replace(/^\//, "");
  if (!/^assets\/machines\/v(?:2|3)\/.+\.webp$/i.test(clean)) {
    throw new Error(`${label} must be a local versioned machine WebP: ${file || "missing"}`);
  }
  return clean;
}
const mediaPath = (base, file, label) => `${base}${localWebp(file, label)}`;
const absoluteMediaPath = (file) => `${BRAND.site}/${localWebp(file, "social image")}`;

function responsivePicture({ src, srcset, sizes, altText, width, height, loading, priority, className }) {
  if (!src) throw new Error(`Missing image path for ${altText}`);
  const source = srcset || `${src} ${width}w`;
  return `<picture class="${className}">
    <source type="image/webp" srcset="${attr(source)}" sizes="${attr(sizes)}">
    <img src="${attr(src)}" alt="${attr(altText)}" width="${width}" height="${height}" loading="${loading}" decoding="async" fetchpriority="${priority}">
  </picture>`;
}

function detailMedia(item, base, kind) {
  const { mapping } = mediaEntry(item, kind);
  const isProduct = kind === "products";
  const file = isProduct ? (mapping.detail || mapping.labelled) : mapping.hero;
  if (!file) throw new Error(`Missing ${isProduct ? "product hero" : "industry montage hero"}: ${item.slug}`);
  const src = mediaPath(base, file, `${item.slug} detail image`);
  const picture = responsivePicture({
    src,
    srcset: `${src} ${isProduct ? 1280 : 1600}w`,
    sizes: "(max-width: 900px) calc(100vw - 2rem), min(48vw, 680px)",
    altText: mapping.alt,
    width: isProduct ? 1280 : 1600,
    height: isProduct ? 960 : 900,
    loading: "eager",
    priority: "high",
    className: "md-figure__picture",
  });
  const caption = mapping.disclosure
    ? `<figcaption class="md-figure__caption"><strong>Representative configuration.</strong> Final equipment and arrangement are engineered for the application.</figcaption>`
    : "";
  return `<figure class="md-figure md-figure--${isProduct ? "product" : "industry"}">
    <div class="md-figure__main">${picture}</div>${caption}
  </figure>`;
}

function cardMedia(item, kind) {
  const isProduct = kind === "products";
  const { mapping, asset } = mediaEntry(item, kind);
  if (isProduct) {
    const card = localWebp(asset.files && asset.files.card, `${item.slug} card image`);
    const detail = localWebp(asset.files && asset.files.detail, `${item.slug} card srcset image`);
    return responsivePicture({
      src: card,
      srcset: `${card} 640w, ${detail} 1280w`,
      sizes: "(max-width: 620px) calc(100vw - 2rem), (max-width: 980px) 45vw, 320px",
      altText: mapping.alt,
      width: 640,
      height: 480,
      loading: "lazy",
      priority: "low",
      className: "cat-card__picture",
    });
  }

  // Prefer the parent tile's cover photo. The old hero-16x9 montages are green
  // and orange machine collages with captions baked in — beside the blue tile
  // grid they read as a different website. An industry's material photo is also
  // simply the truer image for an industry card: almonds belong under nuts.
  const parentCover = groupCoverFor(item.slug);
  if (parentCover) {
    return responsivePicture({
      src: parentCover,
      srcset: `${parentCover} 800w`,
      sizes: "(max-width: 620px) calc(100vw - 2rem), (max-width: 980px) 45vw, 320px",
      altText: mapping.alt,
      width: 800,
      height: 600,
      loading: "lazy",
      priority: "low",
      className: "cat-card__picture",
    });
  }

  const hero = localWebp(mapping.hero, `${item.slug} industry montage card image`);
  return responsivePicture({
    src: hero,
    srcset: `${hero} 1600w`,
    sizes: "(max-width: 620px) calc(100vw - 2rem), (max-width: 980px) 45vw, 320px",
    altText: mapping.alt,
    width: 1600,
    height: 900,
    loading: "lazy",
    priority: "low",
    className: "cat-card__picture",
  });
}

/* editorial artifacts the client left in the doc for their own team, e.g.
   "(Link to Supari Processing Page)" — strip from public pages. */
const isEditorial = (t = "") =>
  /\blink to\b[^.]*\b(page|section)\b/i.test(t) ||
  /^\s*\(?\s*link\b/i.test(t) ||
  /\b(?:these will be created individually|sent to harsh|provide pdf download button|add random (?:comments|reviews|industrial city|country names))\b/i.test(t);

// Remove only explicit editorial emphasis while retaining useful qualifiers.
// Examples: "(CORE PROCESS)" disappears; "(MOISTURE CONTROL – VERY IMPORTANT)"
// becomes "(MOISTURE CONTROL)". Technical parentheses such as FBD/FFS remain.
const EDITORIAL_FRAGMENT = /\b(?:SEO BOOST(?: SECTION)?|CORE (?:MANUFACTURING STAGE|PROCESS|FUNCTION|STAGE|FEATURE|STEP|STRENGTH|SYSTEM|TECHNOLOGY|OFFERING)|VERY IMPORTANT(?: STAGE)?|IMPORTANT(?: FIX| STAGE)?|(?:VERY |MOST )?CRITICAL(?: (?:PROCESS|STEP|STAGE))?|YOUR USP|KEY FEATURE|SYSTEM BACKBONE)\b/gi;
const EDITORIAL_SUFFIX = /\s*[–—-]\s*(?:SEO BOOST(?: SECTION)?|CORE (?:MANUFACTURING STAGE|PROCESS|FUNCTION|STAGE|FEATURE|STEP|STRENGTH|SYSTEM|TECHNOLOGY|OFFERING)|VERY IMPORTANT(?: STAGE)?|IMPORTANT(?: FIX| STAGE)?|(?:VERY |MOST )?CRITICAL(?: (?:PROCESS|STEP|STAGE))?|YOUR USP|KEY FEATURE|SYSTEM BACKBONE)\s*$/g;
function publicText(value = "") {
  return String(value).replace(/\(([^()]*)\)/g, (_whole, inner) => {
    const cleaned = inner
      .replace(/\bOPTIONAL BUT IMPORTANT\b/gi, "OPTIONAL")
      .replace(EDITORIAL_FRAGMENT, "")
      .replace(/^\s*[–—-]\s*|\s*[–—-]\s*$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    return cleaned ? `(${cleaned})` : "";
  }).replace(EDITORIAL_SUFFIX, "").replace(/\s{2,}/g, " ").replace(/\s+([,.;:])/g, "$1").trim();
}

function sectionsBeforeCta(sections) {
  const stop = sections.findIndex((section) => /CALL TO ACTION/.test(section.key));
  return stop === -1 ? sections : sections.slice(0, stop);
}

/* ---- render structured blocks ---- */
function renderBlocks(blocks, linkMachine) {
  return blocks.map((b) => {
    if (b.type === "para") {
      const text = publicText(b.text);
      return !text || isEditorial(b.text) ? "" : proseP(text);
    }
    if (b.type === "note") {
      const text = publicText(b.text);
      if (!text || isEditorial(b.text)) return "";
      const run = checkRun(text);
      if (run) return proseP(text);
      return `<p class="cat-note"><span aria-hidden="true">➜</span> ${esc(text)}</p>`;
    }
    if (b.type === "list") {
      const items = b.items.filter((item) => !isEditorial(item) && publicText(item));
      return items.length ? `<ul class="checks">${items.map((it) => `<li>${linkMaybe(it, linkMachine)}</li>`).join("")}</ul>` : "";
    }
    if (b.type === "step") {
      const machineItems = b.machines.filter((item) => !isEditorial(item) && publicText(item));
      const machines = machineItems.length
        ? `<div class="step__machines">${machineItems.map((m) => linkMaybe(m, linkMachine, true)).join("")}</div>` : "";
      const desc = b.desc.filter((line) => !isEditorial(line)).map(publicText).filter(Boolean).join(" ");
      const noteText = b.note && !isEditorial(b.note) ? publicText(b.note) : "";
      const note = noteText ? `<p class="cat-note"><span aria-hidden="true">➜</span> ${esc(noteText)}</p>` : "";
      return `<div class="step"><div class="step__t">${esc(publicText(b.title))}</div>${desc ? proseP(desc) : ""}${machines}${note}</div>`;
    }
    return "";
  }).join("\n");
}
function linkMaybe(text, linkMachine, chip) {
  const hit = linkMachine && linkMachine(text);
  const label = publicText(text);
  if (hit) return chip
    ? `<a class="mchip" href="${hit.href}">${esc(label)}</a>`
    : `<a href="${hit.href}">${esc(label)}</a>`;
  return chip ? `<span class="mchip mchip--plain">${esc(label)}</span>` : esc(label);
}

/* ---- page shell ---- */
function shell({ page, base, title, desc, canonical, schema, main, ogType, extraJS, ogImage, noindex }) {
  const extra = extraJS ? `  <script src="${base}js/catalog-search.js${CSSV}"></script>\n` : "";
  const ogImg = ogImage || (BRAND.site + "/assets/video/hero-poster.jpg");
  // noindex,follow — keep the page out of the index but let its links pass equity.
  const robots = noindex ? `\n  <meta name="robots" content="noindex,follow">` : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${attr(desc)}">
  <link rel="canonical" href="${canonical}">${robots}
  <meta property="og:type" content="${ogType || "website"}">
  <meta property="og:title" content="${attr(title)}">
  <meta property="og:description" content="${attr(desc)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:site_name" content="${BRAND.name}">
  <meta property="og:image" content="${ogImg}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${attr(title)}">
  <meta name="twitter:description" content="${attr(desc)}">
  <link rel="icon" href="${base}assets/logo.svg" type="image/svg+xml">
  <link rel="stylesheet" href="${base}css/tokens.css${CSSV}">
  <link rel="stylesheet" href="${base}css/base.css${CSSV}">
  <link rel="stylesheet" href="${base}css/machine.css${CSSV}">
  <link rel="stylesheet" href="${base}css/catalog.css${CSSV}">
  ${schema ? `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")}</script>` : ""}
</head>
<body data-page="${page}" data-base="${base}">
  <div data-header></div>
  <main id="main">${main}</main>
  <div data-footer></div>
  <script src="${base}js/data.js${CSSV}"></script>
  <script src="${base}js/layout.js${CSSV}"></script>
${extra}</body>
</html>`;
}

/* ---- quote band (backend-free: composes a WhatsApp message) ---- */
function quoteBand(name) {
  return `<section class="md-section"><div class="wrap">
    <div class="quote-band">
      <div class="quote-band__intro">
        <span class="eyebrow">Request a quote</span>
        <h2>Get pricing &amp; specs for the ${esc(name)}</h2>
        <p>Share the product, target capacity, current process and plant location. These details help our engineers discuss the right machine or line configuration.</p>
        <div class="quote-band__links">
          <a class="btn btn--wa btn--lg" href="${waQuote(name, "Quote band")}" target="_blank" rel="noopener">WhatsApp us</a>
          <a class="btn btn--outline-light btn--lg" href="tel:+${BRAND.phoneDial}">${BRAND.phoneDisplay}</a>
        </div>
      </div>
      <form class="quote-form" data-quote data-machine="${attr(name)}">
        <label>Name<input name="name" required autocomplete="name"></label>
        <label>Company<input name="company" autocomplete="organization"></label>
        <label>Product or material<input name="material" required placeholder="Example: spice powder"></label>
        <label>Target capacity<input name="capacity" placeholder="Example: 1 tonne/hour"></label>
        <label class="quote-form__wide">Plant location<input name="location" autocomplete="country-name" placeholder="City and country"></label>
        <label class="quote-form__wide">Current process or bottleneck<textarea name="req" rows="3" placeholder="Tell us what you want to improve"></textarea></label>
        <button class="btn btn--primary btn--lg" type="submit">Send enquiry on WhatsApp</button>
        <small>Opens WhatsApp with your details pre-filled. No data is stored.</small>
      </form>
    </div>
  </div></section>`;
}

/* ---- breadcrumb ---- */
function crumbs(items, base, selfUrl) {
  const html = items.map((c, i) =>
    c.href ? `<a href="${rel(base, c.href)}">${esc(c.label)}</a>` : `<span aria-current="page">${esc(c.label)}</span>`
  ).join('<span class="sep" aria-hidden="true">/</span>');
  const schema = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem", position: i + 1, name: c.label,
      item: c.href ? abs(c.href.replace(/^\//, "")) : (selfUrl || BRAND.site),
    })),
  };
  return { html: `<nav class="crumbs" aria-label="Breadcrumb"><div class="wrap">${html}</div></nav>`, schema };
}

/* ============================================================
   PRODUCT page
   ============================================================ */
function renderProduct(p, ctx) {
  const base = "../";
  const lead = firstPara(p.intro) || `${p.h1} — engineered, manufactured and supplied by ${BRAND.name}.`;
  const linkMachine = ctx.linkMachine;
  const productMedia = mediaEntry(p, "products");
  const productImage = productMedia.mapping;
  const productSocialImage = productMedia.asset.files && productMedia.asset.files.social;
  if (!productSocialImage) throw new Error(`Missing social image crop for product ${p.slug}`);

  // sections
  const overviewRest = p.intro.split("\n").filter((l) => l.trim()).slice(1).map((t) => proseP(t)).join("");
  const aka = p.aka.length
    ? `<section class="md-section md-section--tint"><div class="wrap"><span class="eyebrow">Also known as</span>
       <h2>One machine, many names</h2><p class="muted">Buyers search for this equipment under many terms — we manufacture all of them:</p>
       <div class="kw-chips">${p.aka.map((k) => `<span class="kw">${esc(k)}</span>`).join("")}</div></div></section>` : "";

  // On product pages the step "machines" are process/application phrases, not real
  // machine names — don't auto-link them (cross-links live in the related section).
  const contentSecs = sectionsBeforeCta(p.sections).filter((s) => !/INTRODUCTION|ALSO KNOWN AS/.test(s.key));
  const body = contentSecs.map((s, i) => `
    <section class="md-section${i % 2 ? " md-section--tint" : ""}"><div class="wrap">
      <span class="eyebrow">${esc(sectionEyebrow(s.key))}</span>
      <h2>${esc(publicText(s.title))}</h2>
      <div class="prose">${renderBlocks(s.blocks, null)}</div>
    </div></section>`).join("");

  // related: industries that use this machine + siblings in category
  const usedBy = ctx.industriesUsing(p);
  const siblings = ctx.selectedProducts.filter((x) => x.category === p.category && x.slug !== p.slug).slice(0, 6);
  const usedByHtml = usedBy.length ? `<div class="rel"><h3>Industries that use the ${esc(p.display)}</h3>
      <div class="tag-row">${usedBy.map((i) => `<a class="tag" href="${rel(base, `industries/${i.slug}.html`)}">${esc(i.display)}</a>`).join("")}</div></div>` : "";
  const siblingsHtml = siblings.length ? `<div class="rel"><h3>Related ${esc(p.category)} machines</h3>
      <div class="tag-row">${siblings.map((s) => `<a class="tag" href="${rel(base, `products/${s.slug}.html`)}">${esc(s.display)}</a>`).join("")}</div></div>` : "";
  const related = `<section class="md-section"><div class="wrap">${usedByHtml}${siblingsHtml}</div></section>`;

  const cr = crumbs([{ label: "Home", href: "index.html" }, { label: "Catalog", href: "catalog.html" }, { label: p.display }], base, abs(`products/${p.slug}.html`));
  const schema = {
    "@context": "https://schema.org", "@type": "Product",
    name: p.h1, description: p.metaDesc || lead, category: p.category,
    brand: { "@type": "Brand", name: BRAND.name },
    manufacturer: { "@type": "Organization", name: BRAND.name },
    image: absoluteMediaPath(productSocialImage),
    url: abs(`products/${p.slug}.html`),
  };

  const main = `
  ${cr.html}
  <section class="md-hero"><div class="wrap"><div class="md-hero__grid">
    <div>
      <span class="eyebrow">${esc(p.category)}</span>
      <h1>${esc(p.h1)}</h1>
      <div class="md-hero__tag">Custom-engineered · Turnkey supply · ${BRAND.presence.join(" · ")}</div>
      <p class="lead">${esc(leadText(lead))}</p>
      <div class="md-cta">
        <a class="btn btn--wa btn--lg" href="${waQuote(p.display, `Product: ${p.slug}`)}" target="_blank" rel="noopener">${waIcon()} Get a quote on WhatsApp</a>
        <a class="btn btn--outline-light btn--lg" href="#quote">Enquire</a>
      </div>
    </div>
    <div>${detailMedia(p, base, "products")}</div>
  </div></div></section>
  ${overviewRest ? `<section class="md-section"><div class="wrap"><span class="eyebrow">Overview</span><h2>About the ${esc(p.display)}</h2><div class="prose">${overviewRest}</div></div></section>` : ""}
  ${aka}
  ${body}
  ${related}
  <div id="quote"></div>
  ${quoteBand(p.display)}
  ${lineBand(p.display, base)}`;

  return shell({
    page: "catalog", base, title: p.seoTitle, desc: p.seoDesc,
    ogImage: absoluteMediaPath(productSocialImage),
    canonical: abs(`products/${p.slug}.html`),
    schema: { "@context": "https://schema.org", "@graph": [schema, cr.schema] },
    main, ogType: "product",
    noindex: !productIndexable(p.slug),
  });
}

/* ============================================================
   INDUSTRY page
   ============================================================ */
function renderIndustry(ind, ctx) {
  const base = "../";
  const lead = firstPara(ind.intro) || `Complete turnkey ${ind.display} plant & machinery by ${BRAND.name}.`;
  const overviewRest = ind.intro.split("\n").filter((l) => l.trim()).slice(1).map((t) => proseP(t)).join("");
  const linkMachine = ctx.linkMachine;
  const industryImage = mediaEntry(ind, "industries").mapping;

  const contentSecs = sectionsBeforeCta(ind.sections).filter((s) => !/INTRODUCTION|APPLICATIONS/.test(s.key));
  const body = contentSecs.map((s, i) => `
    <section class="md-section${i % 2 ? " md-section--tint" : ""}"><div class="wrap">
      <span class="eyebrow">${esc(sectionEyebrow(s.key))}</span>
      <h2>${esc(publicText(s.title))}</h2>
      <div class="prose">${renderBlocks(s.blocks, linkMachine)}</div>
    </div></section>`).join("");

  // machinery -> product links
  const machineLinks = ind.machines.map((m) => {
    const hit = linkMachine(m);
    return hit ? `<a class="tag" href="${hit.href}">${esc(m)}</a>` : `<span class="tag tag--plain">${esc(m)}</span>`;
  }).join("");
  const machSection = ind.machines.length ? `<section class="md-section"><div class="wrap">
    <span class="eyebrow">The machines</span><h2>Machinery in a ${esc(ind.display)} plant</h2>
    <div class="tag-row">${machineLinks}</div></div></section>` : "";

  const apps = ind.applications.length ? `<div class="app-chips">${ind.applications.map((a) => `<span class="chip">${esc(a)}</span>`).join("")}</div>` : "";

  const cr = crumbs([{ label: "Home", href: "index.html" }, { label: "Industries", href: "industries.html" }, { label: ind.display }], base, abs(`industries/${ind.slug}.html`));
  const schema = {
    "@context": "https://schema.org", "@type": "Service",
    serviceType: `${ind.display} Plant & Machinery`, provider: { "@type": "Organization", name: BRAND.name },
    areaServed: BRAND.presence, description: ind.metaDesc || lead,
    image: absoluteMediaPath(industryImage.hero), url: abs(`industries/${ind.slug}.html`),
  };

  const main = `
  ${cr.html}
  <section class="md-hero"><div class="wrap"><div class="md-hero__grid">
    <div>
      <span class="eyebrow">Industry solution</span>
      <h1>${esc(ind.h1)}</h1>
      <div class="md-hero__tag">Turnkey plant · Machinery · Automation · ${BRAND.presence.join(" · ")}</div>
      <p class="lead">${esc(leadText(lead))}</p>
      <div class="md-cta">
        <a class="btn btn--wa btn--lg" href="${wa(`Hi ART Mechatronics, I'd like a quote for a ${ind.display} plant. Please share details.`)}" target="_blank" rel="noopener" aria-label="Plan a ${esc(ind.display)} project with ART Mechatronics">${waIcon()} Plan this plant</a>
        <a class="btn btn--outline-light btn--lg" href="#quote">Talk to an expert</a>
      </div>
    </div>
    <div>${detailMedia(ind, base, "industries")}</div>
  </div></div></section>
  ${overviewRest ? `<section class="md-section"><div class="wrap"><span class="eyebrow">Overview</span><h2>About ${esc(ind.display)} processing</h2><div class="prose">${overviewRest}</div></div></section>` : ""}
  ${body}
  ${machSection}
  ${apps ? `<section class="md-section md-section--tint"><div class="wrap"><span class="eyebrow">Applications</span><h2>Where it's used</h2>${apps}</div></section>` : ""}
  <div id="quote"></div>
  ${quoteBand(ind.display + " plant")}
  ${lineBand(ind.display, base)}`;

  return shell({
    page: "industries", base, title: ind.seoTitle, desc: ind.seoDesc,
    ogImage: absoluteMediaPath(industryImage.hero),
    canonical: abs(`industries/${ind.slug}.html`),
    schema: { "@context": "https://schema.org", "@graph": [schema, cr.schema] },
    main,
  });
}

function sectionEyebrow(key) {
  if (/PROCESS FLOW/.test(key)) return "How it works";
  if (/WORKING PRINCIPLE/.test(key)) return "How it works";
  if (/MACHINERY/.test(key)) return "Machinery";
  if (/TYPES/.test(key)) return "Variants";
  if (/FEATURES|ADVANTAGES/.test(key)) return "Features";
  if (/WHY CHOOSE/.test(key)) return "Why ART";
  if (/TURNKEY/.test(key)) return "Turnkey";
  if (/TECHNICAL/.test(key)) return "Specs";
  if (/INDUSTRIES/.test(key)) return "Applications";
  return "Details";
}
function waIcon() {
  return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.9.9-2.8-.2-.3A8 8 0 1 1 12 20zm4.5-5.8c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.1-.2 0-.4.1-.5l.4-.5c.1-.2.1-.3 0-.5l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.7.7-.9 1.6-.6 2.6.5 1.7 1.6 3.1 3.2 4.1 1.2.7 2.1.9 2.8.8.6-.1 1.4-.6 1.6-1.2.2-.5.2-1 .1-1.1z"/></svg>`;
}
function lineBand(name, base) {
  return `<section class="md-section"><div class="wrap"><div class="md-line-band">
    <div><h3>One partner, from design to start-up</h3>
      <p>ART Mechatronics designs, manufactures, installs and commissions your ${esc(name)} solution with regional presence in India, UAE and Thailand.</p></div>
    <div class="btns"><a class="btn btn--light" href="${rel(base, 'about.html')}">About ART →</a>
      <a class="btn btn--outline-light" href="${rel(base, 'contact.html')}">Contact us</a></div>
  </div></div></section>`;
}

/* ============================================================
   INDUSTRY TILE GRID — the "Industries We Serve" block
   ------------------------------------------------------------
   41 buyer-facing tiles taken from Anurag's ART Catalogue '26.
   Each tile: cover photo + name label, plus a caret that opens the
   sub-industries beneath it (our existing 88 pages). Clicking the
   photo opens the parent industry page; the caret never navigates.

   Cover image resolution order:
     1. assets/industries/<slug>/cover-800.webp   <- the real photo, once shot
     2. the first child's existing industry hero  <- TEMPORARY stand-in
     3. childless tile -> no image, tinted plate  <- needs content + a photo
   The build prints a summary so stand-ins can never go unnoticed.
   ============================================================ */
const industryGroups = JSON.parse(fs.readFileSync(path.join(DATA, "industry-groups.json"), "utf8"));
const coverStats = { real: 0, standIn: 0, none: 0 };

/* industry slug -> the cover photo of the tile it sits under, when that photo
   exists on disk. Used so the 88 industry cards share the blue cover set instead
   of the old montages. Declared as a function so cardMedia (defined earlier in
   the file) can call it — it only runs during rendering, after the data loads. */
let _coverForIndustry = null;
function groupCoverFor(industrySlug) {
  if (!_coverForIndustry) {
    _coverForIndustry = new Map();
    for (const group of industryGroups.groups) {
      const rel = `assets/industries/${group.slug}/cover-800.webp`;
      if (!fs.existsSync(path.join(ROOT, rel))) continue;
      for (const child of group.children) _coverForIndustry.set(child, rel);
    }
  }
  return _coverForIndustry.get(industrySlug) || null;
}

function groupCover(group) {
  const real = path.join(ROOT, "assets", "industries", group.slug, "cover-800.webp");
  if (fs.existsSync(real)) {
    coverStats.real++;
    return { src: `assets/industries/${group.slug}/cover-800.webp`, standIn: false };
  }
  // Deliberately NO stand-in from the existing industry heroes: those are 16:9
  // machine collages with captions baked in, so cropping them to 4:3 slices the
  // text and their green/purple backdrops fight the brand blue. A clean plate is
  // honest about the photo being absent and lets the layout be judged on its own.
  coverStats.none++;
  return null;
}

/* ---- markets band ----
   Anurag asked for the catalogue's flag row. The catalogue heads it "Global
   presence", but BRIEF.md only confirms staffed offices in India, UAE and
   Thailand — the rest are places machines have shipped to. So the heading is
   "Markets we serve" and the three real offices are marked as such. He gets his
   flags; nothing on the page can be challenged by a buyer or an AI engine. */
/* All 25 countries from ART Catalogue '26 page 13. Ratios are read from each
   flag's own viewBox, so nothing is stretched — Nepal stays its correct
   non-rectangular 0.82, Malaysia and the UAE stay 2:1. */
const MARKETS = [
  { file: "india", name: "India", ratio: 1.5 },
  { file: "usa", name: "USA", ratio: 1.9 },
  { file: "uae", name: "UAE", ratio: 2.0 },
  { file: "nepal", name: "Nepal", ratio: 0.82 },
  { file: "bangladesh", name: "Bangladesh", ratio: 1.667 },
  { file: "sri-lanka", name: "Sri Lanka", ratio: 2.0 },
  { file: "mexico", name: "Mexico", ratio: 1.75 },
  { file: "myanmar", name: "Myanmar", ratio: 1.5 },
  { file: "bhutan", name: "Bhutan", ratio: 1.5 },
  { file: "indonesia", name: "Indonesia", ratio: 1.5 },
  { file: "thailand", name: "Thailand", ratio: 1.5 },
  { file: "vietnam", name: "Vietnam", ratio: 1.5 },
  { file: "uk", name: "UK", ratio: 1.667 },
  { file: "malaysia", name: "Malaysia", ratio: 2.0 },
  { file: "south-africa", name: "South Africa", ratio: 1.5 },
  { file: "saudi-arabia", name: "Saudi Arabia", ratio: 1.5 },
  { file: "israel", name: "Israel", ratio: 1.375 },
  { file: "namibia", name: "Namibia", ratio: 1.5 },
  { file: "poland", name: "Poland", ratio: 1.6 },
  { file: "russia", name: "Russia", ratio: 1.5 },
  { file: "kenya", name: "Kenya", ratio: 1.5 },
  { file: "morocco", name: "Morocco", ratio: 1.5 },
  { file: "nigeria", name: "Nigeria", ratio: 2.0 },
  { file: "philippines", name: "Philippines", ratio: 2.0 },
  { file: "egypt", name: "Egypt", ratio: 1.5 },
];

function marketsBand() {
  // Flags are sized by EQUAL AREA, not equal height. At a common height a 2:1
  // flag like Malaysia covers 2.44x the area of Nepal's 0.82 and the row reads
  // as lumpy. Normalising on area brings that spread to 1.35x. Height is
  // clamped so nothing gets extreme, and every flag keeps its true ratio —
  // no stretching, no cropping a national flag.
  const TARGET = 144 * 96;
  const one = MARKETS.map((m) => {
    const h = Math.round(Math.max(80, Math.min(112, Math.sqrt(TARGET / m.ratio))));
    const w = Math.round(h * m.ratio);
    return `
        <li class="mk-item">
          <img class="mk-flag" src="assets/flags/${m.file}.svg" alt="${attr(m.name)}"
               style="--fw:${w}px;--fh:${h}px" width="${w}" height="${h}"
               loading="lazy" decoding="async">
          <span class="mk-name">${esc(m.name)}</span>
        </li>`;
  }).join("");
  return `
  <section class="section mk-section">
    <div class="wrap sec-head">
      <span class="eyebrow">Where we work</span>
      <h2>Markets we serve</h2>
      <p class="mk-sub">Machines engineered in India and supplied across these markets, with teams on the ground in India, the UAE and Thailand.</p>
    </div>
    <div class="mk-marquee">
      <ul class="mk-track">${one}</ul>
      <ul class="mk-track" aria-hidden="true">${one}</ul>
    </div>
  </section>`;
}

function industryGrid(base = "") {
  const tiles = industryGroups.groups.map((group) => {
    const cover = groupCover(group);
    const kids = group.children
      .map((slug) => industries.find((i) => i.slug === slug))
      .filter(Boolean);

    // Childless tiles still render — the grid must match the catalogue Anurag
    // hands to buyers — but they route to a tagged enquiry instead of a thin page.
    const href = kids.length
      ? rel(base, `industries/${kids[0].slug}.html`)
      : wa(`Hi ART Mechatronics, do you supply machinery for ${group.name}? [Industry: ${group.name}]`);
    const external = kids.length ? "" : ' target="_blank" rel="noopener"';

    const media = cover
      ? `<img src="${base}${cover.src}" alt="${attr(group.name)}" loading="lazy" decoding="async" width="800" height="600">`
      : `<span class="ig-plate" aria-hidden="true"></span>`;

    // The dropdown mirrors what the old site showed, so a buyer sees the same
    // breadth Anurag is used to demoing. A sub with a slug goes to its own page;
    // one without has no page yet and falls back to the parent tile.
    const subs = group.subs || [];
    const parentHref = kids.length ? rel(base, `industries/${kids[0].slug}.html`) : null;
    const caret = subs.length ? `
        <button class="ig-caret" type="button" aria-expanded="false" aria-controls="igd-${group.slug}" aria-label="Show categories under ${attr(group.name)}">
          <svg viewBox="0 0 12 12" aria-hidden="true"><polyline points="2,4 6,8 10,4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="ig-drop" id="igd-${group.slug}" hidden>
          <p class="ig-drop__h">Related categories</p>
          <ul>${subs.map((s) => {
            const target = s.slug ? rel(base, `industries/${s.slug}.html`) : parentHref;
            return target
              ? `<li><a href="${target}"><span class="ig-dot" aria-hidden="true"></span>${esc(s.label)}</a></li>`
              : `<li><span class="ig-drop__plain"><span class="ig-dot" aria-hidden="true"></span>${esc(s.label)}</span></li>`;
          }).join("")}</ul>
        </div>` : "";

    return `
      <div class="ig-tile${kids.length > 1 ? " has-drop" : ""}">
        <a class="ig-link" href="${href}"${external}>
          <span class="ig-media">${media}</span>
          <span class="ig-name">${esc(group.name)}</span>
        </a>${caret}
      </div>`;
  }).join("");

  return `<div class="ig-grid">${tiles}</div>`;
}

/* ============================================================
   LISTING pages
   ============================================================ */
function card(item, kind) {
  const href = pubPath(`${kind}/${item.slug}.html`);
  // Card teasers may ellipsis (that's normal card UI) but must never open with a
  // pasted tick-run, so drop that tail first — same rule metaDescOf applies.
  const teaser = String(firstPara(item.intro) || item.metaDesc || "").replace(/\s*[✔✓].*$/s, "").trim();
  const desc = clip(teaser || item.metaDesc || "", 120);
  const tag = kind === "products" ? item.category : "Industry";
  const media = cardMedia(item, kind);
  return `<a class="cat-card cat-card--${kind === "products" ? "product" : "industry"}" href="${href}" data-name="${attr((item.display + " " + item.shortName + " " + item.h1 + " " + (item.aka||[]).join(" ")).toLowerCase())}" data-cat="${attr(item.category)}">
    <div class="cat-card__media">${media}<span class="cat-card__tag">${esc(tag)}</span></div>
    <div class="cat-card__body">
      <h3>${esc(item.display)}</h3>
      <p>${esc(desc)}</p>
      <span class="cat-card__go">View details →</span>
    </div></a>`;
}

function renderIndustriesHub(sel) {
  const main = `
  <section class="mi-hero"><div class="wrap">
    <span class="eyebrow">Industries we serve</span>
    <h1>Turnkey plants &amp; machinery for every industry</h1>
    <p class="lead">Explore innovative, end-to-end customised engineering solutions designed to optimise performance, efficiency and scalability across industries.</p>
    <a class="btn btn--light btn--lg" href="catalog">Browse the machine catalogue →</a>
  </div></section>
  <section class="section section--tint"><div class="wrap">
    <h2 class="ig-head">Industries We Serve</h2>
    <p class="ig-sub">Tailored solutions for food processing, advanced materials and industrial manufacturing. Open any industry to see the machines and the complete line.</p>
    ${industryGrid("")}
  </div></section>
  <section class="section"><div class="wrap">
    <h2 class="visually-hidden">All industries</h2>
    <div class="cat-toolbar"><input type="search" id="catSearch" placeholder="Search industries…" aria-label="Search industries"></div>
    <div class="cat-grid" id="catGrid">${sel.map((i) => card(i, "industries")).join("")}</div>
    <p class="cat-empty" id="catEmpty" hidden>No direct match? Tell us about your industry and process. <a href="${wa("Hi ART Mechatronics, I'd like to know if you serve my industry. Please help.")}" target="_blank" rel="noopener">Ask us on WhatsApp →</a></p>
  </div></section>
  ${moreBand(sel.length, industries.length, "industries")}`;
  return shell({
    page: "industries", base: "", title: "Industries We Serve | ART Mechatronics",
    desc: "Turnkey processing plants & machinery for pan masala, spices, snacks, flour, rice, dairy, tea & more — built and automated by ART Mechatronics.",
    canonical: abs("industries.html"), main,
    schema: listingSchema(abs("industries.html"), "Industries We Serve", "Turnkey processing plants and machinery by ART Mechatronics, by industry."),
    extraJS: true,
  });
}
function renderCatalog(sel) {
  const cats = [...new Set(sel.map((p) => p.category))].sort();
  const filters = ['<button class="fbtn is-on" data-cat="all">All</button>']
    .concat(cats.map((c) => `<button class="fbtn" data-cat="${attr(c)}">${esc(c)}</button>`)).join("");
  const main = `
  <section class="mi-hero"><div class="wrap">
    <span class="eyebrow">Machine catalogue</span>
    <h1>Industrial process &amp; packaging machinery</h1>
    <p class="lead">From dust collectors and pulverizers to mixers, dryers, conveyors and packaging lines. Every machine is custom-engineered and turnkey-supplied by ART Mechatronics.</p>
  </div></section>
  <section class="section"><div class="wrap">
    <h2 class="visually-hidden">All machines</h2>
    <div class="cat-toolbar">
      <input type="search" id="catSearch" placeholder="Search machines… (e.g. mixer, dryer, packing)" aria-label="Search machines">
    </div>
    <div class="cat-filters" id="catFilters">${filters}</div>
    <div class="cat-grid" id="catGrid">${sel.map((p) => card(p, "products")).join("")}</div>
    <p class="cat-empty" id="catEmpty" hidden>No direct match? Tell us the function you need. <a href="${wa("Hi ART Mechatronics, I couldn't find a machine in your catalogue. Can you help?")}" target="_blank" rel="noopener">Ask us on WhatsApp →</a></p>
  </div></section>
  ${moreBand(sel.length, products.length, "machines")}`;
  return shell({
    page: "catalog", base: "", title: "Machine Catalogue | ART Mechatronics",
    desc: "Browse ART Mechatronics' machinery: dust collectors, pulverizers, mixers, dryers, sifters, conveyors & packaging machines. Turnkey supply.",
    canonical: abs("catalog.html"), main, extraJS: true,
    schema: listingSchema(abs("catalog.html"), "Machine Catalogue", "Full catalogue of processing, packaging and material-handling machines by ART Mechatronics."),
  });
}
function moreBand(shown, total, what) {
  if (shown >= total) return "";
  return `<section class="section section--navy"><div class="wrap center">
    <span class="eyebrow">Preview batch</span>
    <h2>${shown} of ${total} ${what} live</h2>
    <p class="lead" style="margin-inline:auto">This is the review batch. Once approved, the remaining ${total - shown} ${what} generate from the same template in one run.</p>
    <div style="margin-top:1.4rem"><a class="btn btn--wa btn--lg" href="${wa("Hi ART Mechatronics, I'd like to enquire about your machinery.")}" target="_blank" rel="noopener">WhatsApp us</a></div>
  </div></section>`;
}

/* ============================================================
   BUILD
   ============================================================ */
const selInd = pickIndustries();
const selProd = pickProducts(selInd);
assignOutputMetadata(selInd, "industry");
assignOutputMetadata(selProd, "product");
const selProdSlugs = new Set(selProd.map((p) => p.slug));

// linker: only link to a machine if we actually generated its page
function linkMachine(name) {
  const m = matchProduct(name);
  if (m && selProdSlugs.has(m.slug)) return { href: `../${pubPath(`products/${m.slug}.html`)}`, product: m };
  return null;
}
function industriesUsing(product) {
  return selInd.filter((ind) => ind.machines.some((n) => {
    const m = matchProduct(n);
    return m && m.slug === product.slug;
  }));
}
const ctx = { linkMachine, industriesUsing, selectedProducts: selProd, selectedIndustries: selInd };

// clean output dirs
for (const d of ["industries", "products"]) {
  const dir = path.join(ROOT, d);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (f.endsWith(".html")) fs.unlinkSync(path.join(dir, f));
}

let n = 0;
for (const ind of selInd) { fs.writeFileSync(path.join(ROOT, "industries", ind.slug + ".html"), renderIndustry(ind, ctx)); n++; }
for (const p of selProd) { fs.writeFileSync(path.join(ROOT, "products", p.slug + ".html"), renderProduct(p, ctx)); n++; }

// listing hubs (search JS appended via extraJS in shell)
fs.writeFileSync(path.join(ROOT, "industries.html"), renderIndustriesHub(selInd));

/* index.html is hand-maintained, but its industry grid must stay in lockstep with
   the taxonomy — so the generator owns the markup between the two markers and
   rewrites it on every build. Idempotent; the rest of the page is never touched. */
{
  const homePath = path.join(ROOT, "index.html");
  const home = fs.readFileSync(homePath, "utf8");
  const START = "<!-- industry-grid:start -->";
  const END = "<!-- industry-grid:end -->";
  const from = home.indexOf(START);
  const to = home.indexOf(END);
  if (from < 0 || to < 0) {
    throw new Error("index.html is missing the industry-grid markers — the homepage grid cannot be injected");
  }
  let next = home.slice(0, from + START.length) + "\n      " + industryGrid("") + "\n      " + home.slice(to);

  // markets band — same marker pattern, generated from the MARKETS list
  const MS = "<!-- markets-band:start -->";
  const ME = "<!-- markets-band:end -->";
  const mf = next.indexOf(MS);
  const mt = next.indexOf(ME);
  if (mf < 0 || mt < 0) {
    throw new Error("index.html is missing the markets-band markers");
  }
  next = next.slice(0, mf + MS.length) + "\n" + marketsBand() + "\n  " + next.slice(mt);

  fs.writeFileSync(homePath, next);
}
fs.writeFileSync(path.join(ROOT, "catalog.html"), renderCatalog(selProd));

// sitemap
const urls = [
  "", "about.html", "contact.html", "machines.html", "system.html", "control-panel.html",
  "industries.html", "catalog.html",
  ...selInd.map((i) => `industries/${i.slug}.html`),
  // Only indexable product pages belong in the sitemap — submitting a noindex
  // URL asks Google to crawl a page we've told it to drop.
  ...selProd.filter((p) => productIndexable(p.slug)).map((p) => `products/${p.slug}.html`),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${abs(u)}</loc></url>`).join("\n")}
</urlset>`;
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap);

console.log(`Generated ${selInd.length} industries + ${selProd.length} products = ${n} pages${ALL ? " [FULL]" : " [batch]"}`);
console.log("Industries:", selInd.map((i) => i.slug).join(", "));
console.log("Products:", selProd.map((p) => p.slug).join(", "));

// export nothing; script side-effects only
