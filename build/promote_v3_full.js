#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MANIFEST_FILE = path.join(ROOT, "assets", "machines", "v3", "pilot", "manifest.json");
const FULL_ROOT = path.join(ROOT, "assets", "machines", "v3", "full");
const PRODUCTS_FILE = path.join(ROOT, "build", "data", "products.json");
const SPEC_CANDIDATES = [
  path.join(ROOT, "assets", "machines", "v3", "full", "visual-spec.json"),
  "/private/tmp/art-full-visual-spec.json",
];

const FAMILY_CATEGORIES = {
  automation: "Automation & Robotics",
  cleaning: "Cleaning, Sorting & Grading",
  conveying: "Conveying & Handling",
  heating: "Heating & Drying",
  mixing: "Mixing & Blending",
  packaging: "Packaging",
  pollution: "Pollution Control",
  process: "Process Equipment",
  grinding: "Size Reduction & Grinding",
  storage: "Storage & Elevation",
};

const rel = (file) => path.relative(ROOT, file).split(path.sep).join("/");

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function findMasters(dir, found = []) {
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findMasters(full, found);
    else if (entry.isFile() && entry.name === "master-4x3.png") found.push(full);
  }
  return found.sort();
}

function loadSpecs() {
  const file = SPEC_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  const specs = new Map();
  if (file) {
    const raw = loadJson(file);
    const rows = Array.isArray(raw) ? raw : raw.products || raw.assets || [];
    for (const row of rows) specs.set(row.slug, row);
  }
  const wavesDir = path.join(FULL_ROOT, "waves");
  if (fs.existsSync(wavesDir)) {
    for (const name of fs.readdirSync(wavesDir).filter((item) => item.endsWith(".json")).sort()) {
      const raw = loadJson(path.join(wavesDir, name));
      const rows = Array.isArray(raw) ? raw : raw.products || raw.assets || [];
      for (const row of rows) specs.set(row.slug, { ...(specs.get(row.slug) || {}), ...row });
    }
  }
  return specs;
}

function familyFor(master) {
  const relative = path.relative(FULL_ROOT, master).split(path.sep);
  return relative[0];
}

function slugFor(master) {
  return path.basename(path.dirname(master));
}

function recordFor(product, master, spec) {
  const slug = product.slug;
  const family = familyFor(master);
  const category = spec.normalizedCategory || spec.category || FAMILY_CATEGORIES[family];
  if (!category) throw new Error(`No approved category for ${slug} (family: ${family})`);

  const status = ["exact", "representative", "reconstructed"].includes(spec.status)
    ? spec.status
    : "reconstructed";
  return {
    slug,
    name: product.shortName,
    category,
    status,
    master: rel(master),
    files: {
      card: `assets/machines/v3/products/${slug}/card-640.webp`,
      detail: `assets/machines/v3/products/${slug}/detail-1280.webp`,
      social: `assets/machines/v3/products/${slug}/social-1200x630.webp`,
    },
    disclosure: status !== "exact",
    alt: `${product.shortName} by ART Mechatronics`,
    visualClass: spec.visualClass || slug,
    confidence: spec.confidence || "medium",
    requiredVisible: spec.requiredVisible || [],
    forbidden: spec.forbidden || [],
    references: spec.references || [],
    ...(spec.sharedConfiguration ? { sharedConfiguration: spec.sharedConfiguration } : {}),
  };
}

function isPromotionReady(spec) {
  return Boolean(
    spec
    && Array.isArray(spec.requiredVisible)
    && spec.requiredVisible.length
    && Array.isArray(spec.references)
    && spec.references.length
  );
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const manifest = loadJson(MANIFEST_FILE);
  const products = loadJson(PRODUCTS_FILE);
  const productsBySlug = new Map(products.map((product) => [product.slug, product]));
  const specs = loadSpecs();
  const beforeCount = manifest.assets.length;
  manifest.assets = manifest.assets.filter((asset) => {
    if (!String(asset.master || "").includes("/v3/full/")) return true;
    return isPromotionReady(specs.get(asset.slug));
  });
  manifest.assets = manifest.assets.map((asset) => {
    const spec = specs.get(asset.slug);
    if (!isPromotionReady(spec)) return asset;
    return {
      ...asset,
      category: spec.normalizedCategory || spec.category || asset.category,
      visualClass: spec.visualClass || asset.visualClass || asset.slug,
      confidence: spec.confidence || asset.confidence || "medium",
      requiredVisible: spec.requiredVisible,
      forbidden: spec.forbidden || [],
      references: spec.references,
      ...(spec.sharedConfiguration ? { sharedConfiguration: spec.sharedConfiguration } : {}),
    };
  });
  const existing = new Map(manifest.assets.map((asset) => [asset.slug, asset]));
  const masters = findMasters(FULL_ROOT);
  const added = [];
  const refreshed = [];
  const deferred = [];

  for (const master of masters) {
    const slug = slugFor(master);
    const product = productsBySlug.get(slug);
    if (!product) throw new Error(`Full v3 master has no product record: ${slug}`);
    const spec = specs.get(slug);
    if (!isPromotionReady(spec)) {
      deferred.push(slug);
      continue;
    }
    const record = recordFor(product, master, spec);
    if (existing.has(slug)) {
      const index = manifest.assets.findIndex((asset) => asset.slug === slug);
      manifest.assets[index] = record;
      refreshed.push(slug);
    } else {
      manifest.assets.push(record);
      added.push(slug);
    }
    existing.set(slug, record);
  }

  manifest.assets.sort((a, b) => a.slug.localeCompare(b.slug));
  if (manifest.assets.length > 12 && manifest.assets.length < products.length) {
    manifest.coverageMode = "incremental";
  } else if (manifest.assets.length === products.length) {
    manifest.coverageMode = "complete";
  }
  manifest.stage = manifest.coverageMode === "complete"
    ? "complete catalogue accuracy system"
    : `incremental accuracy rebuild (${manifest.assets.length}/315)`;

  if (!dryRun && (added.length || refreshed.length || manifest.assets.length !== beforeCount)) {
    fs.writeFileSync(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  console.log(`${dryRun ? "Would promote" : "Promoted"} ${added.length} v3 masters`);
  console.log(`${dryRun ? "Would refresh" : "Refreshed"} ${refreshed.length} v3 masters`);
  console.log(`Approved v3 coverage: ${manifest.assets.length}/315`);
  if (added.length) console.log(added.join("\n"));
  if (deferred.length) console.log(`Deferred pending verified wave spec: ${deferred.join(", ")}`);
}

main();
