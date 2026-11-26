// Geometry checks for a rendered creative. Shared by the editor's «Перевірити адаптивність»
// and the browser tests. Must stay self-contained: tests pass its source into the page.
export function layoutFailures(doc = document, win = window) {
  const W = win.innerWidth,
    H = win.innerHeight,
    out = new Set();
  const outside = r => r.left < -0.5 || r.top < -0.5 || r.right > W + 0.5 || r.bottom > H + 0.5;
  const overlap = (a, b) =>
    a.width > 0 &&
    b.width > 0 &&
    a.left < b.right &&
    b.left < a.right &&
    a.top < b.bottom &&
    b.top < a.bottom;
  // The visible CTA; in the AI chat the first screen shows the start button instead.
  const ctaEl = [...doc.querySelectorAll('.cta,.cta-start')].find(e => e.getClientRects().length),
    cta = ctaEl?.getBoundingClientRect();
  if (!cta) out.add('no-cta');
  else if (outside(cta) || cta.height < 44 || cta.width < 44) out.add('cta-bounds');
  const scroller = doc.scrollingElement;
  if (scroller.scrollWidth > W || scroller.scrollHeight > H) out.add('document-overflow');
  if ([...doc.images].some(i => !i.naturalWidth)) out.add('image-failed');
  for (const e of doc.querySelectorAll('h1,.story,.copy,.checklist'))
    if (e.scrollWidth > e.clientWidth + 1) out.add('text-width');
  const panel = doc.querySelector('.native-panel .panel');
  if (panel) {
    const p = panel.getBoundingClientRect(),
      story = doc.querySelector('.native-panel .story')?.getBoundingClientRect();
    if (outside(p)) out.add('panel-bounds');
    if (story && (story.left < p.left - 0.5 || story.right > p.right + 0.5)) out.add('panel-text');
  }
  // Coded Cleaner layouts: the column must fit on screen and the in-flow button must stay visible.
  const kitLayout = doc.querySelector('.kit.product-cleaner .layout');
  if (kitLayout) {
    for (const e of kitLayout.querySelectorAll(':scope > *')) {
      const r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || win.getComputedStyle(e).position === 'absolute') continue;
      if (outside(r)) out.add('content-collision');
    }
  }
  const kitCard = doc.querySelector('.kit .page-card, .kit .panel-card, .kit .k-card');
  if (kitCard && outside(kitCard.getBoundingClientRect())) out.add('card-bounds');
  const alertCard = doc.querySelector('.kit.m-alertphoto .layout > .k-card');
  if (alertCard && alertCard.scrollHeight > alertCard.clientHeight + 1) out.add('card-overflow');
  const content = doc.querySelector('.product-cleaner .cleaner-content');
  if (content) {
    const alert = doc.querySelector('.layout-alert');
    if (alert) {
      const card = doc.querySelector('.alert-card .card-box')?.getBoundingClientRect(),
        note = doc.querySelector('.role-footnote')?.getBoundingClientRect();
      if (card && outside(card)) out.add('card-bounds');
      if (card && note && overlap(card, note)) out.add('footnote-overlap');
      if (note && outside(note)) out.add('footnote-bounds');
    } else
      for (const e of content.children) {
        const r = e.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        if (r.left < -0.5 || r.right > W + 0.5 || r.top < -0.5 || r.bottom > (cta?.top ?? H) + 0.5)
          out.add('content-collision');
      }
  }
  return [...out];
}

export const failureLabels = {
  'no-cta': 'Немає CTA',
  'cta-bounds': 'CTA виходить / замалий',
  'document-overflow': 'Скрол сторінки',
  'image-failed': 'Не завантажився асет',
  'text-width': 'Текст по ширині',
  'panel-bounds': 'Панель виходить за екран',
  'panel-text': 'Текст виходить за панель',
  'card-bounds': 'Алерт виходить за екран',
  'card-overflow': 'Вміст картки не вміщається',
  'footnote-overlap': 'Примітка перекриває алерт',
  'footnote-bounds': 'Примітка виходить за екран',
  'content-collision': 'Контент / CTA перекриваються'
};
