#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const LIVE_ORIGIN = "https://artmechatronics.com";
const errors = [];
const notes = [];

function walk(dir, predicate) {
  const output = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "dist" || entry.name === ".git" || entry.name === "node_modules") continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...walk(absolute, predicate));
    else if (predicate(absolute)) output.push(absolute);
  }
  return output;
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, "/");
}

function cleanReference(value) {
  return value
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .split(/\s+/)[0]
    .replaceAll("&amp;", "&");
}

function isExternal(value) {
  return /^(?:[a-z]+:|\/\/)/i.test(value) || value.startsWith("data:");
}

function resolveLocal(fromFile, reference) {
  const raw = cleanReference(reference);
  if (!raw || raw === "#" || isExternal(raw)) return null;
  const [withoutHash, hash = ""] = raw.split("#", 2);
  const pathOnly = withoutHash.split("?")[0];
  let target;
  if (!pathOnly) target = fromFile;
  else if (pathOnly.startsWith("/")) target = path.join(ROOT, pathOnly.replace(/^\/+/, ""));
  else target = path.resolve(path.dirname(fromFile), decodeURIComponent(pathOnly));
  if (target.endsWith(path.sep)) target = path.join(target, "index.html");
  // Public URLs are extensionless because Cloudflare Pages serves foo.html at
  // /foo (and 308s the .html form). On disk the file still ends in .html, so a
  // link to "products/x" must resolve to "products/x.html"; "./" means index.
  if (!fs.existsSync(target)) {
    if (target.endsWith(`${path.sep}.`)) {
      const asIndex = path.join(path.dirname(target), "index.html");
      if (fs.existsSync(asIndex)) return { target: asIndex, hash };
    }
    if (!path.extname(target) && fs.existsSync(`${target}.html`)) {
      return { target: `${target}.html`, hash };
    }
  }
  return { target, hash };
}

function idsIn(html) {
  return [...html.matchAll(/\sid\s*=\s*["']([^"']+)["']/gi)].map(match => match[1]);
}

const htmlFiles = walk(ROOT, file => file.endsWith(".html"));
const htmlCache = new Map(htmlFiles.map(file => [file, fs.readFileSync(file, "utf8")]));

for (const [file, html] of htmlCache) {
  const rel = relative(file);
  const ids = idsIn(html);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) errors.push(`${rel}: duplicate IDs ${[...new Set(duplicates)].join(", ")}`);
  if (!/<html\b[^>]*\blang=["'][^"']+["']/i.test(html)) errors.push(`${rel}: missing html lang`);
  if (!/<title>[^<]+<\/title>/i.test(html)) errors.push(`${rel}: missing title`);
  if (!/<meta\b[^>]*name=["']description["'][^>]*content=["'][^"']+["']/i.test(html) &&
      !/<meta\b[^>]*content=["'][^"']+["'][^>]*name=["']description["']/i.test(html)) {
    errors.push(`${rel}: missing meta description`);
  }
  for (const tag of html.match(/<img\b[^>]*>/gi) || []) {
    if (!/\balt\s*=\s*["'][^"']*["']/i.test(tag)) errors.push(`${rel}: image missing alt attribute`);
  }

  const canonical = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) ||
                    html.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
  if (rel !== "machine.html" && (!canonical || !canonical[1].startsWith(LIVE_ORIGIN))) {
    errors.push(`${rel}: production canonical missing or incorrect`);
  }
  if (html.includes("1710yashraj-builder.github.io/art-mechatronics-site")) {
    errors.push(`${rel}: stale GitHub Pages origin`);
  }
  if (html.includes("art-mechatronics-catalogue.personal-buildanta.chatgpt.site")) {
    errors.push(`${rel}: stale ChatGPT Sites origin`);
  }

  const refs = [];
  for (const match of html.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)) refs.push(match[1]);
  for (const match of html.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) {
    match[1].split(",").forEach(candidate => refs.push(candidate.trim().split(/\s+/)[0]));
  }
  for (const reference of refs) {
    const resolved = resolveLocal(file, reference);
    if (!resolved) continue;
    if (!resolved.target.startsWith(ROOT + path.sep) && resolved.target !== ROOT) {
      errors.push(`${rel}: local reference escapes site root: ${reference}`);
      continue;
    }
    if (!fs.existsSync(resolved.target)) {
      errors.push(`${rel}: missing local reference ${reference}`);
      continue;
    }
    if (resolved.hash && resolved.target.endsWith(".html")) {
      const targetHtml = htmlCache.get(resolved.target) || fs.readFileSync(resolved.target, "utf8");
      const targetIds = new Set(idsIn(targetHtml));
      if (!targetIds.has(decodeURIComponent(resolved.hash))) {
        errors.push(`${rel}: missing fragment target ${reference}`);
      }
    }
  }
}

