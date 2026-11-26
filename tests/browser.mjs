import { launchBrowser } from './launch.mjs';
import { layoutFailures } from '../app/layout-checks.js';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
await mkdir('test-results', { recursive: true });
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:4173');
await page.waitForFunction(() => window.studio);
await page.frameLocator('#preview').locator('#cta').waitFor({ state: 'attached' });
await page.waitForTimeout(400);
await page.screenshot({ path: 'test-results/studio-desktop.png' });
const matrix = [
  [320, 480],
  [320, 568],
  [360, 640],
  [375, 667],
  [390, 844],
  [393, 852],
  [412, 915],
  [430, 932]
];
const reports = [];
for (const product of ['fiction', 'cleaner']) {
  if (await page.locator('#editor').isVisible()) await page.locator('#newProject').click();
  await page.locator(`[data-picker-product="${product}"]`).click();
  const templates = await page.locator('[data-choose]').evaluateAll(es => es.map(e => e.dataset.choose));
  for (const template of templates) {
    if (await page.locator('#editor').isVisible()) {
      if (await page.locator('#editor').isVisible()) await page.locator('#newProject').click();
      await page.locator(`[data-picker-product="${product}"]`).click();
    }
    await page.locator(`[data-choose="${template}"]`).click();
    await page.waitForFunction(t => window.studio.getProject().template === t, template, { timeout: 30000 });
    console.log('Testing template:', template);
    const p = await page.evaluate(() => window.studio.getProject());
    const html = await page.evaluate(() =>
      window.studio.buildHTML(window.studio.getProject(), window.studio.resolveAssets(), {
        preview: window.studio.getProject().kind !== 'html'
      })
    );
    for (const [w, h] of [...matrix, ...matrix.map(([w, h]) => [h, w])]) {
      const view = await browser.newPage({ viewport: { width: w, height: h } });
      await view.setContent(html, { waitUntil: 'load' });
      await view.evaluate(() => document.fonts.ready);
      const check = await view.evaluate(`(() => {
        const failures = (${layoutFailures.toString()})(document, window);
        const c = (document.querySelector('.cta') || document.querySelector('button') || document.body).getBoundingClientRect();
        return {
          failures,
          cta: { width: c.width, height: c.height },
          hero: document.querySelector('.hero')?.getBoundingClientRect().toJSON()
        };
      })()`);
      reports.push({ template, w, h, ...check });
      if ((w === 393 && h === 852) || (w === 480 && h === 320))
        await view.screenshot({ path: `test-results/${template}-${w}x${h}.png` });
      if (product === 'fiction' && w === 393 && h === 852) {
        await view.evaluate(() => {
          const r = document.getElementById('reader') || document.querySelector('.scroll-container,.scroll');
          if (r) r.scrollTop = 400;
        });
        await view.waitForTimeout(100);
        if (['titlecover', 'niche', 'infocard'].includes(template))
          assert.ok(
            await view.locator('.hero').evaluate(e => e.getBoundingClientRect().top < 0),
            'cover scrolls away with the text'
          );
        await view.screenshot({ path: `test-results/${template}-scrolled.png` });
      }
      await view.close();
    }
  }
}
await page.locator('#newProject').click();
await page.locator('[data-picker-product="fiction"]').click();
await page.evaluate(() => window.studio.newFromTemplate('panel2'));
await page.locator('[data-inspector="element"]').click();
const text = '**Test story**\n\n[[Highlight]]\n\n<script>alert(1)</script>';
await page.locator('textarea[data-prop="block.text"]').fill(text);
assert.ok((await page.evaluate(() => window.studio.getProject())).blocks.some(b => b.text === text));
await page.locator('#undo').click();
assert.notEqual(
  (await page.evaluate(() => window.studio.getProject())).blocks.find(b => b.type === 'story').text,
  text
);
await page.locator('#redo').click();
assert.equal(
  (await page.evaluate(() => window.studio.getProject())).blocks.find(b => b.type === 'story').text,
  text
);
await page.locator('.add-section summary').click();
await page.locator('[data-add="title"]').click();
await page.locator('textarea[data-prop="block.text"]').fill('Uploaded image');
await page.locator('#assetInput').setInputFiles('app/assets/fcm-cover/brand.png');
await page.waitForFunction(() => Object.keys(window.studio.getAssets()).some(k => k.startsWith('upload-')));
const htmlDownload = page.waitForEvent('download');
await page.locator('#export').click();
const d = await htmlDownload;
await d.saveAs('test-results/export.html');
await page.locator('#closeExport').click();
const exported = await readFile('test-results/export.html', 'utf8');
assert.ok(/data:image\/(png|webp);base64,/.test(exported));
assert.ok(!exported.includes('http://127.0.0.1'), 'self-contained');
assert.ok(!exported.includes('<script>alert(1)</script>'), 'escaped user text');
const runtime = await browser.newPage({ viewport: { width: 393, height: 852 } });
await runtime.addInitScript(() => {
  window.calls = [];
  window.listeners = {};
  window.mraid = {
    getState: () => 'default',
    addEventListener: (n, fn) => (listeners[n] = fn),
    open: u => calls.push(u)
  };
});
await runtime.goto('http://127.0.0.1:4173');
await runtime.evaluate(html => {
  document.open();
  document.write(html);
  document.close();
}, exported);
await runtime.locator('#cta').click({ force: true });
assert.equal(await runtime.evaluate(() => calls.length), 0, 'first tap never redirects');
await runtime.locator('#cta').click({ force: true });
assert.equal(await runtime.evaluate(() => calls.length), 1, 'second tap calls mraid.open');
await runtime.close();
assert.equal(await page.locator('#check').count(), 0, 'no «Перевірити адаптивність» button');
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: 'test-results/studio-mobile.png' });
await writeFile('test-results/matrix.json', JSON.stringify(reports, null, 2));
// Original creatives are shown as they are; their geometry is reported, not enforced.
const failed = reports.filter(r => r.failures.length && !/^[fc]-\d/.test(r.template));
const originalNotes = reports.filter(r => r.failures.length && /^[fc]-\d/.test(r.template));
console.log(
  JSON.stringify(
    {
      viewports: reports.length,
      failed: failed.map(r => ({ template: r.template, size: `${r.w}x${r.h}`, failures: r.failures })),
      pageErrors: errors
    },
    null,
    2
  )
);
await browser.close();
assert.equal(errors.length, 0);
assert.equal(failed.length, 0, 'viewport failures');
