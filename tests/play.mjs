// «Тест»: the creative runs with its own scripts (alert timer counts down), CTA tap is caught.
import assert from 'node:assert/strict';
import { launchBrowser } from './launch.mjs';

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:4173');
await page.waitForFunction(() => window.studio);
await page.locator('[data-picker-product="cleaner"]').click();
await page.locator('[data-choose="c-00112"]').click();
await page.waitForFunction(() => window.studio.getProject().template === 'c-00112', null, { timeout: 30000 });
await page.locator('#previewState').waitFor({ state: 'hidden' });

await page.locator('#modePlay').click();
const play = page.frameLocator('#playFrame');
const timer = play.locator('#timer');
await timer.waitFor({ state: 'attached' });
await page.waitForTimeout(600);
const t0 = await timer.textContent();
assert.match(t0, /\d\d:\d\d/, 'the creative script runs');
await page.waitForTimeout(1300);
assert.notEqual(await timer.textContent(), t0, 'timer ticks');
assert.ok(await page.locator('#preview').isHidden(), 'editor frame hidden while playing');
await play.locator('.app').dispatchEvent('click');
await page.locator('#toast').waitFor();
assert.match(await page.locator('#toast').textContent(), /CTA/);
await page.screenshot({ path: 'test-results/play-timer.png' });

// Back to editing: the editor frame returns.
await page.locator('#modeEdit').click();
await page.locator('#preview').waitFor({ state: 'visible' });
assert.ok(await page.locator('#playFrame').isHidden());

// Test → Edit → Test again starts the creative again (no white screen).
await page.locator('#modePlay').click();
await timer.waitFor({ state: 'attached' });
await page.waitForTimeout(800);
assert.match(await timer.textContent(), /\d\d:\d\d/, 'second test run works');
assert.ok((await play.locator('.app').boundingBox()).height > 100, 'creative has its size');
await page.locator('#modeEdit').click();
await page.locator('#preview').waitFor({ state: 'visible' });

// The standalone preview (new tab, built from the editor — nothing stored) runs the creative too.
const popup = page.waitForEvent('popup');
await page.locator('#standalonePreview').click();
const view = await popup;
const standalone = view.frameLocator('iframe').locator('#timer');
await standalone.waitFor({ state: 'attached', timeout: 20000 });
await view.waitForTimeout(800);
assert.match(await standalone.textContent(), /\d\d:\d\d/);

await browser.close();
assert.deepEqual(errors, []);
console.log({ play: 'ok' });
