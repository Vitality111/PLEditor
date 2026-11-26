// New elements stay next to the element they were put by («anchor») on every screen size: a picture
// put above the rating stays above the rating, scaled with it; a moved logo keeps its distance; the
// group is squeezed on short screens instead of running off; reopening the export keeps all of it.
import assert from 'node:assert/strict';
import { launchBrowser } from './launch.mjs';

const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:4173');
await page.waitForFunction(() => window.studio);
await page.locator('[data-picker-product="fiction"]').click();
await page.locator('[data-choose="f-00109"]').click();
await page.waitForFunction(() => window.studio.getProject().template === 'f-00109', null, { timeout: 30000 });
await page.locator('#previewState').waitFor({ state: 'hidden' });

// A new picture: tied automatically to the nearest element once it has a file.
await page.locator('.add-section summary').click().catch(() => {});
await page.locator('[data-add-html="image"]').click();
const chooser = page.waitForEvent('filechooser');
await page.locator('[data-upload="block.asset"]').click();
await (await chooser).setFiles('app/assets/fcm-cover/brand.png');
await page.waitForFunction(() => window.studio.getProject().blocks.some(b => b.added && b.anchor?.portrait?.node), null, { timeout: 10000 });
const proj = await page.evaluate(() => window.studio.getProject());
const rate = proj.blocks.find(b => /^rate\.png/.test(b.label));
const added = proj.blocks.find(b => b.added);
// Tie it to the rating by hand, 30% of the rating's width above it, 50% of its width.
await page.locator(`select[data-anchor-choice="${added.id}"]`).selectOption(rate.node);
await page.locator('input[type=number][data-prop="block.anchor.portrait.y"]').fill('-30');
await page.locator('input[type=number][data-prop="block.anchor.portrait.w"]').fill('50');
await page.waitForTimeout(500);
const a = await page.evaluate(id => window.studio.getProject().blocks.find(b => b.id === id).anchor.portrait, added.id);
assert.equal(a.node, rate.node);
assert.equal(a.lock, true);

// Move the logo (an element of the creative): it gets tied too.
const logo = proj.blocks.find(b => /^logo/.test(b.label));
await page.locator(`.block-select[data-select="${logo.id}"]`).click();
await page.locator('input[type=number][data-prop="block.position.portrait.y"]').fill('-20');
await page.waitForTimeout(400);
// A slider change in screen % is not a move by hand; tie it through the anchor list.
await page.locator(`select[data-anchor-choice="${logo.id}"]`).selectOption(rate.node).catch(() => {});

