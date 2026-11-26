// PB keeps only the last creative in the browser: a reload brings it back with every edit and its
// variations; opening another creative replaces it; nothing goes to a server.
import assert from 'node:assert/strict';
import { launchBrowser } from './launch.mjs';

const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('dialog', d => d.accept());
await page.goto('http://127.0.0.1:4173');
await page.waitForFunction(() => window.studio);

// First visit: the start screen, nothing kept yet.
assert.ok(await page.locator('#chooser').isVisible());
await page.locator('[data-picker-product="fiction"]').click();
await page.locator('[data-choose="f-00108"]').click();
await page.waitForFunction(() => window.studio.getProject().template === 'f-00108', null, { timeout: 30000 });
await page.locator('#previewState').waitFor({ state: 'hidden' });
const box = await page.evaluate(() => window.studio.getProject().blocks.find(b => b.storyGroup));
const pov = await page.evaluate(g => window.studio.getProject().blocks.find(b => b.node === g.parts[1]).id, box);
await page.locator(`[data-select="${box.id}"]`).click();
await page.locator(`[data-rich="part.${pov}"], input[data-prop="part.${pov}.text"]`).first().click();
await page.keyboard.press('ControlOrMeta+A');
await page.keyboard.type('Nathan’s POV');
await page.locator('#addVariant').click().catch(() => {});
await page.waitForFunction(() => /Збережено/.test(document.querySelector('#saveStatus').textContent), null, { timeout: 5000 });
const before = await page.evaluate(() => ({ n: window.studio.getProjects().length, p: window.studio.getProject() }));

// Reload: straight into the editor with the same creative.
await page.reload();
await page.waitForFunction(() => window.studio && !document.querySelector('#editor').hidden, null, { timeout: 15000 });
await page.locator('#previewState').waitFor({ state: 'hidden' });
const after = await page.evaluate(() => ({ n: window.studio.getProjects().length, p: window.studio.getProject() }));
assert.equal(after.p.template, 'f-00108');
assert.equal(after.p.id, before.p.id, 'same variation');
assert.equal(after.n, before.n, 'variations kept');
assert.equal(after.p.blocks.find(b => b.id === pov).text, 'Nathan’s POV', 'edit kept');
await page.waitForFunction(
  () => /Nathan’s POV/.test(document.querySelector('#preview').contentDocument?.body?.textContent || ''),
  null,
  { timeout: 15000 }
);
assert.match(await page.locator('#toast').textContent(), /Відновлено/);

// Another creative replaces the kept one.
await page.locator('#newProject').click();
await page.locator('[data-picker-product="cleaner"]').click();
await page.locator('[data-choose="c-00176"]').click();
await page.waitForFunction(() => window.studio.getProject().template === 'c-00176', null, { timeout: 30000 });
await page.waitForFunction(() => /Збережено/.test(document.querySelector('#saveStatus').textContent), null, { timeout: 5000 });
await page.reload();
await page.waitForFunction(() => window.studio && !document.querySelector('#editor').hidden, null, { timeout: 15000 });
const third = await page.evaluate(() => ({ t: window.studio.getProject().template, n: window.studio.getProjects().length }));
assert.equal(third.t, 'c-00176');
assert.equal(third.n, 1, 'only the last creative is kept');
assert.deepEqual(
  (await page.evaluate(async () => (await indexedDB.databases()).map(d => d.name))).sort(),
  ['pb-last-v1']
);
await browser.close();
assert.deepEqual(errors, []);
console.log({ lastCreative: 'ok' });
