// 1) Any picture/text can be the CTA: a tap opens the store like the creative's own button (also when
//    the original button is hidden and a new one is added). 2) What is hidden in both orientations does
//    not go into the file (lighter export), and the layout stays the same.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { launchBrowser } from './launch.mjs';

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:4173');
await page.waitForFunction(() => window.studio);
await page.locator('[data-picker-product="fiction"]').click();
await page.locator('[data-choose="f-00108"]').click();
await page.waitForFunction(() => window.studio.getProject().template === 'f-00108', null, { timeout: 30000 });
await page.locator('#previewState').waitFor({ state: 'hidden' });
const build = () =>
  page.evaluate(() => window.studio.buildHTML(window.studio.getProject(), window.studio.resolveAssets(), { preview: false }));
const stub =
  '<script>window.opened=[];window.mraid={getState:function(){return "default"},addEventListener:function(){},removeEventListener:function(){},isViewable:function(){return true},open:function(u){window.opened.push(u)}};</script>';
async function view(html, fn, arg) {
  const v = await browser.newPage({ viewport: { width: 393, height: 852 } });
  await v.setContent(html.replace(/<head>/i, '<head>' + stub), { waitUntil: 'load' });
  await v.waitForTimeout(400);
  const r = await fn(v, arg);
  await v.close();
  return r;
}
const before = await build();
const coverBox = await view(before, v => v.evaluate(() => { const r = document.querySelector('.cpl img').getBoundingClientRect(); return [r.width, r.height].map(Math.round).join('x'); }));

// Hide the original CTA (portrait and landscape) and the cover picture everywhere.
const p0 = await page.evaluate(() => window.studio.getProject());
const ctas = p0.blocks.filter(b => /Кнопка CTA/.test(b.label));
const cover = p0.blocks.find(b => b.label === 'cpl.png');
for (const b of [...ctas, cover]) {
  await page.locator(`.block-select[data-select="${b.id}"]`).click();
  for (let i = 0; i < 3; i++) {
    const box = page.locator('#inspectorBody input[data-show-for]:checked').first();
    if (!(await box.count())) break;
    await box.evaluate(el => el.click());
    await page.waitForTimeout(150);
  }
}
// A new picture made clickable.
await page.locator('.add-section summary').click().catch(() => {});
await page.locator('[data-add-html="image"]').click();
const chooser = page.waitForEvent('filechooser');
await page.locator('[data-upload="block.asset"]').click();
await (await chooser).setFiles('app/assets/fcm-cover/cta.png');
await page.waitForFunction(() => window.studio.getProject().blocks.some(b => b.added && b.asset));
await page.locator('#inspectorBody input[data-prop="block.cta"]').check();
await page.waitForTimeout(300);
const html = await build();

// Weight: the hidden cover and CTA pictures are not in the file.
assert.ok(html.length < before.length - 500000, `lighter: ${before.length} → ${html.length}`);
assert.equal(await view(html, v => v.evaluate(() => { const r = document.querySelector('.cpl img').getBoundingClientRect(); return [r.width, r.height].map(Math.round).join('x'); })), coverBox, 'layout of the hidden cover kept');

// The new picture opens the store.
const opened = await view(html, async v => {
  await v.locator('img.studio-added').click({ force: true });
  await v.waitForTimeout(300);
  return v.evaluate(() => window.opened);
});
assert.equal(opened.length, 1, 'tap on the new picture opens the store once');
assert.match(opened[0], /apps\.apple\.com|play\.google\.com/);
await browser.close();
assert.deepEqual(errors, []);
console.log({ ctaWeight: 'ok', before: before.length, after: html.length });
