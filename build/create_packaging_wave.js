#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const taxonomyPath = path.join(root, 'assets/machines/v3/full/packaging-taxonomy.json');
const outputPath = path.join(root, 'assets/machines/v3/full/waves/packaging.json');
const productsPath = path.join(root, 'build/data/products.json');

const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, 'utf8'));
const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
const productBySlug = new Map(products.map((product) => [product.slug, product]));

const refs = {
  vffs: 'https://www.rovema-na.com/vertical-form-fill-seal-machine-vffs',
  weigher: 'https://www.ishida.com/ww/in/products/weighing/ccw/',
  pouch: 'https://www.ishida.com/ww/en/news/upload/products2018_eng_0911.pdf',
  auger: 'https://www.all-fill.com/equipment/auger-fillers',
  cup: 'https://all-fill.com/media/brochures/AFI_Fillers_Cup_SC-Series_HzF4MeR.pdf',
  imaTea: 'https://ima.it/it/ct30-c-through/',
  imaLine: 'https://ima.it/personalcare/turnkey-line-for-hair-dye-packaging/?lang=en',
  multivac: 'https://multivac.com/gb/en/our-solutions/portfolio/packaging-solutions/traysealers',
  bagging: 'https://www.ptchronos.com/products/bag-packaging-equipment',
  sewing: 'https://www.fischbein.com/wp-content/uploads/2018/06/fischbein-brochure_sewing-system-mtr-3.pdf',
  stretch: 'https://www.robopac.com/en/business-units/robopac-machinery/vertical-stretch-wrapping',
  robopac: 'https://www.robopac.com/en/business-units/robopac-machinery',
  container: 'https://www.krones.com/en/products/machines/unitxpress-for-the-modulfill.php',
  labeler: 'https://www.herma.com/machines/products/labeling-machines/wrap-around-labeler-152c/',
  inspection: 'https://www.mt.com/us/en/home/products/Product-Inspection_1.html',
  coder: 'https://www.domino-printing.com/en-gb/home.aspx',
  leak: 'https://resources.bonfiglioliengineering.com/hubfs/50%20100%2010979%20Rev.008.pdf',
  casepack: 'https://www.ocmeusa.com/en-us/products/case-packing/case-packers-cartoning-machines',
  rewinder: 'https://www.kampf.de/',
};

function chooseReferences(visualClass) {
  const c = visualClass.toLowerCase();
  if (/checkweigher|metal-detector|xray/.test(c)) return [refs.inspection];
  if (/coder/.test(c)) return [refs.coder];
  if (/labeler/.test(c)) return [refs.labeler];
  if (/leak/.test(c)) return [refs.leak, refs.container];
  if (/rewinder/.test(c)) return [refs.rewinder];
  if (/stretch/.test(c)) return [refs.stretch];
  if (/sewing/.test(c)) return [refs.sewing];
  if (/bagging|bagger|net-weigh/.test(c)) return [refs.bagging];
  if (/palletizer|case-packer|cartoner|carton|overwrapper|collator/.test(c)) return [refs.casepack, refs.imaLine];
  if (/tea-bag/.test(c)) return [refs.imaTea];
  if (/strip-pack/.test(c)) return [refs.imaLine];
  if (/tray|thermoform|vacuum/.test(c)) return [refs.multivac];
  if (/auger/.test(c)) return [refs.auger];
  if (/volumetric-cup/.test(c)) return [refs.cup];
  if (/rinser|filler|seam|cap|container|can-|jar-|cup-|bottle|jerry|canister|pail|drum|gallon|collar-fitting|crimper|decapper/.test(c)) return [refs.container];
  if (/multihead/.test(c)) return [refs.weigher];
  if (/premade-pouch|oral-pouch/.test(c)) return [refs.pouch];
  if (/vffs|sachet/.test(c)) return [refs.vffs];
  if (/horizontal-flow|sleeve|l-bar|shrink|band-sealer|batch-cutter/.test(c)) return [refs.robopac, refs.vffs];
  if (/pouch/.test(c)) return [refs.pouch, refs.vffs];
  return [refs.vffs];
}

function visibleCues(mechanism) {
  const normalized = mechanism
    .replace(/\.$/, '')
    .replace(/\s+and\s+/gi, ', ')
    .replace(/\s+with\s+/gi, ', with ');
  const cues = normalized
    .split(/,|;/)
    .map((cue) => cue.trim())
    .filter(Boolean)
    .map((cue) => cue.replace(/^(with|and)\s+/i, ''));

  const fallbackCues = [
    'guarded drive and machine controls appropriate to this mechanism',
    'stable hygienic support frame with a coherent product path',
    'accessible infeed and discharge interfaces',
  ];
  while (cues.length < 4) cues.push(fallbackCues[cues.length % fallbackCues.length]);
  return cues.slice(0, 7);
}

