// Original creatives: the story box can be narrowed and moved; new text and pictures can be added on top.
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
const rect = id =>
  page.evaluate(
    id => document.querySelector('#preview').contentDocument.querySelector(`[data-studio-block="${id}"]`)?.getBoundingClientRect().toJSON(),
    id
  );

// Story box: width and position.
const box = await page.evaluate(() => window.studio.getProject().blocks.find(b => b.storyGroup).id);
await page.locator(`[data-select="${box}"]`).click();
const before = await rect(box);
await page.locator('input[type=number][data-prop="block.customStyle.portrait.width"]').fill('80');
await page.waitForTimeout(600);
const narrow = await rect(box);
assert.ok(narrow.width < before.width * 0.85, 'story box gets narrower');
assert.ok(Math.abs(narrow.left + narrow.width / 2 - (before.left + before.width / 2)) < 2, 'and stays centred');
await page.locator('input[type=number][data-prop="block.position.portrait.y"]').fill('5');
await page.waitForTimeout(600);
assert.ok((await rect(box)).top > narrow.top + 20, 'story box moves');

// New text on top of the creative.
await page.locator('.add-section summary').click();
await page.locator('[data-add-html="text"]').click();
await page.locator('[data-rich="block"]').fill('Only today: free chapters');
await page.locator('input[type=number][data-prop="block.position.portrait.y"]').fill('-25');
await page.waitForTimeout(600);
const textId = await page.evaluate(() => window.studio.getProject().blocks.find(b => b.added && b.type === 'text').id);
assert.ok((await rect(textId)).top < 200, 'new text placed higher');

// New picture: placeholder until a file is chosen, then the file.
await page.locator('[data-add-html="image"]').click();
await page.locator('#previewState').waitFor({ state: 'hidden' });
const chooser = page.waitForEvent('filechooser');
await page.locator('[data-upload="block.asset"]').click();
await (await chooser).setFiles('app/assets/fcm-cover/brand.png');
await page.waitForFunction(() => window.studio.getProject().blocks.some(b => b.added && b.type === 'image' && b.asset));
await page.locator('input[type=number][data-prop="block.customStyle.portrait.width"]').fill('40');
await page.waitForTimeout(600);

const html = await page.evaluate(() =>
  window.studio.buildHTML(window.studio.getProject(), window.studio.resolveAssets(), { preview: false })
);
const view = await browser.newPage({ viewport: { width: 393, height: 852 } });
await view.setContent(html, { waitUntil: 'load' });
assert.equal(await view.locator('.studio-added').count(), 2, 'both new elements exported');
assert.match(await view.locator('div.studio-added').textContent(), /Only today/);
assert.ok((await view.locator('img.studio-added').evaluate(i => i.naturalWidth)) > 0, 'picture embedded');
assert.ok((await view.locator('#scrollContent').boundingBox()).width < 360, 'narrow story in export');
await view.screenshot({ path: 'test-results/elements-export.png' });

// Delete an added element.
await page.locator(`[data-select="${textId}"]`).click();
await page.locator(`[data-delete-block="${textId}"]`).click();
assert.ok(!(await page.evaluate(() => window.studio.getProject().blocks.some(b => b.added && b.type === 'text'))));

await browser.close();
assert.deepEqual(errors, []);
console.log({ elements: 'ok' });