const cssFiles = walk(path.join(ROOT, "css"), file => file.endsWith(".css"));
for (const file of cssFiles) {
  const css = fs.readFileSync(file, "utf8");
  for (const match of css.matchAll(/url\(([^)]+)\)/gi)) {
    const resolved = resolveLocal(file, match[1]);
    if (resolved && !fs.existsSync(resolved.target)) {
      errors.push(`${relative(file)}: missing CSS asset ${cleanReference(match[1])}`);
    }
  }
}

const jsFiles = walk(path.join(ROOT, "js"), file => file.endsWith(".js"))
  .concat(walk(path.join(ROOT, "build"), file => file.endsWith(".js")));
for (const file of jsFiles) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (error) {
    errors.push(`${relative(file)}: JavaScript syntax error\n${String(error.stderr || error.message).trim()}`);
  }
}

const productCount = htmlFiles.filter(file => relative(file).startsWith("products/")).length;
const industryCount = htmlFiles.filter(file => relative(file).startsWith("industries/")).length;
if (productCount !== 319) errors.push(`Expected 319 product pages, found ${productCount}`);
// 112 -> 250 on 2026-09-01. The founder's industries Excel is the source of
// truth: 141 items from his sheet gained pages, and palm-oil plus the two
// silver-coated entries were removed because they are not in his sheet.
const expectedInd = JSON.parse(fs.readFileSync(path.join(ROOT,"build/data/industries.json"),"utf8")); const expN = (Array.isArray(expectedInd)?expectedInd:expectedInd.industries).length;
if (industryCount !== expN) errors.push(`Expected ${expN} industry pages (from industries.json), found ${industryCount}`);

const required = [
  "index.html", "industries.html", "catalog.html", "machines.html",
  "system.html", "control-panel.html", "about.html", "contact.html", "machine.html",
];
for (const file of required) {
  if (!fs.existsSync(path.join(ROOT, file))) errors.push(`Missing required page ${file}`);
}

const textFiles = walk(ROOT, file => /\.(?:html|css|js|xml|json)$/i.test(file));
for (const file of textFiles) {
  if (file === __filename) continue;
  const source = fs.readFileSync(file, "utf8");
  if (source.includes("1710yashraj-builder.github.io/art-mechatronics-site")) {
    errors.push(`${relative(file)}: stale production origin`);
  }
}

notes.push(`${htmlFiles.length} HTML files`);
notes.push(`${productCount} product pages`);
notes.push(`${industryCount} industry pages`);
notes.push(`${cssFiles.length} stylesheets`);
notes.push(`${jsFiles.length} JavaScript files`);

