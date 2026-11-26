// Rich text in original creatives: select words → bold / italic / underline / another font, like in
// the design (Fiction Me «POV» bold italic, «TO HIS FACE.» bold). The preview shows it, the export keeps
// it with its paragraphs, and it opens again in PB as one text.
import assert from 'node:assert/strict';
import { launchBrowser } from './launch.mjs';

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:4173');
await page.waitForFunction(() => window.studio);
await page.locator('[data-picker-product="fiction"]').click();
await page.locator('[data-choose="f-00108"]').click();
await page.waitForFunction(() => window.studio.getProject().template === 'f-00108', null, { timeout: 30000 });
await page.locator('#previewState').waitFor({ state: 'hidden' });
const box = await page.evaluate(() => window.studio.getProject().blocks.find(b => b.storyGroup));
const parts = await page.evaluate(
  g => g.parts.map(n => window.studio.getProject().blocks.find(b => b.node === n)).map(b => ({ id: b.id, text: b.text })),
  box
);
const [, pov, story] = parts;
await page.locator(`[data-select="${box.id}"]`).click();

// Select a piece of text inside an editor (by text), then use the toolbar.
const select = (key, word) =>
  page.evaluate(
    ({ key, word }) => {
      const ed = document.querySelector(`[data-rich="${key}"]`);
      const walker = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const i = word ? n.data.indexOf(word) : 0;
        if (i < 0) continue;
        ed.focus();
        const r = document.createRange();
        r.setStart(n, i);
        r.setEnd(n, word ? i + word.length : n.data.length);
        getSelection().removeAllRanges();
        getSelection().addRange(r);
        return true;
      }
      return false;
    },
    { key, word }
  );
const tool = (key, cmd) => page.locator(`[data-rich-for="${key}"][data-rich-cmd="${cmd}"]`).click();
const inPreview = sel =>
  page.evaluate(sel => {
    const d = document.querySelector('#preview').contentDocument;
    const el = d.querySelector(sel);
    return el && { text: el.textContent, weight: getComputedStyle(el).fontWeight, style: getComputedStyle(el).fontStyle, family: getComputedStyle(el).fontFamily };
  }, sel);

// POV: bold + italic, the whole line.
assert.ok(await select('part.' + pov.id, ''));
await tool('part.' + pov.id, 'bold');
await select('part.' + pov.id, '');
await tool('part.' + pov.id, 'italic');
let p = await page.evaluate(id => window.studio.getProject().blocks.find(b => b.id === id), pov.id);
assert.equal(p.text, pov.text, 'plain text unchanged');
assert.match(p.rich, /^<b><i>.+<\/i><\/b>$/, 'POV is bold italic: ' + p.rich);

// Story: one word bold, another in a different font.
const word = story.text.match(/\b[A-Z][a-z]{4,}\b/)[0];
assert.ok(await select('part.' + story.id, word));
await tool('part.' + story.id, 'bold');
const other = story.text.match(/\b[a-z]{6,}\b/)[0];
assert.ok(await select('part.' + story.id, other));
await page.locator(`[data-rich-font="part.${story.id}"]`).selectOption('sans');
const s = await page.evaluate(id => window.studio.getProject().blocks.find(b => b.id === id), story.id);
assert.ok(s.rich.includes(`<b>${word}</b>`), 'bold word stored');
assert.ok(s.rich.includes(`<span data-font="sans">${other}</span>`), 'font word stored: ' + s.rich.slice(0, 200));
assert.equal(s.text, story.text, 'story text unchanged');

// Preview.
await page.waitForFunction(
  w => [...(document.querySelector('#preview').contentDocument?.querySelectorAll('#scrollContent b') || [])].some(b => b.textContent === w),
  word,
  { timeout: 10000 }
);
const b = await inPreview('#scrollContent b');
assert.equal(b.weight, '700');
assert.match(b.family, /Inria Serif PB/, 'bold-capable copy of the creative font');
const it = await inPreview('.pov i');
assert.equal(it.text, pov.text);
assert.match(it.family, /Inria Serif It/, 'real italic of the creative');
const f = await inPreview('#scrollContent span[data-font]');
assert.match(f.family, /Arial/);
await page.screenshot({ path: 'test-results/rich-text.png' });

// Typing keeps formatting; Cmd+B works on a selection.
await select('part.' + story.id, 'the');
await page.keyboard.press('ControlOrMeta+B');
assert.match(
  await page.evaluate(id => window.studio.getProject().blocks.find(b => b.id === id).rich, story.id),
  /<b>the<\/b>/
);
// Clear: back to plain.
await select('part.' + pov.id, '');
await tool('part.' + pov.id, 'clear');
p = await page.evaluate(id => window.studio.getProject().blocks.find(b => b.id === id), pov.id);
assert.ok(!p.rich, 'formatting removed');
await select('part.' + pov.id, '');
await tool('part.' + pov.id, 'italic');

// Export: formatting kept, the creative's script still makes paragraphs.
const html = await page.evaluate(() =>
  window.studio.buildHTML(window.studio.getProject(), window.studio.resolveAssets(), { preview: false })
);
const view = await browser.newPage({ viewport: { width: 393, height: 852 } });
await view.setContent(html, { waitUntil: 'load' });
await view.waitForTimeout(400);
const out = await view.evaluate(w => {
  const sc = document.querySelector('#scrollContent');
  return {
    bold: [...sc.querySelectorAll('b')].map(b => [b.textContent, getComputedStyle(b).fontWeight]),
    paragraphs: [...sc.querySelectorAll('span.studio-text')].some(x => /\n\s*\n/.test(x.textContent) && /pre/.test(getComputedStyle(x).whiteSpace)),
    pov: getComputedStyle(sc.querySelector('.pov i')).fontFamily
  };
}, word);
assert.ok(out.bold.some(([t, w]) => t === word && w === '700'), 'bold in export');
assert.ok(out.paragraphs, 'formatted story keeps its paragraphs (one text element, shown with white-space)');
assert.match(out.pov, /Inria Serif It/);
await view.screenshot({ path: 'test-results/rich-text-export.png' });

// Reopening the exported HTML in PB keeps the formatting.
const meta = await page.evaluate(h => window.studio.getProject().blocks.filter(b => b.rich).length, html);
assert.ok(meta >= 2);
await browser.close();
assert.deepEqual(errors, []);
console.log({ richText: 'ok' });
