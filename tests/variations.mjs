// Variation sets end to end: create 1/2/3, change an asset in one variation, rename, export ZIP.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
import { launchBrowser } from './launch.mjs';

await mkdir('test-results', { recursive: true });
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('dialog', d => d.accept());
await page.goto('http://127.0.0.1:4173');
await page.waitForFunction(() => window.studio);
if (await page.locator('#editor').isVisible()) await page.locator('#newProject').click();
await page.evaluate(() => window.studio.newFromTemplate('banner'));
const first = await page.evaluate(() => window.studio.getProject());
assert.equal(first.variant, 1);
assert.match(first.naming.number, /^\d{5}$/);

await page.locator('#addVariant').click();
await page.locator('#addVariant').click();
assert.equal(await page.locator('#variantTabs [data-variant-id]').count(), 3, 'three variation tabs');
const third = await page.evaluate(() => window.studio.getProject());
assert.equal(third.variant, 3);
assert.equal(third.setId, first.setId);

// Variation 3 gets its own text picture.
await page.locator('[data-inspector="element"]').click();
await page.locator('.block-select', { hasText: 'Текст-картинка' }).click();
const chooser = page.waitForEvent('filechooser');
await page.locator('[data-upload="block.asset"]').click();
await (await chooser).setFiles('app/assets/cleaner-alert/ale.png');
await page.waitForFunction(() =>
  window.studio
    .getProject()
    .blocks.find(b => b.type === 'image')
    .asset.startsWith('upload-')
);

// Set-level naming: number typed in variation 3 reaches variation 1.
await page.locator('[data-inspector="settings"]').click();
await page.locator('input[data-prop="naming.number"]').fill('00321');
await page.locator('select[data-prop="naming.kind"]').selectOption('cr');
const names = await page.locator('#fileNames li').allTextContents();
assert.deepEqual(names, [
  '00321_1_clr_am_kd_vt_cr_en__bn_pl.html',
  '00321_2_clr_am_kd_vt_cr_en__bn_pl.html',
  '00321_3_clr_am_kd_vt_cr_en__bn_pl.html'
]);
// Undo of a set-wide field keeps the whole set consistent.
await page.locator('input[data-prop="naming.number"]').fill('00999');
await page.locator('input[data-prop="naming.number"]').blur();
await page.locator('#undo').click();
const after = await page.locator('#fileNames li').allTextContents();
assert.equal(new Set(after.map(n => n.slice(0, 5))).size, 1, 'one number across the set after undo');
await page.locator('input[data-prop="naming.number"]').fill('00321');
await page.locator('input[data-prop="naming.number"]').blur();
await page.locator('#variantTabs [data-variant-id]').first().click();
assert.equal((await page.evaluate(() => window.studio.getProject())).naming.number, '00321');
assert.equal(
  (await page.evaluate(() => window.studio.getProject())).blocks.find(b => b.type === 'image').asset,
  'cleaner-banner/ale.png',
  'variation 1 keeps its picture'
);

// Layout from variation 1 goes to the others without touching their pictures.
await page.locator('[data-inspector="settings"]').click();
await page.locator('#applyLayout').click();
await page.locator('#applyLayout').click();

assert.match(await page.locator('#export').textContent(), /ZIP · 3/);
const download = page.waitForEvent('download', { timeout: 60000 });
await page.locator('#export').click();
const file = await download;
assert.equal(file.suggestedFilename(), '00321_bn.zip');
const zipPath = 'test-results/variation-set.zip';
await file.saveAs(zipPath);
const { readFile } = await import('node:fs/promises');
const entries = unzipSync(new Uint8Array(await readFile(zipPath)));
assert.deepEqual(Object.keys(entries).sort(), [
  '00321/1/00321_1_clr_am_kd_vt_cr_en__bn_pl.html',
  '00321/2/00321_2_clr_am_kd_vt_cr_en__bn_pl.html',
  '00321/3/00321_3_clr_am_kd_vt_cr_en__bn_pl.html'
]);
const htmls = Object.values(entries).map(strFromU8);
for (const html of htmls) {
  assert.ok(html.length < 5_000_000);
  assert.match(html, /mraid/);
  assert.match(html, /apps\.apple\.com/);
}
assert.notEqual(htmls[0].length, htmls[2].length, 'variation 3 carries a different picture');
await page.locator('#closeExport').click();

// Deleting variation 2 (two clicks on ×) renumbers 3 → 2.
await page.locator('#variantTabs [data-variant-id]').nth(1).click();
await page.locator('#removeVariant').click();
await page.locator('#removeVariant').click();
assert.deepEqual(
  await page.locator('#variantTabs [data-variant-id]').allTextContents(),
  ['1', '2'],
  'renumbered after removal'
);

// A new creative takes the next number.
await page.locator('#newProject').click();
await page.evaluate(() => window.studio.newFromTemplate('alertphoto'));
const next = await page.evaluate(() => window.studio.getProject());
assert.equal(next.naming.number, '00322');
assert.equal(next.naming.code, 'alrt');

await writeFile(
  'test-results/variations.json',
  JSON.stringify({ names, zip: Object.keys(entries), errors }, null, 2)
);
assert.deepEqual(errors, []);
console.log({ variations: 'ok', zip: Object.keys(entries), errors });
await browser.close();
