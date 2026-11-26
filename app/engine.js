import { importedDocument, placeAnchored } from './html-import.js';
import { snapAlignment } from './alignment.js';
import { positionCSS } from './positions.js';
import { fictionDocument } from './fiction-renderer.js';
import { kitDocument, isKit } from './kit.js';
export const escapeHTML = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
const rich = s =>
  escapeHTML(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[\[(.+?)\]\]/g, '<mark>$1</mark>')
    .split(/\n\s*\n/)
    .map(p => `<p>${p.replace(/[ \t]*\r?\n[ \t]*/g, ' ')}</p>`)
    .join('');
const source = (key, assets) => assets[key]?.data || assets[key]?.url || '';
const img = (b, assets) => {
  const p = source(b.asset, assets),
    l = source(b.assetL, assets);
  return p || l
    ? `<picture>${l ? `<source media="(min-aspect-ratio:1/1)" srcset="${escapeHTML(l)}">` : ''}<img src="${escapeHTML(p || l)}" alt="" style="object-position:${b.focalX ?? 50}% ${b.focalY ?? 50}%"></picture>`
    : '';
};
function block(b, assets) {
  const tag = `data-type="${escapeHTML(b.type)}" data-el="${escapeHTML(b.id)}" data-block="${escapeHTML(b.id)}"`;
  const style = `style="--bw:${Number(b.width) || 100}%;--bs:${(Number(b.width) || 100) / 100};text-align:${['left', 'center', 'right'].includes(b.align) ? b.align : 'center'};--bfsp:${b.fontSizePortrait ?? 23};--bfsl:${b.fontSizeLandscape ?? 21};color:${b.textColor || 'inherit'}"`;
  switch (b.type) {
    case 'title':
      return `<h1 ${tag} ${style}>${escapeHTML(b.text)}</h1>`;
    case 'story':
      return `<article class="story" ${tag} ${style}>${rich(b.text)}</article>`;
    case 'text':
      return `<div class="copy" ${tag} ${style}>${rich(b.text)}</div>`;
    case 'list':
      return `<ul class="checklist" ${tag} ${style}>${String(b.text)
        .split('\n')
        .filter(Boolean)
        .map(t => `<li><span>✓</span>${escapeHTML(t)}</li>`)
        .join('')}</ul>`;
    case 'image':
      return `<div class="image-block${b.role ? ' role-' + escapeHTML(b.role) : ''}" ${tag} ${style}>${img(b, assets)}</div>`;
    case 'logo':
      return `<div class="logo" ${tag} ${style}>${img(b, assets) || escapeHTML(b.text)}</div>`;
    case 'rating':
      return `<div class="rating" ${tag} ${style}>${img(b, assets) || `<span class="stars">★★★★★</span><small>${escapeHTML(b.text)}</small>`}</div>`;
    case 'comparison':
      return `<div class="comparison" ${tag}><div>${img({ ...b, assetL: '' }, assets) || '<div class="phone-sample before"><div class="photo-grid"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="storage-sample"></div></div>'}<small>${escapeHTML(b.text || 'Before')}</small></div><div>${img({ ...b, asset: b.afterAsset, assetL: '' }, assets) || '<div class="phone-sample after"><div class="photo-grid"><i></i><i></i><i></i><i></i></div><div class="storage-sample"></div></div>'}<small>${escapeHTML(b.afterText || 'After')}</small></div></div>`;
    default:
      return '';
  }
}
// Cleaner compositions taken from production folders: banner = 00170 (bg + text image + CTA),
// alert = 00165 (bg + alert card with the CTA inside + footnote). Values are fractions of the
// original 550×1103 / 1103×550 mocks.
const cleanerLayoutCSS = `
 .layout-banner .cta-wrap::before,.layout-alert .cta-wrap::before{display:none}
 .layout-banner .cta img,.layout-alert .cta img{max-height:30vh}
 .layout-banner .backdrop img,.layout-alert .backdrop img{object-position:50% 0%}
 .layout-banner .cleaner-content{justify-content:flex-start;padding:calc(9.7vh + env(safe-area-inset-top)) calc((100% - var(--cw))/2) 0}
 .layout-banner .image-block img{max-height:36vh}
 .layout-banner .cta-wrap{bottom:calc(5.7vh + env(safe-area-inset-bottom))}
 .layout-alert .cleaner-content{justify-content:center;padding:calc(2vh + env(safe-area-inset-top)) 0 calc(7vh + env(safe-area-inset-bottom))}
 .layout-alert .cleaner-content>.alert-card{width:100%;display:flex;justify-content:center}
 .layout-alert .card-box{position:relative;display:inline-block;line-height:0}
 .layout-alert .card-box>picture{display:block}
 .layout-alert .card-box>picture img{width:auto;height:auto;max-width:calc(var(--bs) * 100vw);max-height:calc(91vh - env(safe-area-inset-bottom));object-fit:contain}
 .layout-alert .card-box .cta-wrap{position:absolute;left:50%;bottom:3%;width:var(--ctaw);max-width:none;transform:translateX(-50%);line-height:normal}
 .layout-alert .cleaner-content>.role-footnote{position:absolute;left:50%;bottom:calc(2vh + env(safe-area-inset-bottom));transform:translateX(-50%);width:calc(var(--bs) * 100vmin)}
 .layout-alert .role-footnote img{max-height:4vh;object-fit:contain}
 @media(min-aspect-ratio:1/1){
  .layout-banner .backdrop img,.layout-alert .backdrop img{object-position:45% 50%}
  .layout-banner .cleaner-content{flex-flow:column nowrap;align-items:center;justify-content:flex-start;right:auto;width:46%;padding:calc(12vh + env(safe-area-inset-top)) 0 0 4%}
  .layout-banner .image-block img{max-height:52vh}
  .layout-banner .cta-wrap{left:24%;bottom:calc(5.3vh + env(safe-area-inset-bottom));max-width:none}
  .layout-alert .cleaner-content{flex-flow:column nowrap;align-content:normal;padding:calc(2vh + env(safe-area-inset-top)) 0 calc(7vh + env(safe-area-inset-bottom))}
  .layout-alert .card-box>picture img{max-width:calc(var(--bs) * 80vw)}
 }`;
