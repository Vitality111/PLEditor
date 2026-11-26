// One picture for both orientations → a separate landscape picture added in PB: for a picture of the
// creative and for a CSS background. Portrait keeps its picture; the layout does not change.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { launchBrowser } from './launch.mjs';

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:4173');
await page.waitForFunction(() => window.studio);
const build = () =>
  page.evaluate(() => window.studio.buildHTML(window.studio.getProject(), window.studio.resolveAssets(), { preview: false }));
const shot = async (html, w, h, js) => {
  const v = await browser.newPage({ viewport: { width: w, height: h } });
  await v.setContent(html, { waitUntil: 'load' });
  await v.waitForTimeout(300);
  const r = await v.evaluate(js);
  await v.close();
  return r;
};
const addLandscape = async file => {
  const chooser = page.waitForEvent('filechooser');
  await page.locator('[data-upload="block.assetL"]').click();
  await (await chooser).setFiles(file);
  await page.waitForFunction(() => window.studio.getProject().blocks.some(b => b.landscapeOwn && b.assetL));
  await page.waitForTimeout(400);
};

// 1. A picture of the creative (the Fiction cover).
await page.locator('[data-picker-product="fiction"]').click();
await page.locator('[data-choose="f-00108"]').click();
await page.waitForFunction(() => window.studio.getProject().template === 'f-00108', null, { timeout: 30000 });
await page.locator('#previewState').waitFor({ state: 'hidden' });
const cover = await page.evaluate(() => window.studio.getProject().blocks.find(b => b.label === 'cpl.png'));
await page.locator(`.block-select[data-select="${cover.id}"]`).click();
const before = await shot(await build(), 393, 852, () => {
  const r = document.querySelector('.cpl img').getBoundingClientRect();
  return [r.width, r.height].map(Math.round).join('x');
});
await addLandscape('app/assets/fcm-cover/cplL.png');
let html = await build();
const src = js => `(() => document.querySelector('.cpl img').currentSrc.slice(0, 80))()`;
const port = await shot(html, 393, 852, () => [document.querySelector('.cpl img').currentSrc.slice(-60), (r => [r.width, r.height].map(Math.round).join('x'))(document.querySelector('.cpl img').getBoundingClientRect())]);
const land = await shot(html, 852, 393, () => document.querySelector('.cpl img').currentSrc.slice(-60));
assert.notEqual(port[0], land, 'landscape shows its own picture');
assert.equal(port[1], before, 'portrait layout unchanged');
// Back to one picture.
await page.locator('[data-drop-landscape]').click();
html = await build();
assert.equal(
  await shot(html, 852, 393, () => document.querySelector('.cpl img').currentSrc.slice(-60)),
  port[0],
  'one picture again'
);

// 2. A CSS background (one for both orientations).
const png = 'data:image/png;base64,' + (await readFile('app/assets/fcm-cover/brand.png')).toString('base64');
await writeFile(
  'test-results/bg-fixture.html',
  `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%}body{background:#123 url(${png}) center/cover no-repeat}.t{font:20px Arial;color:#fff;padding:40px}</style></head><body><div class="t">Clean your phone today and free up space</div></body></html>`
);
await page.locator('#newProject').click();
await page.locator('[data-picker-product="cleaner"]').click();
await page.locator('#playableInput').setInputFiles('test-results/bg-fixture.html');
await page.waitForFunction(() => window.studio.getProject().blocks.some(b => b.bgAsset), null, { timeout: 30000 });
await page.locator('#previewState').waitFor({ state: 'hidden' });
const bg = await page.evaluate(() => window.studio.getProject().blocks.find(b => b.bgAsset));
await page.locator(`.block-select[data-select="${bg.id}"]`).click();
await addLandscape('app/assets/fcm-cover/cplL.png');
html = await build();
const bgP = await shot(html, 393, 852, () => getComputedStyle(document.body).backgroundImage.slice(0, 120));
const bgL = await shot(html, 852, 393, () => getComputedStyle(document.body).backgroundImage.slice(0, 120));
assert.notEqual(bgP, bgL, 'landscape background differs');
assert.ok(bgP.includes(png.slice(0, 100)), 'portrait keeps the original background');
assert.equal(
  await shot(html, 852, 393, () => getComputedStyle(document.body).backgroundSize),
  'cover',
  'the rest of the background rule stays'
);
await browser.close();
assert.deepEqual(errors, []);
console.log({ landscapePicture: 'ok' });
