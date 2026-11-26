// Pure geometry, in logical preview pixels. Screen targets win equal distances.
export function snapAlignment(rect, targets, width, height, threshold = 6) {
  const anchors = (r, axis) =>
    axis === 'x' ? [r.left, (r.left + r.right) / 2, r.right] : [r.top, (r.top + r.bottom) / 2, r.bottom];
  const result = { dx: 0, dy: 0, guides: [] };
  for (const axis of ['x', 'y']) {
    const screen = axis === 'x' ? [0, width / 2, width] : [0, height / 2, height];
    const candidates = [
      ...screen.map(value => ({ value, screen: true })),
      ...targets.flatMap(r => anchors(r, axis).map(value => ({ value, screen: false })))
    ];
    let best = null;
    for (const a of anchors(rect, axis))
      for (const c of candidates) {
        const delta = c.value - a;
        if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta)))
          best = { axis, value: c.value, delta, screen: c.screen };
      }
    if (best) {
      result[axis === 'x' ? 'dx' : 'dy'] = best.delta;
      result.guides.push(best);
    }
  }
  return result;
}