export function buildHTML(project, assets, { preview = false, previewSound = false } = {}) {
  if (project.kind === 'html') return importedDocument(project, assets, { positionCSS, preview });
  if (isKit(project))
    return kitDocument(project, assets, { escapeHTML, rich, runtime, preview, previewSound });
  if (project.product === 'fiction')
    return fictionDocument(project, assets, { escapeHTML, rich, runtime, preview, previewSound });
  const c = project.settings,
    bs = project.blocks.filter(b => b.enabled),
    cta = bs.find(b => b.type === 'cta'),
    hero = bs.find(b => b.type === 'hero');
  const brand = bs.filter(b => ['logo', 'rating'].includes(b.type)),
    content = bs.filter(b => !['hero', 'cta', 'audio', 'logo', 'rating'].includes(b.type));
  const heroHTML = hero
    ? `<header class="hero" data-el="${hero.id}" data-block="${hero.id}"><div class="hero-art">${img(hero, assets)}</div><div class="hero-brand">${brand.map(b => block(b, assets)).join('')}</div></header>`
    : brand.map(b => block(b, assets)).join('');
  const audio = bs.find(b => b.type === 'audio'),
    font = source(c.fontAsset, assets),
    bg = source(c.bgAsset, assets),
    bgL = source(c.bgAssetL, assets);
  // Alert composition (00165): the CTA sits inside the alert card, so it scales with the card.
  const card = c.motion === 'alert' ? bs.find(b => b.type === 'image' && b.role === 'card') : null;
  const ctaHTML = cta
    ? `<div class="cta-wrap" data-el="${cta.id}" data-block="${cta.id}"><button class="cta ${source(cta.asset, assets) ? 'has-image' : ''}" id="cta" aria-label="${escapeHTML(cta.text || 'Continue')}">${img(cta, assets) || escapeHTML(cta.text)}</button></div>`
    : '';
  const cardHTML = b =>
    `<div class="image-block alert-card role-card" data-type="image" data-el="${escapeHTML(b.id)}" data-block="${escapeHTML(b.id)}" style="--bw:${Number(b.width) || 100}%;--bs:${(Number(b.width) || 100) / 100}"><div class="card-box">${img(b, assets)}${ctaHTML}</div></div>`;
  const body =
    project.product === 'fiction'
      ? `<div class="reader" id="reader" tabindex="0">${heroHTML}<section class="content">${content.map(b => block(b, assets)).join('')}</section></div>`
      : `<div class="cleaner-content">${bs
          .filter(b => !['cta', 'audio', 'logo', 'rating'].includes(b.type))
          .map(b => (b.type === 'hero' ? heroHTML : b === card ? cardHTML(b) : block(b, assets)))
          .join('')}</div>`;
  const config = {
    preview,
    previewSound,
    ios: project.iosUrl,
    android: project.androidUrl,
    motion: c.motion,
    product: project.product,
    volume: c.volume,
    hand: c.hand
  };
  return `<!doctype html><html lang="${escapeHTML(project.language || 'en')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover"><title>${escapeHTML(project.name)}</title><style>
 ${font ? `@font-face{font-family:Uploaded;src:url("${font}")}` : ''}
 *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${c.background};-webkit-text-size-adjust:100%;text-size-adjust:100%}body{font-family:${font ? 'Uploaded' : c.font === 'serif' ? 'Georgia' : 'Arial'},${c.font === 'serif' ? 'serif' : 'sans-serif'};color:${c.textColor};-webkit-tap-highlight-color:transparent}button{font:inherit}img{display:block;width:100%;height:auto;-webkit-user-drag:none}picture{display:block}p{margin:0 0 .85em}p:last-child{margin-bottom:0}mark{background:${c.accent};color:inherit;padding:0 .08em}h1{font-size:clamp(18px,calc(var(--fs)*1.32),46px);line-height:1.13;margin:0;text-wrap:balance;overflow-wrap:anywhere}ul{margin:0;padding:0;list-style:none}
 #stage{position:fixed;inset:0;overflow:hidden;--fs:max(14px,calc(${c.portrait.fontSize}/393*100vw));--cw:${c.portrait.contentWidth}%;--hh:${c.portrait.heroHeight}%;--ctaw:${c.portrait.ctaWidth}%;--ph:${c.portrait.panelHeight}%;--gap:${c.portrait.gap}px;background:${c.background};font-size:var(--fs)}
 [data-type="story"],[data-type="text"],[data-type="title"],[data-type="list"]{font-size:max(12px,calc(var(--bfsp)/393*100vw))!important}@media(min-aspect-ratio:1/1){[data-type="story"],[data-type="text"],[data-type="title"],[data-type="list"]{font-size:max(12px,calc(var(--bfsl)/393*100vh))!important}}
 .backdrop{position:absolute;inset:0;overflow:hidden;pointer-events:none}.backdrop picture{height:100%}.backdrop img{height:100%;object-fit:cover;object-position:${c.bgFocalX}% ${c.bgFocalY}%}.backdrop::after{content:"";position:absolute;inset:0;background:rgba(0,0,0,${c.bgShade / 100})}.content{position:relative;width:var(--cw);margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:var(--gap);padding:20px 0 max(120px,24vh)}.hero-brand>[data-block],.content>[data-block],.cleaner-content>[data-block]{width:var(--bw,100%);flex-shrink:0}.story,.copy{line-height:${c.lineHeight};overflow-wrap:anywhere}.hero{position:relative;width:100%;height:var(--hh);min-height:80px;flex-shrink:0}.hero-art{position:absolute;inset:0;overflow:hidden}.hero-art picture,.hero-art img{height:100%;object-fit:cover}.hero-brand{position:absolute;inset:auto 5% 5%;display:flex;flex-direction:column;align-items:center;gap:12px;z-index:2}.hero-brand:has(>*):before{content:"";position:absolute;inset:-60px -10% -30px;background:linear-gradient(transparent,rgba(0,0,0,.65));z-index:-1}.logo{font:700 max(14px,calc(var(--fs)*.7)) Arial;color:white}.logo img,.rating img{width:100%;height:auto;object-fit:contain}.rating{font:16px Arial;text-align:center}.rating .stars{color:#ffc861;display:block;letter-spacing:2px}.rating small{display:block;color:white;font-size:12px;margin-top:5px}.image-block img{max-height:38vh;object-fit:contain}.reader{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;touch-action:pan-y;scrollbar-width:none}.reader::-webkit-scrollbar{display:none}
 .layout-panel .reader{left:calc((100% - var(--cw))/2);width:var(--cw);top:calc((100% - var(--ph))/2 - 3%);height:var(--ph);background:rgba(0,0,0,${c.panelOpacity / 100});border-radius:${c.radius}px}.layout-panel .content{width:90%;padding:18px 0 32px}.layout-panel .hero{height:34%;min-height:120px}.layout-cover .reader,.layout-sticky .reader{padding-top:env(safe-area-inset-top)}.layout-sticky .hero{position:sticky;top:calc(-1 * (var(--hero-px) - var(--strip-px,105px)));z-index:3}.layout-sticky .hero-brand{bottom:10px}.layout-shrink .hero{position:absolute;top:5%;left:50%;width:var(--cw);height:var(--hh);transform:translateX(-50%) scale(var(--hero-scale,1));transform-origin:50% 0;z-index:2;pointer-events:none}.layout-shrink .content{padding-top:calc(var(--hero-px) + 8vh)}
 .cta-wrap{position:absolute;left:50%;bottom:calc(4% + env(safe-area-inset-bottom));transform:translateX(-50%);width:var(--ctaw);max-width:560px;z-index:10}.cta{display:block;width:100%;min-height:48px;border:0;border-radius:${c.radius}px;background:${c.accent};color:${c.ctaColor};font-family:Arial;font-size:max(14px,calc(var(--fs)*.8));font-weight:750;padding:14px 18px;cursor:pointer;box-shadow:0 4px 28px #0003;${c.pulse ? 'animation:pulse 1.6s ease-in-out infinite;' : ''}}.cta.has-image{background:transparent;box-shadow:none;padding:0;min-height:48px;display:flex;align-items:center}.cta img{max-height:18vh;object-fit:contain}.cta.has-image picture{width:100%;flex:1 1 auto;min-width:0}.cta img{pointer-events:none}.cta-wrap::before{content:"";position:absolute;inset:-35px -20px -30px;background:linear-gradient(transparent,${c.background});z-index:-1;pointer-events:none}.hint{position:absolute;right:12%;top:60%;z-index:8;pointer-events:none;font:34px Arial;animation:swipe 1.6s infinite;filter:drop-shadow(0 3px 4px #0005)}.hidden{display:none!important}.cleaner-content{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--gap);padding:calc(5% + env(safe-area-inset-top)) calc((100% - var(--cw))/2) max(90px,20vh);overflow:hidden}.cleaner-content .hero{height:var(--hh);width:100%;min-height:0}.cleaner-content .hero-art img{object-fit:contain}.checklist{display:flex;flex-direction:column;gap:12px;font-size:calc(var(--fs)*.83);text-align:left!important;line-height:1.35}.checklist li{display:flex;gap:10px;overflow-wrap:anywhere}.checklist span{color:${c.accent};font-weight:bold}.comparison{display:grid;grid-template-columns:1fr 1fr;gap:14px;width:100%}.comparison img{max-height:28vh;object-fit:contain}.comparison small{display:block;margin-top:8px;text-align:center}.cleaner-content .copy{font-size:calc(var(--fs)*.75)}
 .phone-sample{width:80%;height:clamp(90px,28vh,240px);margin:auto;border:4px solid #d6dfe7;border-radius:18px;background:white;padding:12px;display:flex;flex-direction:column;gap:12px;box-shadow:0 5px 14px #17314810}.photo-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;flex:1}.photo-grid i{background:linear-gradient(145deg,#b5d5c2 45%,#7fa0bb 46%,#e4d7b0);border-radius:4px}.after .photo-grid{grid-template-columns:1fr}.storage-sample{height:7px;border-radius:5px;background:linear-gradient(90deg,#e9a265 90%,#e8edf1 90%)}.after .storage-sample{background:linear-gradient(90deg,#76c496 30%,#e8edf1 30%)}@keyframes pulse{50%{scale:.95}}@keyframes swipe{0%{opacity:0;translate:0 16px}30%{opacity:1}70%{opacity:1;translate:0 -22px}100%{opacity:0;translate:0 -22px}}
 @media(min-aspect-ratio:1/1){#stage{--fs:max(12px,calc(${c.landscape.fontSize}/393*100vh));--cw:${c.landscape.contentWidth}%;--hh:${c.landscape.heroHeight}%;--ctaw:${c.landscape.ctaWidth}%;--ph:${c.landscape.panelHeight}%;--gap:${c.landscape.gap}px}.content{padding-bottom:max(90px,28vh)}.layout-cover .hero,.layout-sticky .hero{position:fixed;left:0;top:0;width:38%;height:100%;z-index:3}.layout-cover .reader,.layout-sticky .reader{left:38%;width:62%}.layout-cover .content,.layout-sticky .content{width:88%;padding-top:6vh}.layout-cover .cta-wrap,.layout-sticky .cta-wrap{left:69%;max-width:50%}.layout-cover .hint,.layout-sticky .hint{right:15%}.layout-panel .reader{top:5%}.layout-panel .content{padding-top:12px}.product-fiction.layout-panel .hero{display:none}.layout-shrink .hero{top:5%;width:30%;left:18%;height:75%}.layout-shrink .content{margin-left:38%;width:57%;padding-top:5vh}.layout-shrink .cta-wrap{left:68%;max-width:50%}.cleaner-content{flex-flow:row wrap;align-content:center;padding:4% 6% max(72px,23vh);gap:var(--gap)}.cleaner-content .hero{width:38%;height:var(--hh);position:absolute;left:5%;top:8%}.cleaner-content:has(.hero) > :not(.hero){margin-left:42%;width:calc(52% * var(--bs,1))}.cleaner-content:has(.hero)+.cta-wrap{left:70%;max-width:48%}.cleaner-content h1{font-size:clamp(18px,calc(var(--fs)*1.15),36px)}.cleaner-content .image-block img{max-height:34vh}.checklist{gap:7px}.hint{top:45%}}
 ${cleanerLayoutCSS}
 ${positionCSS(project)}</style></head><body><div id="stage" data-block="background" class="layout-${escapeHTML(c.motion)} product-${project.product}"><div class="backdrop">${bg || bgL ? img({ asset: c.bgAsset, assetL: c.bgAssetL, focalX: c.bgFocalX, focalY: c.bgFocalY }, assets) : ''}</div>${body}${card ? '' : ctaHTML}${audio && source(audio.asset, assets) ? `<audio id="music" loop preload="none" src="${escapeHTML(source(audio.asset, assets))}"></audio>` : ''}</div><script>(${runtime.toString()})(${JSON.stringify(config).replace(/</g, '\\u003c')});<\/script></body></html>`;
}
function runtime(config) {
  const selector = config.imported ? '[data-studio-block]' : '[data-block]',
    prefix = config.imported ? '--studio' : '--editor',
    blockId = el => (config.imported ? el.dataset.studioBlock : el.dataset.block);
  function translateParts(value) {
    let depth = 0,
      part = '',
      out = [];
    for (const ch of value) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (/\s/.test(ch) && !depth) {
        if (part) {
          out.push(part);
          part = '';
        }
      } else part += ch;
    }
    if (part) out.push(part);
    return out;
  }

  let stage = document.getElementById('stage'),
    reader = document.getElementById('reader') || document.querySelector('.scroll-container,.reader'),
    hero = document.querySelector('.hero'),
    music = document.getElementById('music') || document.querySelector('audio');
  let interacted = false,
    ctaLocked = false,
    ready = false,
    hostVisible = true,
    drag = null;
  const session = String(Date.now()) + '-' + Math.random().toString(36).slice(2);
  // Height of the zone the CTA occupies at the bottom; reader fades use it so the button never sits on readable text.
  function measureCta() {
    const cta = document.getElementById('cta');
    if (!cta || !stage) return;
    const zone = Math.max(
      0,
      innerHeight - (cta.offsetParent ? cta.getBoundingClientRect().top : innerHeight)
    );
    stage.style.setProperty('--cta-zone', Math.round(zone) + 'px');
  }
  function measure() {
    measureCta();
    if (hero && !config.native) {
      stage.style.setProperty(
        '--strip-px',
        Math.max(105, (hero.querySelector('.hero-brand')?.offsetHeight || 0) + 24) + 'px'
      );
      stage.style.setProperty(
        '--hero-px',
        (config.motion === 'shrink'
          ? (innerHeight * parseFloat(getComputedStyle(stage).getPropertyValue('--hh'))) / 100
          : hero.offsetHeight) + 'px'
      );
    }
  }
  function scrollEffect() {
    if (config.motion !== 'shrink' || !reader) return;
    const distance = config.native
      ? document.querySelector('.range-probe')?.offsetHeight || innerHeight * 0.55
      : innerHeight * 0.55;
    const p = Math.min(1, reader.scrollTop / distance);
    if (config.native) document.documentElement.style.setProperty('--p', String(p));
    else stage.style.setProperty('--hero-scale', String(1 - p * 0.45));
  }
  function start() {
    if (config.preview)
      document.body.dataset.runtimeInteractions = String(
        Number(document.body.dataset.runtimeInteractions || 0) + 1
      );
    interacted = true;
    document.getElementById('hint')?.classList.add('hidden');
    if (music && !document.hidden && hostVisible && (!config.preview || config.previewSound)) {
      music.muted = false;
      music.volume = Math.max(0, Math.min(1, config.volume / 100));
      music.play().catch(() => {});
    }
  }
  measure();
  // Elements added in PB follow their anchor element (the export does this with its own small script).
  if (config.imported && config.preview && typeof placeAnchored === 'function') placeAnchored(document, window);
  addEventListener('resize', () => {
    measure();
    scrollEffect();
  });
  hero?.querySelector('img')?.addEventListener('load', measure);
  document.querySelector('#cta img')?.addEventListener('load', measureCta);
  document.addEventListener(
    'pointerdown',
    e => {
      if (!e.target.closest('#cta')) start();
    },
    { passive: true }
  );
  document.addEventListener('keydown', e => {
    if (e.target.id !== 'cta') start();
  });
  reader?.addEventListener(
    'scroll',
    () => {
      start();
      scrollEffect();
    },
    { passive: true }
  );
  // Mouse drag emulates a finger swipe; touch and wheel retain native scrolling.
  if (config.preview && reader) {
    reader.addEventListener('pointerdown', e => {
      if (config.editPositions) return;
      if (e.pointerType === 'mouse' && e.button === 0) {
        drag = { y: e.clientY, top: reader.scrollTop };
        reader.setPointerCapture(e.pointerId);
        reader.classList.add('dragging');
      }
    });
    reader.addEventListener('pointermove', e => {
      if (drag) {
        reader.scrollTop = drag.top + drag.y - e.clientY;
      }
    });
    const end = () => {
      drag = null;
      reader.classList.remove('dragging');
    };
    reader.addEventListener('pointerup', end);
    reader.addEventListener('pointercancel', end);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) music?.pause();
  });
  function wireMraid() {
    try {
      if (typeof mraid === 'undefined') return;
      const init = () => {
        ready = true;
        hostVisible = typeof mraid.isViewable === 'function' ? mraid.isViewable() : true;
        mraid.addEventListener('viewableChange', v => {
          hostVisible = v;
          if (!v) music?.pause();
        });
        mraid.addEventListener('stateChange', s => {
          if (s === 'hidden') music?.pause();
        });
      };
      if (mraid.getState() === 'loading') mraid.addEventListener('ready', init);
      else init();
    } catch {}
  }
  wireMraid();
  function openStore() {
    if (config.preview) {
      start();
      document.body.dataset.runtimeCta = String(Number(document.body.dataset.runtimeCta || 0) + 1);
      parent.postMessage({ type: 'preview-cta' }, '*');
      return;
    }
    if (!interacted) {
      start();
      document.getElementById('cta').setAttribute('aria-label', 'Tap again to continue');
      return;
    }
    if (ctaLocked) return;
    ctaLocked = true;
    setTimeout(() => (ctaLocked = false), 1200);
    const ios =
        /iPhone|iPad|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
      url = ios ? config.ios : config.android || config.ios;
    try {
      if (typeof mraid !== 'undefined') {
        if (ready) mraid.open(url);
        return;
      }
      if (typeof AL !== 'undefined' && typeof AL.openStoreUrl === 'function') {
        AL.openStoreUrl(url);
        return;
      }
      if (typeof FbPlayableAd !== 'undefined' && typeof FbPlayableAd.onCTAClick === 'function') {
        FbPlayableAd.onCTAClick();
        return;
      }
      if (url) window.open(url, '_blank', 'noopener');
    } catch {}
  }
  document.getElementById('cta')?.addEventListener('click', openStore);
  // Secondary buttons (e.g. «Later» in an alert) also lead to the store.
  document.querySelectorAll('.cta-alt').forEach(b => b.addEventListener('click', openStore));
  // Countdown timers: mm:ss from data-timer seconds, restarting at zero.
  document.querySelectorAll('[data-timer]').forEach(el => {
    const total = Math.max(1, Number(el.dataset.timer) || 60);
    let left = total;
    setInterval(() => {
      left = left <= 0 ? total : left - 1;
      el.textContent =
        String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
    }, 1000);
  });
  // AI chat: question → «Ask AI Chat» → the user's message, typing dots, the typed answer → CTA.
  const chatStart = document.getElementById('chatStart');
  chatStart?.addEventListener('click', () => {
    start();
    const st = document.getElementById('stage'),
      answer = document.querySelector('.bubble.answer');
    if (!st || st.classList.contains('chat-on')) return;
    st.classList.add('chat-on', 'chat-typing');
    const full = answer ? answer.innerHTML : '';
    setTimeout(() => {
      st.classList.remove('chat-typing');
      st.classList.add('chat-answer');
      if (!answer) return st.classList.add('chat-done');
      const text = answer.textContent;
      let i = 0;
      answer.textContent = '';
      const timer = setInterval(() => {
        i += 2;
        answer.textContent = text.slice(0, i);
        if (i >= text.length) {
          clearInterval(timer);
          answer.innerHTML = full;
          st.classList.add('chat-done');
        }
      }, 22);
    }, 1100);
  });
  if (config.preview) {
    let move = null;
    const hud = document.createElement('div');
    hud.id = 'alignmentHUD';
    hud.setAttribute('aria-hidden', 'true');
    hud.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none';
    document.body.append(hud);
    let lastGuideLabel = '',
      lastHud = '';
    function drawGuides(guides = [], label = '') {
      if (!hud.isConnected) document.body.append(hud);
      if (!config.editPositions) {
        hud.replaceChildren();
        lastHud = '';
        return;
      }
      let h = '';
      for (const g of guides)
        h +=
          '<div data-guide="' +
          g.axis +
          '" style="position:absolute;background:#e94487;' +
          (g.axis === 'x'
            ? 'top:0;bottom:0;width:1px;left:' + g.value + 'px'
            : 'left:0;right:0;height:1px;top:' + g.value + 'px') +
          '"></div>';
      if (label !== lastGuideLabel) parent.postMessage({ type: 'editor-guides', label }, '*');
      lastGuideLabel = label;
      if (h !== lastHud) hud.innerHTML = lastHud = h;
    }
    addEventListener('resize', () => {
      move = null;
      drawGuides();
    });
    const overlay = document.createElement('style');
    overlay.id = 'editor-controls';
    overlay.textContent =
      'body[data-editor-mode="true"] ' +
      selector +
      ':not(#stage){cursor:move;touch-action:none;pointer-events:auto!important}body[data-editor-mode="true"] [data-editor-selected="true"]{outline:2px solid #9ad400;outline-offset:2px}body[data-editor-mode="true"] *{animation-play-state:paused!important;transition:none!important}body[data-editor-mode="true"] #hint{display:none!important}';
    if (config.imported)
      overlay.textContent +=
        '[data-studio-block]:not(#stage){cursor:pointer}[data-studio-block][data-editor-selected="true"]:not(#stage){outline:2px solid #9ad400;outline-offset:-2px}';
    document.head.append(overlay);
    function editorMode() {
      document.body.dataset.editorMode = String(!!config.editPositions);
      document.querySelectorAll(selector).forEach(el => {
        el.dataset.editorSelected = String(blockId(el) === config.selected);
      });
      drawGuides();
      drawHandles();
    }
    // Resize handles (imported creatives, «Рухати і розтягувати»): drag a side or a corner like in Figma.
    // The opposite side stays where it was; pictures keep their proportions, text boxes change width.
    const handles = document.createElement('div');
    handles.id = 'resizeHandles';
    handles.setAttribute('aria-hidden', 'true');
    handles.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none';
    document.body.append(handles);
    let resize = null;
    const selectedEl = () =>
      config.selected &&
      [...document.querySelectorAll(selector)].find(el => blockId(el) === config.selected && el.id !== 'stage');
    // Elements tied to an anchor are placed after layout: the handles follow them.
    window.pbAfterPlace = () => {
      drawHandles();
    };
    function drawHandles() {
      // A preview update rebuilds the page body; put the handle layer back.
      if (!handles.isConnected) document.body.append(handles);
      handles.replaceChildren();
      if (!config.imported || !config.editPositions) return;
      const el = selectedEl();
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const picture = el.tagName === 'IMG' || el.tagName === 'PICTURE' || el.classList.contains('studio-cta');
      const dirs = picture ? ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] : ['w', 'e'];
      const at = { n: r.top, s: r.bottom, w: r.left, e: r.right };
      for (const d of dirs) {
        const h = document.createElement('div');
        h.dataset.resize = d;
        // Kept inside the screen, so the handles of full-width elements can still be grabbed.
        const inside = (v, max) => Math.max(7, Math.min(max - 7, v)),
          x = inside(d.includes('w') ? at.w : d.includes('e') ? at.e : (r.left + r.right) / 2, innerWidth),
          y = inside(
            d.includes('n') ? at.n : d.includes('s') ? at.s : (Math.max(r.top, 0) + Math.min(r.bottom, innerHeight)) / 2,
            innerHeight
          );
        h.style.cssText =
          'position:absolute;width:12px;height:12px;margin:-6px 0 0 -6px;box-sizing:border-box;background:#c8f04a;border:2px solid #0d0e11;border-radius:3px;pointer-events:auto;touch-action:none;left:' +
          x +
          'px;top:' +
          y +
          'px;cursor:' +
          ({ n: 'ns', s: 'ns', e: 'ew', w: 'ew', ne: 'nesw', sw: 'nesw', nw: 'nwse', se: 'nwse' }[d] + '-resize');
        handles.append(h);
      }
    }
    addEventListener('scroll', () => drawHandles(), true);
    function translateFor(el) {
      const c = getComputedStyle(el),
        t = translateParts(c.translate),
        base = {
          x: c.getPropertyValue(prefix + '-base-x').trim() || t[0] || '0px',
          y: c.getPropertyValue(prefix + '-base-y').trim() || t[1] || '0px'
        };
      el.style.setProperty(prefix + '-base-x', base.x === 'none' ? '0px' : base.x);
      el.style.setProperty(prefix + '-base-y', base.y);
      el.style.setProperty(
        'translate',
        'calc(var(' + prefix + '-base-x) + var(' + prefix + '-x,0)*1vw) calc(var(' + prefix + '-base-y) + var(' + prefix + '-y,0)*1vh)',
        'important'
      );
      return { base, x: parseFloat(c.getPropertyValue(prefix + '-x')) || 0, y: parseFloat(c.getPropertyValue(prefix + '-y')) || 0 };
    }
    document.addEventListener(
      'pointerdown',
      e => {
        const handle = e.target.closest?.('[data-resize]');
        if (!handle || !config.editPositions) return;
        const el = selectedEl();
        if (!el) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const c = getComputedStyle(el),
          t = translateFor(el),
          r = el.getBoundingClientRect(),
          ref =
            c.position === 'fixed'
              ? innerWidth
              : c.position === 'absolute' && el.offsetParent
                ? el.offsetParent.clientWidth
                : (el.parentElement?.clientWidth || innerWidth) -
                  parseFloat(getComputedStyle(el.parentElement).paddingLeft || 0) -
                  parseFloat(getComputedStyle(el.parentElement).paddingRight || 0);
        resize = {
          el,
          id: blockId(el),
          dir: handle.dataset.resize,
          px: e.clientX,
          py: e.clientY,
          rect: r,
          width: el.offsetWidth,
          ratio: r.width / r.height,
          scale: r.width / el.offsetWidth || 1,
          ref: Math.max(1, ref),
          ...t,
          pointer: e.pointerId,
          handle
        };
        handle.setPointerCapture(e.pointerId);
      },
      true
    );
    document.addEventListener(
      'pointermove',
      e => {
        if (!resize) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const m = resize,
          d = m.dir,
          dx = e.clientX - m.px,
          dy = e.clientY - m.py;
        // Width change in screen pixels: sides follow the pointer; top/bottom handles of a picture
        // change its height, and the width follows the proportions.
        let dw = d.includes('e') ? dx : d.includes('w') ? -dx : 0;
        if (d === 'n' || d === 's') dw = (d === 's' ? dy : -dy) * m.ratio;
        const w = Math.max(16, m.rect.width + dw);
        m.pct = Math.round(Math.max(5, Math.min(300, (w / m.scale / m.ref) * 100)) * 10) / 10;
        m.el.style.setProperty('width', m.pct + '%', 'important');
        m.el.style.setProperty('max-width', 'none', 'important');
        m.el.style.setProperty('max-height', 'none', 'important');
        // Keep the opposite side in place.
        m.el.style.setProperty(prefix + '-x', m.x);
        m.el.style.setProperty(prefix + '-y', m.y);
        const now = m.el.getBoundingClientRect(),
          ax = d.includes('e') ? now.left - m.rect.left : d.includes('w') ? now.right - m.rect.right : (now.left + now.right) / 2 - (m.rect.left + m.rect.right) / 2,
          ay = d.includes('s') || d === 'e' || d === 'w' ? now.top - m.rect.top : d.includes('n') ? now.bottom - m.rect.bottom : 0;
        const clamp = n => Math.round(Math.max(-100, Math.min(100, n)) * 1000) / 1000;
        m.nx = clamp(m.x - (ax / m.scale / innerWidth) * 100);
        m.ny = clamp(m.y - (ay / m.scale / innerHeight) * 100);
        m.el.style.setProperty(prefix + '-x', m.nx);
        m.el.style.setProperty(prefix + '-y', m.ny);
        drawHandles();
        parent.postMessage({ type: 'editor-guides', label: 'Ширина ' + m.pct + '%' }, '*');
      },
      true
    );
    function finishResize(e) {
      if (!resize) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const m = resize;
      resize = null;
      if (m.handle.hasPointerCapture?.(m.pointer)) m.handle.releasePointerCapture(m.pointer);
      parent.postMessage({ type: 'editor-guides', label: '' }, '*');
      if (m.pct !== undefined)
        parent.postMessage(
          {
            type: 'resize-change',
            id: m.id,
            orientation: innerWidth > innerHeight ? 'landscape' : 'portrait',
            base: m.base,
            width: m.pct,
            x: m.nx,
            y: m.ny
          },
          '*'
        );
    }
    document.addEventListener('pointerup', finishResize, true);
    document.addEventListener('pointercancel', finishResize, true);
    editorMode();
    document.addEventListener(
      'pointerdown',
      e => {
        if (!config.editPositions || e.button !== 0) return;
        const el = e.target.closest('[data-studio-text-group]') || e.target.closest(selector);
        if (!el || el.id === 'stage') return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const c = getComputedStyle(el),
          t = translateParts(c.translate),
          base = {
            x: c.getPropertyValue(prefix + '-base-x').trim() || t[0] || '0px',
            y: c.getPropertyValue(prefix + '-base-y').trim() || t[1] || '0px'
          };
        if (el.dataset.importNode) {
          el.style.setProperty(prefix + '-base-x', base.x === 'none' ? '0px' : base.x);
          el.style.setProperty(prefix + '-base-y', base.y);
          el.style.setProperty(
            'translate',
            'calc(var(' +
              prefix +
              '-base-x) + var(' +
              prefix +
              '-x,0)*1vw) calc(var(' +
              prefix +
              '-base-y) + var(' +
              prefix +
              '-y,0)*1vh)',
            'important'
          );
        }
        const parentBox = el.parentElement?.getBoundingClientRect(),
          sx = parentBox && el.parentElement.offsetWidth ? parentBox.width / el.parentElement.offsetWidth : 1,
          sy =
            parentBox && el.parentElement.offsetHeight ? parentBox.height / el.parentElement.offsetHeight : 1;
        move = {
          base,
          sx: Math.max(0.05, sx),
          sy: Math.max(0.05, sy),
          el,
          id: blockId(el),
          px: e.clientX,
          py: e.clientY,
          x: parseFloat(c.getPropertyValue(prefix + '-x')) || 0,
          y: parseFloat(c.getPropertyValue(prefix + '-y')) || 0,
          pointer: e.pointerId,
          rect: el.getBoundingClientRect(),
          targets: [...document.querySelectorAll(selector)]
            .filter(
              other => other !== el && other.id !== 'stage' && !el.contains(other) && !other.contains(el)
            )
            .map(other => other.getBoundingClientRect())
            .filter(
              r =>
                r.width > 0 &&
                r.height > 0 &&
                r.right > 0 &&
                r.bottom > 0 &&
                r.left < innerWidth &&
                r.top < innerHeight
            )
        };
        config.selected = move.id;
        editorMode();
        el.setPointerCapture(e.pointerId);
        parent.postMessage({ type: 'select-block', id: move.id }, '*');
      },
      true
    );
    document.addEventListener(
      'pointermove',
      e => {
        if (!move) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        // One update per frame, however many pointer events arrive: smooth dragging on big creatives.
        move.pending = { x: e.clientX, y: e.clientY, alt: e.altKey };
        if (!move.frame) move.frame = requestAnimationFrame(() => applyMove());
      },
      true
    );
    function applyMove() {
      if (!move || !move.pending) return;
      move.frame = 0;
      const p = move.pending;
      let dx = p.x - move.px,
        dy = p.y - move.py;
      const r = move.rect;
      // Snapping is a little sticky once caught, so the element does not jitter on the guide.
      const snap = p.alt
        ? { dx: 0, dy: 0, guides: [] }
        : snapAlignment(
            { left: r.left + dx, right: r.right + dx, top: r.top + dy, bottom: r.bottom + dy },
            move.targets,
            innerWidth,
            innerHeight,
            move.snapped ? 9 : 6
          );
      move.snapped = snap.guides.length > 0;
      dx += snap.dx;
      dy += snap.dy;
      const clamp = n => Math.round(Math.max(-100, Math.min(100, n)) * 1000) / 1000;
      move.nx = clamp(move.x + (dx / move.sx / innerWidth) * 100);
      move.ny = clamp(move.y + (dy / move.sy / innerHeight) * 100);
      move.el.style.setProperty(prefix + '-x', move.nx);
      move.el.style.setProperty(prefix + '-y', move.ny);
      drawHandles();
      drawGuides(
        snap.guides,
        'X ' +
          Math.round(r.left + dx) +
          ' · Y ' +
          Math.round(r.top + dy) +
          (snap.guides.length ? ' · Вирівняно' : '') +
          (/mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent) ? ' · ⌥: без прив’язки' : ' · Alt: без прив’язки')
      );
    }
    function finishMove(e) {
      if (!move) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (move.frame) cancelAnimationFrame(move.frame);
      applyMove();
      const m = move;
      move = null;
      drawGuides();
      if (m.el.hasPointerCapture(m.pointer)) m.el.releasePointerCapture(m.pointer);
      if (m.nx !== undefined)
        parent.postMessage(
          {
            type: 'position-change',
            id: m.id,
            orientation: innerWidth > innerHeight ? 'landscape' : 'portrait',
            base: m.base,
            x: m.nx,
            y: m.ny
          },
          '*'
        );
    }
    document.addEventListener('pointerup', finishMove, true);
    document.addEventListener('pointercancel', finishMove, true);
    document.addEventListener(
      'click',
      e => {
        if (config.editPositions) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true
    );
    document.body.dataset.runtimeSession = session;
    // Imported ads often disable pointer events or capture pointers on a reader.
    // Select at pointerdown before that capture, and fall back to visible bounds.
    // Everything under the pointer, top element first. A second click on the same spot steps to the
    // next element below (like Figma), so decorations and covered elements can be picked too.
    let lastPick = null;
    function importedTarget(e) {
      const group = el => el.closest('[data-studio-text-group]') || el;
      const hit = el => {
        if (el.id === 'stage') return false;
        const c = getComputedStyle(el);
        if (c.visibility === 'hidden' || c.display === 'none' || c.opacity === '0') return false;
        // Inline text counts by its whole box, so a tap between lines or paragraphs still hits it.
        const rects = c.display === 'inline' ? [el.getBoundingClientRect()] : [...el.getClientRects()];
        return rects.some(
          r =>
            r.width > 0 &&
            r.height > 0 &&
            e.clientX >= r.left &&
            e.clientX <= r.right &&
            e.clientY >= r.top &&
            e.clientY <= r.bottom
        );
      };
      const direct = e.target.closest('[data-studio-text-group]') || e.target.closest(selector);
      const area = el => {
        const r = el.getBoundingClientRect();
        return r.width * r.height;
      };
      // Hint decorations (the swipe hand) come last: a click on text under the hand edits the text.
      const decoration = el => !!el.closest('[class*="hand" i],[class*="finger" i],[class*="tap" i]');
      const list = [];
      if (direct && direct.id !== 'stage' && !decoration(direct)) list.push(group(direct));
      for (const el of [...document.querySelectorAll(selector)]
        .filter(hit)
        .sort((a, b) => decoration(a) - decoration(b) || area(a) - area(b))) {
        const g = group(el);
        if (!list.includes(g)) list.push(g);
      }
      if (!list.length) return null;
      const same =
        lastPick && Math.abs(lastPick.x - e.clientX) < 6 && Math.abs(lastPick.y - e.clientY) < 6;
      const at = list.findIndex(el => blockId(el) === config.selected);
      const pick = same && at >= 0 ? list[(at + 1) % list.length] : list[0];
      lastPick = { x: e.clientX, y: e.clientY };
      return pick;
    }
    document.addEventListener(
      'pointerdown',
      e => {
        if (!config.imported || config.editPositions || e.button !== 0) return;
        const b = importedTarget(e);
        if (b) {
          config.selected = blockId(b);
          editorMode();
          parent.postMessage({ type: 'select-block', id: blockId(b) }, '*');
        }
      },
      true
    );
    document.addEventListener('click', e => {
      if (config.imported) return;
      const b = e.target.closest(selector);
      if (b) parent.postMessage({ type: 'select-block', id: blockId(b) }, '*');
    });
    function morph(old, fresh) {
      if (old.nodeType !== fresh.nodeType || old.nodeName !== fresh.nodeName) {
        old.replaceWith(fresh.cloneNode(true));
        return;
      }
      if (old.nodeType === Node.TEXT_NODE) {
        if (old.data !== fresh.data) old.data = fresh.data;
        return;
      }
      if (old.nodeType !== Node.ELEMENT_NODE) return;
      for (const a of [...old.attributes])
        if (!fresh.hasAttribute(a.name) && !a.name.startsWith('data-runtime-')) old.removeAttribute(a.name);
      for (const a of [...fresh.attributes])
        if (old.getAttribute(a.name) !== a.value) old.setAttribute(a.name, a.value);
      for (let i = 0; i < fresh.childNodes.length; i++) {
        if (old.childNodes[i]) morph(old.childNodes[i], fresh.childNodes[i]);
        else old.append(fresh.childNodes[i].cloneNode(true));
      }
      while (old.childNodes.length > fresh.childNodes.length) old.lastChild.remove();
    }
    addEventListener('message', e => {
      if (e.source !== parent) return;
      if (e.data?.type === 'set-editor-mode') {
        Object.assign(config, { editPositions: e.data.enabled, selected: e.data.selected });
        editorMode();
      }
      if (e.data?.type === 'set-scroll' && reader) {
        reader.scrollTop = e.data.value;
        scrollEffect();
      }
      if (e.data?.type === 'preview-sound') {
        config.previewSound = !!e.data.enabled;
        if (!config.previewSound) music?.pause();
        else if (interacted) start();
      }
      if (e.data?.type === 'update-document') {
        const fresh = new DOMParser().parseFromString(e.data.html, 'text/html'),
          newStage = fresh.getElementById('stage');
        if (!newStage) return;
        const savedScroll = reader?.scrollTop || 0,
          animations = [...document.querySelectorAll('.cta,.hint')].flatMap(el =>
            el.getAnimations().map(a => ({ el, name: a.animationName, time: a.currentTime }))
          );
        const style = document.querySelector('style'),
          newStyle = fresh.querySelector('style');
        if (style.textContent !== newStyle.textContent) style.textContent = newStyle.textContent;
        if (stage === document.body) hud.remove();
        morph(stage, newStage);
        if (stage === document.body) document.body.append(hud);
        Object.assign(config, e.data.config);
        editorMode();
        stage = document.getElementById('stage');
        hero = document.querySelector('.hero');
        music = document.getElementById('music') || document.querySelector('audio');
        if (reader) reader.scrollTop = savedScroll;
        if (interacted) document.getElementById('hint')?.classList.add('hidden');
        measure();
        scrollEffect();
        window.pbPlaceAnchored?.();
        for (const item of animations)
          for (const a of item.el.getAnimations())
            if (a.animationName === item.name && item.time != null) a.currentTime = item.time;
        parent.postMessage({ type: 'preview-updated', token: e.data.token }, '*');
      }
    });
    reader?.addEventListener(
      'scroll',
      () => parent.postMessage({ type: 'preview-scroll', value: reader.scrollTop }, '*'),
      { passive: true }
    );
    // Small DOM diagnostics make real rendering and time progression testable.
    let ticks = 0;
    setInterval(() => {
      document.body.dataset.runtimeTicks = String(++ticks);
      document.body.dataset.runtimeScroll = String(reader?.scrollTop || 0);
      document.body.dataset.runtimeProgress = getComputedStyle(document.documentElement).getPropertyValue(
        '--p'
      );
      const a = document.querySelector('.cta')?.getAnimations()[0];
      document.body.dataset.runtimeAnimation = String(a?.currentTime ?? 'none');
      document.body.dataset.runtimeViewport = innerWidth + 'x' + innerHeight;
    }, 200);
  }
}

export { runtime as runCreative };

// Play mode / standalone preview: the exported playable runs as on a phone inside a sandboxed frame
// (no access to the studio). The store is never opened; a CTA tap is reported to the parent page.
const PLAY_STUB =
  '<script>(function(){var r=function(u){parent.postMessage({type:"studio-cta",url:String(u||"")},"*")};' +
  'window.mraid={getState:function(){return"default"},getVersion:function(){return"2.0"},' +
  'isViewable:function(){return true},addEventListener:function(){},removeEventListener:function(){},' +
  'open:r,close:function(){},useCustomClose:function(){},getPlacementType:function(){return"interstitial"},' +
  'getMaxSize:function(){return{width:innerWidth,height:innerHeight}},' +
  'getScreenSize:function(){return{width:screen.width,height:screen.height}}};' +
  'window.open=function(u){r(u);return{}};})()</' +
  'script>';
export function playableHTML(html) {
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + PLAY_STUB) : PLAY_STUB + html;
}