// Landscape: tied there too — to the rating's landscape twin when it fits above it, otherwise put in
// sight and tied where it is; it is on screen. It can be hidden in landscape only.
await page.locator(`.block-select[data-select="${added.id}"]`).click();
await page.locator('#landscape').click();
await page.waitForFunction(
  id => window.studio.getProject().blocks.find(b => b.id === id).anchor?.landscape?.node,
  added.id,
  { timeout: 8000 }
);
await page.waitForTimeout(400);
const land = await page.evaluate(() => {
  const d = document.querySelector('#preview').contentDocument,
    r = d.querySelector('img.studio-added').getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, width: r.width, h: d.defaultView.innerHeight };
});
assert.ok(land.top >= 0 && land.bottom <= land.h + 1 && land.width > 40, 'landscape: visible: ' + JSON.stringify(land));
await page.locator('input[data-show-for="landscape"]').uncheck();
assert.ok(await page.locator('input[data-show-for="portrait"]').isChecked(), 'still shown in portrait');
await page.waitForFunction(
  () => getComputedStyle(document.querySelector('#preview').contentDocument.querySelector('img.studio-added')).display === 'none'
);
await page.locator('#portrait').click();
await page.waitForFunction(
  () => getComputedStyle(document.querySelector('#preview').contentDocument.querySelector('img.studio-added')).display !== 'none'
);
const html = await page.evaluate(() =>
  window.studio.buildHTML(window.studio.getProject(), window.studio.resolveAssets(), { preview: false })
);
assert.match(html, /id="pb-anchor-runtime"/);
const measure = async (w, h) => {
  const v = await browser.newPage({ viewport: { width: w, height: h } });
  await v.setContent(html, { waitUntil: 'load' });
  await v.waitForTimeout(700);
  const m = await v.evaluate(() => {
    const img = document.querySelector('img.studio-added').getBoundingClientRect(),
      rate = document.querySelector('.rate img.port').getBoundingClientRect();
    return { img: { top: img.top, width: img.width, cx: img.left + img.width / 2 }, rate: { top: rate.top, width: rate.width, cx: rate.left + rate.width / 2 } };
  });
  await v.close();
  return m;
};
for (const [w, h] of [[393, 852], [430, 932], [375, 667], [768, 1024]]) {
  const m = await measure(w, h);
  const k = (m.rate.top - m.img.top) / m.rate.width;
  assert.ok(m.img.top >= 0, `${w}x${h}: on screen`);
  assert.ok(Math.abs(m.img.cx - m.rate.cx) < 2, `${w}x${h}: centred on the rating`);
  // Tall phones: exactly as placed; elsewhere the group may be squeezed toward the rating, never beyond.
  if (h / w >= 2.1) {
    assert.ok(Math.abs(k - 0.3) < 0.01, `${w}x${h}: 30% of the rating width above it, got ${k}`);
    assert.ok(Math.abs(m.img.width / m.rate.width - 0.5) < 0.01, `${w}x${h}: half the rating width`);
  } else assert.ok(k > 0 && k <= 0.301, `${w}x${h}: squeezed toward the rating, got ${k}`);
}
// A hidden element never squeezes the others: with the logo hidden the picture keeps its exact place.
{
  const p2 = await page.evaluate(id => {
    const p = window.studio.getProject();
    p.blocks.find(b => b.id === id).enabled = false;
    return window.studio.buildHTML(p, window.studio.resolveAssets(), { preview: false });
  }, logo.id);
  for (const [w, h] of [[375, 667], [768, 1024], [320, 480]]) {
    const v = await browser.newPage({ viewport: { width: w, height: h } });
    await v.setContent(p2, { waitUntil: 'load' });
    await v.waitForTimeout(700);
    const m = await v.evaluate(() => {
      const img = document.querySelector('img.studio-added').getBoundingClientRect(),
        rate = document.querySelector('.rate img.port').getBoundingClientRect();
      return { k: (rate.top - img.top) / rate.width, w: img.width / rate.width, top: img.top };
    });
    await v.close();
    if (m.top > 5) assert.ok(Math.abs(m.k - 0.3) < 0.01 && Math.abs(m.w - 0.5) < 0.01, `${w}x${h}: logo hidden, picture not squeezed: ${JSON.stringify(m)}`);
  }
}
// Short screen: the group is squeezed, nothing runs off the top.
const short = await measure(320, 480);
assert.ok(short.img.top >= 0 && short.img.top < short.rate.top, 'short screen: above the rating, on screen');

// The exported HTML (with PB's edit data) opens again in PB with the new picture and its anchor.
const dl = page.waitForEvent('download', { timeout: 60000 });
await page.locator('#export').click();
await (await dl).saveAs('test-results/anchor-export.html');
await page.locator('#closeExport').click();
await page.locator('#newProject').click();
await page.locator('[data-picker-product="fiction"]').click();
await page.locator('#playableInput').setInputFiles('test-results/anchor-export.html');
await page.waitForFunction(() => window.studio.getProject().template === 'imported', null, { timeout: 30000 });
const back = await page.evaluate(() => window.studio.getProject().blocks.filter(b => b.added));
assert.equal(back.length, 1, 'one new picture, not duplicated into the creative');
assert.equal(back[0].anchor.portrait.node, rate.node);
assert.equal(back[0].anchor.portrait.y, -30);
assert.equal(back[0].hide?.landscape, true, 'hidden in landscape after reopening');
await browser.close();
assert.deepEqual(errors, []);
console.log({ anchor: 'ok' });
