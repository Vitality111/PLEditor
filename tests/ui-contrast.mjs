// DESIGN.md 2.2: every visible text in the PB interface has enough contrast with what is behind it.
// Walks the main screens and states; fails on any text below 4.5:1 (3:1 for large text).
import assert from 'node:assert/strict';
import { launchBrowser } from './launch.mjs';

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const failures = [];
let checked = 0;

async function audit(state) {
  await page.waitForTimeout(400);
  const res = await page.evaluate(() => {
    const parse = c => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r, g, b, a };
    };
    const over = (top, base) => ({
      r: top.r * top.a + base.r * (1 - top.a),
      g: top.g * top.a + base.g * (1 - top.a),
      b: top.b * top.a + base.b * (1 - top.a),
      a: 1
    });
    const lum = c =>
      [c.r, c.g, c.b]
        .map(v => v / 255)
        .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    // Background behind an element: composite translucent layers down to the first opaque one.
    const background = el => {
      const layers = [];
      for (let n = el; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        const c = parse(cs.backgroundColor);
        if (c && c.a > 0) {
          layers.push(c);
          if (c.a >= 1) break;
        }
      }
      let base = { r: 13, g: 14, b: 17, a: 1 };
      for (const l of layers.reverse()) base = l.a >= 1 ? l : over(l, base);
      return base;
    };
    const out = [];
    let count = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      if (!t.data.trim()) continue;
      const el = t.parentElement;
      if (!el || el.closest('script,style,iframe,option,[hidden],dialog:not([open])')) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      let faded = false;
      for (let n = el; n; n = n.parentElement) if (+getComputedStyle(n).opacity < 0.5) faded = true;
      if (faded || el.closest(':disabled')) continue; // disabled controls are dimmed on purpose
      const fg = parse(cs.color);
      const bg = background(el);
      const value = ratio(fg.a < 1 ? over(fg, bg) : fg, bg);
      const size = parseFloat(cs.fontSize),
        bold = +cs.fontWeight >= 700;
      const need = size >= 24 || (bold && size >= 18.5) ? 3 : 4.5;
      count++;
      if (value < need)
        out.push({
          text: t.data.trim().slice(0, 40),
          ratio: Math.round(value * 100) / 100,
          need,
          color: cs.color,
          el: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className ? '.' + String(el.className).split(' ')[0] : '')
        });
    }
    return { out, count };
  });
  checked += res.count;
  for (const f of res.out) failures.push({ state, ...f });
}

await page.goto('http://127.0.0.1:4173');
await page.waitForFunction(() => window.studio);
await audit('start');
await page.locator('[data-picker-product="fiction"]').click();
await audit('templates');
await page.locator('[data-choose="f-00108"]').click();
await page.waitForFunction(() => window.studio.getProject().template === 'f-00108', null, { timeout: 30000 });
await page.waitForTimeout(1200);
await audit('editor · story');
const cta = await page.evaluate(() => window.studio.getProject().blocks.find(b => /CTA · портрет/.test(b.label)).id);
await page.locator(`[data-select="${cta}"]`).click();
await page.locator(`[data-select="${cta}"]`).hover();
await audit('editor · picture (hovered row)');
await page.locator('[data-inspector="layout"]').click();
await audit('layout tab');
await page.locator('[data-inspector="settings"]').click();
await audit('export tab');
await page.locator('[data-inspector="element"]').click();
await audit('files');
await page.locator('.add-section summary').click();
await audit('add element');
await page.locator('#editPositions').click();
await audit('move and resize');
await page.locator('#editPositions').click();
await page.locator('#modePlay').click();
await audit('test mode');
await page.locator('#modeEdit').click();
const exported = page.waitForEvent('download', { timeout: 60000 });
await page.locator('#export').click();
await exported;
await page.locator('#exportDialog').waitFor();
await audit('export dialog');
await page.locator('#closeExport').click();
await page.locator('#newProject').click();
await audit('start again');

await browser.close();
console.log(JSON.stringify({ textsChecked: checked, failures }, null, 1));
assert.deepEqual(errors, []);
assert.equal(failures.length, 0, 'texts below the contrast norm');
