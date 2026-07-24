#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CLIENT = path.join(ROOT, "dist", "client");
const SERVER = path.join(ROOT, "dist", "server");
const SITE_ORIGIN = "https://artmechatronics.com";

function copyFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function copyTree(source, destination) {
  fs.cpSync(source, destination, { recursive: true });
}

fs.rmSync(CLIENT, { recursive: true, force: true });
fs.rmSync(SERVER, { recursive: true, force: true });
fs.mkdirSync(CLIENT, { recursive: true });
fs.mkdirSync(SERVER, { recursive: true });

for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (entry.isFile() && (entry.name.endsWith(".html") || ["sitemap.xml", "robots.txt", "_headers", "_redirects", ".htaccess"].includes(entry.name))) {
    copyFile(path.join(ROOT, entry.name), path.join(CLIENT, entry.name));
  }
}
for (const directory of ["css", "js", "products", "industries"]) {
  copyTree(path.join(ROOT, directory), path.join(CLIENT, directory));
}

const scanFiles = [];
function collectFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collectFiles(absolute);
    else if (/\.(?:html|css|js)$/i.test(entry.name)) scanFiles.push(absolute);
  }
}
collectFiles(CLIENT);

const assetReferences = new Set();
const assetPattern = /(?:(?:https?:\/\/[^/"'\s)]+)?\/?|(?:\.\.\/|\.\/)*)assets\/[^"'`\s)<]+/gi;
for (const file of scanFiles) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(assetPattern)) {
    let reference = match[0].replaceAll("&amp;", "&");
    if (/^https?:/i.test(reference)) {
      const url = new URL(reference);
      if (url.origin !== SITE_ORIGIN || !url.pathname.startsWith("/assets/")) continue;
      reference = url.pathname.slice(1);
    } else {
      reference = reference.replace(/^(?:\/|\.\.\/|\.\/)+/, "");
    }
    reference = reference.split(/[?#]/)[0];
    if (reference.startsWith("assets/")) assetReferences.add(reference);
  }
}

const missing = [];
for (const reference of [...assetReferences].sort()) {
  const source = path.join(ROOT, reference);
  if (fs.existsSync(source) && fs.statSync(source).isDirectory()) continue;
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
    missing.push(reference);
    continue;
  }
  copyFile(source, path.join(CLIENT, reference));
}
if (missing.length) {
  console.error(`Missing ${missing.length} referenced assets:\n${missing.join("\n")}`);
  process.exit(1);
}

copyFile(path.join(ROOT, ".openai", "sites-worker.js"), path.join(SERVER, "index.js"));

let bytes = 0;
let files = 0;
function measure(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) measure(absolute);
    else {
      files += 1;
      bytes += fs.statSync(absolute).size;
    }
  }
}
measure(path.join(ROOT, "dist"));

console.log(`Packaged ${files} runtime files with ${assetReferences.size} referenced assets.`);
console.log(`Uncompressed build size: ${(bytes / 1024 / 1024).toFixed(1)} MB`);
