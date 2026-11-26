import test from 'node:test';
import assert from 'node:assert/strict';
import { scopedAssets, slotAssets } from '../app/asset-scope.js';
import { createAssetLoader } from '../app/asset-loader.js';
const assets = {
  'fcm-cover/cpl.png': { id: 'fcm-cover/cpl.png', name: 'cpl.png', type: 'image', builtin: true },
  'fcm-cover/cplL.png': { id: 'fcm-cover/cplL.png', name: 'cplL.png', type: 'image', builtin: true },
  'fcm-cover/cta.png': { id: 'fcm-cover/cta.png', name: 'cta.png', type: 'image', builtin: true },
  'fcm-panel/bg.png': { id: 'fcm-panel/bg.png', name: 'bg.png', type: 'image', builtin: true },
  'cleaner/ale.png': { id: 'cleaner/ale.png', name: 'ale.png', type: 'image', builtin: true },
  uploadMine: { id: 'uploadMine', name: 'mine.png', type: 'image' },
  uploadOther: { id: 'uploadOther', name: 'other.png', type: 'image' }
};
const project = {
  template: 'cover',
  assetIds: ['uploadMine'],
  selectedBlock: 'hero',
  blocks: [{ id: 'hero', type: 'hero', asset: 'fcm-cover/cpl.png' }],
  settings: {}
};
test('library excludes other templates and other project uploads', () => {
  const ids = scopedAssets(project, assets, 'image').map(a => a.id);
  assert.ok(ids.includes('uploadMine'));
  assert.ok(ids.includes('fcm-cover/cpl.png'));
  assert.ok(!ids.includes('uploadOther'));
  assert.ok(!ids.includes('fcm-panel/bg.png'));
  assert.ok(!ids.includes('cleaner/ale.png'));
});
test('hero slot excludes the CTA even within its own template', () => {
  const ids = slotAssets(project, assets, 'block.asset', 'image', 'fcm-cover/cpl.png').map(a => a.id);
  assert.deepEqual(ids, ['fcm-cover/cpl.png', 'fcm-cover/cplL.png', 'uploadMine']);
});
test('legacy project keeps its referenced upload without needing migration', () => {
  assert.ok(
    scopedAssets({ ...project, assetIds: [], blocks: [{ asset: 'uploadMine' }] }, assets).some(
      a => a.id === 'uploadMine'
    )
  );
});
globalThis.location = { href: 'https://studio.test/' };
globalThis.FileReader = class {
  readAsDataURL(blob) {
    blob.arrayBuffer().then(buffer => {
      this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;
      this.onload();
    });
  }
};
test('protected assets load in the parent with credentials and are embedded for an opaque iframe', async () => {
  let requests = 0;
  const loader = createAssetLoader(async (url, options) => {
    requests++;
    assert.equal(url, 'https://studio.test/assets/cover.png');
    assert.equal(options.credentials, 'same-origin');
    return new Response(new Blob(['pixels'], { type: 'image/png' }));
  });
  const asset = { name: 'cover.png', url: 'assets/cover.png' };
  const [a, b] = await Promise.all([loader.load(asset), loader.load(asset)]);
  assert.ok(a.data.startsWith('data:image/png;base64,'));
  assert.equal(a.url, undefined);
  assert.equal(a.data, b.data);
  assert.equal(requests, 1);
});
test('failed access shows an error and can be retried instead of caching a broken image', async () => {
  let requests = 0;
  const loader = createAssetLoader(async () =>
    ++requests === 1
      ? new Response('denied', { status: 403 })
      : new Response(new Blob(['pixels'], { type: 'image/png' }))
  );
  await assert.rejects(loader.load({ url: 'cover.png', name: 'cover.png' }), /403/);
  assert.ok((await loader.load({ url: 'cover.png', name: 'cover.png' })).data);
  assert.equal(requests, 2);
});
test('HTML login response is never treated as an image', async () => {
  const loader = createAssetLoader(
    async () => new Response('<html>login</html>', { headers: { 'Content-Type': 'text/html' } })
  );
  await assert.rejects(loader.load({ url: 'cover.png', name: 'cover.png' }), /доступу/);
});
