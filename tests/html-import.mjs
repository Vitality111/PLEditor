import { launchBrowser, playableAdsRoot } from './launch.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { zipSync, strToU8 } from 'fflate';
const bytes = await readFile('app/assets/cleaner/mcp.png'),
  data = 'data:image/png;base64,' + bytes.toString('base64');
const fixture = `<!doctype html><html><head><style>html,body{margin:0;height:100%;font-family:Arial}.scene{position:fixed;inset:0;background:#eef5ff}h1{pointer-events:none;text-align:center;font-size:25px;margin:20px}img{position:absolute;width:40%;left:50%;top:28%}button{position:absolute;left:30%;width:40%;bottom:10%;height:50px}</style></head><body><div class="scene"><h1 data-block="originalHeading" data-type="headline">Original <strong>title</strong></h1><div class="reader" style="height:80px"><div class="copy" style="pointer-events:none">Nested <span>body</span><br>text</div></div><img style="translate:-50% 0" src="${data}"><button id="cta" data-block="originalCTA">Continue</button></div><script>window.originalScript=true;document.getElementById('cta').addEventListener('click',()=>document.body.dataset.clicked='yes')</script></body></html>`;
await writeFile('test-results/import-fixture.html', fixture);
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1625, height: 1000 } }),
  errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto('http://127.0.0.1:4173');
  await page.waitForFunction(() => window.studio);
  await page.locator('#playableInput').setInputFiles('test-results/import-fixture.html');
  await page.waitForFunction(() => window.studio.getProject().kind === 'html');
  await page.waitForFunction(() => {
    const p = window.studio.getProject();
    return !!document
      .querySelector('#preview')
      .contentDocument?.querySelector(
        '[' + (p.kind === 'html' ? 'data-studio-block' : 'data-block') + '="' + p.blocks[0].id + '"]'
      );
  });
  await page.locator('#previewState').waitFor({ state: 'hidden' });
  const frame = page.frameLocator('#preview');
  assert.equal(await frame.locator('h1').textContent(), 'Original title');
  assert.equal(await frame.locator('h1').getAttribute('data-block'), 'originalHeading');
  assert.equal(await frame.locator('h1').getAttribute('data-type'), 'headline');
  assert.equal(await frame.locator('script').count(), 0);
  assert.ok(
    await page.evaluate(() =>
      window.studio.getProject().blocks.some(b => b.type === 'text' && b.text.startsWith('Nested body'))
    ),
    'mixed inline text inventoried as one editable block'
  );
  const copyPoint = await page.evaluate(() => {
    const f = document.querySelector('#preview'),
      outer = f.getBoundingClientRect(),
      r = f.contentDocument.querySelector('.copy').getBoundingClientRect();
    return {
      x: outer.left + ((r.left + 10) * outer.width) / f.contentWindow.innerWidth,
      y: outer.top + ((r.top + 10) * outer.height) / f.contentWindow.innerHeight
    };
  });
  await page.mouse.click(copyPoint.x, copyPoint.y);
  await page.locator('[data-rich="block"]').waitFor();
  assert.match(
    await page.locator('[data-rich="block"]').innerText(),
    /^Nested body/,
    'preview selects pointer-disabled text before reader captures pointer'
  );
  await page.locator('[data-inspector="layout"]').click();
  assert.equal(await page.locator('#inspectorBody h3').textContent(), 'Оформлення');
  assert.equal(await page.locator('#importStyleElement').count(), 1);
  assert.equal(await page.locator('[data-prop="settings.compressImages"]').count(), 0);
  await page.locator('input[type=number][data-prop="block.customStyle.portrait.fontSize"]').fill('22');
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector('#preview').contentDocument.querySelector('.copy')).fontSize ===
      '22px'
  );
  await page.locator('#landscape').click();
  await page.locator('#portrait').click();
  await page.locator('[data-inspector="settings"]').click();
  assert.equal(await page.locator('#inspectorBody h3').textContent(), 'Експорт');
  assert.equal(await page.locator('#exportOne').count(), 1);
  assert.equal(await page.locator('#importStyleElement').count(), 0);
  await page.locator('#previewZoom').selectOption('1');
  const titleBox = await frame.locator('h1').boundingBox();
  await page.mouse.click(titleBox.x + titleBox.width / 2, titleBox.y + titleBox.height / 2);
  assert.equal(await page.locator('[data-rich="block"]').innerText(), 'Original title');
  await page.locator('.block-select').filter({ hasText: 'Original title' }).click();
  await page.locator('[data-rich="block"]').fill('Edited title');
  await frame.locator('h1').filter({ hasText: 'Edited title' }).waitFor();
  assert.equal(await frame.locator('h1 strong').textContent(), 'title', 'nested text formatting preserved');
  await page.locator('input[type=number][data-prop="block.position.portrait.x"]').fill('5');
  await page.locator('.block-select').filter({ hasText: 'Зображення' }).click();
  const choose = page.waitForEvent('filechooser');
  await page.locator('[data-upload="block.asset"]').click();
  await (await choose).setFiles('app/assets/fcm-shrink/hero.png');
  await page.waitForFunction(
    () => document.querySelector('#preview').contentDocument.querySelector('img').naturalWidth === 760
  );
  await page.locator('input[type=number][data-prop="block.position.portrait.x"]').fill('7');
  await page.waitForFunction(() => {
    const img = document.querySelector('#preview').contentDocument.querySelector('img');
    return parseFloat(getComputedStyle(img).getPropertyValue('--studio-x')) === 7;
  });
  const imageRect = await frame.locator('img').evaluate(e => e.getBoundingClientRect().toJSON());
  assert.ok(
    Math.abs(imageRect.left - 393 * 0.37) < 2,
    'import preserves original inline centering when adding offsets'
  );
  await page.screenshot({ path: 'test-results/imported-editor.png' });
  await page.locator('[data-inspector="settings"]').click();
  const htmlDownload = page.waitForEvent('download');
  await page.locator('#exportOne').click();
  await (await htmlDownload).saveAs('test-results/import-edited.html');
  await page.locator('#closeExport').click();
  const output = await readFile('test-results/import-edited.html', 'utf8');
  assert.ok(output.includes('Edited title'));
  assert.ok(output.includes('originalScript'));
  assert.ok(output.includes('playable-studio-state'));
  const creative = await browser.newPage({ viewport: { width: 393, height: 852 } });
  await creative.setContent(output, { waitUntil: 'load' });
  assert.equal(await creative.evaluate(() => window.originalScript), true);
  await creative.locator('#cta').click();
  assert.equal(await creative.locator('body').getAttribute('data-clicked'), 'yes');
  await creative.close();
  await page.locator('#playableInput').setInputFiles('test-results/import-edited.html');
  await page.waitForFunction(
    () =>
      window.studio.getProject().name === 'import-fixture' &&
      // the moved title keeps its offset, or is tied to its neighbour when the file opens
      (window.studio.getProject().blocks.find(b => b.text === 'Edited title')?.position.portrait.x === 5 ||
        !!window.studio.getProject().blocks.find(b => b.text === 'Edited title')?.anchor?.portrait?.node)
  );
  await page.waitForFunction(() => {
    const p = window.studio.getProject();
    return !!document
      .querySelector('#preview')
      .contentDocument?.querySelector(
        '[' + (p.kind === 'html' ? 'data-studio-block' : 'data-block') + '="' + p.blocks[0].id + '"]'
      );
  });
  await page.locator('#previewState').waitFor({ state: 'hidden' });
  // Production ZIP: source HTML + CSS + JS + assets, excluding every test folder.
  const root = path.resolve(playableAdsRoot, 'cleaner/00159/1'),
    files = {};
  async function collect(dir) {
    for (const f of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, f.name);
      if (f.isDirectory()) await collect(full);
      else files[path.relative(root, full).replaceAll('\\', '/')] = new Uint8Array(await readFile(full));
    }
  }
  await collect(root);
  await writeFile('test-results/production-playable.zip', zipSync(files));
  await page.locator('#playableInput').setInputFiles('test-results/production-playable.zip');
  await page.waitForFunction(() => window.studio.getProject().name.startsWith('00159'));
  await page.waitForFunction(() => {
    const p = window.studio.getProject();
    return !!document
      .querySelector('#preview')
      .contentDocument?.querySelector(
        '[' + (p.kind === 'html' ? 'data-studio-block' : 'data-block') + '="' + p.blocks[0].id + '"]'
      );
  });
  await page.locator('#previewState').waitFor({ state: 'hidden' });
  assert.ok((await frame.locator('img').count()) >= 4);
  assert.equal(await frame.locator('img').evaluateAll(es => es.every(e => e.naturalWidth > 0)), true);
  await page.screenshot({ path: 'test-results/imported-production.png' });
  // Paragraphs are edited as a complete story, including stored imports from before grouping.
  const storyHTML =
    '<html><head><style>body{margin:0}.story{width:90%;padding:10px}p{font:18px Arial;color:#222}</style></head><body><div class="story"><p>First <br><strong>bold</strong> paragraph.</p><p>Second paragraph.</p></div><button>Continue</button></body></html>';
  await writeFile('test-results/grouped-story.html', storyHTML);
  await page.locator('#playableInput').setInputFiles('test-results/grouped-story.html');
  await page.waitForFunction(() => window.studio.getProject().name === 'grouped-story');
  await page.locator('#previewState').waitFor({ state: 'hidden' });
  await page.locator('#previewZoom').selectOption('1');
  assert.equal(await page.locator('.block-select').filter({ hasText: 'Весь текст' }).count(), 1);
  assert.equal(await page.locator('.block-select').filter({ hasText: 'Текст · First' }).count(), 0);
  await frame.locator('.story p').nth(1).click();
  assert.equal(
    await page.locator('[data-rich="block"]').innerText(),
    'First bold paragraph.\n\nSecond paragraph.'
  );
  const visibleBounds = await frame.locator('button').evaluate(e => e.getBoundingClientRect().toJSON());
  await page.locator('input[data-prop="block.enabled"]').uncheck();
  await page.locator('#previewState').waitFor({ state: 'hidden' });
  await page.waitForTimeout(150);
  const hiddenBounds = await frame.locator('button').evaluate(e => e.getBoundingClientRect().toJSON());
  assert.equal(hiddenBounds.top, visibleBounds.top, 'hiding imported story preserves CTA position');
  assert.ok(
    (await frame.locator('.story').evaluate(e => e.getBoundingClientRect().height)) > 0,
    'hidden imported story retains layout space'
  );
  assert.equal(await frame.locator('.story').evaluate(e => getComputedStyle(e).opacity), '0');
  const hiddenHTML = await page.evaluate(() =>
    window.studio.buildHTML(window.studio.getProject(), window.studio.getAssets())
  );
  const hiddenExport = await browser.newPage({ viewport: { width: 393, height: 852 } });
  await hiddenExport.setContent(hiddenHTML);
  assert.equal(
    await hiddenExport.locator('button').evaluate(e => e.getBoundingClientRect().top),
    visibleBounds.top,
    'export preserves hidden story layout too'
  );
  assert.equal(await hiddenExport.locator('.story').evaluate(e => getComputedStyle(e).opacity), '0');
  await hiddenExport.close();
  await page.screenshot({ path: 'test-results/hidden-story-editor.png' });
  await page.locator('#inspectorBody [data-visible]').click();
  await page.locator('#previewState').waitFor({ state: 'hidden' });
  await frame.locator('.story').waitFor();
  assert.equal(await page.locator('input[data-prop="block.enabled"]').isChecked(), true);
  const legacy = await page.evaluate(() => {
    const p = window.studio.getProject();
    p.blocks = p.blocks.filter(b => !b.textGroup);
    p.blocks.find(b => b.text === 'First bold paragraph.').text = 'Legacy bold paragraph.';
    return { format: 'playable-studio', version: 1, project: p, assets: {} };
  });
  await writeFile('test-results/legacy-story.json', JSON.stringify(legacy));
  await page.locator('#jsonInput').setInputFiles('test-results/legacy-story.json');
  await page.waitForTimeout(500);
  await page.locator('#previewState').waitFor({ state: 'hidden' });
  await frame.locator('.story p').first().click();
  assert.equal(
    await page.locator('[data-rich="block"]').innerText(),
    'Legacy bold paragraph.\n\nSecond paragraph.'
  );
  await page.locator('#previewState').waitFor({ state: 'hidden' });
  await page.locator('#previewZoom').selectOption('1');
  await frame.locator('.story p').first().click();
  assert.match(await page.locator('[data-rich="block"]').innerText(), /^Legacy bold/);
  await page
    .locator('[data-rich="block"]')
    .fill('Legacy edited bold paragraph.\n\nSecond paragraph.\n\nThird added.');
  await frame.locator('.story p').nth(2).waitFor();
  assert.equal(await frame.locator('.story strong').textContent(), 'bold');
  await page.locator('input[type=number][data-prop="block.customStyle.portrait.fontSize"]').fill('24');
  await page.waitForFunction(() =>
    [...document.querySelector('#preview').contentDocument.querySelectorAll('.story p')].every(
      e => getComputedStyle(e).fontSize === '24px'
    )
  );
  await page.screenshot({ path: 'test-results/whole-story-editor.png' });
  const groupDownload = page.waitForEvent('download');
  await page.locator('#export').click();
  await (await groupDownload).saveAs('test-results/grouped-export.html');
  await page.locator('#closeExport').click();
  await page.locator('#playableInput').setInputFiles('test-results/grouped-export.html');
  await page.waitForTimeout(500);
  await page.locator('#previewState').waitFor({ state: 'hidden' });
  await frame.locator('.story p').nth(2).click();
  assert.equal(
    await page.locator('[data-rich="block"]').innerText(),
    'Legacy edited bold paragraph.\n\nSecond paragraph.\n\nThird added.'
  );
  await page.locator('[data-rich="block"]').fill('One paragraph.');
  await page.waitForFunction(
    () => document.querySelector('#preview').contentDocument.querySelectorAll('.story p').length === 1
  );
  await page
    .locator('[data-rich="block"]')
    .fill('Bright future fell apart.\nI\nhad lost my mate.\n\nSecond paragraph.');
  await page.waitForFunction(
    () => document.querySelector('#preview').contentDocument.querySelectorAll('.story p').length === 2
  );
  assert.equal(
    await frame.locator('.story p').first().textContent(),
    'Bright future fell apart. I had lost my mate.'
  );
  assert.equal(await frame.locator('.story br').count(), 0);
  assert.equal(
    await frame
      .locator('.story p')
      .first()
      .evaluate(e => getComputedStyle(e).whiteSpace),
    'normal'
  );
  // Native round-trip keeps the original builder's template, not a generic HTML approximation.
  await page.locator('#newProject').click();
  await page.evaluate(() => window.studio.newFromTemplate('panel2'));
  await page.waitForFunction(() => {
    const p = window.studio.getProject();
    return !!document
      .querySelector('#preview')
      .contentDocument?.querySelector(
        '[' + (p.kind === 'html' ? 'data-studio-block' : 'data-block') + '="' + p.blocks[0].id + '"]'
      );
  });
  await page.locator('#previewState').waitFor({ state: 'hidden' });
  await page.locator('.block-select').filter({ hasText: 'Історія' }).click();
  await page
    .locator('textarea[data-prop="block.text"]')
    .fill('Bright future fell apart.\nI\nhad lost my mate.\n\nSecond paragraph.');
  await page.waitForFunction(
    () => document.querySelector('#preview').contentDocument.querySelectorAll('.story p').length === 2
  );
  assert.equal(await frame.locator('.story br').count(), 0);
  assert.equal(
    await frame.locator('.story p').first().textContent(),
    'Bright future fell apart. I had lost my mate.'
  );
  const nativeDownload = page.waitForEvent('download');
  await page.locator('#export').click();
  await (await nativeDownload).saveAs('test-results/native-roundtrip.html');
  await page.locator('#closeExport').click();
  await page.locator('#playableInput').setInputFiles('test-results/native-roundtrip.html');
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => window.studio.getProject().template), 'panel2');
  assert.equal(await page.evaluate(() => window.studio.getProject().kind), undefined);
  assert.deepEqual(errors, []);
  console.log({
    htmlEditing: true,
    originalScriptPreserved: true,
    htmlRoundtrip: true,
    productionZIP: true,
    nativeRoundtrip: true,
    errors
  });
} finally {
  await browser.close();
}
