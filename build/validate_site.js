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
if (productCount !== 315) errors.push(`Expected 315 product pages, found ${productCount}`);
if (industryCount !== 111) errors.push(`Expected 111 industry pages, found ${industryCount}`);

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

console.log("ART whole-site validation");
console.log(`  Checked: ${notes.join(", ")}`);
if (errors.length) {
  console.error(`\nFAIL: ${errors.length} issue${errors.length === 1 ? "" : "s"}`);
  errors.slice(0, 100).forEach(error => console.error(`  - ${error}`));
  if (errors.length > 100) console.error(`  - ...and ${errors.length - 100} more`);
  process.exit(1);
}
console.log("PASS: local references, fragments, metadata, accessibility basics, source syntax, counts, and production canonicals are valid.");
