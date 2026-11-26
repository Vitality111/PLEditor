// Renders every built-in composition at key sizes into test-results/screens for visual review.
// Usage: npm start (in another terminal), then `npm run screens [-- template ...]`.
import { mkdir } from 'node:fs/promises';
import { launchBrowser } from './launch.mjs';

const only = process.argv.slice(2);
const sizes = [
  [393, 852],
  [320, 480],
  [430, 932],
  [852, 393],
  [480, 320],
  [932, 430]
];
await mkdir('test-results/screens', { recursive: true });
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto('http://127.0.0.1:4173');
await page.waitForFunction(() => window.studio);
async function pick(product) {
  if (await page.locator('#editor').isVisible()) await page.locator('#newProject').click();
  if (await page.locator('#chooserBack').isVisible()) await page.locator('#chooserBack').click();
  await page.locator(`[data-picker-product="${product}"]`).click();
}
for (const product of ['fiction', 'cleaner']) {
  await pick(product);
  const templates = await page.locator('[data-choose]').evaluateAll(es => es.map(e => e.dataset.choose));
  for (const template of templates) {
    if (only.length && !only.includes(template)) continue;
    if (await page.locator('#editor').isVisible()) await pick(product);
    await page.locator(`[data-choose="${template}"]`).click();
    const html = await page.evaluate(() =>
      window.studio.buildHTML(window.studio.getProject(), window.studio.resolveAssets(), { preview: true })
    );
    for (const [w, h] of sizes) {
      const view = await browser.newPage({ viewport: { width: w, height: h } });
      await view.setContent(html, { waitUntil: 'load' });
      await view.evaluate(() => document.fonts.ready);
      await view.waitForTimeout(150);
      await view.screenshot({ path: `test-results/screens/${template}-${w}x${h}.png` });
      await view.close();
    }
    console.log('rendered', template);
  }
}
await browser.close();
