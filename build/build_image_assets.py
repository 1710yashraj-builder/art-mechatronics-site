#!/usr/bin/env python3
"""Build ART Mechatronics' branded catalogue image system.

The AI image editor produces one approved, directly branded clean-source.png
per master. This script is the deterministic layer: it normalises composition,
derives crops, renders product labels from verified catalogue copy, builds
industry montages, and writes the public manifest.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import sys
from collections import Counter, OrderedDict
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
V2 = ROOT / "assets" / "machines" / "v2"
MASTERS = V2 / "masters"
PRODUCT_OUT = V2 / "products"
INDUSTRY_OUT = V2 / "industries"
V3 = ROOT / "assets" / "machines" / "v3"
V3_PILOT = V3 / "pilot"
V3_PRODUCT_OUT = V3 / "products"
V3_MANIFEST = V3_PILOT / "manifest.json"
DATA = ROOT / "build" / "data"
MANIFEST = V2 / "manifest.json"

FONT_DISPLAY = Path("/System/Library/Fonts/Supplemental/DIN Alternate Bold.ttf")
FONT_BODY = Path("/System/Library/Fonts/Avenir Next.ttc")


CATEGORIES = OrderedDict(
    [
        ("Automation & Robotics", {"slug": "automation-robotics", "from": "#312E81", "to": "#2563EB", "pool": 3}),
        ("Cleaning, Sorting & Grading", {"slug": "cleaning-sorting-grading", "from": "#065F46", "to": "#10B981", "pool": 4}),
        ("Conveying & Handling", {"slug": "conveying-handling", "from": "#063B4A", "to": "#0E7490", "pool": 4}),
        ("Heating & Drying", {"slug": "heating-drying", "from": "#7C2D12", "to": "#D97706", "pool": 4}),
        ("Mixing & Blending", {"slug": "mixing-blending", "from": "#4C1D95", "to": "#7C3AED", "pool": 4}),
        ("Packaging", {"slug": "packaging", "from": "#082F6B", "to": "#1657B0", "pool": 8}),
        ("Pollution Control", {"slug": "pollution-control", "from": "#111827", "to": "#475569", "pool": 3}),
        ("Process Equipment", {"slug": "process-equipment", "from": "#0B2A4A", "to": "#1D4ED8", "pool": 6}),
        ("Size Reduction & Grinding", {"slug": "size-reduction-grinding", "from": "#5C2A1D", "to": "#C2410C", "pool": 2}),
        ("Storage & Elevation", {"slug": "storage-elevation", "from": "#082B4A", "to": "#0B7189", "pool": 2}),
    ]
)


def spec(category: str, status: str, description: str, *, source: str = "generated", anchors=((0.50, 0.45),)):
    return {
        "category": category,
        "status": status,
        "description": description,
        "source": source,
        "anchors": [list(a) for a in anchors],
    }


MASTER_SPECS = OrderedDict(
    [
        (
            "storage-silos",
            spec(
                "Storage & Elevation",
                "reconstructed",
                "Three-vessel storage silos system",
                source="supplied:9ceb9549-3f0b-4075-ac02-eb253712a3f2.jpeg",
                anchors=((0.22, 0.31), (0.49, 0.31), (0.75, 0.31)),
            ),
        ),
        (
            "buffer-tank",
            spec(
                "Storage & Elevation",
                "reconstructed",
                "Buffer tank with load-cell weighing",
                source="supplied:b635997a-a8b0-4fe1-8613-3dd140b2f067.jpeg",
                anchors=((0.54, 0.31),),
            ),
        ),
        (
            "ribbon-mixer",
            spec(
                "Mixing & Blending",
                "reconstructed",
                "Horizontal ribbon mixer",
                source="supplied:fc12f9c8-878d-4ff6-be45-83e5c9a474a2.jpeg",
                anchors=((0.50, 0.43),),
            ),
        ),
        (
            "ribbon-mixer-drive",
            spec(
                "Mixing & Blending",
                "reconstructed",
                "Ribbon mixer drive-side gallery angle",
                source="supplied:6e09bfec-4602-4c11-8e43-e0a884bd9f35.jpeg",
                anchors=((0.45, 0.48),),
            ),
        ),
        (
            "vibro-sifter",
            spec(
                "Cleaning, Sorting & Grading",
                "reconstructed",
                "Circular vibro sifter",
                source="supplied:74acb52c-7f1f-4384-88a9-73c704b8634c.jpeg",
                anchors=((0.50, 0.48),),
            ),
        ),
        (
            "dust-collector",
            spec(
                "Pollution Control",
                "reconstructed",
                "Industrial dust collector",
                source="supplied:43713b25-059e-4678-8239-300dfd0aa1a3.jpeg",
                anchors=((0.49, 0.42),),
            ),
        ),
        (
            "control-panel",
            spec(
                "Automation & Robotics",
                "reconstructed",
                "PLC automation control panel",
                source="supplied:b84b6998-d3b8-4656-84ef-d0656b8c625b.jpeg",
                anchors=((0.50, 0.68),),
            ),
        ),
        (
            "collection-trolley",
            spec(
                "Storage & Elevation",
                "reconstructed",
                "Stainless collection trolley",
                source="supplied:7d91fa20-d847-497c-a752-03599cd19470.jpeg",
                anchors=((0.50, 0.52),),
            ),
        ),
        (
            "platform-ladder",
            spec(
                "Storage & Elevation",
                "reconstructed",
                "Industrial access platform and ladder",
                source="supplied:410b79d7-bcb1-4059-b831-27464f5196d9.jpeg",
                anchors=((0.50, 0.65),),
            ),
        ),
        (
            "system",
            spec(
                "Process Equipment",
                "reconstructed",
                "Integrated processing and automation system",
                source="supplied:507a6971-705b-4b29-8bc5-33dd122ccbd9.jpeg",
                anchors=((0.50, 0.50),),
            ),
        ),
        ("automation-controls-inspection", spec("Automation & Robotics", "representative", "Controls, weighing and inspection station", anchors=((0.52, 0.65),))),
        ("automation-mobile-robotics", spec("Automation & Robotics", "representative", "AGV and autonomous mobile material transport", anchors=((0.50, 0.61),))),
        ("automation-robotic-handling", spec("Automation & Robotics", "representative", "Robotic handling and packing cell", anchors=((0.50, 0.67),))),
        ("cleaning-air-aspiration", spec("Cleaning, Sorting & Grading", "representative", "Air aspiration and pre-cleaning equipment")),
        ("cleaning-sorting-grading", spec("Cleaning, Sorting & Grading", "representative", "Sorting and grading line")),
        ("cleaning-separation-destoning", spec("Cleaning, Sorting & Grading", "representative", "Gravity separation and de-stoning equipment")),
        ("cleaning-washing-peeling", spec("Cleaning, Sorting & Grading", "representative", "Washing and peeling line")),
        ("conveying-belt-roller", spec("Conveying & Handling", "representative", "Belt, slat and roller conveying equipment", anchors=((0.50, 0.64),))),
        ("conveying-screw-auger", spec("Conveying & Handling", "representative", "Screw and auger conveyor", anchors=((0.50, 0.59),))),
        ("conveying-pneumatic-vacuum", spec("Conveying & Handling", "representative", "Pneumatic and vacuum transfer equipment")),
        ("conveying-elevator-lift", spec("Conveying & Handling", "representative", "Bucket elevator and vertical lift", anchors=((0.50, 0.60),))),
        ("heating-industrial-dryer", spec("Heating & Drying", "representative", "Industrial drying equipment")),
        ("heating-oven-roaster", spec("Heating & Drying", "representative", "Industrial oven and roaster", anchors=((0.50, 0.58),))),
        ("heating-thermal-generator", spec("Heating & Drying", "representative", "Hot-air and steam generation equipment")),
        ("heating-cooling-freezing", spec("Heating & Drying", "representative", "Cooling and freezing tunnel", anchors=((0.50, 0.58),))),
        ("mixing-ribbon-paddle", spec("Mixing & Blending", "representative", "Ribbon and paddle mixing equipment")),
        ("mixing-high-shear-granulation", spec("Mixing & Blending", "representative", "High-shear mixer and granulator")),
        ("mixing-planetary-spiral", spec("Mixing & Blending", "representative", "Planetary and spiral mixing equipment")),
        ("mixing-tank-agitator", spec("Mixing & Blending", "representative", "Agitated and jacketed mixing tank")),
        ("packaging-vffs-ffs", spec("Packaging", "representative", "Vertical form-fill-seal packaging machine")),
        ("packaging-premade-pouch", spec("Packaging", "representative", "Premade pouch filling and sealing machine")),
        ("packaging-filling-dosing", spec("Packaging", "representative", "Filling, dosing and weighing machine")),
        ("packaging-sealing-shrink-wrap", spec("Packaging", "representative", "Sealing, wrapping and shrink tunnel line", anchors=((0.50, 0.60),))),
        ("packaging-bottle-jar-can", spec("Packaging", "representative", "Bottle, jar and can packaging line", anchors=((0.50, 0.58),))),
        ("packaging-cartoning-case", spec("Packaging", "representative", "Cartoning and case packing line", anchors=((0.50, 0.58),))),
        ("packaging-weighing-inspection", spec("Packaging", "representative", "Weighing and inspection station", anchors=((0.50, 0.60),))),
        ("packaging-robotic-palletising", spec("Packaging", "representative", "Robotic packing and palletising cell", anchors=((0.50, 0.67),))),
        ("pollution-dry-dust", spec("Pollution Control", "representative", "Dry dust collection equipment")),
        ("pollution-wet-scrubber-fume", spec("Pollution Control", "representative", "Wet scrubbing and fume extraction equipment")),
        ("pollution-central-extraction", spec("Pollution Control", "representative", "Centralised dust extraction system")),
        ("process-cutting-slicing", spec("Process Equipment", "representative", "Cutting and slicing equipment")),
        ("process-cooking-blanching", spec("Process Equipment", "representative", "Cooking and blanching line", anchors=((0.50, 0.58),))),
        ("process-liquid-homogenising", spec("Process Equipment", "representative", "Liquid processing and homogenising skid")),
        ("process-extrusion-forming", spec("Process Equipment", "representative", "Extrusion and forming equipment", anchors=((0.50, 0.58),))),
        ("process-refrigeration-hvac", spec("Process Equipment", "representative", "Refrigeration and air-handling equipment")),
        ("process-general-plant", spec("Process Equipment", "representative", "General processing plant equipment")),
        ("grinding-mill-pulverizer", spec("Size Reduction & Grinding", "representative", "Milling and pulverising system")),
        ("grinding-crusher-shredder", spec("Size Reduction & Grinding", "representative", "Crushing and shredding equipment")),
    ]
)


CATEGORY_ASSETS = {
    "Automation & Robotics": ["automation-controls-inspection", "automation-mobile-robotics", "automation-robotic-handling"],
    "Cleaning, Sorting & Grading": ["cleaning-air-aspiration", "cleaning-sorting-grading", "cleaning-separation-destoning", "cleaning-washing-peeling"],
    "Conveying & Handling": ["conveying-belt-roller", "conveying-screw-auger", "conveying-pneumatic-vacuum", "conveying-elevator-lift"],
    "Heating & Drying": ["heating-industrial-dryer", "heating-oven-roaster", "heating-thermal-generator", "heating-cooling-freezing"],
    "Mixing & Blending": ["mixing-ribbon-paddle", "mixing-high-shear-granulation", "mixing-planetary-spiral", "mixing-tank-agitator"],
    "Packaging": ["packaging-vffs-ffs", "packaging-premade-pouch", "packaging-filling-dosing", "packaging-sealing-shrink-wrap", "packaging-bottle-jar-can", "packaging-cartoning-case", "packaging-weighing-inspection", "packaging-robotic-palletising"],
    "Pollution Control": ["pollution-dry-dust", "pollution-wet-scrubber-fume", "pollution-central-extraction"],
    "Process Equipment": ["process-cutting-slicing", "process-cooking-blanching", "process-liquid-homogenising", "process-extrusion-forming", "process-refrigeration-hvac", "process-general-plant"],
    "Size Reduction & Grinding": ["grinding-mill-pulverizer", "grinding-crusher-shredder"],
    "Storage & Elevation": ["storage-silos", "buffer-tank"],
}


CLUSTER_RULES = {
    "Automation & Robotics": [
        (r"agv|amr|guided vehicle|mobile robot|drone", "automation-mobile-robotics"),
        (r"robot|pallet|pick.and.place|case pack", "automation-robotic-handling"),
        (r"plc|control|inspection|vision|checkweigh|metal detect|x.ray|reject", "automation-controls-inspection"),
    ],
    "Cleaning, Sorting & Grading": [
        (r"wash|peel|skin removal|dehusk|shell removal", "cleaning-washing-peeling"),
        (r"deston|de.ston|gravity|magnetic|separat", "cleaning-separation-destoning"),
        (r"aspirat|pre.clean|cleaner|scour|winnow", "cleaning-air-aspiration"),
        (r"sort|grad|screen|siev|sift|color", "cleaning-sorting-grading"),
    ],
    "Conveying & Handling": [
        (r"bucket|z.type|vertical conveyor|lift", "conveying-elevator-lift"),
        (r"screw|auger", "conveying-screw-auger"),
        (r"pneumatic|vacuum|pipe conveyor", "conveying-pneumatic-vacuum"),
        (r"belt|roller|slat|chain|telescopic|conveyor", "conveying-belt-roller"),
    ],
    "Heating & Drying": [
        (r"cool|freez|chill|cold", "heating-cooling-freezing"),
        (r"boiler|steam|heater|hot.air|thermic|furnace|generator", "heating-thermal-generator"),
        (r"oven|roast|fry|cook|blanch", "heating-oven-roaster"),
        (r"dry|dehumid", "heating-industrial-dryer"),
    ],
    "Mixing & Blending": [
        (r"high.shear|granulat|rmg", "mixing-high-shear-granulation"),
        (r"planetary|spiral|handa|sigma", "mixing-planetary-spiral"),
        (r"tank|agitator|stirrer|homogen", "mixing-tank-agitator"),
        (r"ribbon|paddle|plough|plow|drum|mixer|blend", "mixing-ribbon-paddle"),
    ],
    "Packaging": [
        (r"robot|pallet", "packaging-robotic-palletising"),
        (r"inspect|weigh|detect|reject|x.ray", "packaging-weighing-inspection"),
        (r"carton|case|collat", "packaging-cartoning-case"),
        (r"bottle|jar|can|gallon|jerry", "packaging-bottle-jar-can"),
        (r"seal|shrink|wrap|overwrap", "packaging-sealing-shrink-wrap"),
        (r"premade|doypack|standup|zip|pouch", "packaging-premade-pouch"),
        (r"fill|dose|auger|cup|weigher", "packaging-filling-dosing"),
        (r"vffs|ffs|form.fill|vertical|horizontal|flow.wrap|sachet|packet", "packaging-vffs-ffs"),
    ],
    "Pollution Control": [
        (r"wet|scrubber|fume", "pollution-wet-scrubber-fume"),
        (r"central|extraction", "pollution-central-extraction"),
        (r"dust|bag|pulse|cyclone|filter", "pollution-dry-dust"),
    ],
    "Process Equipment": [
        (r"refriger|hvac|air.handling|cooling tower|chiller", "process-refrigeration-hvac"),
        (r"extrud|form|press", "process-extrusion-forming"),
        (r"homogen|liquid|syrup|paste|pump|heat exchanger", "process-liquid-homogenising"),
        (r"cook|blanch|pasteur|kettle|boil", "process-cooking-blanching"),
        (r"cut|slice|dice|chop|knife|blade", "process-cutting-slicing"),
        (r".*", "process-general-plant"),
    ],
    "Size Reduction & Grinding": [
        (r"crush|shred|chipper|cutter", "grinding-crusher-shredder"),
        (r"mill|pulver|grind|micron|disintegr|powder", "grinding-mill-pulverizer"),
    ],
    "Storage & Elevation": [
        (r"silo|storage pit|day bin|hopper", "storage-silos"),
        (r"tank|bag dump|storage|lift|stack", "buffer-tank"),
    ],
}


EXACT_PRODUCT_ASSETS = {
    "silo": "storage-silos",
    "ribbon-mixer": "ribbon-mixer",
    "vibro": "vibro-sifter",
    "dust-collector-machine": "dust-collector",
    "plc-automation-control-panel": "control-panel",
    "trolley": "collection-trolley",
    "centralised-automation-system": "system",
}


def rgb(value: str):
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def font(path: Path, size: int, index: int = 0):
    try:
        return ImageFont.truetype(str(path), size=size, index=index)
    except OSError:
        return ImageFont.load_default(size=size)


def gradient(size, start: str, end: str, *, horizontal=False):
    w, h = size
    a, b = rgb(start), rgb(end)
    canvas = Image.new("RGB", size)
    draw = ImageDraw.Draw(canvas)
    span = w if horizontal else h
    for i in range(span):
        t = i / max(1, span - 1)
        c = tuple(round(a[j] * (1 - t) + b[j] * t) for j in range(3))
        if horizontal:
            draw.line((i, 0, i, h), fill=c)
        else:
            draw.line((0, i, w, i), fill=c)
    return canvas


def cover(img: Image.Image, size, centering=(0.5, 0.5)):
    return ImageOps.fit(img.convert("RGB"), size, Image.Resampling.LANCZOS, centering=centering)


def contain_on_category(img: Image.Image, size, category: str):
    token = CATEGORIES[category]
    canvas = gradient(size, token["from"], token["to"], horizontal=True)
    contained = ImageOps.contain(img.convert("RGB"), size, Image.Resampling.LANCZOS)
    x = (size[0] - contained.width) // 2
    y = (size[1] - contained.height) // 2
    canvas.paste(contained, (x, y))
    return canvas


def save_webp(image: Image.Image, path: Path, quality=84):
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "WEBP", quality=quality, method=6)


def save_webp_budget(image: Image.Image, path: Path, *, quality: int, max_bytes: int):
    """Write a deterministic WebP while enforcing the public file-size budget."""
    for candidate_quality in range(quality, 59, -3):
        save_webp(image, path, candidate_quality)
        if path.stat().st_size <= max_bytes:
            return candidate_quality
    raise ValueError(
        f"Could not fit {rel(path)} below {max_bytes / 1024:.0f} KB without excessive compression"
    )


def build_master(asset_id: str, meta: dict):
    source = MASTERS / asset_id / "clean-source.png"
    if not source.exists():
        return None
    raw = Image.open(source).convert("RGB")
    master = cover(raw, (2048, 1536))
    # Branding is part of the approved clean source itself.  Do not composite a
    # generic plaque here: every clean-source image carries the approved direct
    # A.R.T. decal treatment taken from the original machinery reference.
    branded = master
    folder = MASTERS / asset_id
    save_webp(branded, folder / "clean-4x3.webp", 90)
    save_webp(branded.resize((1280, 960), Image.Resampling.LANCZOS), folder / "detail-1280.webp", 84)
    save_webp(branded.resize((640, 480), Image.Resampling.LANCZOS), folder / "card-640.webp", 78)
    square = contain_on_category(branded, (960, 960), meta["category"])
    save_webp(square, folder / "square-960.webp", 82)
    wide = contain_on_category(branded, (1600, 900), meta["category"])
    save_webp(wide, folder / "wide-1600.webp", 84)
    social = contain_on_category(branded, (1200, 630), meta["category"])
    save_webp(social, folder / "social-1200x630.webp", 84)
    return {
        "source": rel(source),
        "master": rel(folder / "clean-4x3.webp"),
        "detail": rel(folder / "detail-1280.webp"),
        "card": rel(folder / "card-640.webp"),
        "square": rel(folder / "square-960.webp"),
        "wide": rel(folder / "wide-1600.webp"),
        "social": rel(folder / "social-1200x630.webp"),
    }


def derive_category(product):
    s = f"{product.get('shortName', '')} {product.get('h1', '')}".lower()
    def has(*words):
        return any(re.search(r"\b" + re.escape(word), s) for word in words)
    if has("dust", "scrubber", "fume", "pollution", "de-dust", "bag house", "bag filter", "pulse jet", "cyclone dust", "cyclone separ", "air pollution", "wet scrub"):
        return "Pollution Control"
    if has("pulveriz", "mill", "grind", "crush", "shred", "micron", "disintegrat", "powderiz", "expeller"):
        return "Size Reduction & Grinding"
    if has("dry", "roast", "oven", "boiler", "heater", "furnace", "thermic", "steam", "pasteuriz", "steriliz", "retort", "fryer", "blanch", "incinerat", "cook", "heat exchang", "heat recov"):
        return "Heating & Drying"
    if has("mixer", "blend", "agitat", "homogeniz", "granulat", "stirrer", "knead", "shaker"):
        return "Mixing & Blending"
    if has("sifter", "siev", "separat", "grader", "sorter", "cleaner", "destoner", "de-stoner", "scourer", "washer", "peeler", "polisher", "screen", "classifier", "aspirat", "winnow", "metal detect", "x-ray", "color sort"):
        return "Cleaning, Sorting & Grading"
    if has("conveyor", "convey", "elevator", "feeder", "trolley", "collecting table"):
        return "Conveying & Handling"
    if has("silo", "hopper", "storage", "bag dump", "goods lift", "scissor", "stacker", "day bin"):
        return "Storage & Elevation"
    if has("robot", "agv", "amr", "plc", "automation", "control panel", "palletiz", "pick & place"):
        return "Automation & Robotics"
    if has("pack", "seal", "wrap", "filler", "weigher", "pouch", "carton", "sachet", "collator", "flow wrap", "shrink", "label", "nitrogen"):
        return "Packaging"
    return "Process Equipment"


def display_name(product):
    raw = product.get("shortName") or product.get("h1") or product["slug"].replace("-", " ").title()
    base = re.split(r"\s[–-]\s|\s*\(", raw, maxsplit=1)[0].strip()
    if len(base.split()) < 2 and product.get("h1"):
        richer = re.split(r"\s[–-]\s|\s*\(", product["h1"], maxsplit=1)[0].strip()
        if 2 <= len(richer.split()) <= 6:
            base = richer
    return base or raw


def asset_for_product(product):
    slug = product["slug"]
    if slug in EXACT_PRODUCT_ASSETS:
        return EXACT_PRODUCT_ASSETS[slug]
    category = derive_category(product)
    hay = f"{slug} {product.get('shortName', '')} {product.get('h1', '')}".lower()
    for pattern, asset_id in CLUSTER_RULES[category]:
        if re.search(pattern, hay):
            return asset_id
    choices = CATEGORY_ASSETS[category]
    idx = int(hashlib.sha1(slug.encode()).hexdigest()[:8], 16) % len(choices)
    return choices[idx]


def clean_feature(value):
    value = re.sub(r"^[\s✔✓•\-–—\d.)]+", "", value or "")
    value = re.sub(r"\s+", " ", value).strip(" .;:")
    if not 4 <= len(value) <= 82:
        return ""
    if re.search(r"call to action|request a quote|talk to|why choose|link to|seo|keyword", value, re.I):
        return ""
    return value


def verified_features(product):
    values = []
    sections = product.get("sections") or []
    preferred = [s for s in sections if re.search(r"FEATURE|ADVANTAGE|TECHNICAL HIGHLIGHT", s.get("key", ""), re.I)]
    for section in preferred:
        for block in section.get("blocks") or []:
            if block.get("type") == "list":
                values.extend(block.get("items") or [])
            elif block.get("type") == "para":
                values.extend(re.split(r"[\u2028\n]|✔|✓|•", block.get("text", "")))
    if not values:
        values.extend(re.split(r"[\u2028\n]|✔|✓|•", product.get("intro", "")))
    out = []
    seen = set()
    for raw in values:
        item = clean_feature(raw)
        key = item.lower()
        if item and key not in seen:
            seen.add(key)
            out.append(item)
        if len(out) == 3:
            break
    return out


def text_wrap(draw, value, face, max_width, max_lines=2):
    words = value.split()
    lines, current = [], ""
    for word in words:
        trial = f"{current} {word}".strip()
        if draw.textbbox((0, 0), trial, font=face)[2] <= max_width or not current:
            current = trial
        else:
            lines.append(current)
            current = word
        if len(lines) == max_lines:
            break
    if current and len(lines) < max_lines:
        lines.append(current)
    if len(lines) == max_lines and len(" ".join(lines).split()) < len(words):
        while lines[-1] and draw.textbbox((0, 0), lines[-1] + "…", font=face)[2] > max_width:
            lines[-1] = lines[-1][:-1]
        lines[-1] = lines[-1].rstrip() + "…"
    return lines


def render_labelled(product, asset_id, features):
    src = MASTERS / asset_id / "detail-1280.webp"
    if not src.exists():
        return None
    image = Image.open(src).convert("RGBA")
    w, h = image.size
    band_h = 286
    overlay = Image.new("RGBA", (w, band_h), (7, 24, 48, 242))
    od = ImageDraw.Draw(overlay)
    token = CATEGORIES[derive_category(product)]
    for x in range(w):
        t = x / max(1, w - 1)
        a, b = rgb(token["from"]), rgb(token["to"])
        c = tuple(round(a[i] * (1 - t) + b[i] * t) for i in range(3))
        od.line((x, 0, x, 8), fill=(*c, 255))
    image.alpha_composite(overlay, (0, h - band_h))
    d = ImageDraw.Draw(image)
    eyebrow = font(FONT_BODY, 22, index=5)
    title_face = font(FONT_DISPLAY, 48)
    feature_face = font(FONT_BODY, 24, index=5)
    disclosure_face = font(FONT_BODY, 19, index=5)
    x0, y0 = 48, h - band_h + 28
    category = derive_category(product)
    d.text((x0, y0), category.upper(), font=eyebrow, fill="#8FC0FF")
    title = display_name(product)
    title_lines = text_wrap(d, title, title_face, 660, 2)
    ty = y0 + 34
    for line in title_lines:
        d.text((x0, ty), line, font=title_face, fill="white")
        ty += 50
    fx = 770
    fy = y0 + 8
    for item in features:
        d.ellipse((fx, fy + 9, fx + 12, fy + 21), fill="#69A9EF")
        lines = text_wrap(d, item, feature_face, 430, 2)
        for line in lines:
            d.text((fx + 24, fy), line, font=feature_face, fill="#E6EEF8")
            fy += 28
        fy += 18
    if MASTER_SPECS[asset_id]["status"] != "exact":
        label = "REPRESENTATIVE CONFIGURATION"
        box = d.textbbox((0, 0), label, font=disclosure_face)
        bw = box[2] - box[0] + 30
        bh = 38
        bx, by = w - bw - 32, h - 48
        d.rounded_rectangle((bx, by, bx + bw, by + bh), radius=8, fill="#EAF2FD", outline="#8FC0FF", width=2)
        d.text((bx + 15, by + 8), label, font=disclosure_face, fill="#0B2C5E")
    out = PRODUCT_OUT / product["slug"] / "labelled-4x3.webp"
    save_webp(image.convert("RGB"), out, 85)
    return rel(out)


STOP = {"machine", "system", "unit", "type", "the", "and", "for", "with", "of", "industrial", "process", "plant", "equipment", "line"}


def signature(value):
    return {w for w in re.sub(r"[^a-z0-9 ]", " ", value.lower()).split() if len(w) > 2 and w not in STOP}


def match_product(machine_name, products):
    want = signature(machine_name)
    if not want:
        return None
    best, score = None, 0
    for product in products:
        hay = signature(f"{product.get('shortName', '')} {product.get('h1', '')}")
        common = len(want & hay)
        candidate = common / len(want)
        if common and candidate > score:
            best, score = product, candidate
    return best if score >= 0.5 else None


def rounded_card(source: Image.Image, size, radius=28):
    card = cover(source, size)
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.paste(card.convert("RGBA"), (0, 0), mask)
    return out


def industry_assets(industry, products):
    ids = []
    categories = []
    for machine in industry.get("machines") or []:
        product = match_product(machine, products)
        if product:
            aid = asset_for_product(product)
            category = derive_category(product)
        else:
            synthetic = {"slug": machine.lower().replace(" ", "-"), "shortName": machine, "h1": machine}
            category = derive_category(synthetic)
            aid = CATEGORY_ASSETS[category][0]
        if aid not in ids:
            ids.append(aid)
            categories.append(category)
        if len(ids) == 3:
            break
    if not ids:
        ids = ["process-general-plant", "conveying-belt-roller", "automation-controls-inspection"]
        categories = ["Process Equipment", "Conveying & Handling", "Automation & Robotics"]
    while len(ids) < 3:
        ids.append(ids[-1])
        categories.append(categories[-1])
    dominant = Counter(categories).most_common(1)[0][0]
    return ids, dominant


def render_industry(industry, asset_ids, category):
    token = CATEGORIES[category]
    canvas = gradient((1600, 900), token["from"], token["to"], horizontal=True).convert("RGBA")
    bg = canvas.copy().filter(ImageFilter.GaussianBlur(18))
    canvas = Image.blend(canvas, bg, 0.18)
    positions = [(70, 200), (500, 125), (930, 200)]
    for i, aid in enumerate(asset_ids[:3]):
        path = MASTERS / aid / "card-640.webp"
        if not path.exists():
            return None
        card = rounded_card(Image.open(path).convert("RGB"), (600, 450))
        shadow = Image.new("RGBA", card.size, (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle((12, 12, card.width - 4, card.height - 4), radius=30, fill=(0, 0, 0, 110))
        shadow = shadow.filter(ImageFilter.GaussianBlur(18))
        x, y = positions[i]
        canvas.alpha_composite(shadow, (x + 12, y + 18))
        canvas.alpha_composite(card, (x, y))
    d = ImageDraw.Draw(canvas)
    title_face = font(FONT_DISPLAY, 54)
    eyebrow = font(FONT_BODY, 22, index=5)
    label_face = font(FONT_BODY, 20, index=5)
    d.text((64, 44), "REPRESENTATIVE PROCESS EQUIPMENT", font=eyebrow, fill="#9CC9FF")
    title = industry.get("shortName") or industry.get("h1") or industry["slug"].replace("-", " ").title()
    title_lines = text_wrap(d, title, title_face, 1040, 2)
    ty = 76
    for line in title_lines:
        d.text((64, ty), line, font=title_face, fill="white")
        ty += 56
    label = "REPRESENTATIVE CONFIGURATION"
    box = d.textbbox((0, 0), label, font=label_face)
    bw = box[2] - box[0] + 34
    bx, by = 1600 - bw - 42, 900 - 62
    d.rounded_rectangle((bx, by, bx + bw, by + 40), radius=9, fill="#EAF2FD", outline="#8FC0FF", width=2)
    d.text((bx + 17, by + 8), label, font=label_face, fill="#0B2C5E")
    out = INDUSTRY_OUT / industry["slug"] / "hero-16x9.webp"
    save_webp(canvas.convert("RGB"), out, 84)
    return rel(out)


def build_v3_products():
    """Derive approved v3 product media without rebuilding or mutating v2."""
    if not V3_MANIFEST.exists():
        print(f"Missing v3 pilot manifest: {rel(V3_MANIFEST)}")
        return 4

    manifest = json.loads(V3_MANIFEST.read_text())
    approval = str(manifest.get("approvalStatus", ""))
    if not re.fullmatch(r"approved(?:-\d{4}-\d{2}-\d{2})?", approval):
        print(f"Refusing v3 build: approvalStatus is {approval!r}")
        return 4
    if manifest.get("coverageMode") not in {"pilot", "incremental", "complete"}:
        print(f"Refusing v3 build: invalid coverageMode {manifest.get('coverageMode')!r}")
        return 4

    entries = manifest.get("assets")
    if not isinstance(entries, list) or not entries:
        print("Refusing v3 build: manifest assets must be a non-empty array")
        return 4

    seen = set()
    built = []
    valid_statuses = {"exact", "representative", "reconstructed"}
    expected_names = {
        "card": "card-640.webp",
        "detail": "detail-1280.webp",
        "social": "social-1200x630.webp",
    }

    try:
        for entry in entries:
            slug = entry.get("slug", "")
            if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
                raise ValueError(f"Invalid v3 product slug: {slug!r}")
            if slug in seen:
                raise ValueError(f"Duplicate v3 product slug: {slug}")
            seen.add(slug)

            category = entry.get("category")
            if category not in CATEGORIES:
                raise ValueError(f"Unknown v3 category for {slug}: {category!r}")
            status = entry.get("status")
            if status not in valid_statuses:
                raise ValueError(f"Invalid v3 status for {slug}: {status!r}")
            if entry.get("disclosure") is not (status != "exact"):
                raise ValueError(f"V3 disclosure does not match status for {slug}")
            if not str(entry.get("alt", "")).strip():
                raise ValueError(f"Missing v3 alt text for {slug}")

            source = (ROOT / str(entry.get("master", ""))).resolve()
            if (
                V3.resolve() not in source.parents
                or source.name != "master-4x3.png"
                or source.parent.name != slug
                or not source.is_file()
            ):
                raise ValueError(f"Invalid or missing immutable v3 master for {slug}: {rel(source)}")

            files = entry.get("files") or {}
            outputs = {}
            for key, filename in expected_names.items():
                output = (ROOT / str(files.get(key, ""))).resolve()
                expected = (V3_PRODUCT_OUT / slug / filename).resolve()
                if output != expected:
                    raise ValueError(f"Unexpected v3 {key} output for {slug}: {files.get(key)!r}")
                outputs[key] = output

            raw = Image.open(source).convert("RGB")
            if raw.width < 1280 or raw.height < 960:
                raise ValueError(f"V3 master is too small for {slug}: {raw.width}x{raw.height}")
            if abs((raw.width / raw.height) - (4 / 3)) > 0.005:
                raise ValueError(f"V3 master is not 4:3 for {slug}: {raw.width}x{raw.height}")

            detail = cover(raw, (1280, 960))
            card = detail.resize((640, 480), Image.Resampling.LANCZOS)
            # Contain the complete machine for social/metadata instead of cropping
            # tall vessels, robot arms, conveyors, or cold-room enclosures.
            social = contain_on_category(detail, (1200, 630), category)

            save_webp_budget(card, outputs["card"], quality=78, max_bytes=120 * 1024)
            save_webp_budget(detail, outputs["detail"], quality=84, max_bytes=400 * 1024)
            save_webp_budget(social, outputs["social"], quality=82, max_bytes=450 * 1024)
            built.append(slug)
    except (OSError, ValueError, TypeError) as error:
        print(f"V3 derivative build failed: {error}")
        return 4

    print(f"Built {len(built)} approved v3 product derivative sets")
    print("V3 products:", ", ".join(built))
    return 0


def build():
    V2.mkdir(parents=True, exist_ok=True)
    products = json.loads((DATA / "products.json").read_text())
    industries = json.loads((DATA / "industries.json").read_text())

    assets = OrderedDict()
    missing = []
    for asset_id, meta in MASTER_SPECS.items():
        files = build_master(asset_id, meta)
        if not files:
            missing.append(asset_id)
            continue
        assets[asset_id] = {
            "category": meta["category"],
            "status": meta["status"],
            "description": meta["description"],
            "sourceOriginal": meta["source"],
            "logoAnchors": meta["anchors"],
            "files": files,
            "alt": meta["description"] + " by ART Mechatronics",
        }

    product_map = OrderedDict()
    for product in products:
        category = derive_category(product)
        asset_id = asset_for_product(product)
        features = verified_features(product)
        labelled = render_labelled(product, asset_id, features) if asset_id in assets else None
        product_map[product["slug"]] = {
            "assetId": asset_id,
            "category": category,
            "labelled": labelled,
            "features": features,
            "disclosure": MASTER_SPECS[asset_id]["status"] != "exact",
            "alt": f"{display_name(product)} by ART Mechatronics",
        }

    industry_map = OrderedDict()
    for industry in industries:
        asset_ids, category = industry_assets(industry, products)
        hero = render_industry(industry, asset_ids, category) if all(a in assets for a in asset_ids) else None
        industry_map[industry["slug"]] = {
            "assetIds": asset_ids,
            "category": category,
            "hero": hero,
            "disclosure": True,
            "alt": f"Representative {display_name(industry)} process equipment by ART Mechatronics",
        }

    manifest = {
        "version": 2,
        "brandRule": "Every final machine image carries the approved direct-on-surface A.R.T. Mechatronics decal; rectangular logo plaques are not permitted.",
        "categories": CATEGORIES,
        "assets": assets,
        "products": product_map,
        "industries": industry_map,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"Built {len(assets)}/{len(MASTER_SPECS)} branded masters")
    print(f"Mapped {len(product_map)} products and {len(industry_map)} industries")
    if missing:
        print("Missing clean sources:", ", ".join(missing))
        return 2
    missing_labels = [slug for slug, item in product_map.items() if not item["labelled"]]
    missing_industries = [slug for slug, item in industry_map.items() if not item["hero"]]
    if missing_labels or missing_industries:
        print(f"Incomplete derivatives: {len(missing_labels)} products, {len(missing_industries)} industries")
        return 3
    return 0


if __name__ == "__main__":
    if "--v3" in sys.argv:
        sys.exit(build_v3_products())
    sys.exit(build())