/* ONE CACHE TOKEN, SITE-WIDE. This shipped broken and nothing caught it: the
   9 hand-authored pages were bumped by hand while build/generate.js kept
   stamping the other 415 with the value hardcoded in its own CSSV constant.
   Because /js/* is served with max-age=604800, every returning visitor got a
   week-old layout.js on those 415 pages — a nav missing its Contact link —
   while the server held the correct file and every local check passed. The
   defect is invisible from the source tree, so the only thing that can catch
   it is this: the whole site must ask for exactly ONE version of its assets. */
{
  const tokens = new Map();
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, "utf8");
    for (const m of html.matchAll(/\?v=([0-9a-z]+)/g)) {
      if (!tokens.has(m[1])) tokens.set(m[1], []);
      const seen = tokens.get(m[1]);
      if (seen.length < 4) seen.push(path.relative(ROOT, file));
    }
  }
  if (tokens.size > 1) {
    const parts = [...tokens.entries()]
      .map(([t, files]) => `?v=${t} (e.g. ${files.join(", ")})`)
      .join("  |  ");
    errors.push(
      `cache token drift: ${tokens.size} different tokens are live across the site — ${parts}. ` +
      `Bump CSSV in build/generate.js and re-run --all so every page agrees.`
    );
  } else if (tokens.size === 1) {
    notes.push(`1 cache token (?v=${[...tokens.keys()][0]})`);
  }
}

