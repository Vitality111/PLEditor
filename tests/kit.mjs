// Coded templates: start screen flow, coded CTA editing, AI chat animation, timer, export.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { launchBrowser } from './launch.mjs';

await mkdir('test-results', { recursive: true });
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:4173');
await page.waitForFunction(() => window.studio);

// Start screen: product first, then the original creatives from the boards and the own-playable card.
assert.ok(await page.locator('#productPick').isVisible());
assert.equal(await page.locator('#blank').count(), 0);
await page.locator('[data-picker-product="fiction"]').click();
assert.ok(await page.locator('#importPlayable').isVisible(), 'upload card on the template step');
assert.deepEqual(
  await page.locator('[data-choose]').evaluateAll(es => es.map(e => e.dataset.choose)),
  ['f-00108', 'f-00110', 'f-00109', 'f-00112', 'f-00105']
);
await page.screenshot({ path: 'test-results/start-templates.png' });
await page.locator('#chooserBack').click();
await page.locator('[data-picker-product="cleaner"]').click();
assert.deepEqual(
  await page.locator('[data-choose]').evaluateAll(es => es.map(e => e.dataset.choose)),
  ['c-00176', 'c-00175', 'c-00173', 'c-00122-1', 'c-00112', 'c-00122-5', 'c-00101']
);
await page.locator('#chooserBack').click();
await page.locator('[data-picker-product="fiction"]').click();

// An original opens as it is (its own HTML/CSS/JS), as a new creative.
await page.locator('[data-choose="f-00108"]').click();
await page.waitForFunction(() => window.studio.getProject().template === 'f-00108', null, { timeout: 30000 });
const original = await page.evaluate(() => window.studio.getProject());
assert.equal(original.kind, 'html');
assert.equal(original.product, 'fiction');
assert.notEqual(original.naming.number, '00108', 'a new number, not the original');
await page.locator('#previewState').waitFor({ state: 'hidden' });
// The logo leads to the start screen (not an empty list) and back.
await page.locator('#brandHome').click();
assert.ok(await page.locator('#productPick').isVisible(), 'logo opens the product choice');
await page.locator('#cancelChooser').click();
await page.locator('#editor').waitFor();

// The CTA picture becomes a coded button; text and colour are editable, portrait and landscape together.
const ctaBlock = await page.evaluate(() => window.studio.getProject().blocks.find(b => /CTA/.test(b.label || '')).id);
await page.locator(`[data-select="${ctaBlock}"]`).click();
await page.locator('#convertCta').click();
await page.waitForFunction(() => window.studio.getProject().blocks.some(b => b.ctaCode));
const frame = page.frameLocator('#preview');
await frame.locator('.studio-cta').first().waitFor({ state: 'attached' });
await page.locator('input[data-prop="block.ctaCode.text"]').fill('Read More Now');
await page.waitForFunction(() =>
  [...document.querySelector('#preview').contentDocument.querySelectorAll('.studio-cta-label')].some(
    e => e.textContent === 'Read More Now'
  )
);
const coded = (await page.evaluate(() => window.studio.getProject())).blocks.filter(b => b.ctaCode);
assert.ok(coded.every(b => b.ctaCode.text === 'Read More Now'), 'both orientations follow');
await page.screenshot({ path: 'test-results/original-coded-cta.png' });
const exportedOriginal = await page.evaluate(() =>
  window.studio.buildHTML(window.studio.getProject(), window.studio.resolveAssets(), { preview: false })
);
assert.match(exportedOriginal, /studio-cta/);
assert.match(exportedOriginal, /<script/);
const ov = await browser.newPage({ viewport: { width: 393, height: 852 } });
await ov.setContent(exportedOriginal, { waitUntil: 'load' });
const ctaBox = await ov.locator('.studio-cta:visible').first().boundingBox();
assert.ok(ctaBox && ctaBox.height >= 30 && ctaBox.width > ctaBox.height, 'coded button keeps the place');
await ov.screenshot({ path: 'test-results/original-coded-cta-export.png' });
await ov.setViewportSize({ width: 852, height: 393 });
await ov.waitForTimeout(200);
await ov.screenshot({ path: 'test-results/original-coded-cta-export-land.png' });
await ov.close();
// «Повернути картинку» restores the original picture.
await page.locator('#restoreCta').click();
await page.waitForFunction(() => !window.studio.getProject().blocks.some(b => b.ctaCode));

