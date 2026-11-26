// Tutorial: from the «Туторіал» button — on the start screen it opens a Fiction Me creative and shows
// the editor on it; every step lights a part of the screen; Esc / «Пропустити» close it.
import assert from 'node:assert/strict';
import { launchBrowser } from './launch.mjs';

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:4173');
await page.waitForFunction(() => window.studio);
assert.equal(await page.locator('.tour').count(), 0, 'no tour by itself under automation');

// Start screen: the tour opens a calm Fiction Me creative by itself and shows the editor on it.
await page.locator('#tourBtn').click();
await page.waitForFunction(() => window.studio.getProject().template === 'f-00108', null, { timeout: 30000 });
await page.locator('.tour').waitFor({ timeout: 10000 });
assert.equal(await page.evaluate(() => window.studio.getProject().product), 'fiction');
// The creative stands still while the tour runs.
await page.waitForTimeout(500);
assert.ok(
  await page.evaluate(() => !!document.querySelector('#preview').contentDocument.getElementById('tour-pause')),
  'preview animations paused'
);

// Every step: a title, a lit part of the screen inside the window, the card inside the window.
const seen = [];
for (let i = 0; i < 20 && (await page.locator('.tour').count()); i++) {
  await page.waitForTimeout(450);
  const s = await page.evaluate(() => {
    const spot = document.querySelector('.tour-spot').getBoundingClientRect(),
      card = document.querySelector('.tour-card').getBoundingClientRect();
    return {
      title: document.querySelector('.tour-title').textContent,
      lit: !document.querySelector('.tour-spot').classList.contains('none'),
      spot: spot.width > 0 && spot.left >= 0 && spot.right <= innerWidth && spot.top >= 0 && spot.bottom <= innerHeight,
      card: card.left >= 0 && card.right <= innerWidth && card.top >= 0 && card.bottom <= innerHeight
    };
  });
  seen.push(s.title);
  assert.ok(s.card, `card on screen: ${s.title}`);
  if (s.lit) assert.ok(s.spot, `lit part on screen: ${s.title}`);
  await page.locator('.tour-next').click();
}
assert.ok(seen.length >= 12, 'tour steps: ' + seen.join(' | '));
assert.ok(seen.includes('Тест') && seen.includes('Експорт HTML') && seen.includes('Скріншот'));
assert.equal(await page.locator('.tour').count(), 0, 'finished');
assert.equal(await page.locator('[data-inspector="element"].active').count(), 1, 'back on the element tab');
assert.ok(
  await page.evaluate(() => !document.querySelector('#preview').contentDocument.getElementById('tour-pause')),
  'animations run again after the tour'
);

// Again from the button; Esc closes.
await page.locator('#tourBtn').click();
await page.locator('.tour').waitFor();
await page.keyboard.press('ArrowRight');
await page.keyboard.press('Escape');
await page.locator('.tour').waitFor({ state: 'detached' });
await browser.close();
assert.deepEqual(errors, []);
console.log({ tour: 'ok', steps: seen.length });
