/* ============================================================
   ART Mechatronics — content parser
   Converts the client's Word-exported text (build/source/*.txt) into
   clean structured JSON (build/data/*.json) that the generator turns
   into static SEO pages.

   The client docs use a consistent emoji-marked structure, e.g.
     🔥 SEO TITLE (Meta Title)
     🔥 META DESCRIPTION
     🏭 H1 HEADING
     🧠 INTRODUCTION ...
     ⚙️ ... PROCESS FLOW / WORKING PRINCIPLE
     🔍 ALSO KNOWN AS ...
     🌍 APPLICATIONS
     📞 CALL TO ACTION
   Run:  node build/parse.js
   ============================================================ */
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "source");
const OUT = path.join(__dirname, "data");
fs.mkdirSync(OUT, { recursive: true });

/* ---------- helpers ---------- */
const isBlank = (l) => !l || !l.trim();

// The doc has TWO header formats:
//   (1) "🔥 META DESCRIPTION\n<value>"      marker alone, value on next line
//   (2) "🔥 META DESCRIPTION <value>"        marker + value on the SAME line
// A header = emoji, not a 👉 note or bullet, and a leading ALL-CAPS keyword run of
//   • 2+ caps words (META DESCRIPTION, H1 HEADING, SEO TITLE, WORKING PRINCIPLE…), or
//   • 1 caps word only if it's bare / followed by "(" or ":" (APPLICATIONS).
// The single-word rule is what rejects "CIP System" / "FMCG Dairy Brands".
// each caps word needs (?![a-z]) so a Title-case value ("Sack") isn't eaten into the keyword.
// Connector tokens are allowed because many real headers contain "&", "/" or commas.
const CAPS_WORD = "[A-Z0-9][A-Z0-9-]*(?![a-z])";
const CAPS_TOKEN = `(?:${CAPS_WORD}|[&/,+])`;
const CAPS_RUN = new RegExp(`^(${CAPS_TOKEN}(?:\\s*${CAPS_TOKEN})*)`);
function isHeader(line) {
  const t = line.trim();
  if (!t) return false;
  if (t.startsWith("👉")) return false;
  if (isBullet(line)) return false;                    // bullets are never section headers
  if (t.codePointAt(0) <= 0x2000) return false;        // must start with an emoji/symbol
  const after = t.replace(/^[^\p{L}0-9]+/u, "");       // strip leading emoji
  const m = after.match(CAPS_RUN);
  if (!m || !/[A-Z]/.test(m[1])) return false;
  const capsWords = (m[1].match(/[A-Z0-9][A-Z0-9-]*/g) || []).length;
  const rest = after.slice(m[0].length).replace(/^\s+/, "");
  return capsWords >= 2 || rest === "" || rest.startsWith("(") || rest.startsWith(":");
}
// Split a header line into its keyword + any inline value (format 2).
function parseHeader(line) {
  const after = line.trim().replace(/^[^\p{L}0-9]+/u, "");
  const m = after.match(CAPS_RUN);
  const kw = m ? m[1].trim() : after;
  let rest = m ? after.slice(m[0].length) : "";
  const qualifier = rest.match(/^\s*\([^)]*\)/);
  if (qualifier) rest = rest.slice(qualifier[0].length);

  let key = kw.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
  let title = titleCase(kw);
  // One client revision uses "UPDATED INTRO" for the real introduction.
  if (key === "UPDATED INTRO") { key = "INTRODUCTION"; title = "Introduction"; }
  else if (key.startsWith("UPDATED ")) { key = key.slice(8); title = titleCase(key); }
  return { key, title, inlineValue: rest.trim() };
}

