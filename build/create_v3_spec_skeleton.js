#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PRODUCTS = require(path.join(ROOT, "build", "data", "products.json"));
const OUT = path.join(ROOT, "assets", "machines", "v3", "full", "visual-spec.json");

const packagingTerms = /(?:form-fill|\bffs\b|vffs|hffs|seal|pouch|sachet|stick|packet|wrapper|wrapping|carton|bagging|bag-packing|sack-packing|filling|dosing|weigher|cup-filler|auger-filler|collat|count-and-stack|tea-bag|oral-pouches|doypack|pillow-pack|premade|strip|labell|coding|printer|rinsing|capping|crimping|decapper|leak|seaming|tray-packing|cup-packing|can-packing|jar|bottle|jerry|cannister|bucket-packing|drum-packing|gallon|rewinder|pneumatic$|mechanical$|servo-driven|collar-type|rotary$|d-motion|vacuum$|nitrogen-packing)/i;
const automationTerms = /(?:robot|robotic|\bagv\b|\bamr\b|guided-vehicle|mobile-robot|automation|plc-control|plc-automation|vision-inspection|auto-reject)/i;
const storageTerms = /(?:storage-tank|\bhopper\b|\bsilo\b|day-bin|bag-dump|storage-pit)/i;
const conveyingTerms = /(?:conveyor|elevator|\blift\b|trolley|vibratory-feeder|rotary-collecting-table)/i;

function normalizedCategory(product) {
  const slug = product.slug;
  const source = product.category;
  if (source === "Pollution Control" || /dust-collection-system/.test(slug)) return "Pollution Control";
  if (source === "Grinding") return "Size Reduction & Grinding";
  if (source === "Heating") return "Heating & Drying";
  if (source === "Mixing") return "Mixing & Blending";
  if (source === "Cutting" || source === "Cooling") return "Process Equipment";
  if (source === "Robotic Carton Packer") return automationTerms.test(slug) ? "Automation & Robotics" : "Packaging";
  if (source === "Others") {
    if (slug === "drone") return "Automation & Robotics";
    if (slug === "blower-fan") return "Pollution Control";
    return "Process Equipment";
  }
  if (automationTerms.test(slug)) return "Automation & Robotics";
  if (storageTerms.test(slug)) return "Storage & Elevation";
  if (conveyingTerms.test(slug)) return "Conveying & Handling";
  if (packagingTerms.test(slug)) return "Packaging";
  return "Cleaning, Sorting & Grading";
}

const rows = PRODUCTS.map((product) => ({
  slug: product.slug,
  name: product.shortName,
  sourceCategory: product.category,
  normalizedCategory: normalizedCategory(product),
  visualClass: product.slug,
  configuration: product.intro.split(/\n|(?<=[.!?])\s+/)[0].trim(),
  requiredVisible: [],
  forbidden: [],
  confidence: "medium",
  status: "reconstructed",
  disclosure: true,
  references: [],
}));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify({ version: 3, products: rows }, null, 2)}\n`);
console.log(`Wrote ${rows.length} v3 visual-spec skeleton records to ${path.relative(ROOT, OUT)}`);
