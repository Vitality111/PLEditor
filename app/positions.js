const clamp = n => (Number.isFinite(n) ? Math.max(-100, Math.min(100, n)) : 0);
export function normalizePositions(block) {
  const old = block.position || {};
  block.position = Object.fromEntries(
    ['portrait', 'landscape'].map(o => [o, { x: clamp(old[o]?.x), y: clamp(old[o]?.y) }])
  );
  return block;
}
export function positionCSS(project) {
  const rules = o =>
    project.blocks
      .filter(b => b.type !== 'audio')
      .map(b => {
        const p = b.position?.[o] || {},
          id = String(b.id).replace(/["\\]/g, '\\$&');
        return `[data-block="${id}"]{--editor-x:${clamp(p.x)};--editor-y:${clamp(p.y)};translate:calc(var(--editor-base-x,0px) + var(--editor-x)*1vw) calc(var(--editor-base-y,0px) + var(--editor-y)*1vh)}`;
      })
      .join('');
  return rules('portrait') + '@media(min-aspect-ratio:1/1){' + rules('landscape') + '}';
}
