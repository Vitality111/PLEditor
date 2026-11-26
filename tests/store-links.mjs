// Store links of an original creative (Export tab): empty = the creative's own links; one link = both
// platforms; two links = each phone its store, also for creatives whose code knows one link only.
import assert from 'node:assert/strict';
import { launchBrowser } from './launch.mjs';

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:4173');
await page.waitForFunction(() => window.studio);

const IOS = 'https://apps.apple.com/us/app/test-app/id111',
  AND = 'https://play.google.com/store/apps/details?id=test.app';
const build = () =>
  page.evaluate(() => window.studio.buildHTML(window.studio.getProject(), window.studio.resolveAssets(), { preview: false }));
// Taps the CTA in the exported creative with a given phone; returns the URL passed to mraid.open.
async function tapUrl(html, ua) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, userAgent: ua });
  const v = await ctx.newPage();
  // The ad network's MRAID exists before the creative's code runs.
  const stub =
    '<script>window.opened=[];window.mraid={getState:function(){return "default"},addEventListener:function(){},removeEventListener:function(){},isViewable:function(){return true},open:function(u){window.opened.push(u)}};</script>';
  await v.setContent(html.replace(/<head>/i, '<head>' + stub), { waitUntil: 'load' });
  await v.waitForTimeout(300);
  const cta = v.locator('.cta img.port, .cta, #cta').first();
  for (let i = 0; i < 3 && !(await v.evaluate(() => window.opened.length)); i++) {
    await cta.click({ force: true }).catch(() => {});
    await v.waitForTimeout(1700);
  }
  const u = await v.evaluate(() => window.opened[0]);
  await ctx.close();
  return u;
}
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile';

for (const [product, id] of [['fiction', 'f-00108'], ['cleaner', 'c-00176']]) {
  if (await page.locator('#editor').isVisible()) await page.locator('#newProject').click();
  await page.locator(`[data-picker-product="${product}"]`).click();
  await page.locator(`[data-choose="${id}"]`).click();
  await page.waitForFunction(t => window.studio.getProject().template === t, id, { timeout: 30000 });
  await page.locator('#previewState').waitFor({ state: 'hidden' });
  await page.locator('[data-inspector="settings"]').click();
  // Empty: the creative's own link.
  const own = await tapUrl(await build(), iphone);
  assert.match(own, /apps\.apple\.com/, `${id}: own link`);
  assert.equal(await page.locator('input[data-prop="linkIos"]').getAttribute('placeholder'), own);
  // Only Google Play: both phones go there.
  await page.locator('input[data-prop="linkAndroid"]').fill(AND);
  await page.waitForTimeout(300);
  let html = await build();
  assert.equal(await tapUrl(html, iphone), AND, `${id}: one link → iPhone too`);
  assert.equal(await tapUrl(html, android), AND, `${id}: one link → Android`);
  // Both: each its own store.
  await page.locator('input[data-prop="linkIos"]').fill(IOS);
  await page.waitForTimeout(300);
  html = await build();
  assert.equal(await tapUrl(html, iphone), IOS, `${id}: iPhone → App Store`);
  assert.equal(await tapUrl(html, android), AND, `${id}: Android → Google Play`);
  assert.match(await page.locator('#linksNote').textContent(), /iPhone/);
  // A wrong link is caught before export.
  await page.locator('input[data-prop="linkIos"]').fill('apps.apple.com/x');
  await page.waitForTimeout(200);
  await page.locator('#export').click();
  await page.waitForFunction(() => /https/.test(document.querySelector('#toast').textContent));
  await page.locator('input[data-prop="linkIos"]').fill('');
  await page.locator('input[data-prop="linkAndroid"]').fill('');
  await page.waitForTimeout(200);
}
await browser.close();
assert.deepEqual(errors, []);
console.log({ storeLinks: 'ok' });
