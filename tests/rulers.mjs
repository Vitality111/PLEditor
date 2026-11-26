import { launchBrowser } from './launch.mjs';
import assert from 'node:assert/strict';
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1625, height: 1000 } }),
  errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto('http://127.0.0.1:4173');
  await page.waitForFunction(() => window.studio);
  await page.evaluate(() => window.studio.newFromTemplate('titlecover'));
  await page.locator('#previewState').waitFor({ state: 'hidden' });
  await page.locator('#editPositions').click();
  await page.locator('#horizontalRuler').waitFor();
  let checked = 0;
  for (const mode of ['portrait', 'landscape'])
    for (const device of ['393,852', '320,480'])
      for (const zoom of ['fit', '0.5', '1']) {
        await page.locator('#' + mode).click();
        await page.locator('#device').selectOption(device);
        await page.locator('#previewZoom').selectOption(zoom);
        const r = await page.evaluate(() => {
          const box = id => document.getElementById(id).getBoundingClientRect().toJSON();
          return {
            shell: box('deviceShell'),
            frame: box('preview'),
            h: box('horizontalRuler'),
            v: box('verticalRuler')
          };
        });
        assert.ok(r.h.bottom <= r.shell.top - 1, 'horizontal ruler above entire phone');
        assert.ok(r.v.right <= r.shell.left - 1, 'vertical ruler left of entire phone');
        assert.ok(Math.abs(r.h.left - r.frame.left) < 1, 'zero corresponds to creative screen');
        assert.ok(Math.abs(r.v.top - r.frame.top) < 1);
        assert.ok(Math.abs(r.h.width - r.frame.width) < 1);
        assert.ok(Math.abs(r.v.height - r.frame.height) < 1);
        assert.equal(await page.frameLocator('#preview').locator('#alignmentHUD').textContent(), '');
        checked++;
      }
  await page.locator('#portrait').click();
  assert.equal(await page.locator('#frameToggle').count(), 0, 'no phone frame');
  await page.locator('#device').selectOption('320,480');
  await page.locator('#previewZoom').selectOption('1');
  await page.screenshot({ path: 'test-results/rulers-outside.png' });
  await page.locator('#editPositions').click();
  assert.equal(await page.locator('#horizontalRuler').isVisible(), false);
  assert.equal(await page.locator('#verticalRuler').isVisible(), false);
  assert.deepEqual(errors, []);
  console.log({ rulerConfigurations: checked, errors });
} finally {
  await browser.close();
}
