// Variation sets: one creative number (e.g. 00186) with variations 1, 2, 3… that share the layout
// and differ in assets/text — the same structure as the production folders cleaner/00170/{1,2,3}.
// File names follow the production scheme:
//   00170_1_clr_am_kd_vt_nc_en__bn_pl.html
//   {number}_{variant}_{product}_{prefix}_{kind}_{lang}_{ref}_{code}_pl.html

export const PRODUCT_CODES = { cleaner: 'clr', fiction: 'fcm' };
const FIRST_FREE = { cleaner: 186, fiction: 141 };

const TEMPLATE_CODES = {
  banner: 'bn',
  poster: 'bn',
  checklist: 'bn',
  alert: 'alrt',
  comparison: 'ba',
  textbanner: 'bn',
  steps: 'bn',
  bubble: 'bn',
  mockup: 'bn',
  aichat: 'ai',
  alertphoto: 'alrt',
  compare: 'ba'
};

export function templateCode(project) {
  if (project.product === 'fiction') return 'lr';
  return TEMPLATE_CODES[project.template] || 'bn';
}

const clean = (value, max = 24) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '')
    .replace(/^_+|_+$/g, '')
    .slice(0, max);

export function normalizeNaming(raw = {}, project) {
  const digits = String(raw.number ?? '')
    .replace(/\D/g, '')
    .slice(0, 6);
  return {
    number: digits ? digits.padStart(5, '0') : '',
    prefix: clean(raw.prefix ?? 'am_kd_vt', 40) || 'am_kd_vt',
    kind: clean(raw.kind ?? 'nc', 8) || 'nc',
    ref: String(raw.ref ?? '')
      .replace(/\D/g, '')
      .slice(0, 6),
    code: clean(raw.code, 12) || templateCode(project)
  };
}

export function nextNumber(product, projects) {
  let max = FIRST_FREE[product] - 1;
  for (const p of projects)
    if (p.product === product && !p.isTemplate) {
      const n = Number(p.naming?.number);
      if (Number.isFinite(n) && n > max) max = n;
    }
  return String(max + 1).padStart(5, '0');
}

export function setMembers(projects, setId) {
  return projects.filter(p => p.setId === setId && !p.isTemplate).sort((a, b) => a.variant - b.variant);
}

// Gives a project a set, a variant number and naming fields if it has none (older projects).
export function ensureSet(project, projects, uid) {
  if (project.isTemplate) {
    project.naming = normalizeNaming(project.naming || {}, project);
    return project;
  }
  if (!project.setId) {
    project.setId = uid();
    project.variant = 1;
  }
  if (!Number.isInteger(project.variant) || project.variant < 1) project.variant = 1;
  const naming = normalizeNaming(project.naming || {}, project);
  if (!naming.number) {
    const sibling = projects.find(p => p !== project && p.setId === project.setId && p.naming?.number);
    naming.number = sibling ? sibling.naming.number : nextNumber(project.product, projects);
  }
  project.naming = naming;
  return project;
}

export function fileName(project) {
  const n = normalizeNaming(project.naming || {}, project);
  const lang = clean(project.language || 'en', 8) || 'en';
  return (
    [
      n.number || '00000',
      project.variant || 1,
      PRODUCT_CODES[project.product] || 'pl',
      n.prefix,
      n.kind,
      lang,
      n.ref,
      n.code,
      'pl'
    ].join('_') + '.html'
  );
}

// Reads naming from a production file name, e.g. when an existing playable is imported.
export function parseFileName(name) {
  const base = String(name || '')
    .split(/[\\/]/)
    .pop()
    .replace(/\.(html?|zip)$/i, '');
  const m = base.match(
    /^(\d{3,6})_(\d{1,2})_(clr|fcm)_((?:[a-z0-9]+_)*?[a-z0-9]+)_(nc|cr|lz)_([a-z]{2,3})_(\d*)_([a-z]+)_pl$/i
  );
  if (!m) return null;
  return {
    product: m[3].toLowerCase() === 'fcm' ? 'fiction' : 'cleaner',
    variant: Number(m[2]),
    language: m[6].toLowerCase(),
    naming: {
      number: m[1].padStart(5, '0'),
      prefix: m[4].toLowerCase(),
      kind: m[5].toLowerCase(),
      ref: m[7],
      code: m[8].toLowerCase()
    }
  };
}

// New variation = copy of the current one with the next free number in the set.
export function createVariant(project, projects, uid, clone) {
  const members = setMembers(projects, project.setId);
  const v = clone(project);
  v.id = uid();
  v.variant = Math.max(0, ...members.map(p => p.variant)) + 1;
  v.name = baseName(project.name) + ' · ' + v.variant;
  v.updated = Date.now();
  return v;
}

export function baseName(name) {
  return String(name || '').replace(/\s·\s\d+$/, '');
}

// After a variation is removed, keep variants numbered 1..n so file names stay continuous.
export function renumber(projects, setId) {
  setMembers(projects, setId).forEach((p, i) => {
    if (p.variant !== i + 1) {
      p.variant = i + 1;
      p.name = baseName(p.name) + ' · ' + p.variant;
    }
  });
}

// Fields that belong to the set and are kept equal in every variation.
export function syncSetFields(source, projects) {
  if (!source.setId || source.isTemplate) return;
  for (const p of setMembers(projects, source.setId))
    if (p !== source) {
      p.naming = { ...source.naming };
      p.language = source.language;
      p.iosUrl = source.iosUrl;
      p.androidUrl = source.androidUrl;
    }
}

const ASSET_KEYS = ['asset', 'assetL', 'afterAsset'];
const SETTING_ASSET_KEYS = ['bgAsset', 'bgAssetL', 'fontAsset'];

// Copies the layout of `source` to the other variations: composition, sizes, positions, colours,
// block order and visibility. Each variation keeps its own pictures, background and texts.
// Blocks are paired by id (variations made with «+ Варіація» share ids), otherwise by type, role
// and order. Blocks that exist only in a target variation are kept at the end.
export function applyLayoutToSet(source, projects, clone) {
  let changed = 0;
  for (const target of setMembers(projects, source.setId)) {
    if (target === source || target.kind === 'html' || source.kind === 'html') continue;
    const keepSettings = Object.fromEntries(SETTING_ASSET_KEYS.map(k => [k, target.settings[k]]));
    const used = new Set();
    const pair = b => {
      let own = target.blocks.find(x => x.id === b.id && !used.has(x.id));
      if (!own)
        own = target.blocks.find(
          x => !used.has(x.id) && x.type === b.type && (x.role || '') === (b.role || '')
        );
      if (own) used.add(own.id);
      return own;
    };
    const blocks = source.blocks.map(b => {
      const own = pair(b);
      const next = clone(b);
      if (own) {
        next.id = own.id;
        for (const k of ASSET_KEYS) next[k] = own[k];
        next.text = own.text;
        if ('afterText' in own) next.afterText = own.afterText;
      }
      return next;
    });
    for (const b of target.blocks) if (!used.has(b.id)) blocks.push(b);
    target.template = source.template;
    target.settings = { ...clone(source.settings), ...keepSettings };
    target.blocks = blocks;
    target.assetIds = [...new Set([...(target.assetIds || []), ...(source.assetIds || [])])];
    target.updated = Date.now();
    changed++;
  }
  return changed;
}
