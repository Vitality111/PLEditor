// PB stores nothing on a server; in the browser it keeps only the last creative (see last-creative.mjs).
// The exported HTML opens again in PB with every edit.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { launchBrowser } from './launch.mjs';

const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const dialogs = [];
page.on('dialog', d => {
  dialogs.push(d.type());
  d.accept();
});

// An old browser copy from earlier versions is removed.
await page.goto('http://127.0.0.1:4173/missing');
await page.evaluate(
  () =>
    new Promise(r => {
      const q = indexedDB.open('playable-studio-v1', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('workspace');
      q.onsuccess = () => (q.result.close(), r());
    })
);
await page.goto('http://127.0.0.1:4173');
await page.waitForFunction(() => window.studio);
await page.waitForTimeout(300);
assert.ok(
  !(await page.evaluate(async () => (await indexedDB.databases()).map(d => d.name))).includes('playable-studio-v1'),
  'browser copy removed'
);
for (const url of ['/api/workspace', '/api/project/x'])
  assert.equal((await page.request.get('http://127.0.0.1:4173' + url)).status(), 404, 'no storage API: ' + url);
assert.equal((await page.request.put('http://127.0.0.1:4173/api/project/x', { data: '{}' })).status(), 405);
assert.match(await page.locator('#storageNote').textContent(), /Зберігається лише останній креатив/);
assert.equal(await page.locator('#projectMenu').count(), 0, 'no project history');

// Edit a creative.
await page.locator('[data-picker-product="fiction"]').click();
await page.locator('[data-choose="f-00108"]').click();
await page.waitForFunction(() => window.studio.getProject().template === 'f-00108', null, { timeout: 30000 });
await page.locator('#previewState').waitFor({ state: 'hidden' });
const box = await page.evaluate(() => window.studio.getProject().blocks.find(b => b.storyGroup));
const pov = await page.evaluate(g => window.studio.getProject().blocks.find(b => b.node === g.parts[1]).id, box);
await page.locator(`[data-select="${box.id}"]`).click();
await page.locator(`[data-rich="part.${pov}"]`).fill('Nathan’s POV');
await page.waitForTimeout(400);
await page.waitForFunction(() => /Збережено/.test(document.querySelector('#saveStatus').textContent));
assert.equal(await page.evaluate(() => localStorage.length), 0);

// Export, then open the exported HTML again: the edit is there.
const dl = page.waitForEvent('download', { timeout: 60000 });
await page.locator('#export').click();
const file = await dl;
await file.saveAs('test-results/no-storage-export.html');
await page.locator('#closeExport').click();
assert.match(await readFile('test-results/no-storage-export.html', 'utf8'), /Nathan’s POV/);

// Only the one kept creative is in the browser.
assert.deepEqual(await page.evaluate(async () => (await indexedDB.databases()).map(d => d.name)), ['pb-last-v1']);
await page.locator('#newProject').click();

// The exported file opens with the edit («Свій плейбл»).
await page.locator('[data-picker-product="fiction"]').click();
await page.locator('#playableInput').setInputFiles('test-results/no-storage-export.html');
await page.waitForFunction(() => window.studio.getProject().kind === 'html', null, { timeout: 30000 });
await page.locator('#previewState').waitFor({ state: 'hidden' });
assert.ok(
  await page.evaluate(() => document.querySelector('#preview').contentDocument.body.textContent.includes('Nathan’s POV')),
  'edit restored from the exported HTML'
);

assert.deepEqual(dialogs, [], 'leaving never asks: the work is kept');

await browser.close();
assert.deepEqual(errors, []);
console.log({ noStorage: 'ok' });