// Clean a header line to a display title: strip leading emoji + trailing (qualifier)
function headerTitle(line) {
  return line.trim()
    .replace(/^[^\p{L}]+/u, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}
const keyOf = (title) => title.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();

const BULLET = "🔹🔸▪●○•\\-*·";
const isBullet = (l) => new RegExp(`^[\\s${BULLET}]*[${BULLET}]\\s*`, "u").test(l) && /[A-Za-z0-9]/.test(l);
const cleanBullet = (l) => l.replace(new RegExp(`^[\\s${BULLET}]*[${BULLET}]\\s*`, "u"), "").replace(/\s+/g, " ").trim();

const isAllCaps = (l) => {
  const t = l.trim();
  if (t.length < 4) return false;
  if (!/^[A-Z0-9][A-Z0-9 &/().,'\-]+$/.test(t)) return false; // only caps-ish chars
  const letters = t.replace(/[^A-Za-z]/g, "");
  return letters.length >= 3 && letters === letters.toUpperCase();
};

function slugify(s) {
  return s.toLowerCase()
    .split("(")[0]
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 70);
}
const titleCase = (s) =>
  s.toLowerCase().replace(/\b([a-z])/g, (m, c) => c.toUpperCase())
   .replace(/\bAnd\b/g, "and").replace(/\bOf\b/g, "of").replace(/\bFor\b/g, "for");

/* ---------- core: split a document into entries ---------- */
function parseDoc(raw, kind) {
  const lines = raw.replace(/\r/g, "").split("\n");

  // indices of "SEO TITLE (Meta Title)" markers = start of each entry's fields
  const markers = [];
  lines.forEach((l, i) => { if (/SEO TITLE\s*\(Meta Title\)/i.test(l)) markers.push(i); });

  // Fallback: a few blocks have NAME + META DESCRIPTION + H1 but NO "SEO TITLE"
  // line. Without this they get swallowed into the previous entry (data loss).
  // Treat such an orphan META line as an entry boundary.
  const seoSet = new Set(markers);
  lines.forEach((l, i) => {
    if (!/META DESCRIPTION/i.test(l)) return;
    let seen = 0, hasSeo = false;
    for (let j = i - 1; j >= 0 && seen < 3; j--) {
      if (isBlank(lines[j])) continue;
      seen++;
      if (seoSet.has(j)) { hasSeo = true; break; }
    }
    if (!hasSeo) markers.push(i);
  });
  markers.sort((a, b) => a - b);

  // helper: nearest previous non-blank line (the entry's raw name)
  const prevNonBlank = (i) => { for (let j = i - 1; j >= 0; j--) if (!isBlank(lines[j])) return j; return -1; };
  const nextNonBlank = (i) => { for (let j = i + 1; j < lines.length; j++) if (!isBlank(lines[j])) return j; return -1; };

  const nameIdx = new Set(markers.map((m) => prevNonBlank(m)));

  // running category (products only): an all-caps standalone line whose next
  // non-blank line is another all-caps line (the machine name), not an emoji header.
  const categoryAt = [];
  let current = "";
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!isBlank(l) && isAllCaps(l) && !nameIdx.has(i)) {
      const nb = nextNonBlank(i);
      if (nb !== -1 && !isHeader(lines[nb]) && isAllCaps(lines[nb])) {
        current = titleCase(l.trim());
      }
    }
    categoryAt[i] = current;
  }

  const seenSlugs = new Map();
  const entries = [];

  for (let k = 0; k < markers.length; k++) {
    const start = markers[k];
    const end = k + 1 < markers.length ? prevNonBlank(markers[k + 1]) : lines.length; // stop before next name
    const nameLine = lines[prevNonBlank(start)] || "";
    const rawName = cleanBullet(nameLine).replace(/\.$/, "").trim();

    // walk the block, grouping into sections by header (inline value → first body line)
    const sections = [];
    const h0 = parseHeader(lines[start]);
    let cur = { key: h0.key, title: h0.title, body: h0.inlineValue ? [h0.inlineValue] : [] };
    for (let i = start + 1; i < end; i++) {
      const l = lines[i];
      if (isHeader(l)) {
        sections.push(cur);
        const h = parseHeader(l);
        cur = { key: h.key, title: h.title, body: h.inlineValue ? [h.inlineValue] : [] };
      } else if (!isBlank(l)) {
        cur.body.push(l.replace(/\s+$/, ""));
      }
    }
    sections.push(cur);

    const find = (re) => sections.find((s) => re.test(s.key));
    const bodyText = (s) => (s ? s.body.filter((l)=>!isBlank(l)).join("\n") : "");
    const firstLine = (s) => (s && s.body.find((l) => !isBlank(l))) || "";

    const metaTitle = firstLine(find(/SEO TITLE/));
    const metaDesc = firstLine(find(/META DESCRIPTION/));
    const h1 = firstLine(find(/H1 HEADING|^H1$|HEADING/)) || titleCase(rawName);
    const introSec = find(/INTRODUCTION/);

    // content sections = everything except the meta/name plumbing
    const skip = /(SEO TITLE|META DESCRIPTION|H1 HEADING|^HEADING$)/;
    const contentSections = sections
      .filter((s) => s.body.length && !skip.test(s.key))
      .map((s) => structureSection(s));

    // machines used (industries): from MACHINERY REQUIRED, else all process bullets
    let machines = [];
    const machSec = sections.find((s) => /MACHINERY/.test(s.key));
    if (machSec) machines = machSec.body.filter(isBullet).map(cleanBullet);
    if (!machines.length) {
      const flow = sections.find((s) => /PROCESS FLOW/.test(s.key));
      if (flow) machines = flow.body.filter(isBullet).map(cleanBullet);
    }
    machines = [...new Set(machines.map((m) => m.replace(/\s+/g, " ").trim()).filter(Boolean))];

    // applications
    const appSec = sections.find((s) => /APPLICATION/.test(s.key));
    const applications = appSec ? appSec.body.filter(isBullet).map(cleanBullet) : [];

    // also-known-as (products) → keyword synonyms
    const akaSec = sections.find((s) => /ALSO KNOWN AS/.test(s.key));
    const aka = akaSec ? akaSec.body.filter(isBullet).map(cleanBullet) : [];

    // slug (unique)
    let slug = slugify(rawName || h1);
    if (!slug) slug = slugify(h1) || `item-${k}`;
    const n = (seenSlugs.get(slug) || 0) + 1;
    seenSlugs.set(slug, n);
    if (n > 1) slug = `${slug}-${n}`;

    entries.push({
      slug,
      shortName: titleCase(rawName || h1),
      h1: h1.trim(),
      metaTitle: (metaTitle || h1).trim(),
      metaDesc: (metaDesc || "").trim(),
      category: kind === "product" ? (categoryAt[start] || "General") : "Industry",
      intro: bodyText(introSec),
      sections: contentSections,
      machines,
      applications,
      aka,
    });
  }
  return entries;
}

