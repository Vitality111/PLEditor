import { positionCSS } from './positions.js';
import { fictionStyles } from './fiction-styles.js';
// Preserve the original Fiction Me DOM layers and CSS. Both preview and export
// call this renderer; preview changes only store navigation and sound controls.
// Editable text fades. 'auto' keeps the template's own gradients (panel has none),
// 'custom' draws a gradient of the chosen colour, height (% of the reading area) and strength.
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',');
const isHex = v => /^#[\da-f]{6}$/i.test(v || '');
export function fadeCSS(c, mode) {
  let css = '.native-panel .fade-top,.native-panel .fade-bottom,.native-shrink .fade-top{display:none}';
  for (const [key, side] of [
    ['fadeTop', 'top'],
    ['fadeBottom', 'bottom']
  ]) {
    const f = c[key];
    if (!f || f.mode === 'auto') continue;
    const sel = `.app .fade-${side}`;
    if (f.mode === 'off') {
      css += `${sel}{display:none!important}`;
      continue;
    }
    const color = rgb(isHex(f.color) ? f.color : isHex(c.background) ? c.background : '#000000'),
      a = (f.strength ?? 100) / 100,
      to = side === 'top' ? 'bottom' : 'top';
    css += `${sel}{display:block!important;position:absolute;${side}:0;${side === 'top' ? 'bottom' : 'top'}:auto;left:0;right:0;pointer-events:none;z-index:${mode === 'shrink' ? 6 : 2};height:${f.portrait}%!important;background:linear-gradient(to ${to},rgba(${color},${a}) 0%,rgba(${color},${a}) 30%,rgba(${color},0) 100%)!important}`;
    css += `@media(min-aspect-ratio:1/1){${sel}{height:${f.landscape}%!important}${mode === 'cover' || mode === 'sticky' ? `${sel}{left:var(--coverW)}` : ''}}`;
  }
  return css;
}
export function fictionDocument(
  project,
  assets,
  { escapeHTML, rich, runtime, preview = false, previewSound = false }
) {
  const c = project.settings,
    blocks = project.blocks.filter(b => b.enabled),
    mode = c.motion;
  const asset = id => assets[id]?.data || assets[id]?.url || '';
  const tag = b =>
    `data-block="${escapeHTML(b.id)}" data-el="${escapeHTML(b.id)}" data-type="${escapeHTML(b.type)}"`;
  const picture = (id, idL = '', cls = '') => {
    const p = asset(id),
      l = asset(idL);
    return p || l
      ? `<picture class="${cls}">${l ? `<source media="(min-aspect-ratio:1/1)" srcset="${escapeHTML(l)}">` : ''}<img src="${escapeHTML(p || l)}" alt=""></picture>`
      : '';
  };
  const hero = blocks.find(b => b.type === 'hero'),
    logo = blocks.find(b => b.type === 'logo'),
    rating = blocks.find(b => b.type === 'rating'),
    cta = blocks.find(b => b.type === 'cta'),
    audio = blocks.find(b => b.type === 'audio');
  const content = blocks
    .filter(b => !['hero', 'logo', 'rating', 'cta', 'audio'].includes(b.type))
    .map(b => {
      const style = `style="width:${Number(b.width) || 100}%;text-align:${b.align || 'left'};--bfsp:${b.fontSizePortrait ?? c.portrait.fontSize};--bfsl:${b.fontSizeLandscape ?? c.landscape.fontSize};color:${b.textColor || c.textColor}"`;
      if (b.type === 'story' || b.type === 'text')
        return `<article class="${b.type === 'story' ? 'story' : 'copy'}" ${tag(b)} ${style}>${rich(b.text)}</article>`;
      if (b.type === 'title') return `<h1 ${tag(b)} ${style}>${escapeHTML(b.text)}</h1>`;
      if (b.type === 'image')
        return `<div class="image-block" ${tag(b)} ${style}>${picture(b.asset, b.assetL)}</div>`;
      if (b.type === 'list')
        return `<ul class="checklist" ${tag(b)} ${style}>${String(b.text)
          .split('\n')
          .filter(Boolean)
          .map(t => `<li>✓ ${escapeHTML(t)}</li>`)
          .join('')}</ul>`;
      if (b.type === 'comparison')
        return `<div class="comparison" ${tag(b)}><div>${picture(b.asset)}<small>${escapeHTML(b.text)}</small></div><div>${picture(b.afterAsset)}<small>${escapeHTML(b.afterText)}</small></div></div>`;
      return '';
    })
    .join('');
  const brand = logo
    ? `<div class="brand" ${tag(logo)} style="width:${Number(logo.width) || 30}%">${picture(logo.asset, logo.assetL) || escapeHTML(logo.text)}</div>`
    : '';
  const rate = rating
    ? `<div class="rating" ${tag(rating)}>${picture(rating.asset) || `<span>★★★★★</span><small>${escapeHTML(rating.text)}</small>`}</div>`
    : '';
  const rateL = rating
    ? `<div class="ratingL" ${tag(rating)}>${picture(rating.assetL || rating.asset)}</div>`
    : '';
  const cover = hero
    ? `<header class="cover" ${tag(hero)}><div class="cover-art">${picture(hero.asset, hero.assetL, 'cover-picture')}</div><div class="cover-shade"></div>${brand}${rate}</header>`
    : `${brand}${rate}`;
  const bg = `<div class="bg">${picture(c.bgAsset, c.bgAssetL)}</div>`;
  const text = `<div class="scroll-content" id="scrollContent">${content}</div>`;
  let markup;
  if (mode === 'panel')
    markup = `${bg}<div class="panel"><div class="scroll-container" id="reader" tabindex="0">${hero ? cover : ''}${text}</div><div class="fade-top"></div><div class="fade-bottom"></div></div>`;
  else if (mode === 'shrink')
    markup = `${bg}<div class="stage"><div class="scroll-container" id="reader" tabindex="0">${text}<div class="range-probe"></div></div><div class="band">${picture(c.bgAsset, c.bgAssetL)}</div>${hero ? `<div class="hero" ${tag(hero)}>${picture(hero.asset, hero.assetL)}</div>` : ''}<div class="fade-top"></div><div class="fade-bottom"></div></div>`;
  else
    markup = `${bg}<div class="scroll-container" id="reader" tabindex="0">${cover}${text}</div>${rateL}<div class="fade-top"></div><div class="fade-bottom"></div>`;
  if (cta)
    markup += `<button class="cta ${asset(cta.asset) ? 'has-image' : ''}" id="cta" ${tag(cta)} aria-label="${escapeHTML(cta.text || 'Continue')}">${picture(cta.asset, cta.assetL) || escapeHTML(cta.text)}</button>`;
  if (c.hand)
    markup += `<div class="hand hint" id="hint" aria-hidden="true">${picture('fcm-cover/hand.png', 'fcm-cover/handL.png')}</div>`;
  if (audio && asset(audio.asset))
    markup += `<audio id="music" preload="none" loop src="${escapeHTML(asset(audio.asset))}"></audio>`;
  const font = asset(c.fontAsset);
  const fades = fadeCSS(c, mode);
  const override = `
 .native-cover .cta,.native-sticky .cta,.native-panel .cta,.native-shrink .cta,.native-shrink .hero{--editor-base-x:-50%}
 ${font ? `@font-face{font-family:BuilderFont;src:url("${font}");font-weight:400;font-style:normal}` : ''}
 html,body{font-family:${font ? 'BuilderFont' : c.font === 'serif' ? 'Georgia' : 'Arial'},serif;background:${c.background}}
 :root{--bg:${c.background};--builder-fs:max(14px,calc(${c.portrait.fontSize}/393*100vw));--builder-cta:${c.portrait.ctaWidth}%;--builder-width:${c.portrait.contentWidth}%;--builder-gap:${c.portrait.gap}px;--builder-hero:${(c.portrait.heroScale ?? 100) / 100};--builder-cover-h:${c.portrait.heroHeight}vh;--panel:rgba(9,9,9,${c.panelOpacity / 100});--fade0:${c.background}00;--fade1:${c.background}e0}
 .app{font-family:inherit}.bg picture,.bg img{width:100%;height:100%;object-fit:cover;object-position:${c.bgFocalX}% ${c.bgFocalY}%}.band picture{display:block}.band img{object-position:${c.bgFocalX}% ${c.bgFocalY}%}.bg:after{content:"";position:absolute;inset:0;background:rgba(0,0,0,${c.bgShade / 100})}
 .cover-art{position:absolute;inset:0}.cover-picture,.cover-picture img{width:100%;height:100%;object-fit:${hero?.fit || 'cover'};object-position:${hero?.focalX ?? 50}% ${hero?.focalY ?? 15}%}
 .brand img,.rating img,.ratingL img{width:100%;height:auto}.brand{color:white;font:700 16px Arial}.rating small{font:12px Arial}.rating span{color:#ffd263}
 .scroll-content{font-size:var(--builder-fs);line-height:${c.lineHeight};color:${c.textColor};display:flex;flex-direction:column;align-items:center;gap:var(--builder-gap)}
 [data-type="story"],[data-type="text"],[data-type="title"],[data-type="list"]{font-size:max(12px,calc(var(--bfsp)/393*100vw))!important}
 @media(min-aspect-ratio:1/1){[data-type="story"],[data-type="text"],[data-type="title"],[data-type="list"]{font-size:max(12px,calc(var(--bfsl)/393*100vh))!important}}
 .story,.copy{overflow-wrap:anywhere;font:inherit;line-height:inherit}.story p,.copy p{text-wrap:pretty;margin:0 0 .85em}.story p:last-child,.copy p:last-child{margin-bottom:0}mark{background:${c.accent};color:inherit;padding:0 .08em}h1{font-size:1.3em;line-height:1.15;overflow-wrap:anywhere}.image-block img{max-height:35vh;object-fit:contain}.checklist{list-style:none;font-size:.9em;line-height:1.4}.checklist li{padding-bottom:.5em}.comparison{display:grid;grid-template-columns:1fr 1fr;gap:14px}.comparison img{max-height:28vh;object-fit:contain}
 .panel{background:rgba(9,9,9,${c.panelOpacity / 100});border-radius:${c.radius}px}.native-panel .panel{translate:none;width:var(--builder-width);left:calc((100% - var(--builder-width))/2);height:${c.portrait.panelHeight}%;top:calc((100% - ${c.portrait.panelHeight}%)/2 - 3%)}
 .native-panel .scroll-content{width:calc(100% - 28px);max-width:100%;min-width:0;margin-inline:auto;padding:14px 0 24px;box-sizing:border-box}.native-panel .scroll-content>[data-block]{max-width:100%;min-width:0;box-sizing:border-box}.native-panel .story,.native-panel .copy{white-space:normal;overflow-wrap:anywhere}
 .native-cover .scroll-content,.native-sticky .scroll-content{width:var(--builder-width)}.native-cover .cover,.native-sticky .cover{height:var(--builder-cover-h);aspect-ratio:auto}.native-sticky .cover{top:calc(-.62 * var(--builder-cover-h) + env(safe-area-inset-top))}.native-shrink .hero{width:calc(920 * var(--u) * var(--builder-hero));top:calc(204 * var(--u) + ${c.portrait.heroOffset ?? 0}vh)}.native-shrink .scroll-content{padding-top:calc(1173 * var(--u) * var(--builder-hero) + ${c.portrait.heroOffset ?? 0}vh)}.native-shrink .scroll-content{width:var(--builder-width)}
 .cta{font:700 max(14px,calc(var(--builder-fs)*.8)) Arial;display:flex;align-items:center;justify-content:center;min-height:52px;max-width:90%;border:0;border-radius:${c.radius}px;background:${asset(cta?.asset) ? 'transparent' : c.accent};color:${c.ctaColor};padding:${asset(cta?.asset) ? '0' : '10px 18px'};width:var(--builder-cta);aspect-ratio:auto;${c.pulse ? '' : 'animation:none;'}}
 .cta picture{width:100%}.cta img{width:100%;height:auto;max-height:18vh;object-fit:contain}.hand{pointer-events:none}.hand picture{display:block;width:100%;height:100%}.hand img{display:block;width:100%;height:100%;object-fit:contain}.native-panel .hand,.native-shrink .hand{position:absolute;z-index:5;left:55.65%;top:59.59%;width:12.04%;aspect-ratio:130/340;animation:builderHandMove 1.5s linear infinite}@keyframes builderHandMove{0%,100%{transform:translateY(0)}50%{transform:translateY(-30%)}}@media(min-aspect-ratio:1/1){.native-panel .hand,.native-shrink .hand{left:60%;top:43.98%;width:22.69vh;aspect-ratio:245/297}}.hidden{display:none!important}.scroll-container{cursor:grab}.scroll-container.dragging{cursor:grabbing}
 .native-cover .fade-bottom,.native-sticky .fade-bottom{height:max(calc(11.16% + env(safe-area-inset-bottom)),calc(var(--cta-zone,0px) + 4vh));background:linear-gradient(to bottom,var(--fade0) 0%,var(--bg) 62%)} .native-shrink .fade-bottom{height:max(calc(295 * var(--u) + env(safe-area-inset-bottom)),calc(var(--cta-zone,0px) + 4vh))}
 @media(min-aspect-ratio:1/1){.native-cover .fade-bottom,.native-sticky .fade-bottom{height:max(calc(21.11% + env(safe-area-inset-bottom)),calc(var(--cta-zone,0px) + 4vh))}}
 @media(min-aspect-ratio:1/1){:root{--builder-fs:max(12px,calc(${c.landscape.fontSize}/393*100vh));--builder-cta:${c.landscape.ctaWidth}vw;--builder-width:${c.landscape.contentWidth}%;--builder-gap:${c.landscape.gap}px;--builder-hero:${(c.landscape.heroScale ?? 100) / 100};--coverW:${c.landscape.coverWidth ?? 38}vw}.native-panel .panel{translate:none;width:var(--builder-width);left:calc((100% - var(--builder-width))/2);height:${c.landscape.panelHeight}%;top:5%}.native-cover .cover,.native-sticky .cover{height:100%;top:0;width:var(--coverW)}.native-shrink .hero{width:calc(650 * var(--u) * var(--builder-hero));top:${c.landscape.heroOffset ?? 0}vh}.native-shrink .scroll-content{padding-top:calc(661 * var(--u) * var(--builder-hero) + ${c.landscape.heroOffset ?? 0}vh )}.native-cover .scroll-content,.native-sticky .scroll-content{width:var(--builder-width);margin-left:calc((100% - var(--builder-width))/2)}.native-cover .cta,.native-sticky .cta{max-width:calc(var(--panelW)*.85)}.native-shrink .scroll-content{width:var(--builder-width)}}
 `;
  const config = {
    preview,
    previewSound,
    ios: project.iosUrl,
    android: project.androidUrl,
    motion: mode,
    product: 'fiction',
    volume: c.volume,
    hand: c.hand,
    native: true
  };
  return `<!doctype html><html lang="${escapeHTML(project.language || 'en')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover"><title>${escapeHTML(project.name)}</title><style>${fictionStyles[mode]}${override}${fades}${positionCSS(project)}</style></head><body><div class="app native-${mode}" id="stage" data-block="background">${markup}</div><script>(${runtime.toString()})(${JSON.stringify(config).replace(/</g, '\\u003c')});<\/script></body></html>`;
}
