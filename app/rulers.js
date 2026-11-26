export function drawRulers({
  surface,
  shell,
  frame,
  horizontal,
  vertical,
  badge,
  enabled,
  width,
  height,
  label = ''
}) {
  for (const el of [horizontal, vertical, badge]) el.hidden = !enabled;
  if (!enabled) return;
  const parent = surface.getBoundingClientRect(),
    box = shell.getBoundingClientRect(),
    screen = frame.getBoundingClientRect();
  const x = screen.left - parent.left,
    y = screen.top - parent.top,
    sx = screen.width / width,
    sy = screen.height / height;
  horizontal.style.cssText = `left:${x}px;top:${box.top - parent.top - 26}px;width:${screen.width}px;height:20px`;
  vertical.style.cssText = `left:${box.left - parent.left - 26}px;top:${y}px;width:20px;height:${screen.height}px`;
  const ticks = (size, scale, axis) => {
    // Labels stay readable at every preview zoom; positions use logical pixels.
    const step = Math.max(50, Math.ceil(45 / Math.max(0.05, scale) / 50) * 50);
    let html = '';
    for (let value = 0; value < size; value += step)
      html += `<span class="ruler-tick" style="${axis === 'x' ? 'left' : 'top'}:${value * scale}px">${value}</span>`;
    return html;
  };
  horizontal.innerHTML = ticks(width, sx, 'x');
  vertical.innerHTML = ticks(height, sy, 'y');
  badge.textContent = label;
  badge.hidden = !label;
  badge.style.cssText = `left:${box.left - parent.left}px;top:${box.bottom - parent.top + 6}px;max-width:${box.width}px`;
}
