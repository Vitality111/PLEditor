// «Рухати і розтягувати»: handles around the selected element change its size like in Figma;
// the opposite side stays put, pictures keep proportions, and the export matches.
import assert from 'node:assert/strict';
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
await page.waitForTimeout(1500);
await page.waitForTimeout(400);
const frame = page.frameLocator('#preview');
const rectOf = id =>
  page.evaluate(
    id => document.querySelector('#preview').contentDocument.querySelector(`[data-studio-block="${id}"]`).getBoundingClientRect().toJSON(),
    id
  );
const dragHandle = async (dir, dx, dy) => {
  // Page coordinates of the handle (the preview frame is scaled with CSS zoom).
  const { x, y } = await page.evaluate(dir => {
    const f = document.querySelector('#preview'),
      r = f.getBoundingClientRect(),
      z = Number(f.style.zoom) || 1,
      h = f.contentDocument.querySelector(`#resizeHandles [data-resize="${dir}"]`).getBoundingClientRect();
    return { x: r.x + (h.x + h.width / 2) * z, y: r.y + (h.y + h.height / 2) * z };
  }, dir);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(700);
};

// Story box: only side handles; dragging the right one makes it narrower, the left side stays.
const box = await page.evaluate(() => window.studio.getProject().blocks.find(b => b.storyGroup).id);
await page.locator(`[data-select="${box}"]`).click();
await page.locator('#editPositions').click();
await page.waitForTimeout(500);
assert.deepEqual(
  (await frame.locator('[data-resize]').evaluateAll(es => es.map(e => e.dataset.resize))).sort(),
  ['e', 'w']
);
const a = await rectOf(box);
await dragHandle('e', -80, 0);
const b = await rectOf(box);
assert.ok(b.width < a.width - 60, 'narrower: ' + a.width + ' → ' + b.width);
assert.ok(Math.abs(b.left - a.left) < 3, 'left side stays');
const story = await page.evaluate(id => window.studio.getProject().blocks.find(b => b.id === id), box);
assert.ok(story.customStyle.portrait.width < 85, 'width saved');

// CTA picture: corner handle keeps proportions, the top-left corner stays.
const cta = await page.evaluate(() => window.studio.getProject().blocks.find(b => /CTA · портрет/.test(b.label)).id);
await page.locator(`[data-select="${cta}"]`).click();
await page.waitForTimeout(500);
assert.equal(await frame.locator('[data-resize]').count(), 8);
const c1 = await rectOf(cta);
await dragHandle('se', -60, 0);
const c2 = await rectOf(cta);
assert.ok(c2.width < c1.width - 40, 'smaller picture');
assert.ok(Math.abs(c2.width / c2.height - c1.width / c1.height) < 0.05, 'same proportions');
assert.ok(Math.abs(c2.left - c1.left) < 3 && Math.abs(c2.top - c1.top) < 3, 'top-left corner stays');
await page.screenshot({ path: 'test-results/resize.png' });

// Bigger than the original: the right side of the CTA goes past its original box.
await dragHandle('e', 160, 0);
const c4 = await rectOf(cta);
assert.ok(c4.width > c1.width + 40, 'can grow beyond the original: ' + c1.width + ' → ' + c4.width);
assert.ok(
  (await page.evaluate(id => window.studio.getProject().blocks.find(b => b.id === id).customStyle.portrait.width, cta)) > 100,
  'width above 100% saved'
);
const big = await page.evaluate(() =>
  window.studio.buildHTML(window.studio.getProject(), window.studio.resolveAssets(), { preview: false })
);
const bigView = await browser.newPage({ viewport: { width: 393, height: 852 } });
await bigView.setContent(big, { waitUntil: 'load' });
// Layout width (the CTA pulses, so its on-screen box changes while it animates).
const editorW = await page.evaluate(
  id => document.querySelector('#preview').contentDocument.querySelector(`[data-studio-block="${id}"]`).offsetWidth,
  cta
);
assert.ok(Math.abs((await bigView.locator('.cta img.port').evaluate(e => e.offsetWidth)) - editorW) < 3, 'export is as big');
await bigView.close();
await dragHandle('e', -160, 0);

// Export: same size and place as in the editor.
const html = await page.evaluate(() =>
  window.studio.buildHTML(window.studio.getProject(), window.studio.resolveAssets(), { preview: false })
);
const view = await browser.newPage({ viewport: { width: 393, height: 852 } });
await view.setContent(html, { waitUntil: 'load' });
await view.waitForTimeout(400);
const e = await view.locator('#scrollContent').boundingBox();
assert.ok(Math.abs(e.width - b.width) < 3 && Math.abs(e.x - b.left) < 3, 'export matches the editor');

// «Скинути позицію і розмір» brings the original back.
await page.locator('#resetPosition').click();
await page.waitForTimeout(600);
const c3 = await rectOf(cta);
assert.ok(Math.abs(c3.width - c1.width) < 2, 'size reset');

await browser.close();
assert.deepEqual(errors, []);
console.log({ resize: 'ok' });
