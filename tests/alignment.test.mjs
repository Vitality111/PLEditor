import test from 'node:test';
import assert from 'node:assert/strict';
import { snapAlignment } from '../app/alignment.js';
import { normalizePositions, positionCSS } from '../app/positions.js';
import { smallerImage } from '../app/export-packager.js';
test('center snaps within six pixels and leaves far-away axes unchanged', () => {
  const r = snapAlignment({ left: 153, right: 253, top: 100, bottom: 130 }, [], 400, 800);
  assert.equal(r.dx, -3);
  assert.equal(r.dy, 0);
  assert.deepEqual(
    r.guides.map(g => g.axis),
    ['x']
  );
});
test('element edges and centers are snapping targets', () => {
  const r = snapAlignment(
    { left: 98, right: 138, top: 147, bottom: 177 },
    [{ left: 100, right: 160, top: 150, bottom: 240 }],
    400,
    800
  );
  assert.equal(r.dx, 2);
  assert.equal(r.dy, 3);
  assert.equal(r.guides.length, 2);
});
test('legacy projects start at their base position, custom offsets survive normalization', () => {
  const b = normalizePositions({
    position: { portrait: { x: 12, y: -4 }, landscape: { x: Infinity, y: 200 } }
  });
  assert.deepEqual(b.position, { portrait: { x: 12, y: -4 }, landscape: { x: 0, y: 100 } });
  const css = positionCSS({ blocks: [{ id: 'cta', type: 'cta', ...b }] });
  assert.ok(css.includes('--editor-base-x,0px'));
  assert.ok(css.includes('@media'));
});
test('already compressed assets are retained when savings are below ten percent', () => {
  const original = 'data:image/png;base64,' + 'A'.repeat(1000),
    small = 'data:image/webp;base64,' + 'B'.repeat(600),
    similar = 'data:image/webp;base64,' + 'B'.repeat(980);
  assert.equal(smallerImage(original, small), small);
  assert.equal(smallerImage(original, similar), original);
});
