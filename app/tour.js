// Guided tour, like in games: the screen dims, the part being explained is lit and outlined, a card with
// an arrow says what it does. «Далі» / «Назад» (or ← →), Esc skips. Runs once on the first visit and
// any time from the «Туторіал» button.
const KEY = 'pb-tour-done-v1';
export function tourSeen() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
function markSeen() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {}
}

let active = null;

// steps: [{ target: selector | [selectors] | null, title, text, before?(), place? }]
export function startTour(steps, { onEnd, onStep } = {}) {
  if (active) active.end(false);
  const root = document.createElement('div');
  root.className = 'tour';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.innerHTML =
    '<div class="tour-catch"></div><div class="tour-spot" aria-hidden="true"></div>' +
    '<div class="tour-card" role="document"><div class="tour-arrow" aria-hidden="true"></div>' +
    '<div class="tour-count"></div><h3 class="tour-title"></h3><p class="tour-text"></p>' +
    '<div class="tour-actions"><button type="button" class="text-btn tour-skip">Пропустити</button>' +
    '<span class="tour-gap"></span><button type="button" class="btn secondary tour-back">Назад</button>' +
    '<button type="button" class="btn primary tour-next">Далі</button></div></div>';
  document.body.append(root);
  const $ = s => root.querySelector(s),
    spot = $('.tour-spot'),
    card = $('.tour-card'),
    arrow = $('.tour-arrow');
  let i = 0,
    raf = 0;

  const visible = el => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2 && getComputedStyle(el).visibility !== 'hidden';
  };
  const rectOf = step => {
    if (!step.target) return null;
    const list = [].concat(step.target).flatMap(s => [...document.querySelectorAll(s)]).filter(visible);
    if (!list.length) return null;
    const rs = list.map(el => el.getBoundingClientRect());
    return {
      left: Math.min(...rs.map(r => r.left)),
      top: Math.min(...rs.map(r => r.top)),
      right: Math.max(...rs.map(r => r.right)),
      bottom: Math.max(...rs.map(r => r.bottom))
    };
  };
  // Steps whose part of the screen is not there now (e.g. no variations yet) are passed over.
  const usable = n => !steps[n].target || !!rectOf(steps[n]);

  function place() {
    const step = steps[i],
      W = innerWidth,
      H = innerHeight,
      pad = 6,
      r = rectOf(step);
    if (!r) {
      spot.style.cssText = `left:${W / 2}px;top:${H / 2}px;width:0;height:0`;
      spot.classList.add('none');
      arrow.hidden = true;
      card.style.left = Math.max(16, (W - card.offsetWidth) / 2) + 'px';
      card.style.top = Math.max(16, (H - card.offsetHeight) / 2) + 'px';
      return;
    }
    spot.classList.remove('none');
    const s = {
      left: Math.max(4, r.left - pad),
      top: Math.max(4, r.top - pad),
      right: Math.min(W - 4, r.right + pad),
      bottom: Math.min(H - 4, r.bottom + pad)
    };
    spot.style.cssText = `left:${s.left}px;top:${s.top}px;width:${s.right - s.left}px;height:${s.bottom - s.top}px`;
    const cw = card.offsetWidth,
      ch = card.offsetHeight,
      gap = 18,
      room = { bottom: H - s.bottom, top: s.top, right: W - s.right, left: s.left };
    let side = step.place;
    if (!side || room[side] < (side === 'top' || side === 'bottom' ? ch : cw) + gap)
      side = ['bottom', 'top', 'right', 'left'].find(k => room[k] >= (k === 'top' || k === 'bottom' ? ch : cw) + gap) || 'over';
    const cx = (s.left + s.right) / 2,
      cy = (s.top + s.bottom) / 2,
      clampX = x => Math.max(16, Math.min(W - cw - 16, x)),
      clampY = y => Math.max(16, Math.min(H - ch - 16, y));
    let x, y;
    if (side === 'bottom') [x, y] = [clampX(cx - cw / 2), s.bottom + gap];
    else if (side === 'top') [x, y] = [clampX(cx - cw / 2), s.top - gap - ch];
    else if (side === 'right') [x, y] = [s.right + gap, clampY(cy - ch / 2)];
    else if (side === 'left') [x, y] = [s.left - gap - cw, clampY(cy - ch / 2)];
    else [x, y] = [clampX(cx - cw / 2), clampY(s.bottom - ch - 16)];
    card.style.left = x + 'px';
    card.style.top = y + 'px';
    // The arrow sits on the card edge facing the lit part, pointing at its middle.
    arrow.hidden = side === 'over';
    arrow.className = 'tour-arrow ' + side;
    if (side === 'bottom' || side === 'top') arrow.style.cssText = `left:${Math.max(18, Math.min(cw - 30, cx - x - 6))}px`;
    else if (side === 'left' || side === 'right') arrow.style.cssText = `top:${Math.max(18, Math.min(ch - 30, cy - y - 6))}px`;
  }
  function render() {
    const step = steps[i];
    try {
      step.before?.();
      onStep?.(step);
    } catch {}
    const shown = steps.map((_, n) => n).filter(usable),
      at = shown.indexOf(i);
    $('.tour-count').textContent = `${at + 1} / ${shown.length}`;
    $('.tour-title').textContent = step.title;
    $('.tour-text').textContent = step.text;
    $('.tour-back').hidden = at <= 0;
    $('.tour-next').textContent = at === shown.length - 1 ? 'Готово' : 'Далі';
    // Let the layout settle (a tab switch, a panel redraw) before measuring.
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => requestAnimationFrame(place));
    $('.tour-next').focus({ preventScroll: true });
  }
  function go(dir) {
    let n = i + dir;
    while (n >= 0 && n < steps.length && !usable(n)) n += dir;
    if (n < 0) return;
    if (n >= steps.length) return end(true);
    i = n;
    render();
  }
  function end(done) {
    cancelAnimationFrame(raf);
    removeEventListener('resize', onResize);
    removeEventListener('keydown', onKey, true);
    root.remove();
    active = null;
    markSeen();
    onEnd?.(done);
  }
  const onResize = () => place(),
    onKey = e => {
      if (e.key === 'Escape') end(false);
      else if (e.key === 'ArrowRight' || e.key === 'Enter') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
  $('.tour-next').onclick = () => go(1);
  $('.tour-back').onclick = () => go(-1);
  $('.tour-skip').onclick = () => end(false);
  addEventListener('resize', onResize);
  addEventListener('keydown', onKey, true);
  active = { end };
  while (i < steps.length - 1 && !usable(i)) i++;
  render();
  return active;
}
export const tourActive = () => !!active;
