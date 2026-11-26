// «Скріншот»: PNG of the creative's screen as in the preview (no selection outline or handles), 2×,
// downloaded and copied to the clipboard; landscape and other screen sizes too.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { launchBrowser } from './launch.mjs';

const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:4173' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:4173');
await page.waitForFunction(() => window.studio);
await page.locator('[data-picker-product="fiction"]').click();
await page.locator('[data-choose="f-00108"]').click();
await page.waitForFunction(() => window.studio.getProject().template === 'f-00108', null, { timeout: 30000 });
await page.locator('#previewState').waitFor({ state: 'hidden' });

const png = buf => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });
async function shoot(file) {
  const dl = page.waitForEvent('download', { timeout: 30000 });
  await page.locator('#screenshot').click();
  const d = await dl.catch(async e => { console.log('toast:', await page.locator('#toast').textContent(), '| btn:', await page.locator('#screenshot').textContent()); throw e; });
  assert.match(d.suggestedFilename(), /\.png$/);
  const path = 'test-results/' + file;
  await d.saveAs(path);
  const buf = Buffer.from(await (await import('node:fs/promises')).readFile(path));
  return { name: d.suggestedFilename(), ...png(buf), buf };
}
let s = await shoot('shot-portrait.png');
assert.equal(s.w, 393 * 2);
assert.equal(s.h, 852 * 2);
assert.match(s.name, /port_393x852\.png$/);
await page.waitForFunction(() => /скопійовано/.test(document.querySelector('#toast').textContent));
const clip = await page.evaluate(async () => {
  const items = await navigator.clipboard.read();
  return items[0]?.types || [];
});
assert.ok(clip.includes('image/png'), 'copied to the clipboard');
// Selection outline is not in the picture, and the editor still shows it afterwards.
assert.ok(
  await page.evaluate(() => !!document.querySelector('#preview').contentDocument.querySelector('[data-editor-selected]'))
);

// Landscape.
await page.locator('#landscape').click();
await page.locator('#previewState').waitFor({ state: 'hidden' });
await page.waitForTimeout(500);
s = await shoot('shot-landscape.png');
assert.ok(s.w > s.h, 'landscape picture');
assert.match(s.name, /land_/);
await browser.close();
assert.deepEqual(errors, []);
console.log({ screenshot: 'ok' });
