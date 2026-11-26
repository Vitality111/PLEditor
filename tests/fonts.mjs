// Font of a text element in an original creative: the creative's own font, a built-in one, the
// creative's other fonts, or an uploaded file; «for all text» copies the choice; export keeps it.
import assert from 'node:assert/strict';
import { launchBrowser } from './launch.mjs';

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:4173');
await page.waitForFunction(() => window.studio);
await page.locator('[data-picker-product="fiction"]').click();
await page.locator('[data-choose="f-00109"]').click();
await page.waitForFunction(() => window.studio.getProject().template === 'f-00109', null, { timeout: 30000 });
await page.locator('#previewState').waitFor({ state: 'hidden' });

const story = await page.evaluate(() => window.studio.getProject().blocks.filter(b => b.type === 'text').sort((a, b) => b.text.length - a.text.length)[0].id);
const family = () =>
  page.evaluate(id => {
    const el = document.querySelector('#preview').contentDocument.querySelector(`[data-studio-block="${id}"]`);
    return el && getComputedStyle(el).fontFamily;
  }, story);
await page.locator(`.block-select[data-select="${story}"]`).click();
await page.locator('[data-inspector="layout"]').click();
const select = page.locator('select[data-prop="block.font"]');
await select.waitFor();
assert.match(await family(), /Inria Serif/, 'the creative font by default');
const options = await select.locator('option').allTextContents();
assert.ok(options.some(o => /Inria Serif It · з креативу/.test(o)), 'fonts of the creative are offered');

await select.selectOption('sans');
await page.waitForFunction(
  id => /Arial/.test(getComputedStyle(document.querySelector('#preview').contentDocument.querySelector(`[data-studio-block="${id}"]`)).fontFamily),
  story,
  { timeout: 8000 }
);

// An uploaded font becomes the chosen one.
const chooser = page.waitForEvent('filechooser');
await page.locator('[data-upload="block.fontAsset"]').click();
await (await chooser).setFiles('app/assets/fonts/InriaSerif-Regular.ttf');
await page.waitForFunction(id => window.studio.getProject().blocks.find(b => b.id === id).font === 'asset', story);
await page.waitForFunction(
  id => /PB Font/.test(getComputedStyle(document.querySelector('#preview').contentDocument.querySelector(`[data-studio-block="${id}"]`)).fontFamily),
  story,
  { timeout: 8000 }
);
await page.locator('[data-font-all]').click();
const fonts = await page.evaluate(() => window.studio.getProject().blocks.filter(b => b.type === 'text').map(b => b.font));
assert.ok(fonts.length && fonts.every(f => f === 'asset'), 'for all text');

// Export: the font file is embedded and applied.
const html = await page.evaluate(() =>
  window.studio.buildHTML(window.studio.getProject(), window.studio.resolveAssets(), { preview: false })
);
assert.match(html, /@font-face\{font-family:"PB Font [^"]+";src:url\("data:font\//, 'font embedded');
const view = await browser.newPage({ viewport: { width: 393, height: 852 } });
await view.setContent(html, { waitUntil: 'load' });
await view.waitForTimeout(500);
assert.match(await view.locator('#scrollContent').evaluate(e => getComputedStyle(e).fontFamily), /PB Font/);
assert.ok(await view.evaluate(() => [...document.fonts].some(f => /PB Font/.test(f.family) && f.status === 'loaded')), 'font loads');

// Back to the creative font.
await select.selectOption('');
await page.waitForFunction(
  id => /Inria Serif/.test(getComputedStyle(document.querySelector('#preview').contentDocument.querySelector(`[data-studio-block="${id}"]`)).fontFamily),
  story,
  { timeout: 8000 }
);
await page.screenshot({ path: 'test-results/fonts.png' });
await browser.close();
assert.deepEqual(errors, []);
console.log({ fonts: 'ok' });