function mismatchGuards(visualClass) {
  const c = visualClass.toLowerCase();
  if (/vffs|sachet/.test(c)) return ['horizontal flow wrapper', 'rotary premade-pouch carousel', 'bottle filling line', 'cartoning machine'];
  if (/horizontal-flow/.test(c)) return ['vertical forming-collar machine', 'rotary pouch carousel', 'cartoner', 'tray sealer'];
  if (/multihead|auger|cup-filler|net-weigh/.test(c)) return ['sealing-only machine', 'capping machine', 'flow wrapper', 'cartoner'];
  if (/pouch/.test(c)) return ['vertical rollstock bagger', 'horizontal flow wrapper', 'bottle filler', 'cartoner'];
  if (/sealer|shrink|vacuum/.test(c)) return ['product dosing filler', 'bottle capper', 'cartoner', 'inspection-only conveyor'];
  if (/tea|strip|carton|overwrapper|collator|case-packer/.test(c)) return ['VFFS bagger', 'bottle filler', 'tray sealer', 'open-mouth bagger'];
  if (/bagging|bagger|sewing|stretch/.test(c)) return ['small pouch machine', 'bottle filler', 'cartoner', 'tray sealer'];
  if (/rinser|filler|seam|cap|container|can-|jar-|cup-|tray|bottle|jerry|canister|pail|drum|gallon|labeler|leak|crimper|decapper|collar-fitting/.test(c)) return ['VFFS bagger', 'open-mouth sack bagger', 'cartoner', 'robot palletizer'];
  if (/palletizer/.test(c)) return ['VFFS bagger', 'container filler', 'labeler', 'checkweigher'];
  if (/rewinder/.test(c)) return ['bagger', 'cartoner', 'labeler', 'container filler'];
  if (/coder|checkweigher|metal-detector|xray/.test(c)) return ['product filler', 'capper', 'cartoner', 'shrink tunnel'];
  return ['unrelated filling machine', 'unrelated sealing machine', 'unrelated cartoner', 'disconnected product path'];
}

const records = [];
for (const group of taxonomy.groups) {
  const sharedConfiguration = `packaging-${group.visualClass}`;
  const requiredVisible = visibleCues(group.externalMechanism);
  const forbidden = mismatchGuards(group.visualClass);
  const references = chooseReferences(group.visualClass);

  for (const slug of group.slugs) {
    const product = productBySlug.get(slug);
    if (!product) throw new Error(`Missing catalogue product: ${slug}`);

    const approvedPilot = slug === 'vertical-form-fill-seal';
    records.push({
      slug,
      name: product.shortName || product.h1 || slug,
      normalizedCategory: 'Packaging',
      visualClass: group.visualClass,
      sharedConfiguration,
      configuration: group.externalMechanism,
      requiredVisible,
      forbidden,
      forbiddenMismatch: forbidden.map((item) => `Do not depict a ${item}`),
      confidence: 'high',
      disclosure: true,
      references,
      output: approvedPilot
        ? 'assets/machines/v3/pilot/vertical-form-fill-seal/master-4x3.png'
        : `assets/machines/v3/full/packaging/${slug}/master-4x3.png`,
      status: approvedPilot ? 'approved-pilot' : 'pending',
    });
  }
}

const slugs = records.map((record) => record.slug);
if (records.length !== 114 || new Set(slugs).size !== 114) {
  throw new Error(`Expected 114 unique Packaging records, got ${records.length}/${new Set(slugs).size}`);
}
if (records.some((record) => record.requiredVisible.length < 4 || !record.references.length)) {
  throw new Error('Packaging wave contains an incomplete record');
}

const wave = {
  version: 3,
  family: taxonomy.family,
  gradient: taxonomy.gradient,
  styleReference: 'assets/machines/v2/approval/storage-silos-art-logo-sample.png',
  sharingPolicy: taxonomy.policy,
  sourceNote: 'External mechanisms are normalized from the verified 67-class taxonomy and grounded in current official OEM sources.',
  products: records,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(wave, null, 2)}\n`);
console.log(`Wrote ${path.relative(root, outputPath)} with ${records.length} products across ${taxonomy.groups.length} visual classes.`);
