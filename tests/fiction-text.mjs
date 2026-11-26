// Fiction Me originals: the story text is a selectable, editable element in every template,
// paragraphs stay apart in the editor, and the swipe hand never steals a click on the text.
import assert from 'node:assert/strict';
import { launchBrowser } from './launch.mjs';

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:4173');
await page.waitForFunction(() => window.studio);
const ids = ['f-00108', 'f-00110', 'f-00109', 'f-00112', 'f-00105'];
for (const id of ids) {
  if (await page.locator('#editor').isVisible()) await page.locator('#newProject').click();
  await page.locator('[data-picker-product="fiction"]').click();
  await page.locator(`[data-choose="${id}"]`).click();
  await page.waitForFunction(t => window.studio.getProject().template === t, id, { timeout: 30000 });
  await page.locator('#previewState').waitFor({ state: 'hidden' });
  await page.waitForTimeout(300);
  // The longest text block is the story.
  const story = await page.evaluate(() =>
    window.studio
      .getProject()
      .blocks.filter(b => b.type === 'text')
      .sort((a, b) => b.text.length - a.text.length)[0]
  );
  assert.ok(story && story.text.length > 300, `${id}: story text is an element`);
  await page.waitForFunction(
    id => document.querySelector('#preview').contentDocument?.querySelector(`[data-studio-block="${id}"]`),
    story.id,
    { timeout: 15000 }
  );
  // Clicking in the middle of the visible story selects it.
  const point = await page.evaluate(storyId => {
    const frame = document.querySelector('#preview'),
      d = frame.contentDocument,
      el = d.querySelector(`[data-studio-block="${storyId}"]`),
      f = frame.getBoundingClientRect(),
      z = Number(frame.style.zoom || 1);
    // The visible part of the text: clipped by scrolling ancestors and the screen.
    let { left, top, right, bottom } = el.getBoundingClientRect();
    bottom = Math.min(bottom, d.documentElement.clientHeight);
    top = Math.max(top, 0);
    for (let a = el.parentElement; a && a !== d.body; a = a.parentElement)
      if (getComputedStyle(a).overflowY !== 'visible') {
        const c = a.getBoundingClientRect();
        top = Math.max(top, c.top);
        bottom = Math.min(bottom, c.bottom);
      }
    return { x: f.left + ((left + right) / 2) * z, y: f.top + (top + (bottom - top) * 0.3) * z };
  }, story.id);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(200);
  const selected = await page.locator('#inspectorBody h3').first().textContent();
  assert.ok(selected.startsWith('Текст'), `${id}: click on the story selects it, got «${selected}»`);
  // Editing the text reaches the preview.
  const edited = 'Edited first line.\n\n' + story.text;
  // One textarea for the story: inside the story box («part.<id>.text») or the text itself.
  await page.locator(`[data-rich="part.${story.id}"], [data-rich="block"]`).first().fill(edited);
  await page.waitForFunction(
    () => document.querySelector('#preview').contentDocument.body.textContent.includes('Edited first line.'),
    null,
    { timeout: 5000 }
  );
  await page.screenshot({ path: `test-results/fiction-text-${id}.png` });
  // The exported creative still runs and shows the edit.
  const html = await page.evaluate(() =>
    window.studio.buildHTML(window.studio.getProject(), window.studio.resolveAssets(), { preview: false })
  );
  assert.ok(!/class="studio-text"/.test(html), `${id}: export gives the text back to the creative's own script`);
  const view = await browser.newPage({ viewport: { width: 393, height: 852 } });
  view.on('pageerror', e => errors.push(id + ' export: ' + e.message));
  await view.setContent(html, { waitUntil: 'load' });
  assert.ok((await view.textContent('body')).includes('Edited first line.'), `${id}: export has the edit`);
  // The creative's script turned the blank line after the edit into a paragraph break.
  assert.match(await view.locator('#scrollContent').innerHTML(), /Edited first line\.<br><br>/, `${id}: script formats it`);
  await view.close();
}
// The scrolling story box is one element: Chapter, POV and the story are its parts.
if (await page.locator('#editor').isVisible()) await page.locator('#newProject').click();
await page.locator('[data-picker-product="fiction"]').click();
await page.locator('[data-choose="f-00108"]').click();
await page.waitForFunction(() => window.studio.getProject().template === 'f-00108', null, { timeout: 30000 });
const box = await page.evaluate(() => {
  const p = window.studio.getProject(),
    g = p.blocks.find(b => b.storyGroup);
  return { id: g.id, parts: p.blocks.filter(b => g.parts.includes(b.node)).map(b => [b.id, b.partLabel]) };
});
assert.deepEqual(box.parts.map(x => x[1]), ['Chapter', 'POV', 'Текст історії']);
assert.ok(
  !(await page.locator('.block-name').allTextContents()).some(t => /Chapter 5|POV/.test(t)),
  'parts are not separate rows'
);
await page.locator(`[data-select="${box.id}"]`).click();
await page.locator(`input[data-prop="part.${box.parts[0][0]}.enabled"]`).uncheck();
await page.locator(`[data-rich="part.${box.parts[1][0]}"]`).fill('Nathan’s POV');
await page.waitForTimeout(600);
const boxed = await page.evaluate(() =>
  window.studio.buildHTML(window.studio.getProject(), window.studio.resolveAssets(), { preview: false })
);
const out = await browser.newPage({ viewport: { width: 393, height: 852 } });
await out.setContent(boxed, { waitUntil: 'load' });
assert.equal(await out.locator('.chapter').isVisible(), false, 'hidden Chapter');
assert.match(await out.locator('.pov').textContent(), /Nathan’s POV/);
await out.mouse.move(196, 600);
await out.mouse.wheel(0, 500);
await out.waitForTimeout(500);
assert.ok((await out.locator('#scrollContent').evaluate(e => e.scrollTop)) > 0, 'story still scrolls');
await out.close();

await browser.close();
assert.deepEqual(errors, []);
console.log({ fictionText: 'ok', templates: ids.length });
