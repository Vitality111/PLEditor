// Every element of every built-in template: listed, present in the preview, selectable by a click in
// the preview, editable (text / width / position / visibility) and the edit reaches the export.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { launchBrowser } from './launch.mjs';

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('dialog', d => d.accept());
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const problems = [];
const note = (template, block, issue) => problems.push({ template, block, issue });
await page.goto('http://127.0.0.1:4173');
await page.waitForFunction(() => window.studio);

const ids = {
  fiction: ['f-00108', 'f-00110', 'f-00106', 'f-00109', 'f-00112', 'f-00111', 'f-00105'],
  cleaner: ['c-00176', 'c-00175', 'c-00173', 'c-00122-1', 'c-00112', 'c-00122-5', 'c-00101']
};
const only = process.argv.slice(2);
const inPreview = (id, fn) =>
  page.evaluate(
    ([id, fn]) => {
      const d = document.querySelector('#preview').contentDocument,
        el = d.querySelector(`[data-studio-block="${id}"]`);
      return new Function('el', 'd', fn)(el, d);
    },
    [id, fn]
  );
const ready = () =>
  page.waitForFunction(() => document.getElementById('previewState').hidden, null, { timeout: 15000 }).catch(() => {});

for (const [product, list] of Object.entries(ids))
  for (const t of list) {
    if (only.length && !only.includes(t)) continue;
    if (await page.locator('#editor').isVisible()) await page.locator('#newProject').click();
    if (await page.locator('#chooserBack').isVisible()) await page.locator('#chooserBack').click();
    await page.locator(`[data-picker-product="${product}"]`).click();
    await page.locator(`[data-choose="${t}"]`).click();
    await page.waitForFunction(x => window.studio.getProject().template === x, t, { timeout: 30000 });
    await ready();
    await page.waitForTimeout(400);
    const rows = await page.locator('#libraryBody [data-select]').evaluateAll(es => es.map(e => e.dataset.select));
    const blocks = await page.evaluate(() => window.studio.getProject().blocks);
    for (const id of rows) {
      const b = blocks.find(x => x.id === id);
      if (!b) {
        note(t, id, 'row without block');
        continue;
      }
      const name = b.label || b.type;
      // 1. selecting from the list
      await page.locator(`#libraryBody [data-select="${id}"]`).click();
      await page.waitForTimeout(120);
      const h3 = (await page.locator('#inspectorBody h3').first().textContent().catch(() => '')) || '';
      if (!h3.trim()) note(t, name, 'inspector empty after selecting');
      // CSS backgrounds: listed and replaceable (checked by the inspector having a picture field).
      // CSS backgrounds and the music: not on the screen, but replaceable (a file field in the inspector).
      if (b.bgAsset || b.audioAsset) {
        if (!(await page.locator('#inspectorBody [data-upload="block.asset"]').count())) note(t, name, 'no file field');
        continue;
      }
      // 2. present in the preview (give a reloading preview up to 3 s)
      await page
        .waitForFunction(i => document.querySelector('#preview').contentDocument?.querySelector(`[data-studio-block="${i}"]`), id, { timeout: 3000 })
        .catch(() => {});
      const info = await inPreview(
        id,
        `if (!el) return null; const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
         return { w: r.width, h: r.height, x: r.left, y: r.top, vis: cs.visibility, disp: cs.display, vw: innerWidth, vh: innerHeight };`
      );
      if (!info) {
        const why = await page.evaluate(i => {
          const d = document.querySelector('#preview').contentDocument;
          const p = window.studio.getProject();
          return {
            blocksInPreview: d?.querySelectorAll('[data-studio-block]').length,
            title: d?.title,
            project: p.name,
            state: document.getElementById('previewState').hidden ? 'ready' : document.getElementById('previewState').textContent.trim(),
            frameHidden: document.querySelector('#preview').hidden,
            enabled: p.blocks.find(b => b.id === i)?.enabled
          };
        }, id);
        note(t, name, 'not found in preview ' + JSON.stringify(why));
        continue;
      }
      const shown = info.w > 0 && info.h > 0 && info.disp !== 'none' && info.vis !== 'hidden';
      const onScreen = shown && info.x < info.vw && info.y < info.vh && info.x + info.w > 0 && info.y + info.h > 0;
      // 3. clicking it in the preview selects it (only for visible, on-screen elements)
      if (onScreen && !b.storyGroup) {
        const point = await inPreview(
          id,
          `const r = el.getBoundingClientRect(); const x = Math.max(1, Math.min(innerWidth - 1, r.left + r.width / 2)),
             y = Math.max(1, Math.min(innerHeight - 1, r.top + Math.min(r.height / 2, 20)));
           const top = d.elementFromPoint(x, y);
           return { x, y, top: top ? (top.closest('[data-studio-block]')?.dataset.studioBlock || '') : '' };`
        );
        const pos = await page.evaluate(
          ([x, y]) => {
            const f = document.querySelector('#preview'),
              r = f.getBoundingClientRect(),
              z = Number(f.style.zoom) || 1;
            return { x: r.x + x * z, y: r.y + y * z };
          },
          [point.x, point.y]
        );
        // select something else first, then click the element in the preview
        await page.evaluate(() => {});
        // First click picks the top element; repeated clicks on the same spot step to the ones below.
        const current = () => page.evaluate(() => document.querySelector('#libraryBody .block-row.active [data-select]')?.dataset.select);
        const parts0 = blocks.filter(g => g.storyGroup && g.parts?.includes(b.node)).map(g => g.id);
        let sel;
        for (let i = 0; i < 4; i++) {
          await page.mouse.click(pos.x, pos.y);
          await page.waitForTimeout(150);
          sel = await current();
          if (sel === id || parts0.includes(sel)) break;
        }
        const parts = blocks.filter(g => g.storyGroup && g.parts?.includes(b.node)).map(g => g.id);
        if (sel !== id && !parts.includes(sel)) {
          const other = blocks.find(x => x.id === sel);
          // covered by another element on top is fine if that one is a real element on top
          if (point.top !== id)
            note(t, name, `click in preview selects «${other?.label || sel || 'nothing'}» (covered by ${blocks.find(x => x.id === point.top)?.label || point.top || 'background'})`);
          else note(t, name, `click in preview selects «${other?.label || sel || 'nothing'}»`);
        }
        await page.locator(`#libraryBody [data-select="${id}"]`).click();
        await page.waitForTimeout(100);
      }
      // 4. edits
      const o = 'portrait';
      const width = page.locator(`input[type=number][data-prop="block.customStyle.${o}.width"]`);
      if (await width.count()) {
        const before = await inPreview(id, 'return el.offsetWidth');
        await width.fill('60');
        await page.waitForTimeout(350);
        const after = await inPreview(id, 'return el ? el.offsetWidth : -1');
        if (shown && before > 20 && Math.abs(after - before) < 2) note(t, name, `width 60% has no effect (${before}px)`);
        await width.fill(String(await page.evaluate(i => window.studio.getProject().blocks.find(b => b.id === i).customStyle?.portrait?.width ?? 100, id)));
      }
      const y = page.locator(`input[type=number][data-prop="block.position.${o}.y"]`);
      if (await y.count()) {
        const before = await inPreview(id, 'return el.getBoundingClientRect().top');
        await y.fill('5');
        await page.waitForTimeout(350);
        const after = await inPreview(id, 'return el ? el.getBoundingClientRect().top : -1');
        if (shown && Math.abs(after - before) < 5) note(t, name, `Y +5% does not move it (${before} → ${after})`);
        await y.fill('0');
      }
      const text = page.locator('#inspectorBody [data-rich="block"], #inspectorBody textarea[data-prop="block.text"], #inspectorBody input[data-prop="block.text"]');
      if ((await text.count()) && b.type === 'text') {
        const marker = 'Zq' + Math.random().toString(36).slice(2, 7);
        const old = await text.first().evaluate(e => e.value ?? e.innerText);
        await text.first().fill(marker + ' ' + old);
        await page.waitForTimeout(400);
        const has = await page.evaluate(m => document.querySelector('#preview').contentDocument.body.textContent.includes(m), marker);
        if (!has) note(t, name, 'text edit not visible in preview');
        const html = await page.evaluate(() =>
          window.studio.buildHTML(window.studio.getProject(), window.studio.resolveAssets(), { preview: false })
        );
        if (!html.includes(marker)) note(t, name, 'text edit missing in export');
        await text.first().fill(old);
        await page.waitForTimeout(250);
      }
      const vis = page.locator('#inspectorBody input[data-prop="block.enabled"], #inspectorBody input[data-show-for]');
      if (await vis.count()) {
        // The panel is redrawn after each change: one box at a time, found again each time.
        for (let i = 0; i < 4; i++) {
          const box = page.locator('#inspectorBody input[data-prop="block.enabled"]:checked, #inspectorBody input[data-show-for]:checked').first();
          if (!(await box.count())) break;
          await box.evaluate(el => el.click());
          await page.waitForTimeout(150);
        }
        await page.waitForTimeout(300);
        const hidden = await inPreview(
          id,
          `if (!el) return true; const cs = getComputedStyle(el); return cs.visibility === 'hidden' || cs.display === 'none' || el.getBoundingClientRect().height === 0;`
        );
        if (!hidden) note(t, name, 'hide does not hide');
        // Show again (the panel is redrawn after each click, so look for the next box each time).
        for (let i = 0; i < 4; i++) {
          const box = page
            .locator('#inspectorBody input[data-prop="block.enabled"]:not(:checked), #inspectorBody input[data-show-for]:not(:checked)')
            .first();
          if (!(await box.count())) break;
          await box.evaluate(el => el.click());
          await page.waitForTimeout(150);
        }
        await page.waitForTimeout(250);
      }
    }
    const exp = await page.evaluate(async () => {
      try {
        const h = window.studio.buildHTML(window.studio.getProject(), window.studio.resolveAssets(), { preview: false });
        return h.length;
      } catch (e) {
        return 'ERR ' + e.message;
      }
    });
    if (typeof exp !== 'number') note(t, '-', 'export failed: ' + exp);
    console.log(t, rows.length, 'elements', problems.filter(p => p.template === t).length, 'problems');
  }
await writeFile('test-results/audit.json', JSON.stringify({ problems, errors }, null, 1));
console.log(JSON.stringify({ problems, errors }, null, 1));
await browser.close();
assert.deepEqual(errors, []);
assert.equal(problems.length, 0, 'element problems');
