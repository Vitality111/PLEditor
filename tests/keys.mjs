// Keyboard hints in the keys of the user's computer: ⌘ ⇧ ⌥ on a Mac, Ctrl / Shift / Alt elsewhere.
import assert from 'node:assert/strict';
import { launchBrowser } from './launch.mjs';
const browser = await launchBrowser();
for (const mac of [true, false]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => console.log('ERR', e.message));
  if (mac) await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'MacIntel' });
    Object.defineProperty(Navigator.prototype, 'userAgentData', { get: () => ({ platform: 'macOS' }) });
  });
  await page.goto('http://127.0.0.1:4173');
  await page.waitForFunction(() => window.studio);
  await page.locator('[data-picker-product="fiction"]').click();
  await page.locator('[data-choose="f-00108"]').click();
  await page.waitForFunction(() => window.studio.getProject().template === 'f-00108', null, { timeout: 30000 });
  const t = [
    await page.locator('#undo').getAttribute('title'),
    await page.locator('#redo').getAttribute('title'),
    await page.locator('[data-rich-cmd="bold"]').first().getAttribute('title'),
    await page.locator('#screenshot').getAttribute('title')
  ];
  if (mac) {
    assert.deepEqual(t.slice(0, 3), ['Скасувати (⌘Z)', 'Повторити (⌘⇧Z)', 'Жирний (⌘B)']);
    assert.match(t[3], /⌘V/);
  } else {
    assert.deepEqual(t.slice(0, 3), ['Скасувати (Ctrl+Z)', 'Повторити (Ctrl+Shift+Z)', 'Жирний (Ctrl+B)']);
    assert.match(t[3], /Ctrl\+V/);
  }
  assert.ok(!t.join(' ').includes('Cmd/Ctrl'), 'no mixed hints');
  await page.close();
}
await browser.close();
console.log({ keys: 'ok' });