/* Turn a raw section into renderable blocks: paragraphs, bullet lists,
   numbered steps (each step may carry a "Machines Used" sub-list + a 👉 note). */
function structureSection(sec) {
  const blocks = [];
  const lines = sec.body;
  let i = 0;
  const isStep = (l) => /^\s*\d+[.)]\s+/.test(l);
  const isNote = (l) => l.trim().startsWith("👉");
  const stripNum = (l) => l.replace(/^\s*\d+[.)]\s+/, "").trim();

  while (i < lines.length) {
    const l = lines[i];
    if (isBullet(l)) {
      const items = [];
      while (i < lines.length && isBullet(lines[i])) items.push(cleanBullet(lines[i++]));
      blocks.push({ type: "list", items });
    } else if (isStep(l)) {
      const step = { type: "step", title: stripNum(l), desc: [], machines: [], note: "" };
      i++;
      while (i < lines.length && !isStep(lines[i]) && !isBullet(lines[i]) && !isNote(lines[i]) &&
             !/^machines?\s+used/i.test(lines[i].trim())) {
        step.desc.push(lines[i++].trim());
      }
      if (i < lines.length && /^machines?\s+used/i.test(lines[i].trim())) i++; // skip "Machines Used:" label
      while (i < lines.length && isBullet(lines[i])) step.machines.push(cleanBullet(lines[i++]));
      if (i < lines.length && isNote(lines[i])) step.note = lines[i++].replace(/^👉\s*/, "").trim();
      blocks.push(step);
    } else if (isNote(l)) {
      blocks.push({ type: "note", text: l.replace(/^👉\s*/, "").trim() });
      i++;
    } else {
      const para = [];
      while (i < lines.length && !isBullet(lines[i]) && !isStep(lines[i]) && !isNote(lines[i])) para.push(lines[i++].trim());
      const text = para.join(" ").trim();
      if (text) blocks.push({ type: "para", text });
    }
  }
  return { title: titleCase(sec.title), key: sec.key, blocks };
}

// Keep the first copy of exact content and quarantine later mislabeled copies.
// The source remains untouched, so a corrected block automatically returns.
function omitExactContentDuplicates(entries, kind) {
  const seen = new Map();
  return entries.filter((entry) => {
    const signature = JSON.stringify([
      entry.h1, entry.metaTitle, entry.metaDesc, entry.intro, entry.sections,
      entry.machines, entry.applications, entry.aka,
    ]);
    const first = seen.get(signature);
    if (first) {
      console.warn(`  skipped duplicate ${kind}: "${entry.shortName}" (${entry.slug}) duplicates "${first.shortName}" (${first.slug})`);
      return false;
    }
    seen.set(signature, entry);
    return true;
  });
}

/* ---------- run ---------- */
function run(file, kind, outName) {
  const raw = fs.readFileSync(path.join(SRC, file), "utf8");
  const entries = omitExactContentDuplicates(parseDoc(raw, kind), kind);
  fs.writeFileSync(path.join(OUT, outName), JSON.stringify(entries, null, 2));
  console.log(`\n${file} → ${outName}: ${entries.length} ${kind} pages`);
  // sample for eyeballing
  const s = entries[0];
  if (s) {
    console.log(`  sample: "${s.shortName}"  slug=${s.slug}  cat=${s.category}`);
    console.log(`    title: ${s.metaTitle.slice(0, 70)}`);
    console.log(`    desc : ${s.metaDesc.slice(0, 70)}`);
    console.log(`    sections: ${s.sections.map((x) => x.title).join(" | ")}`);
    console.log(`    machines(${s.machines.length}): ${s.machines.slice(0, 5).join(", ")}`);
  }
  // category breakdown for products
  if (kind === "product") {
    const cats = {};
    entries.forEach((e) => (cats[e.category] = (cats[e.category] || 0) + 1));
    console.log("  categories:", Object.entries(cats).map(([c, n]) => `${c}(${n})`).join(", "));
  }
  return entries;
}

run("industries.txt", "industry", "industries.json");
run("products.txt", "product", "products.json");
console.log("\nDone.");
