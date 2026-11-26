import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHTML } from '../app/engine.js';
import { fictionStyles, fictionSources } from '../app/fiction-styles.js';
const settings = {
  motion: 'shrink',
  background: '#2d0001',
  textColor: '#ffffff',
  accent: '#9053ed',
  ctaColor: '#ffffff',
  font: 'serif',
  fontAsset: '',
  bgAsset: 'bg',
  bgAssetL: 'bgL',
  bgFocalX: 50,
  bgFocalY: 50,
  bgShade: 0,
  panelOpacity: 67,
  lineHeight: 1.35,
  radius: 8,
  hand: false,
  pulse: true,
  volume: 70,
  portrait: { fontSize: 23, contentWidth: 90, heroHeight: 36, ctaWidth: 70, panelHeight: 70, gap: 14 },
  landscape: { fontSize: 21, contentWidth: 84, heroHeight: 70, ctaWidth: 39, panelHeight: 69, gap: 10 }
};
const project = {
  id: 'qa',
  product: 'fiction',
  language: 'en',
  name: 'QA',
  iosUrl: 'https://apps.apple.com/example',
  settings,
  blocks: [
    { id: 'hero', type: 'hero', enabled: true, asset: 'hero' },
    { id: 'story', type: 'story', enabled: true, text: 'Story', width: 100, align: 'left' },
    { id: 'cta', type: 'cta', enabled: true, text: 'Continue', asset: 'cta' }
  ]
};
const assets = Object.fromEntries(
  ['hero', 'cta', 'bg', 'bgL'].map(id => [id, { data: 'data:image/png;base64,aGVsbG8=' }])
);
test('Fiction shrinking template retains original mask, background band and scroll probe', () => {
  const html = buildHTML(project, assets, { preview: true });
  assert.ok(html.includes('-webkit-mask-image: linear-gradient(to bottom, #000 86%, transparent 100%)'));
  assert.ok(html.includes('class="band"'));
  assert.ok(html.includes('class="range-probe"'));
  assert.ok(html.includes("setProperty('--p'"));
  assert.ok(html.includes('height: 100vh;'), 'background copy remains viewport-sized');
  assert.ok(
    !html.includes('.band img{width:100%;height:100%'),
    'do not recrop the background to mask height'
  );
});
test('preview and export preserve identical creative markup and CSS', () => {
  const preview = buildHTML(project, assets, { preview: true }),
    exported = buildHTML(project, assets);
  assert.equal(
    preview.match(/<style>([\s\S]*?)<\/style>/)[1],
    exported.match(/<style>([\s\S]*?)<\/style>/)[1]
  );
  assert.equal(preview.match(/<body>([\s\S]*?)<script>/)[1], exported.match(/<body>([\s\S]*?)<script>/)[1]);
});
test('no original CSS references test folders; templates contain original shadows and gradients', () => {
  for (const file of Object.values(fictionSources))
    assert.ok(!file.replaceAll('\\', '/').split('/').includes('test'));
  assert.ok(fictionStyles.sticky.includes('box-shadow:'));
  assert.ok(fictionStyles.cover.includes('.fade-top'));
});

test('scroll hint uses original portrait and landscape images in preview and export', () => {
  const p = structuredClone(project);
  p.settings.motion = 'cover';
  p.settings.hand = true;
  const a = {
    ...assets,
    'fcm-cover/hand.png': { data: 'data:image/png;base64,cG9ydHJhaXQ=' },
    'fcm-cover/handL.png': { data: 'data:image/png;base64,bGFuZHNjYXBl' }
  };
  for (const options of [{ preview: true }, {}]) {
    const html = buildHTML(p, a, options),
      hint = html.match(/<div class="hand hint"[^>]*>(.*?)<\/div>/s)[1];
    assert.ok(hint.includes('data:image/png;base64,cG9ydHJhaXQ='));
    assert.ok(hint.includes('srcset="data:image/png;base64,bGFuZHNjYXBl"'));
    assert.ok(!html.includes('☝'));
    assert.ok(!html.includes('.hand{font:'));
  }
  p.settings.hand = false;
  assert.ok(!buildHTML(p, a).includes('id="hint"'));
});

test('text fades: auto keeps template, custom draws colour and height, off hides', async () => {
  const { fadeCSS } = await import('../app/fiction-renderer.js');
  const base = { background: '#2d0001' };
  assert.equal(
    fadeCSS({ ...base, fadeTop: { mode: 'auto' }, fadeBottom: { mode: 'auto' } }, 'shrink').includes(
      '!important'
    ),
    false
  );
  const custom = fadeCSS(
    {
      ...base,
      fadeTop: { mode: 'off' },
      fadeBottom: { mode: 'custom', color: '#ff0000', strength: 50, portrait: 20, landscape: 30 }
    },
    'cover'
  );
  assert.match(custom, /\.app \.fade-top\{display:none!important\}/);
  assert.match(custom, /height:20%!important/);
  assert.match(custom, /height:30%!important/);
  assert.match(custom, /rgba\(255,0,0,0\.5\)/);
  assert.match(custom, /left:var\(--coverW\)/);
  const fallback = fadeCSS({ ...base, fadeTop: { mode: 'custom', portrait: 10, landscape: 10 } }, 'panel');
  assert.match(fallback, /rgba\(45,0,1,1\)/, 'uses the background colour when none is chosen');
});
