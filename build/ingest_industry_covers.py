#!/usr/bin/env python3
"""Ingest generated industry cover photos into the site.

Takes a folder of cover-<slug>.png files, checks each one, converts to WebP at
800x600 and writes it to assets/industries/<slug>/cover-800.webp — the exact path
build/generate.js looks for. Anything that fails a check is reported and skipped,
never silently shipped.

  python3 build/ingest_industry_covers.py <folder> [<folder2> ...]
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GROUPS = os.path.join(ROOT, "build", "data", "industry-groups.json")
OUT_DIR = os.path.join(ROOT, "assets", "industries")

valid_slugs = {g["slug"] for g in json.load(open(GROUPS))["groups"]}

# Collect candidates. Later folders win, and an explicit -vN suffix beats the
# plain name, so a revised render supersedes the original.
found = {}
for folder in sys.argv[1:]:
    if not os.path.isdir(folder):
        print(f"  ! not a folder, skipped: {folder}")
        continue
    for name in sorted(os.listdir(folder)):
        m = re.fullmatch(r"cover-([a-z0-9-]+?)(?:-v(\d+))?\.png", name)
        if not m:
            continue
        slug, ver = m.group(1), int(m.group(2) or 0)
        prev = found.get(slug)
        if prev is None or ver >= prev[0]:
            found[slug] = (ver, os.path.join(folder, name))

from PIL import Image  # sips on this Mac can READ webp but not write it
import numpy as np


def tune_for_tile(im):
    """Lift the subject so it still reads at 171px tile size.

    The covers were briefed and judged full-screen, where a dark editorial
    still-life looks superb. Shrunk into a grid tile the subject fell to a
    median 66/255 and the tiles read as flat blue rectangles. This lifts the
    midtones, then fades the lift out over the bottom 30% so the label strip
    stays dark and the white name on top keeps its contrast.
    """
    a = np.asarray(im).astype(np.float32) / 255.0
    lifted = np.power(a, 0.62)                              # gamma < 1 brightens
    lifted = np.clip((lifted - 0.5) * 1.08 + 0.5, 0, 1)     # gentle contrast
    h = a.shape[0]
    ramp = np.ones(h, dtype=np.float32)
    start = int(h * 0.68)
    ramp[start:] = np.linspace(1.0, 0.0, h - start)         # protect label zone
    m = ramp[:, None, None]
    out = a * (1 - m) + lifted * m
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))

def dims(path):
    with Image.open(path) as im:
        return im.size

ok, skipped, unknown = [], [], []
for slug, (ver, src) in sorted(found.items()):
    if slug not in valid_slugs:
        unknown.append(slug)
        continue
    try:
        w, h = dims(src)
    except Exception:
        skipped.append((slug, "unreadable"))
        continue
    if abs(w / h - 4 / 3) > 0.02:
        skipped.append((slug, f"not 4:3 ({w}x{h})"))
        continue

    dest_dir = os.path.join(OUT_DIR, slug)
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, "cover-800.webp")
    with Image.open(src) as im:
        tuned = tune_for_tile(im.convert("RGB").resize((800, 600), Image.LANCZOS))
        tuned.save(dest, "WEBP", quality=82, method=6)
    size_kb = os.path.getsize(dest) / 1024
    if size_kb > 200:
        skipped.append((slug, f"webp too heavy ({size_kb:.0f} KB)"))
        continue
    ok.append((slug, size_kb, ver))

print(f"\ningested : {len(ok)} of {len(valid_slugs)} tiles")
if ok:
    total = sum(k for _, k, _ in ok)
    print(f"           avg {total/len(ok):.0f} KB, {total/1024:.1f} MB total")
    revised = [s for s, _, v in ok if v]
    if revised:
        print(f"           used revised renders for: {', '.join(revised)}")
missing = sorted(valid_slugs - {s for s, _, _ in ok})
if missing:
    print(f"missing  : {len(missing)} -> {', '.join(missing)}")
if skipped:
    print(f"skipped  : {len(skipped)}")
    for s, why in skipped:
        print(f"           {s}: {why}")
if unknown:
    print(f"unknown slugs (not a tile): {', '.join(unknown)}")
