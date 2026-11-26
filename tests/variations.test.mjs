import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fileName,
  parseFileName,
  ensureSet,
  createVariant,
  renumber,
  setMembers,
  applyLayoutToSet,
  nextNumber,
  syncSetFields
} from '../app/variations.js';

let n = 0;
const uid = () => 'id' + ++n;
const clone = x => structuredClone(x);
const project = extra => ({
  id: uid(),
  product: 'cleaner',
  template: 'banner',
  language: 'en',
  name: 'Cleaner — нова варіація',
  settings: {
    motion: 'banner',
    bgAsset: 'bg-a',
    bgAssetL: 'bgL-a',
    fontAsset: '',
    portrait: { ctaWidth: 85 }
  },
  blocks: [
    {
      id: 'img',
      type: 'image',
      asset: 'ale-a',
      assetL: 'aleL-a',
      text: '',
      width: 76,
      position: { portrait: { x: 0, y: 0 } }
    },
    {
      id: 'cta',
      type: 'cta',
      asset: 'cta-a',
      assetL: '',
      text: 'Go',
      width: 100,
      position: { portrait: { x: 0, y: 0 } }
    }
  ],
  ...extra
});

test('file names follow the production scheme', () => {
  const p = ensureSet(project({ naming: { number: '170' } }), [], uid);
  assert.equal(fileName(p), '00170_1_clr_am_kd_vt_nc_en__bn_pl.html');
  const alert = ensureSet(
    project({ template: 'alert', language: 'pt', naming: { number: '00165', kind: 'lz', ref: '00124' } }),
    [],
    uid
  );
  alert.variant = 3;
  assert.equal(fileName(alert), '00165_3_clr_am_kd_vt_lz_pt_00124_alrt_pl.html');
  const fiction = ensureSet(
    {
      ...project(),
      product: 'fiction',
      template: 'sticky',
      naming: { number: '140', kind: 'cr', ref: '00109' }
    },
    [],
    uid
  );
  assert.equal(fileName(fiction), '00140_1_fcm_am_kd_vt_cr_en_00109_lr_pl.html');
});

test('production names parse back into naming fields', () => {
  for (const name of [
    '00170_1_clr_am_kd_vt_nc_en__bn_pl.html',
    '00165_2_clr_am_kd_vt_lz_jp_00124_alrt_pl.html',
    '00140_3_fcm_am_kd_vt_cr_en_00109_lr_pl.html',
    '00175_1_clr_am_kd_vt_cr_en_0038_bn_pl.html'
  ]) {
    const parsed = parseFileName('some/folder/' + name);
    assert.ok(parsed, name);
    const p = {
      ...project(),
      product: parsed.product,
      language: parsed.language,
      variant: parsed.variant,
      naming: parsed.naming
    };
    assert.equal(fileName(p), name);
  }
  assert.equal(parseFileName('index.html'), null);
});

test('next number continues after the highest one in the workspace', () => {
  assert.equal(nextNumber('cleaner', []), '00186');
  assert.equal(nextNumber('cleaner', [{ product: 'cleaner', naming: { number: '00191' } }]), '00192');
  assert.equal(nextNumber('fiction', [{ product: 'cleaner', naming: { number: '00191' } }]), '00141');
});

test('variations share a set and renumber after removal', () => {
  const projects = [];
  const a = ensureSet(project(), projects, uid);
  projects.push(a);
  const b = createVariant(a, projects, uid, clone);
  projects.push(b);
  const c = createVariant(b, projects, uid, clone);
  projects.push(c);
  assert.deepEqual(
    setMembers(projects, a.setId).map(p => p.variant),
    [1, 2, 3]
  );
  assert.equal(c.name, 'Cleaner — нова варіація · 3');
  const left = projects.filter(p => p !== b);
  renumber(left, a.setId);
  assert.deepEqual(
    setMembers(left, a.setId).map(p => p.variant),
    [1, 2]
  );
  assert.equal(c.name, 'Cleaner — нова варіація · 2');
});

test('layout goes to every variation, assets and texts stay', () => {
  const projects = [];
  const a = ensureSet(project(), projects, uid);
  projects.push(a);
  const b = createVariant(a, projects, uid, clone);
  projects.push(b);
  b.blocks[0].asset = 'ale-b';
  b.blocks[1].text = 'Other';
  b.settings.bgAsset = 'bg-b';
  a.blocks[0].width = 60;
  a.blocks[0].position.portrait = { x: 4, y: -2 };
  a.settings.portrait.ctaWidth = 70;
  assert.equal(applyLayoutToSet(a, projects, clone), 1);
  assert.equal(b.blocks[0].width, 60);
  assert.deepEqual(b.blocks[0].position.portrait, { x: 4, y: -2 });
  assert.equal(b.settings.portrait.ctaWidth, 70);
  assert.equal(b.blocks[0].asset, 'ale-b');
  assert.equal(b.blocks[1].text, 'Other');
  assert.equal(b.settings.bgAsset, 'bg-b');
});

test('set fields stay equal across variations', () => {
  const projects = [];
  const a = ensureSet(project(), projects, uid);
  projects.push(a);
  const b = createVariant(a, projects, uid, clone);
  projects.push(b);
  a.naming.number = '00200';
  a.language = 'de';
  syncSetFields(a, projects);
  assert.equal(b.naming.number, '00200');
  assert.equal(fileName(b), '00200_2_clr_am_kd_vt_nc_de__bn_pl.html');
});

test('layout pairs blocks by type when ids differ and keeps extra blocks', () => {
  const projects = [];
  const a = ensureSet(project(), projects, uid);
  projects.push(a);
  const b = createVariant(a, projects, uid, clone);
  projects.push(b);
  b.blocks = b.blocks.map(x => ({ ...x, id: 'other-' + x.id }));
  b.blocks[0].asset = 'ale-b';
  b.blocks.push({ id: 'extra', type: 'text', text: 'Only in 2', position: { portrait: { x: 0, y: 0 } } });
  a.blocks[0].width = 55;
  applyLayoutToSet(a, projects, clone);
  assert.equal(b.blocks[0].width, 55);
  assert.equal(b.blocks[0].asset, 'ale-b');
  assert.equal(b.blocks[0].id, 'other-img');
  assert.ok(
    b.blocks.some(x => x.id === 'extra'),
    'extra block kept'
  );
});
