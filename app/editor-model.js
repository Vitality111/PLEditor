import { normalizePositions } from './positions.js';
export const layoutNames = {
  cover: 'Картинка над текстом',
  panel: 'Текст на фоні',
  shrink: 'Картинка зі зменшенням',
  sticky: 'Закріплена картинка',
  banner: 'Банер на фоні',
  alert: 'Алерт',
  poster: 'Банер з мокапом',
  checklist: 'Заголовок зі списком',
  comparison: 'Дві картинки поруч'
};
export const layoutDescriptions = {
  cover: 'Картинка й історія прокручуються разом.',
  panel: 'Фон залишається на місці. Текст прокручується в панелі.',
  shrink: 'Під час читання картинка плавно зменшується.',
  sticky: 'Картинка йде вгору, смуга з брендом залишається.',
  banner: 'Фон на весь екран, текст-картинка зверху і кнопка. Як 00170.',
  alert: 'Картка алерту по центру, кнопка всередині картки, примітка внизу. Як 00165.',
  poster: 'Заголовок, мокап телефону, опис і кнопка. Як 00159.',
  checklist: 'Заголовок, короткий список і кнопка.',
  comparison: 'Два зображення з підписами та кнопка.'
};
const numeric = (value, fallback, min, max) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
// Text fades (the gradients that hide text at the top/bottom edge of the reading area).
// mode: 'auto' = as in the original template, 'custom' = colour/height/strength below, 'off' = none.
export const FADE_DEFAULTS = {
  fadeTop: { mode: 'auto', color: '', strength: 100, portrait: 12, landscape: 22 },
  fadeBottom: { mode: 'auto', color: '', strength: 100, portrait: 18, landscape: 28 }
};
export function normalizeFade(raw, key) {
  const d = FADE_DEFAULTS[key],
    f = raw && typeof raw === 'object' ? raw : {};
  return {
    mode: ['auto', 'custom', 'off'].includes(f.mode) ? f.mode : d.mode,
    color: /^#[\da-f]{6}$/i.test(f.color || '') ? f.color : '',
    strength: numeric(f.strength, d.strength, 0, 100),
    portrait: numeric(f.portrait, d.portrait, 0, 60),
    landscape: numeric(f.landscape, d.landscape, 0, 60)
  };
}
export function prepareEditorProject(p) {
  const c = p.settings;
  if (p.product === 'fiction')
    for (const key of ['fadeTop', 'fadeBottom']) c[key] = normalizeFade(c[key], key);
  c.compressImages = c.compressImages !== false;
  c.exportImageQuality = numeric(c.exportImageQuality, 72, 50, 100);
  for (const o of ['portrait', 'landscape']) {
    const s = c[o];
    s.coverWidth = numeric(s.coverWidth, 38, 20, 55);
    s.heroScale = numeric(s.heroScale, 100, 50, 150);
    s.heroOffset = numeric(s.heroOffset, 0, -10, 25);
    if (p.product === 'fiction' && ['cover', 'sticky'].includes(c.motion) && o === 'landscape')
      s.ctaWidth = Math.min(s.ctaWidth, Math.floor((100 - s.coverWidth) * 0.85));
  }
  for (const b of p.blocks) {
    normalizePositions(b);
    if (p.kind === 'html') b.customStyle ??= { portrait: {}, landscape: {} };
    if (['story', 'text', 'title', 'list'].includes(b.type)) {
      const title = b.type === 'title',
        small = b.type === 'text' || b.type === 'list';
      b.fontSizePortrait = numeric(
        b.fontSizePortrait,
        Math.round(c.portrait.fontSize * (title ? 1.3 : small ? 0.85 : 1)),
        12,
        48
      );
      b.fontSizeLandscape = numeric(
        b.fontSizeLandscape,
        Math.round(c.landscape.fontSize * (title ? 1.2 : small ? 0.85 : 1)),
        12,
        48
      );
    }
    if (!['cover', 'contain'].includes(b.fit)) b.fit = 'cover';
  }
  return p;
}
const KIT_COVER_MODES = ['titlecover', 'niche', 'infocard'];
export function imageControlKind(p, orientation) {
  if (KIT_COVER_MODES.includes(p.settings.motion)) return orientation === 'landscape' ? 'column' : 'height';
  if (['page', 'panel2'].includes(p.settings.motion)) return 'none';
  if (p.product === 'fiction' && p.settings.motion === 'shrink') return 'scale';
  if (
    p.product === 'fiction' &&
    ['cover', 'sticky'].includes(p.settings.motion) &&
    orientation === 'landscape'
  )
    return 'column';
  return 'height';
}
export function layoutSketch(mode) {
  const common = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"';
  const lines = '<path d="M27 71h30M27 78h30M27 85h23"/>';
  const image =
    '<rect x="24" y="25" width="36" height="32" rx="4" fill="currentColor" opacity=".16" stroke="none"/><path d="m29 50 9-10 8 7 6-4"/>';
  const body =
    mode === 'panel'
      ? '<rect x="23" y="23" width="38" height="68" rx="4" fill="currentColor" opacity=".10" stroke="none"/><path d="M29 37h26M29 45h26M29 53h20M29 66h26M29 74h22"/>'
      : mode === 'checklist'
        ? '<path d="M25 29h34M25 36h24M25 51l3 3 5-6M39 52h19M25 67l3 3 5-6M39 68h19M25 83l3 3 5-6M39 84h19"/>'
        : mode === 'comparison'
          ? '<rect x="22" y="29" width="18" height="47" rx="3"/><rect x="45" y="29" width="18" height="47" rx="3"/><path d="M23 84h15M46 84h15"/>'
          : mode === 'banner'
            ? '<rect x="14" y="9" width="56" height="102" rx="10" fill="currentColor" opacity=".12" stroke="none"/><path d="M27 24h30M24 31h36M27 38h30"/><circle cx="50" cy="66" r="9" fill="currentColor" opacity=".2" stroke="none"/>'
            : mode === 'alert'
              ? '<rect x="14" y="9" width="56" height="102" rx="10" fill="currentColor" opacity=".08" stroke="none"/><rect x="21" y="22" width="42" height="76" rx="5" fill="currentColor" opacity=".16" stroke="none"/><path d="M27 32h30M27 39h30M27 46h22M27 58h30"/><rect x="26" y="84" width="32" height="7" rx="3" fill="currentColor" stroke="none"/><path d="M33 105h18"/>'
              : mode === 'poster'
                ? image + '<path d="M27 69h30M27 76h24"/>'
                : image + lines;
  const motion =
    mode === 'shrink'
      ? '<path d="M68 30v23m-4-4 4 4 4-4"/>'
      : mode === 'cover'
        ? '<path d="M68 66v22m-4-4 4 4 4-4"/>'
        : mode === 'sticky'
          ? '<path d="M23 61h38"/>'
          : '';
  return `<svg viewBox="0 0 84 120" aria-hidden="true"><g ${common}><rect x="14" y="9" width="56" height="102" rx="10"/>${body}${motion}${mode === 'alert' ? '' : '<rect x="26" y="95" width="33" height="7" rx="3" fill="currentColor" stroke="none"/>'}</g></svg>`;
}
