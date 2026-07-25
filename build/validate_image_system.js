#!/usr/bin/env node
"use strict";

/*
 * Independent validation for the manifest-driven ART machinery image system.
 * Run after the full image build and static generation:
 *
 *   node build/validate_image_system.js
 *
 * The script has no third-party dependencies and exits non-zero on any error.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(__dirname, "data");
const MANIFEST_FILE = path.join(ROOT, "assets", "machines", "v2", "manifest.json");
const V3_MANIFEST_FILE = path.join(ROOT, "assets", "machines", "v3", "pilot", "manifest.json");
const REQUIRE_COMPLETE = process.argv.includes("--require-complete");

const EXPECTED = Object.freeze({ assets: 48, products: 315, industries: 88, v3Pilot: 12 });
const LIMITS = Object.freeze({
  card: 120 * 1024,
  detail: 400 * 1024,
  social: 450 * 1024,
  industry: 450 * 1024,
});
const REQUIRED_ASSET_FILES = Object.freeze([
  "source",
  "master",
  "detail",
  "card",
  "square",
  "wide",
  "social",
]);
const VALID_STATUSES = new Set(["exact", "representative", "reconstructed"]);

const errors = new Map();
const stats = {
  manifestFiles: 0,
  features: 0,
  htmlFiles: 0,
  htmlImageRefs: 0,
  cardFiles: new Set(),
  detailFiles: new Set(),
  socialFiles: new Set(),
  industryFiles: new Set(),
  v3Products: 0,
};

function addError(group, message) {
  if (!errors.has(group)) errors.set(group, []);
  errors.get(group).push(message);
}

function expect(condition, group, message) {
  if (!condition) addError(group, message);
  return Boolean(condition);
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    addError("Input", `${label} could not be read: ${path.relative(ROOT, file)} (${error.message})`);
    return null;
  }
}

function rel(file) {
  return path.relative(ROOT, file) || ".";
}

function localManifestPath(value, label) {
  if (!expect(typeof value === "string" && value.length > 0, "Manifest files", `${label} is missing`)) {
    return null;
  }
  if (!expect(/^assets\/machines\/v2\//.test(value), "Manifest files", `${label} is not a local v2 asset: ${value}`)) {
    return null;
  }
  const absolute = path.resolve(ROOT, value);
  const outsideRoot = path.relative(ROOT, absolute).startsWith(`..${path.sep}`) || absolute === path.dirname(ROOT);
  if (!expect(!outsideRoot, "Manifest files", `${label} escapes the site root: ${value}`)) return null;
  if (!expect(fs.existsSync(absolute) && fs.statSync(absolute).isFile(), "Manifest files", `${label} does not exist: ${value}`)) {
    return null;
  }
  stats.manifestFiles += 1;
  return absolute;
}

function localV3Path(value, label, extension) {
  if (!expect(typeof value === "string" && value.length > 0, "V3 manifest files", `${label} is missing`)) {
    return null;
  }
  if (!expect(/^assets\/machines\/v3\//.test(value), "V3 manifest files", `${label} is not a local v3 asset: ${value}`)) {
    return null;
  }
  if (extension && !expect(value.toLowerCase().endsWith(extension), "V3 manifest files", `${label} must end in ${extension}: ${value}`)) {
    return null;
  }
  const absolute = path.resolve(ROOT, value);
  const relative = path.relative(ROOT, absolute);
  const outsideRoot = relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
  if (!expect(!outsideRoot, "V3 manifest files", `${label} escapes the site root: ${value}`)) return null;
  if (!expect(fs.existsSync(absolute) && fs.statSync(absolute).isFile(), "V3 manifest files", `${label} does not exist: ${value}`)) {
    return null;
  }
  stats.manifestFiles += 1;
  return absolute;
}

function collectStrings(value, output = []) {
  if (typeof value === "string") output.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, output));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectStrings(item, output));
  return output;
}

function sameSlugSet(source, mapped, label) {
  const sourceSet = new Set(source.map((item) => item.slug));
  const mappedSet = new Set(Object.keys(mapped));
  for (const slug of sourceSet) {
    if (!mappedSet.has(slug)) addError("Manifest coverage", `${label} missing from manifest: ${slug}`);
  }
  for (const slug of mappedSet) {
    if (!sourceSet.has(slug)) addError("Manifest coverage", `Unknown ${label.toLowerCase()} in manifest: ${slug}`);
  }
}

function validateManifest(manifest, products, industries) {
  const assets = manifest && manifest.assets && typeof manifest.assets === "object" ? manifest.assets : {};
  const productMap = manifest && manifest.products && typeof manifest.products === "object" ? manifest.products : {};
  const industryMap = manifest && manifest.industries && typeof manifest.industries === "object" ? manifest.industries : {};

  expect(Object.keys(assets).length === EXPECTED.assets, "Manifest counts", `Expected ${EXPECTED.assets} assets; found ${Object.keys(assets).length}`);
  expect(Object.keys(productMap).length === EXPECTED.products, "Manifest counts", `Expected ${EXPECTED.products} products; found ${Object.keys(productMap).length}`);
  expect(Object.keys(industryMap).length === EXPECTED.industries, "Manifest counts", `Expected ${EXPECTED.industries} industries; found ${Object.keys(industryMap).length}`);
  expect(products.length === EXPECTED.products, "Source counts", `Expected ${EXPECTED.products} source products; found ${products.length}`);
  expect(industries.length === EXPECTED.industries, "Source counts", `Expected ${EXPECTED.industries} source industries; found ${industries.length}`);

  sameSlugSet(products, productMap, "Product");
  sameSlugSet(industries, industryMap, "Industry");

  for (const [assetId, asset] of Object.entries(assets)) {
    expect(asset && typeof asset === "object", "Assets", `Asset ${assetId} is not an object`);
    if (!asset || typeof asset !== "object") continue;
    expect(VALID_STATUSES.has(asset.status), "Disclosure", `Asset ${assetId} has invalid status: ${String(asset.status)}`);
    expect(typeof asset.alt === "string" && asset.alt.trim().length > 0, "Assets", `Asset ${assetId} has no alt text`);
    const files = asset.files && typeof asset.files === "object" ? asset.files : {};
    for (const key of REQUIRED_ASSET_FILES) {
      const absolute = localManifestPath(files[key], `assets.${assetId}.files.${key}`);
      if (absolute && key === "card") stats.cardFiles.add(absolute);
      if (absolute && key === "detail") stats.detailFiles.add(absolute);
    }
  }

  const sourceBySlug = new Map(products.map((product) => [product.slug, product]));
  for (const [slug, mapping] of Object.entries(productMap)) {
    if (!mapping || typeof mapping !== "object") {
      addError("Products", `Product mapping ${slug} is not an object`);
      continue;
    }
    const asset = assets[mapping.assetId];
    expect(Boolean(asset), "Products", `Product ${slug} references missing asset ${String(mapping.assetId)}`);
    expect(typeof mapping.alt === "string" && mapping.alt.trim().length > 0, "Products", `Product ${slug} has no alt text`);
    const labelled = localManifestPath(mapping.labelled, `products.${slug}.labelled`);
    if (labelled) stats.detailFiles.add(labelled);

    if (asset && VALID_STATUSES.has(asset.status)) {
      const expectedDisclosure = asset.status !== "exact";
      expect(
        mapping.disclosure === expectedDisclosure,
        "Disclosure",
        `Product ${slug} uses ${asset.status} asset ${mapping.assetId} but disclosure is ${String(mapping.disclosure)} (expected ${expectedDisclosure})`,
      );
    }

    const features = mapping.features;
    if (!expect(Array.isArray(features), "Features", `Product ${slug} features must be an array`)) continue;
    expect(features.length <= 3, "Features", `Product ${slug} has ${features.length} features; maximum is 3`);
    const source = sourceBySlug.get(slug);
    if (!source) continue;
    const sourceStrings = collectStrings(source);
    for (const feature of features) {
      stats.features += 1;
      expect(typeof feature === "string" && feature.trim().length > 0, "Features", `Product ${slug} contains an empty/non-string feature`);
      if (typeof feature === "string" && feature.length) {
        expect(
          sourceStrings.some((text) => text.includes(feature)),
          "Features",
          `Product ${slug} feature is not verbatim in catalogue source: ${JSON.stringify(feature)}`,
        );
      }
    }
  }

  for (const [slug, mapping] of Object.entries(industryMap)) {
    if (!mapping || typeof mapping !== "object") {
      addError("Industries", `Industry mapping ${slug} is not an object`);
      continue;
    }
    expect(Array.isArray(mapping.assetIds) && mapping.assetIds.length >= 1, "Industries", `Industry ${slug} has no representative assets`);
    for (const assetId of mapping.assetIds || []) {
      expect(Boolean(assets[assetId]), "Industries", `Industry ${slug} references missing asset ${assetId}`);
    }
    expect(mapping.disclosure === true, "Disclosure", `Industry ${slug} montage disclosure must be true; found ${String(mapping.disclosure)}`);
    expect(typeof mapping.alt === "string" && mapping.alt.trim().length > 0, "Industries", `Industry ${slug} has no alt text`);
    const hero = localManifestPath(mapping.hero, `industries.${slug}.hero`);
    if (hero) stats.industryFiles.add(hero);
  }
}

function validateV3Manifest(manifest, products, v2Manifest) {
  if (!expect(manifest && typeof manifest === "object", "V3 manifest", "V3 manifest is not an object")) return;
  const approval = String(manifest.approvalStatus || "");
  expect(/^approved(?:-\d{4}-\d{2}-\d{2})?$/.test(approval), "V3 manifest", `V3 manifest is not approved: ${approval || "missing status"}`);
  expect(["pilot", "incremental", "complete"].includes(manifest.coverageMode), "V3 manifest", `Invalid v3 coverageMode: ${String(manifest.coverageMode)}`);
  if (REQUIRE_COMPLETE) {
    expect(manifest.coverageMode === "complete", "V3 manifest", `Release validation requires complete v3 coverage; found ${String(manifest.coverageMode)}`);
  }

  const entries = Array.isArray(manifest.assets) ? manifest.assets : [];
  expect(entries.length > 0, "V3 manifest", "V3 manifest assets must be a non-empty array");
  if (manifest.coverageMode === "pilot") {
    expect(entries.length === EXPECTED.v3Pilot, "V3 manifest", `Expected ${EXPECTED.v3Pilot} approved pilot products; found ${entries.length}`);
  }
  if (manifest.coverageMode === "incremental") {
    expect(entries.length > EXPECTED.v3Pilot && entries.length < EXPECTED.products, "V3 manifest", `Incremental v3 coverage must be between ${EXPECTED.v3Pilot + 1} and ${EXPECTED.products - 1}; found ${entries.length}`);
  }
  if (manifest.coverageMode === "complete") {
    expect(entries.length === EXPECTED.products, "V3 manifest", `Complete v3 manifest must contain ${EXPECTED.products} products; found ${entries.length}`);
    sameSlugSet(products, Object.fromEntries(entries.filter((entry) => entry && entry.slug).map((entry) => [entry.slug, entry])), "V3 product");
  }

  const sourceSlugs = new Set(products.map((product) => product.slug));
  const allowedCategories = new Set(Object.keys((v2Manifest && v2Manifest.categories) || {}));
  const slugs = new Set();
  const claimedFiles = new Map();
  const masterHashes = new Map();

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      addError("V3 products", "V3 product entry is not an object");
      continue;
    }
    const slug = entry.slug;
    if (!expect(typeof slug === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug), "V3 products", `Invalid v3 product slug: ${String(slug)}`)) continue;
    expect(!slugs.has(slug), "V3 products", `Duplicate v3 product slug: ${slug}`);
    slugs.add(slug);
    expect(sourceSlugs.has(slug), "V3 products", `Unknown v3 product slug: ${slug}`);
    expect(allowedCategories.has(entry.category), "V3 products", `Unknown v3 category for ${slug}: ${String(entry.category)}`);
    expect(VALID_STATUSES.has(entry.status), "V3 disclosure", `V3 product ${slug} has invalid status: ${String(entry.status)}`);
    if (VALID_STATUSES.has(entry.status)) {
      expect(entry.disclosure === (entry.status !== "exact"), "V3 disclosure", `V3 product ${slug} disclosure does not match ${entry.status} status`);
    }
    expect(typeof entry.alt === "string" && entry.alt.trim().length > 0, "V3 products", `V3 product ${slug} has no alt text`);
    expect(Array.isArray(entry.requiredVisible) && entry.requiredVisible.length > 0, "V3 products", `V3 product ${slug} has no required-visible specification`);
    expect(Array.isArray(entry.forbidden), "V3 products", `V3 product ${slug} forbidden specification must be an array`);
    expect(Array.isArray(entry.references) && entry.references.length > 0, "V3 products", `V3 product ${slug} has no research references`);

    const allStrings = collectStrings(entry);
    expect(!allStrings.some((value) => /candidate-\d+\.(?:png|jpe?g|webp)$/i.test(value)), "V3 products", `V3 product ${slug} references an unapproved candidate image`);

    const validMaster = typeof entry.master === "string"
      && entry.master.endsWith(`/${slug}/master-4x3.png`)
      && /^assets\/machines\/v3\/(?:pilot\/[^/]+|full\/[^/]+\/[^/]+)\/master-4x3\.png$/.test(entry.master);
    expect(validMaster, "V3 manifest files", `V3 product ${slug} has invalid immutable master path: ${String(entry.master)}`);
    const masterAbsolute = localV3Path(entry.master, `v3.${slug}.master`, ".png");
    if (masterAbsolute) {
      const hash = crypto.createHash("sha256").update(fs.readFileSync(masterAbsolute)).digest("hex");
      if (!masterHashes.has(hash)) masterHashes.set(hash, []);
      masterHashes.get(hash).push({ slug, sharedConfiguration: entry.sharedConfiguration });
    }

    const files = entry.files && typeof entry.files === "object" ? entry.files : {};
    const expectedFiles = {
      card: `assets/machines/v3/products/${slug}/card-640.webp`,
      detail: `assets/machines/v3/products/${slug}/detail-1280.webp`,
      social: `assets/machines/v3/products/${slug}/social-1200x630.webp`,
    };
    for (const [key, expectedPath] of Object.entries(expectedFiles)) {
      const value = files[key];
      expect(value === expectedPath, "V3 manifest files", `V3 product ${slug} ${key} must be ${expectedPath}; found ${String(value)}`);
      const absolute = localV3Path(value, `v3.${slug}.files.${key}`, ".webp");
      if (!absolute) continue;
      const previous = claimedFiles.get(value);
      expect(!previous, "V3 duplicates", `V3 ${key} image is shared by ${previous || "another product"} and ${slug}: ${value}`);
      if (!previous) claimedFiles.set(value, slug);
      if (key === "card") stats.cardFiles.add(absolute);
      if (key === "detail") stats.detailFiles.add(absolute);
      if (key === "social") stats.socialFiles.add(absolute);
    }
    stats.v3Products += 1;
  }

  for (const duplicates of masterHashes.values()) {
    if (duplicates.length < 2) continue;
    const labels = new Set(duplicates.map((item) => item.sharedConfiguration).filter((value) => typeof value === "string" && value.trim()));
    const slugsForHash = duplicates.map((item) => item.slug).join(", ");
    expect(
      labels.size === 1 && duplicates.every((item) => item.sharedConfiguration === [...labels][0]),
      "V3 duplicates",
      `Identical v3 masters require one explicit sharedConfiguration for every product: ${slugsForHash}`,
    );
  }
}

function generatedHtmlFiles(products, industries) {
  const files = [path.join(ROOT, "catalog.html"), path.join(ROOT, "industries.html")];
  files.push(...products.map((product) => path.join(ROOT, "products", `${product.slug}.html`)));
  files.push(...industries.map((industry) => path.join(ROOT, "industries", `${industry.slug}.html`)));

  const actualProducts = fs.existsSync(path.join(ROOT, "products"))
    ? fs.readdirSync(path.join(ROOT, "products")).filter((name) => name.endsWith(".html"))
    : [];
  const actualIndustries = fs.existsSync(path.join(ROOT, "industries"))
    ? fs.readdirSync(path.join(ROOT, "industries")).filter((name) => name.endsWith(".html"))
    : [];
  expect(actualProducts.length === EXPECTED.products, "Generated HTML", `Expected ${EXPECTED.products} product HTML files; found ${actualProducts.length}`);
  expect(actualIndustries.length === EXPECTED.industries, "Generated HTML", `Expected ${EXPECTED.industries} industry HTML files; found ${actualIndustries.length}`);
  return files;
}

function lineForOffset(text, offset) {
  return text.slice(0, offset).split("\n").length;
}

function isExternalReference(value) {
  return /^(?:https?:)?\/\//i.test(value)
    || /^(?:data|blob|mailto|tel|javascript):/i.test(value)
    || value.startsWith("#");
}

function decodeHtmlUrl(value) {
  const decodedEntities = value.replace(/&amp;|&#38;/gi, "&").trim();
  try {
    return decodeURIComponent(decodedEntities);
  } catch (_error) {
    return decodedEntities;
  }
}

function validateHtmlImageReference(htmlFile, rawReference) {
  const value = decodeHtmlUrl(rawReference).replace(/[?#].*$/, "");
  if (!value || isExternalReference(value)) return;
  const absolute = value.startsWith("/")
    ? path.resolve(ROOT, value.slice(1))
    : path.resolve(path.dirname(htmlFile), value);
  const relative = path.relative(ROOT, absolute);
  if (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    addError("HTML image references", `${rel(htmlFile)} points outside the site root: ${rawReference}`);
    return;
  }
  stats.htmlImageRefs += 1;
  expect(fs.existsSync(absolute) && fs.statSync(absolute).isFile(), "HTML image references", `${rel(htmlFile)} references missing image: ${rawReference}`);
}

function scanHtml(products, industries) {
  const files = generatedHtmlFiles(products, industries);
  for (const file of files) {
    if (!expect(fs.existsSync(file) && fs.statSync(file).isFile(), "Generated HTML", `Missing generated file: ${rel(file)}`)) continue;
    const html = fs.readFileSync(file, "utf8");
    stats.htmlFiles += 1;

    const placeholder = /md-figure(?:--|__)ph\b/i.exec(html);
    if (placeholder) addError("Generated HTML", `${rel(file)}:${lineForOffset(html, placeholder.index)} contains an md-figure placeholder`);

    const legacy = /assets\/machines\/(?!v(?:2|3)\/)/i.exec(html);
    if (legacy) addError("Generated HTML", `${rel(file)}:${lineForOffset(html, legacy.index)} contains a legacy unversioned machine image reference`);

    const tagPattern = /<(?:img|source)\b[^>]*>/gi;
    for (const tagMatch of html.matchAll(tagPattern)) {
      const tag = tagMatch[0];
      const attributePattern = /\b(src|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
      for (const attribute of tag.matchAll(attributePattern)) {
        const name = attribute[1].toLowerCase();
        const value = attribute[2] !== undefined ? attribute[2] : attribute[3];
        if (name === "srcset") {
          for (const candidate of value.split(",")) {
            const reference = candidate.trim().split(/\s+/)[0];
            if (reference) validateHtmlImageReference(file, reference);
          }
        } else {
          validateHtmlImageReference(file, value);
        }
      }
    }
  }
}

function validateV3GeneratedHtml(manifest) {
  if (!manifest || !Array.isArray(manifest.assets)) return;
  const catalogFile = path.join(ROOT, "catalog.html");
  if (!fs.existsSync(catalogFile)) return;
  const catalog = fs.readFileSync(catalogFile, "utf8");

  for (const entry of manifest.assets) {
    if (!entry || !entry.slug || !entry.files) continue;
    const productFile = path.join(ROOT, "products", `${entry.slug}.html`);
    if (!fs.existsSync(productFile)) continue;
    const productHtml = fs.readFileSync(productFile, "utf8");
    const detailSrc = `src="../${entry.files.detail}"`;
    expect(productHtml.includes(detailSrc), "V3 generated HTML", `products/${entry.slug}.html does not use its v3 detail image`);
    expect(productHtml.includes(entry.files.social), "V3 generated HTML", `products/${entry.slug}.html does not use its v3 social image`);
    const schemaCategory = JSON.stringify(entry.category).replace(/&/g, "\\u0026");
    expect(productHtml.includes(`"category":${schemaCategory}`), "V3 generated HTML", `products/${entry.slug}.html does not use v3 category ${entry.category}`);

    const disclosureCaption = '<figcaption class="md-figure__caption"><strong>Representative configuration.</strong>';
    expect(
      productHtml.includes(disclosureCaption) === Boolean(entry.disclosure),
      "V3 generated HTML",
      `products/${entry.slug}.html representative caption does not match disclosure ${String(entry.disclosure)}`,
    );

    // Public URLs are extensionless (Cloudflare Pages serves foo.html at /foo),
    // but accept the .html form too so this check survives either URL shape.
    const href = `href="products/${entry.slug}"`;
    let hrefAt = catalog.indexOf(href);
    if (hrefAt < 0) hrefAt = catalog.indexOf(`href="products/${entry.slug}.html"`);
    expect(hrefAt >= 0, "V3 generated HTML", `catalog.html has no card for v3 product ${entry.slug}`);
    if (hrefAt < 0) continue;
    const cardStart = catalog.lastIndexOf('<a class="cat-card ', hrefAt);
    const cardEnd = catalog.indexOf("</a>", hrefAt);
    const cardHtml = cardStart >= 0 && cardEnd >= 0 ? catalog.slice(cardStart, cardEnd + 4) : "";
    expect(cardHtml.includes(entry.files.card), "V3 generated HTML", `catalog card for ${entry.slug} does not use its v3 card image`);
    expect(!/assets\/machines\/v2\//i.test(cardHtml), "V3 generated HTML", `catalog card for ${entry.slug} still contains a v2 machine image`);
  }
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function validateSizeSet(files, limit, label) {
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const bytes = fs.statSync(file).size;
    expect(bytes <= limit, "File sizes", `${label} exceeds ${formatBytes(limit)}: ${rel(file)} is ${formatBytes(bytes)}`);
  }
}

function printResults(manifest, v3Manifest) {
  const counts = manifest
    ? `${Object.keys(manifest.assets || {}).length} assets, ${Object.keys(manifest.products || {}).length} products, ${Object.keys(manifest.industries || {}).length} industries`
    : "manifest unavailable";
  console.log("ART machinery image-system validation");
  console.log(`  Manifest: ${counts}`);
  console.log(`  Approved v3 overlay: ${stats.v3Products} products (${v3Manifest ? v3Manifest.coverageMode : "not present"})`);
  console.log(`  Local manifest files checked: ${stats.manifestFiles}`);
  console.log(`  Verified catalogue features checked: ${stats.features}`);
  console.log(`  Generated HTML files checked: ${stats.htmlFiles}`);
  console.log(`  Local HTML image references checked: ${stats.htmlImageRefs}`);
  console.log(`  Size budgets checked: ${stats.cardFiles.size} cards, ${stats.detailFiles.size} detail/labelled, ${stats.socialFiles.size} v3 social, ${stats.industryFiles.size} industry`);

  if (!errors.size) {
    console.log("\nPASS: v2 fallback and approved v3 overlay manifests, generated pages, references, disclosures, source features, and file budgets are valid.");
    return;
  }

  let total = 0;
  console.error("\nFAIL:");
  for (const [group, messages] of errors) {
    total += messages.length;
    console.error(`\n${group} (${messages.length})`);
    for (const message of messages.slice(0, 25)) console.error(`  - ${message}`);
    if (messages.length > 25) console.error(`  - … ${messages.length - 25} more`);
  }
  console.error(`\nValidation failed with ${total} error${total === 1 ? "" : "s"} across ${errors.size} check group${errors.size === 1 ? "" : "s"}.`);
  process.exitCode = 1;
}

const manifest = readJson(MANIFEST_FILE, "Image manifest");
const v3Manifest = fs.existsSync(V3_MANIFEST_FILE) ? readJson(V3_MANIFEST_FILE, "V3 image manifest") : null;
const products = readJson(path.join(DATA_DIR, "products.json"), "Product catalogue");
const industries = readJson(path.join(DATA_DIR, "industries.json"), "Industry catalogue");

if (manifest && Array.isArray(products) && Array.isArray(industries)) {
  validateManifest(manifest, products, industries);
  if (v3Manifest) validateV3Manifest(v3Manifest, products, manifest);
  scanHtml(products, industries);
  if (v3Manifest) validateV3GeneratedHtml(v3Manifest);
  validateSizeSet(stats.cardFiles, LIMITS.card, "Card image");
  validateSizeSet(stats.detailFiles, LIMITS.detail, "Detail/labelled image");
  validateSizeSet(stats.socialFiles, LIMITS.social, "V3 social image");
  validateSizeSet(stats.industryFiles, LIMITS.industry, "Industry image");
}

printResults(manifest, v3Manifest);
