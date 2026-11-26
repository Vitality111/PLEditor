// Long session: hundreds of random editor actions in a row (seeded, reproducible), checking after each
// one that nothing broke — no page errors, the selected element is in the panel and in the preview,
// every visible element of the project is in the preview, export still builds.
// Usage: node tests/fuzz.mjs [seed] [actions]
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { launchBrowser } from './launch.mjs';

const seed = Number(process.argv[2] || 1),
  total = Number(process.argv[3] || 250);
let state = seed;
const rnd = () => ((state = (state * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = a => a[Math.floor(rnd() * a.length)];
const int = (a, b) => Math.floor(a + rnd() * (b - a + 1));

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
page.on('dialog', d => d.accept());
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push('console: ' + m.text()));
const log = [];
const problems = [];
await page.goto('http://127.0.0.1:4173');
await page.waitForFunction(() => window.studio);

const templates = {
  fiction: ['f-00108', 'f-00110', 'f-00106', 'f-00109', 'f-00112', 'f-00111', 'f-00105'],
  cleaner: ['c-00176', 'c-00175', 'c-00173', 'c-00122-1', 'c-00112', 'c-00122-5', 'c-00101']
};
async function openTemplate() {
  const product = pick(['fiction', 'cleaner']),
    t = pick(templates[product]);
  if (await page.locator('#editor').isVisible()) await page.locator('#newProject').click();
  if (await page.locator('#chooserBack').isVisible()) await page.locator('#chooserBack').click();
  await page.locator(`[data-picker-product="${product}"]`).click();
  await page.locator(`[data-choose="${t}"]`).click();
  await page.waitForFunction(x => window.studio.getProject().template === x, t, { timeout: 30000 });
  await settle();
  return t;
}
async function settle() {
  await page.waitForTimeout(120);
  await page
    .waitForFunction(() => document.getElementById('previewState').hidden, null, { timeout: 15000 })
    .catch(() => problems.push({ step: log.length, issue: 'preview did not finish loading', last: log.at(-1) }));
}
const visible = loc => loc.isVisible().catch(() => false);
async function clickIf(sel) {
  const l = page.locator(sel).first();
  if (await visible(l)) {
    await l.click();
    return true;
  }
  return false;
}
async function fillIf(sel, value) {
  const l = page.locator(sel).first();
  if (await visible(l)) {
    await l.fill(String(value));
    return true;
  }
  return false;
}

const actions = {
  async select() {
    const rows = await page.locator('#libraryBody [data-select]').evaluateAll(es => es.map(e => e.dataset.select));
    if (rows.length) await page.locator(`#libraryBody [data-select="${pick(rows)}"]`).click();
  },
  async clickPreview() {
    if (!(await visible(page.locator('#preview')))) return;
    const box = await page.locator('#preview').boundingBox();
    if (box) await page.mouse.click(box.x + box.width * (0.15 + rnd() * 0.7), box.y + box.height * (0.1 + rnd() * 0.8));
  },
  async text() {
    const marker = 'w' + int(100, 999);
    const t = page.locator('#inspectorBody [data-rich], #inspectorBody textarea[data-prop$=".text"], #inspectorBody input[data-prop$=".text"]').first();
    if (await visible(t)) await t.fill((await t.evaluate(e => e.value ?? e.innerText)).slice(0, 400) + ' ' + marker);
  },
  async width() {
    await fillIf('#inspectorBody input[type=number][data-prop$=".width"]', int(20, 160));
  },
  async move() {
    await fillIf('#inspectorBody input[type=number][data-prop$=".x"]', int(-20, 20));
    await fillIf('#inspectorBody input[type=number][data-prop$=".y"]', int(-20, 20));
  },
  async fontSize() {
    await fillIf('#inspectorBody input[type=number][data-prop$=".fontSize"]', int(10, 40));
  },
  async toggle() {
    const t = page.locator('#inspectorBody input[type=checkbox][data-prop$="enabled"]').nth(int(0, 2));
    if (await visible(t)) await t.click();
  },
  async undo() {
    await clickIf('#undo:not([disabled])');
  },
  async redo() {
    await clickIf('#redo:not([disabled])');
  },
  async orientation() {
    await page.locator(pick(['#portrait', '#landscape'])).click();
  },
  async device() {
    await page.locator('#device').selectOption(pick(['393,852', '320,480', '412,915']));
  },
  async testMode() {
    await page.locator('#modePlay').click();
    await page.waitForTimeout(int(200, 900));
    await page.locator('#modeEdit').click();
  },
  async addElement() {
    if (!(await visible(page.locator('[data-add-html="text"]')))) await clickIf('.add-section summary');
    await clickIf(`[data-add-html="${pick(['text', 'image'])}"]`);
  },
  async deleteAdded() {
    await clickIf('#inspectorBody [data-delete-block]');
  },
  async addVariant() {
    const n = await page.locator('#variantTabs [data-variant-id]').count();
    if (n < 3) await clickIf('#addVariant');
  },
  async switchVariant() {
    const tabs = page.locator('#variantTabs [data-variant-id]');
    const n = await tabs.count();
    if (n > 1) await tabs.nth(int(0, n - 1)).click();
  },
  async removeVariant() {
    if (await clickIf('#removeVariant')) await clickIf('#removeVariant');
  },
  async cta() {
    if (!(await clickIf('#convertCta'))) await clickIf('#restoreCta');
  },
  async ctaText() {
    await fillIf('#inspectorBody input[data-prop="block.ctaCode.text"]', 'Go ' + int(1, 99));
  },
  async drag() {
    if (!(await visible(page.locator('#preview')))) return;
    await page.locator('#editPositions').click();
    const box = await page.locator('#preview').boundingBox();
    if (box) {
      const x = box.x + box.width * (0.3 + rnd() * 0.4),
        y = box.y + box.height * (0.2 + rnd() * 0.6);
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + int(-40, 40), y + int(-40, 40), { steps: 6 });
      await page.mouse.up();
    }
    await page.locator('#editPositions').click();
  },
  async tabs() {
    await page.locator(`[data-inspector="${pick(['element', 'layout', 'settings'])}"]`).click();
    await page.locator('[data-inspector="element"]').click();
  },
  async newTemplate() {
    if (rnd() < 0.35) log.push('template ' + (await openTemplate()));
  }
};
const weights = {
  select: 14, clickPreview: 8, text: 10, width: 6, move: 6, fontSize: 4, toggle: 5, undo: 6, redo: 3,
  orientation: 3, device: 2, testMode: 2, addElement: 4, deleteAdded: 3, addVariant: 3, switchVariant: 3,
  removeVariant: 2, cta: 3, ctaText: 3, drag: 4, tabs: 2, newTemplate: 2
};
const bag = Object.entries(weights).flatMap(([k, w]) => Array(w).fill(k));

async function check(step) {
  const r = await page.evaluate(() => {
    const p = window.studio.getProject(),
      d = document.querySelector('#preview')?.contentDocument,
      out = [];
    const sel = document.querySelector('#libraryBody .block-row.active [data-select]')?.dataset.select;
    if (!document.querySelector('#inspectorBody')?.textContent.trim()) out.push('empty inspector');
    if (sel && !p.blocks.some(b => b.id === sel)) out.push('selected row is not a project element');
    if (p.kind === 'html' && d && !document.querySelector('#preview').hidden) {
      const parts = new Set(p.blocks.flatMap(b => (b.storyGroup ? b.parts : [])));
      for (const b of p.blocks) {
        if (!b.enabled || b.bgAsset || b.audioAsset || (b.added && b.type === 'image' && !b.asset)) continue;
        if (!d.querySelector(`[data-studio-block="${b.id}"]`) && !(b.textGroup && b.memberNodes?.length))
          out.push('missing in preview: ' + (b.label || b.type) + (parts.has(b.node) ? ' (part)' : ''));
      }
    }
    return out;
  });
  for (const issue of r) problems.push({ step, issue, last: log.slice(-4) });
}
// The live preview (updated in place after each edit) must match a fresh render of the same project.
async function compareFresh(step) {
  const diff = await page.evaluate(async () => {
    const p = window.studio.getProject();
    if (p.kind !== 'html' || document.querySelector('#preview').hidden) return [];
    const live = document.querySelector('#preview').contentDocument;
    const fresh = new DOMParser().parseFromString(
      window.studio.buildHTML(p, window.studio.resolveAssets(), { preview: true }),
      'text/html'
    );
    const norm = t => (t || '').replace(/\s+/g, ' ').trim();
    const out = [];
    for (const el of fresh.querySelectorAll('[data-studio-block]')) {
      const id = el.dataset.studioBlock;
      if (id === 'background') continue;
      const l = live.querySelector(`[data-studio-block="${id}"]`);
      const b = p.blocks.find(x => x.id === id);
      const name = b?.label || id;
      if (!l) {
        out.push('live preview lacks ' + name);
        continue;
      }
      if (norm(l.textContent) !== norm(el.textContent)) out.push('text differs in ' + name);
      if (el.tagName === 'IMG' && l.getAttribute('src') !== el.getAttribute('src')) out.push('picture differs in ' + name);
    }
    for (const l of live.querySelectorAll('[data-studio-block]'))
      if (l.dataset.studioBlock !== 'background' && !fresh.querySelector(`[data-studio-block="${l.dataset.studioBlock}"]`))
        out.push('stale element in live preview: ' + (p.blocks.find(x => x.id === l.dataset.studioBlock)?.label || l.dataset.studioBlock));
    return out;
  });
  for (const issue of diff) problems.push({ step, issue, last: log.slice(-5) });
}

log.push('template ' + (await openTemplate()));
for (let i = 0; i < total; i++) {
  const a = pick(bag);
  log.push(a);
  try {
    await actions[a]();
  } catch (e) {
    problems.push({ step: i, issue: 'action failed: ' + a + ' — ' + e.message.split('\n')[0], last: log.slice(-4) });
  }
  await settle();
  if (i % 3 === 0 || a === 'undo' || a === 'redo') await check(i);
  if (i % 5 === 0) {
    await page.waitForTimeout(300);
    await compareFresh(i);
  }
  if (errors.length) {
    problems.push({ step: i, issue: 'page error: ' + errors.join(' | '), last: log.slice(-6) });
    errors.length = 0;
  }
}
// Export still works for the whole set.
const exp = await page.evaluate(async () => {
  try {
    return window.studio.buildHTML(window.studio.getProject(), window.studio.resolveAssets(), { preview: false }).length;
  } catch (e) {
    return 'ERR ' + e.message;
  }
});
if (typeof exp !== 'number') problems.push({ step: total, issue: 'export: ' + exp });
const dl = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);
await page.locator('#export').click();
const file = await dl;
if (!file) problems.push({ step: total, issue: 'export download did not happen' });

await writeFile(`test-results/fuzz-${seed}.json`, JSON.stringify({ seed, total, problems, log }, null, 1));
console.log(JSON.stringify({ seed, actions: total, problems: problems.slice(0, 30), count: problems.length }, null, 1));
await browser.close();
assert.equal(problems.length, 0, 'long session problems');