/* CSS math validity (added 2026-08-29). Inside calc()/clamp()/min()/max(), the
   + and - operators REQUIRE spaces on both sides; "1.5rem+3vw" is invalid and
   the browser drops the ENTIRE declaration without a word in the console.
   That is how .ab-cta shipped with zero padding for three weeks: the padding
   rule looked fine in the file, computed to nothing in the page, and the CTA
   button sat flush on the box edge until the client saw it. Every stylesheet
   and every <style>/style="" block in the HTML gets scanned. */
{
  const badMath = /(calc|clamp|min|max)\(([^()]|\([^()]*\))*?(\d(?:rem|em|px|vw|vh|ch|%)(?:\+|-(?=[\d.]))[\d.]|\d(?:rem|em|px|vw|vh|ch|%) (?:\+|-)(?=[\d.])|(?<=[\d.])(?:\+|-) \d)/;
  const cssFiles = walk(ROOT, f => f.endsWith(".css") && !f.includes(`${path.sep}dist${path.sep}`));
  let scanned = 0;
  for (const file of cssFiles) {
    scanned++;
    const text = fs.readFileSync(file, "utf8");
    text.split("\n").forEach((line, i) => {
      const m = line.match(badMath);
      if (m) errors.push(`invalid CSS math (missing space around +/-, browser drops the whole declaration): ${relative(file)}:${i + 1} — "${m[0].slice(0, 60)}"`);
    });
  }
  notes.push(`${scanned} stylesheets for calc/clamp math`);
}


/* CLICK-THROUGH GUARD (added 2026-09-01). Yash clicked "Elaichi" on the
   industries listing and landed on Mouth Freshener: the chip had no page link
   and silently fell back to its parent. Every page existed; every validator
   passed; the thing the user actually clicks was wrong. So this check follows
   what a visitor clicks — every industry tile and dropdown chip on the
   industries page and the homepage grid, and every category tile in the
   catalogue — loads the page it points at, and FAILS the build unless that
   page's H1 contains the label that was clicked. */
{
  const norm = (s) => String(s).replace(/&amp;/g,"&").replace(/<[^>]+>/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const contains = (h1, label) => { const a=norm(h1), b=norm(label); if(!b) return true; if(a.includes(b)) return true;
    const bw=b.split(" ").filter(w=>w.length>2); return bw.length>0 && bw.every(w=>a.includes(w.replace(/s$/,""))); };
  /* Founder-approved wording that deliberately differs from the landing page's
     own name: the homepage "Manufacturing Solutions" tiles carry Anurag's
     catalogue-cover labels and land on category pages named differently
     ("Crushing & Grinding" -> Size Reduction & Grinding). Recorded here so the
     mapping is explicit and reviewable — a tile/target pair NOT in this list
     still fails the build. Flagged to Yash 2026-09-02 to decide on a rename. */
  const KNOWN_TILE_TARGETS = {
    "material handling equipment industrial automation": "categories/conveying-handling",
    "dust collection pollution control equipment": "categories/pollution-control",
    "crushing grinding": "categories/size-reduction-grinding",
    "much more": "catalog",
  };
  /* A "#section" link lands the visitor on that section, so judge it by the
     section's own heading, not the page H1. */
  const landingHeading = (th, href) => {
    const hash = (href.split("#")[1] || "").trim();
    if (hash) {
      const esc = hash.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const idx = th.search(new RegExp('id="' + esc + '"'));
      if (idx >= 0) {
        const start = th.lastIndexOf("<", idx);
        const m = th.slice(start).match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/);
        if (m) return m[1];
      }
    }
    return (th.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "";
  };
  let checked=0, knownUsed=0;
  for (const page of ["industries.html","index.html","catalog.html"]) {
    const file=path.join(ROOT,page); if(!fs.existsSync(file)) continue;
    const html=fs.readFileSync(file,"utf8");
    const links=[];
    for (const m of html.matchAll(/<a class="ig-link" href="([^"]+)"[^>]*>[\s\S]*?<span class="ig-name">([^<]+)<\/span>/g)) links.push([m[1],m[2],"tile"]);
    for (const m of html.matchAll(/<div class="ig-drop"[\s\S]*?<\/div>/g)) for (const a of m[0].matchAll(/<a href="([^"]+)"><span class="ig-dot"[^>]*><\/span>([^<]+)<\/a>/g)) links.push([a[1],a[2],"chip"]);
    for (const m of html.matchAll(/<a class="mc-tile" href="([^"]+)"[\s\S]*?<span class="mc-tile__name">([^<]+)<\/span>/g)) links.push([m[1],m[2],"tile"]);
    for (const m of html.matchAll(/<a class="cat-card[^"]*" href="([^"]+)"[\s\S]*?<h3>([^<]+)<\/h3>/g)) links.push([m[1],m[2],"card"]);
    for (const [href,label,kind] of links) {
      if (/^https?:|^mailto:|^tel:|wa\.me/.test(href)) continue;
      const r=resolveLocal(file,href); if(!r||!fs.existsSync(r.target)) continue;
      const th=fs.readFileSync(r.target,"utf8"); const h1=landingHeading(th,href);
      checked++;
      const known = KNOWN_TILE_TARGETS[norm(label)];
      if (known !== undefined) {
        if (href.replace(/\.html$/,"").replace(/#.*$/,"") === known) { knownUsed++; continue; }
        errors.push(`click-through: known tile "${label.trim()}" now points at ${href}, not ${known} — change KNOWN_TILE_TARGETS deliberately or fix the tile`); continue;
      }
      if (!contains(h1,label)) errors.push(`click-through: on ${page} the ${kind} "${label.trim()}" opens ${href} whose heading is "${norm(h1).slice(0,60)}"`);
    }
  }
  notes.push(`${checked} tiles/chips/cards click-through verified (${knownUsed} founder-worded tiles matched their recorded targets)`);

/* CHIP LABEL vs PAGE NAME (added 2026-09-02). The click-through guard above
   only asked whether the landing page's H1 CONTAINS the clicked words — so
   "Butter" happily opened the Peanut Butter page, "Mineral" opened Mineral
   Water and "Flakes" opened Cereals & Flakes. Containment is not identity.
   This checks the stronger thing the founder actually asked for: a chip must
   carry its page's own name. Compared on the base name, so a page may still
   carry a "– (a, b, c)" contents suffix or a trailing "(qualifier)". */
{
  const baseName = (s) => String(s || "")
    .split(/\s*[\u2013\u2014-]\s*\(/)[0]        // "Seasoning – (Herbs, ...)" -> "Seasoning"
    .replace(/\s*\([^)]*\)\s*$/, "")             // "Fox Nut (Makhana)"        -> "Fox Nut"
    .replace(/&amp;/g, "&")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const groupsFile = path.join(ROOT, "build/data/industry-groups.json");
  const indFile = path.join(ROOT, "build/data/industries.json");
  if (fs.existsSync(groupsFile) && fs.existsSync(indFile)) {
    const G = JSON.parse(fs.readFileSync(groupsFile, "utf8"));
    const rawInd = JSON.parse(fs.readFileSync(indFile, "utf8"));
    const pages = Array.isArray(rawInd) ? rawInd : rawInd.industries;
    const bySlug = new Map(pages.map((p) => [p.slug, p]));
    let n = 0;
    for (const g of G.groups || []) {
      for (const s of g.subs || []) {
        if (!s.slug) { errors.push(`chip-name: "${g.name}" chip "${s.label}" has no page of its own`); continue; }
        const p = bySlug.get(s.slug);
        if (!p) { errors.push(`chip-name: "${g.name}" chip "${s.label}" points at missing page ${s.slug}`); continue; }
        n++;
        if (baseName(s.label) !== baseName(p.shortName))
          errors.push(`chip-name: under "${g.name}" the chip "${s.label}" opens ${s.slug}, a page called "${p.shortName}" — a chip must carry its page's own name`);
      }
    }
    notes.push(`${n} chip labels matched to their page's own name`);
  }
}

/* NO PLACEHOLDER PROSE (added 2026-09-02). 186 industry pages shipped carrying one
   generated sentence — "X is processed within the Y industry, where raw material is
   cleaned, processed and packed into a consistent, market-ready product" — and the
   same copied machine list, so the Chilli page described turmeric fingers. Both
   validators passed the whole time, because neither had any opinion about prose.
   A second wording ("is a distinct segment of the processing industry") survived the
   first cleanup for the same reason: the filter only knew about the first one. */
{
  const PLACEHOLDERS = [
    "where raw material is cleaned, processed and packed",
    "is a distinct segment of the processing industry",
  ];
  const indFile = path.join(ROOT, "build/data/industries.json");
  if (fs.existsSync(indFile)) {
    const rawInd = JSON.parse(fs.readFileSync(indFile, "utf8"));
    const pages = Array.isArray(rawInd) ? rawInd : rawInd.industries;
    const hits = [];
    for (const p of pages) {
      const blob = JSON.stringify(p);
      for (const ph of PLACEHOLDERS) if (blob.includes(ph)) { hits.push(p.slug); break; }
    }
    if (hits.length)
      errors.push(`placeholder prose: ${hits.length} industry page(s) still carry generated filler text — ${hits.slice(0, 6).join(", ")}${hits.length > 6 ? ", …" : ""}`);
    notes.push(`${pages.length} industry pages checked for placeholder prose`);

    /* A machine list must contain MACHINES. The /industries/packaging page shipped an
       entire internal website brief inside its blocks — "[list patent numbers]",
       "logo strip of 8-12 client logos", "IMAGES SENT TO HARSH" — and several pages
       carried sub-headings ("For Roasted Peanuts:") and sentences ("Grinding peanuts
       into paste") as if they were equipment. Both render as machine chips. */
    const junk = [];
    for (const p of pages) {
      for (const sec of p.sections || []) {
        for (const b of sec.blocks || []) {
          for (const m of b.machines || []) {
            const s = String(m).trim();
            // slashes are separators inside legitimate compound names
            //   ("Dryer (Hot Air / Fluid Bed / Tray Dryer)"), not word breaks
            const words = s.replace(/\s*\/\s*/g, "/").split(/\s+/).length;
            if (s.endsWith(":") || words > 8 || /\[[^\]]+\]/.test(s))
              junk.push(`${p.slug}: "${s.slice(0, 58)}"`);
          }
        }
      }
    }
    if (junk.length)
      errors.push(`machine-list prose: ${junk.length} entr(ies) are not machine names — ${junk.slice(0, 4).join(" | ")}${junk.length > 4 ? " …" : ""}`);
  }
}
}

console.log("ART whole-site validation");
console.log(`  Checked: ${notes.join(", ")}`);
if (errors.length) {
  console.error(`\nFAIL: ${errors.length} issue${errors.length === 1 ? "" : "s"}`);
  errors.slice(0, 100).forEach(error => console.error(`  - ${error}`));
  if (errors.length > 100) console.error(`  - ...and ${errors.length - 100} more`);
  process.exit(1);
}
console.log("PASS: local references, fragments, metadata, accessibility basics, source syntax, counts, and production canonicals are valid.");
