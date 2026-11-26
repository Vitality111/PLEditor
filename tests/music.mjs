// Music of an original creative is an element: switch it off (silence, script keeps working), replace
// it, bring the original back. The left panel is one list: elements, then files.
import assert from 'node:assert/strict';
import { launchBrowser } from './launch.mjs';
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', e => console.log('ERR', e.message));
await page.goto('http://127.0.0.1:4173');
await page.waitForFunction(() => window.studio);
await page.locator('[data-picker-product="fiction"]').click();
await page.locator('[data-choose="f-00108"]').click();
await page.waitForFunction(() => window.studio.getProject().template === 'f-00108', null, { timeout: 30000 });
await page.locator('#previewState').waitFor({ state: 'hidden' });
const m = await page.evaluate(() => window.studio.getProject().blocks.find(b => b.type === 'audio'));
assert.equal(m?.label, 'Музика', 'music is an element');
await page.locator(`.block-select[data-select="${m.id}"]`).click();
await page.locator('input[data-prop="block.enabled"]').uncheck();
await page.waitForTimeout(300);
let html = await page.evaluate(() => window.studio.buildHTML(window.studio.getProject(), window.studio.resolveAssets(), { preview: false }));
assert.ok(html.includes('UklGRiQAAABXQVZFZm10') && !/data:audio\/mpeg/.test(html), 'switched off: silence instead of the music');
await page.locator('input[data-prop="block.enabled"]').check();
const chooser = page.waitForEvent('filechooser');
await page.locator('[data-upload="block.asset"]').click();
const fc = await chooser;
await fc.setFiles({ name: 'new.wav', mimeType: 'audio/wav', buffer: Buffer.from('UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=', 'base64') });
await page.waitForTimeout(500);
html = await page.evaluate(() => window.studio.buildHTML(window.studio.getProject(), window.studio.resolveAssets(), { preview: false }));
assert.ok(html.includes('data:audio/wav') && !/data:audio\/mpeg/.test(html), 'replaced by the new file');
await page.locator('[data-restore-audio]').click();
html = await page.evaluate(() => window.studio.buildHTML(window.studio.getProject(), window.studio.resolveAssets(), { preview: false }));
assert.ok(/data:audio\/mpeg/.test(html), 'original music back');
// One panel: files under the elements; a used file opens its element.
assert.equal(await page.locator('[data-tab]').count(), 0);
await page.locator('.asset-card.used .asset-open').first().click();
assert.ok(await page.locator('#inspectorBody h3').isVisible());

// A creative kept in the browser by an older PB (no music element) gets «Музика» when it comes back.
await page.locator('#newProject').click();
await page.locator('[data-picker-product="fiction"]').click();
await page.locator('[data-choose="f-00109"]').click();
await page.waitForFunction(() => window.studio.getProject().template === 'f-00109', null, { timeout: 30000 });
await page.waitForFunction(() => /Збережено/.test(document.querySelector('#saveStatus').textContent), null, { timeout: 8000 });
await page.evaluate(() => new Promise((res, rej) => {
  const q = indexedDB.open('pb-last-v1', 1);
  q.onsuccess = () => {
    const db = q.result, tx = db.transaction('last', 'readwrite'), st = tx.objectStore('last');
    const g = st.get('creative');
    g.onsuccess = () => { const r = g.result; for (const p of r.projects) p.blocks = p.blocks.filter(b => b.type !== 'audio'); st.put(r, 'creative'); };
    tx.oncomplete = () => { db.close(); res(); };
    tx.onerror = rej;
  };
}));
await page.reload();
await page.waitForFunction(() => window.studio && !document.querySelector('#editor').hidden, null, { timeout: 15000 });
const again = await page.evaluate(() => window.studio.getProject().blocks.find(b => b.type === 'audio'));
assert.equal(again?.label, 'Музика', 'music element added to an older creative');
await page.locator(`.block-select[data-select="${again.id}"]`).click();
assert.equal(await page.locator('#inspectorBody [data-upload="block.asset"]').count(), 1, 'music can be replaced');
await browser.close();
console.log({ music: 'ok' });