// Builder templates (kept for older projects) still render: coded CTA editing.
await page.evaluate(() => window.studio.newFromTemplate('textbanner'));
await page.locator('#previewState').waitFor({ state: 'hidden' });
await page.locator('.block-select', { hasText: 'Кнопка CTA' }).click();
await page.locator('input[data-prop="block.text"]').fill('CLEAN NOW');
await page.waitForFunction(() => {
  const d = document.querySelector('#preview').contentDocument;
  return d?.querySelector('#cta')?.textContent.includes('CLEAN NOW');
});

// AI chat: start button → typed answer → CTA, in the exported runtime.
await page.evaluate(() => window.studio.newFromTemplate('aichat'));
await page.locator('#previewState').waitFor({ state: 'hidden' });
const html = await page.evaluate(() =>
  window.studio.buildHTML(window.studio.getProject(), window.studio.resolveAssets(), { preview: false })
);
const view = await browser.newPage({ viewport: { width: 393, height: 852 } });
const viewErrors = [];
view.on('pageerror', e => viewErrors.push(e.message));
await view.setContent(html, { waitUntil: 'load' });
assert.equal(await view.locator('.chat-cta').isVisible(), false, 'CTA waits for the answer');
await view.locator('#chatStart').click({ force: true });
await view.waitForFunction(() => document.getElementById('stage').classList.contains('chat-done'), null, {
  timeout: 15000
});
assert.ok(await view.locator('.chat-cta .cta').isVisible(), 'CTA after the answer');
assert.match(await view.locator('.bubble.answer').textContent(), /CleanUp app/);
await view.screenshot({ path: 'test-results/aichat-done.png' });

// Switching AI chat → text banner keeps the text but hides the chat; hiding the chat shows the CTA.
await page.locator('#changeLayout').click();
await page.evaluate(() => {
  // «Змінити композицію» lists originals only for new creatives; switch through the hidden builder list.
  document.querySelector('#compositionGrid').insertAdjacentHTML('beforeend', '<button data-choose="textbanner">x</button>');
});
await page.locator('[data-choose="textbanner"]').click();
const switched = await page.evaluate(() => window.studio.getProject());
assert.equal(switched.blocks.find(b => b.type === 'chat').enabled, false, 'chat kept but hidden');
await page.locator('#undo').click();
const noChat = await page.evaluate(() => {
  const p = window.studio.getProject();
  p.blocks.find(b => b.type === 'chat').enabled = false;
  return window.studio.buildHTML(p, window.studio.resolveAssets(), { preview: false });
});
await view.setContent(noChat, { waitUntil: 'load' });
assert.ok(await view.locator('.chat-cta .cta').isVisible(), 'CTA visible without the chat');

// Preview can show the chat state for editing.
await page.locator('.block-select', { hasText: 'Чат' }).click();
await page.locator('select[data-prop="settings.previewChat"]').selectOption('chat');
await page.waitForFunction(() =>
  document.querySelector('#preview').contentDocument?.getElementById('stage')?.classList.contains('chat-done')
);

// Timer counts down.
await page.evaluate(() => window.studio.newFromTemplate('alertphoto'));
await page.locator('#previewState').waitFor({ state: 'hidden' });
await page
  .locator('.block-select', { hasText: 'Таймер' })
  .locator('xpath=..')
  .locator('[data-visible]')
  .click();
const timerHtml = await page.evaluate(() =>
  window.studio.buildHTML(window.studio.getProject(), window.studio.resolveAssets(), { preview: false })
);
await view.setContent(timerHtml, { waitUntil: 'load' });
const t0 = await view.locator('.k-timer').textContent();
await view.waitForTimeout(1300);
assert.notEqual(await view.locator('.k-timer').textContent(), t0, 'timer ticks');

// Export of a coded template is a single HTML under 5 MB with the coded button.
const dl = page.waitForEvent('download', { timeout: 60000 });
await page.locator('#export').click();
const file = await dl;
await file.saveAs('test-results/kit-export.html');
const exported = await readFile('test-results/kit-export.html', 'utf8');
assert.ok(exported.length < 5_000_000);
assert.match(exported, /id="cta"/);
assert.match(exported, /data-timer=/);

assert.deepEqual([...errors, ...viewErrors], []);
console.log({ kit: 'ok', errors });
await browser.close();
