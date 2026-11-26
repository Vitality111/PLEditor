import { launchBrowser } from './launch.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1625, height: 1000 } }),
  errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto('http://127.0.0.1:4173');
  await page.waitForFunction(() => window.studio);
  await page.evaluate(() => window.studio.newFromTemplate('titlecover'));
  await page.locator('#previewState').waitFor({ state: 'hidden' });
  await page.locator('#device').selectOption('320,480');
  await page.locator('#previewZoom').selectOption('1');
  await page.locator('.block-select').filter({ hasText: 'Назва книги' }).click();
  await page.locator('input[type=number][data-prop="block.width"]').fill('70');
  await page.locator('input[type=number][data-prop="block.position.portrait.x"]').fill('12');
  await page.waitForFunction(
    () => window.studio.getProject().blocks.find(b => b.type === 'title').position.portrait.x === 12
  );
  await page.waitForFunction(() => {
    const e = document.querySelector('#preview').contentDocument.querySelector('h1');
    return !!e && parseFloat(getComputedStyle(e).getPropertyValue('--editor-x')) === 12;
  });
  await page.locator('#editPositions').click();
  const frame = page.frameLocator('#preview');
  await frame.locator('body[data-editor-mode="true"]').waitFor();
  const box = await frame.locator('h1').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 34, box.y + box.height / 2, { steps: 10 });
  await frame.locator('[data-guide="x"]').waitFor();
  await page.screenshot({ path: 'test-results/alignment-guides.png' });
  console.log(
    'drag',
    await frame.locator('h1').evaluate(e => ({
      rect: e.getBoundingClientRect().toJSON(),
      x: getComputedStyle(e).getPropertyValue('--editor-x'),
      guides: [...document.querySelectorAll('[data-guide]')].map(g => g.outerHTML)
    }))
  );
  await page.mouse.up();
  await page.waitForFunction(
    () => window.studio.getProject().blocks.find(b => b.type === 'title').position.portrait.x !== 12
  );
  // Dragged 34 px back towards the centre and snapped to a guide (centre or a neighbour's edge).
  assert.ok(
    Math.abs(
      (await page.evaluate(() => window.studio.getProject())).blocks.find(b => b.type === 'title').position
        .portrait.x
    ) < 4
  );
  await page.locator('#landscape').click();
  assert.equal(
    await page.locator('input[type=number][data-prop="block.position.landscape.x"]').inputValue(),
    '0'
  );
  await page.locator('input[type=number][data-prop="block.position.landscape.y"]').fill('5');
  await page.locator('#resetPosition').click();
  assert.equal(
    await page.locator('input[type=number][data-prop="block.position.landscape.y"]').inputValue(),
    '0'
  );
  await page.locator('#portrait').click();
  await page.locator('#editPositions').click();
  const p = await page.evaluate(() => window.studio.getProject());
  const exported = page.waitForEvent('download');
  await page.locator('#export').click();
  await (await exported).saveAs('test-results/compressed-positions.html');
  await page.locator('#exportDialog').waitFor();
  const summary = await page.locator('#exportSummary').textContent();
  const html = await readFile('test-results/compressed-positions.html', 'utf8');
  assert.ok(!html.includes('src="assets/'));
  assert.ok(html.includes('<style>'));
  assert.ok(html.includes('<script>'));
  await page.locator('#closeExport').click();
  // Preview/export keeps a single original centering transform on the CTA.
  await page.evaluate(() => window.studio.newFromTemplate('panel2'));
  await page.locator('#previewState').waitFor({ state: 'hidden' });
  const reader = page.frameLocator('#preview').locator('#reader');
  const bounds = await page
    .frameLocator('#preview')
    .locator('.panel-card')
    .evaluate(el => ({ rect: el.getBoundingClientRect().toJSON(), viewport: [innerWidth, innerHeight] }));
  assert.ok(bounds.rect.left >= 0 && bounds.rect.right <= bounds.viewport[0] + 1);
  await reader.evaluate(el => (el.scrollTop = el.scrollHeight));
  const visibleLast = await page
    .frameLocator('#preview')
    .locator('.story p')
    .last()
    .evaluate(el => ({
      p: el.getBoundingClientRect().toJSON(),
      panel: el.closest('.panel-card').getBoundingClientRect().toJSON()
    }));
  assert.ok(visibleLast.p.bottom <= visibleLast.panel.bottom + 1);
  assert.ok(visibleLast.p.right <= visibleLast.panel.right + 1);
  await reader.evaluate(el => (el.scrollTop = 0));
  await page.screenshot({ path: 'test-results/panel-fixed.png' });
  const d = page.waitForEvent('download');
  await page.locator('#export').click();
  await (await d).saveAs('test-results/compressed-panel.html');
  await page.locator('#exportDialog').waitFor();
  const panelSummary = await page.locator('#exportSummary').textContent();
  const panelHtml = await readFile('test-results/compressed-panel.html', 'utf8');
  assert.ok(panelHtml.includes('data:image/webp;base64,'));
  const preview = await browser.newPage({ viewport: { width: 320, height: 480 } });
  await preview.setContent(panelHtml, { waitUntil: 'load' });
  await preview.evaluate(() => document.fonts.ready);
  assert.equal(
    await preview.locator('.panel-card').evaluate(el => {
      const r = el.getBoundingClientRect();
      return r.left >= 0 && r.right <= innerWidth + 1;
    }),
    true
  );
  await preview.close();
  assert.deepEqual(errors, []);
  await writeFile(
    'test-results/interaction.json',
    JSON.stringify({ summary, panelSummary, panelBounds: bounds, errors }, null, 2)
  );
  console.log({ summary, panelSummary, errors });
} finally {
  await browser.close();
}
