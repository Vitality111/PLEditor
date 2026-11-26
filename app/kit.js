// Coded templates (kit 2): every element is HTML/CSS and editable in the inspector, including the CTA.
// Fiction Me: titlecover, niche, infocard, page, panel2. Cleaner: textbanner, aichat, alertphoto, mockup, compare.
// Sizes are design px of a 393×852 portrait / 852×393 landscape frame (see the playable-ads skill):
// --uw = 1 px by width, --u = 1 px that never overflows either axis.
import { positionCSS } from './positions.js';

const isHex = v => /^#[\da-f]{6}$/i.test(v || '');
const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : d);

export const FICTION_MODES = ['titlecover', 'niche', 'infocard', 'page', 'panel2'];
export const CLEANER_MODES = ['textbanner', 'aichat', 'alertphoto', 'mockup', 'compare'];
export const KIT_MODES = [...FICTION_MODES, ...CLEANER_MODES];
export const isKit = project => project.kind !== 'html' && KIT_MODES.includes(project.settings?.motion);

export function kitDocument(
  project,
  assets,
  { escapeHTML: esc, rich, runtime, preview = false, previewSound = false }
) {
  const c = project.settings,
    mode = c.motion,
    fiction = project.product === 'fiction',
    blocks = project.blocks.filter(b => b.enabled);
  const src = id => assets[id]?.data || assets[id]?.url || '';
  const tag = b => `data-type="${esc(b.type)}" data-el="${esc(b.id)}" data-block="${esc(b.id)}"`;
  const picture = (id, idL = '', cls = '', style = '') => {
    const p = src(id),
      l = src(idL);
    return p || l
      ? `<picture class="${cls}">${l ? `<source media="(min-aspect-ratio:1/1)" srcset="${esc(l)}">` : ''}<img src="${esc(p || l)}" alt="" style="${style}"></picture>`
      : '';
  };
  // Per-block inline variables: width, font sizes, colours.
  const vars = b => {
    const v = [`--bw:${num(b.width, 100)}%`, `--bs:${num(b.width, 100) / 100}`];
    if (b.fontSizePortrait) v.push(`--bfsp:${b.fontSizePortrait}`);
    if (b.fontSizeLandscape) v.push(`--bfsl:${b.fontSizeLandscape}`);
    if (isHex(b.textColor)) v.push(`--bc:${b.textColor}`);
    if (isHex(b.bgColor)) v.push(`--bbg:${b.bgColor}`);
    if (isHex(b.accentColor)) v.push(`--bac:${b.accentColor}`);
    if (['left', 'center', 'right'].includes(b.align)) v.push(`--ba:${b.align}`);
    if (b.weight) v.push(`--bwt:${num(b.weight, 400)}`);
    v.push(`--bst:${b.italic ? 'italic' : 'normal'}`, `--btt:${b.upper ? 'uppercase' : 'none'}`);
    return `style="${v.join(';')}"`;
  };
  const role = b => (b.role ? ` r-${esc(b.role)}` : '');
  const lines = t =>
    String(t || '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

  function ctaButton(b, extraClass = '') {
    if (!b) return '';
    const img = picture(b.asset, b.assetL);
    const icon =
      b.icon === 'sparkle'
        ? '<span class="cta-ic" aria-hidden="true">✦</span>'
        : b.icon === 'arrow'
          ? '<span class="cta-ic" aria-hidden="true">›</span>'
          : '';
    const style = [
      `--cbg:${isHex(b.bgColor) ? b.bgColor : c.accent}`,
      `--cbg2:${isHex(b.bgColor2) ? b.bgColor2 : isHex(b.bgColor) ? b.bgColor : c.accent}`,
      `--ccol:${isHex(b.textColor) ? b.textColor : '#ffffff'}`,
      `--crad:${num(b.radius, 999)}px`,
      `--ch:${num(b.height, 52)}`,
      `--cfs:${num(b.fontSize, 18)}`,
      `--cwt:${num(b.weight, 700)}`,
      `--ctt:${b.upper ? 'uppercase' : 'none'}`,
      `--csh:${b.shadow === false ? 'none' : '0 6px 18px rgba(0,0,0,.22)'}`
    ].join(';');
    return `<div class="cta-wrap ${extraClass}" ${tag(b)} style="${style}"><button class="cta ${img ? 'has-image' : ''} ${c.pulse ? 'pulse' : ''}" id="cta" aria-label="${esc(b.text || 'Continue')}">${img || `${b.icon === 'sparkle' ? icon : ''}<span>${esc(b.text)}</span>${b.icon === 'arrow' ? icon : ''}`}</button></div>`;
  }

  function block(b) {
    const t = tag(b),
      s = vars(b);
    switch (b.type) {
      case 'title':
        return `<h1 class="k-text k-title${role(b)}" ${t} ${s}>${esc(b.text)}</h1>`;
      case 'story':
        return `<article class="k-text k-story story${role(b)}" ${t} ${s}>${rich(b.text)}</article>`;
      case 'text':
        return `<div class="k-text k-copy${role(b)}" ${t} ${s}>${rich(b.text)}</div>`;
      case 'list': {
        const style = ['number', 'check', 'dot'].includes(b.listStyle) ? b.listStyle : 'number';
        return `<ol class="k-text k-list l-${style}${role(b)}" ${t} ${s}>${lines(b.text)
          .map(
            (x, i) =>
              `<li><span class="li-mark">${style === 'number' ? i + 1 + '.' : style === 'check' ? '✓' : '•'}</span><span>${esc(x)}</span></li>`
          )
          .join('')}</ol>`;
      }
      case 'image':
      case 'hero':
        return `<div class="k-image${role(b)}" ${t} ${s}>${picture(b.asset, b.assetL, '', `object-position:${num(b.focalX, 50)}% ${num(b.focalY, 30)}%`)}</div>`;
      case 'logo':
        return `<div class="k-logo${role(b)}" ${t} ${s}>${picture(b.asset, b.assetL) || `<span class="logo-mark" aria-hidden="true"></span><span>${esc(b.text)}</span>`}</div>`;
      case 'stats':
        return `<div class="k-stats${role(b)}" ${t} ${s}>${lines(b.text)
          .map(l => {
            const hot = l.startsWith('*'),
              [v, label = ''] = l.replace(/^\*/, '').split('|');
            return `<div class="stat ${hot ? 'hot' : ''}"><b>${esc(v.trim())}</b>${label.trim() ? `<small>${esc(label.trim())}</small>` : ''}</div>`;
          })
          .join('')}</div>`;
      case 'bar': {
        const p = Math.max(0, Math.min(100, num(b.percent, 83)));
        return `<div class="k-bar${role(b)}" ${t} ${s}><div class="bar-head"><span>${esc(b.label || '')}</span><span>${p}%</span></div><div class="bar-track"><i style="width:${p}%"></i></div>${b.text ? `<div class="bar-value">${esc(b.text)}</div>` : ''}${b.note ? `<small class="bar-note">${esc(b.note)}</small>` : ''}</div>`;
      }
      case 'timer': {
        const sec = Math.max(1, Math.round(num(b.seconds, 60)));
        const mm = String(Math.floor(sec / 60)).padStart(2, '0'),
          ss = String(sec % 60).padStart(2, '0');
        return `<div class="k-timer${role(b)}" ${t} ${s} data-timer="${sec}">${mm}:${ss}</div>`;
      }
      case 'rings': {
        const side = (k, fallback) => {
          const v = Math.max(0, Math.min(100, num(b[k + 'Value'], fallback.value)));
          const col = isHex(b[k + 'Color']) ? b[k + 'Color'] : fallback.color;
          return `<div class="ring-card"><b>${esc(b[k + 'Title'] ?? fallback.title)}</b><small>${esc(b[k + 'Sub'] ?? fallback.sub)}</small><div class="ring" style="--rv:${v};--rc:${col}"><span>${v}%</span></div></div>`;
        };
        return `<div class="k-rings${role(b)}" ${t} ${s}>${side('a', { title: 'Buy Storage', sub: 'Extra cost', value: 99, color: '#ef5b3f' })}<div class="ring-vs">${esc(b.vsText || 'VS.')}</div>${side('b', { title: 'Smart Cleaner', sub: 'No extra cost', value: 52, color: '#21a07a' })}</div>`;
      }
      case 'chat':
        return `<div class="k-chat${role(b)}" ${t} ${s}><div class="chat-q1">${esc(b.question)}</div><button class="chat-start cta-start" id="chatStart"><span class="cta-ic" aria-hidden="true">✦</span><span>${esc(b.start || 'Ask AI Chat')}</span></button><div class="chat-screen"><div class="chat-head"><span aria-hidden="true">✦</span> ${esc(b.header || 'AI Chat')}</div><div class="bubble me">${esc(b.question)}</div><div class="bubble bot typing" aria-hidden="true"><i></i><i></i><i></i></div><div class="bubble bot answer" data-answer="${esc(b.answer)}">${rich(b.answer)}</div></div></div>`;
      case 'button':
        return `<div class="k-button${role(b)}" ${t} ${s}><button class="cta-alt">${esc(b.text)}</button></div>`;
      default:
        return '';
    }
  }

  const byType = type => blocks.find(b => b.type === type);
  const cta = byType('cta'),
    audio = byType('audio'),
    hero = byType('hero');
  const zone = z =>
    blocks.filter(b => (b.zone || 'content') === z && !['cta', 'audio', 'hero'].includes(b.type));
  const bg = `<div class="k-bg">${picture(c.bgAsset, c.bgAssetL, '', `object-position:${c.bgFocalX}% ${c.bgFocalY}%`)}</div>`;
  let markup = '';

  if (fiction) {
    const coverTop = zone('top').map(block).join(''),
      coverBottom = zone('bottom').map(block).join(''),
      content = zone('content').map(block).join('');
    const cover = hero
      ? `<header class="hero" ${tag(hero)}><div class="hero-art">${picture(hero.asset, hero.assetL, '', `object-position:${num(hero.focalX, 50)}% ${num(hero.focalY, 25)}%`)}</div><div class="hero-shade"></div><div class="hero-top">${coverTop}</div><div class="hero-brand">${coverBottom}</div></header>`
      : `<div class="hero-top flat">${coverTop}</div><div class="hero-brand flat">${coverBottom}</div>`;
    if (mode === 'page')
      markup = `${bg}<div class="page-top">${coverTop}</div><div class="page-card"><div class="scroll" id="reader" tabindex="0"><div class="page-head"><div class="page-head-text">${coverBottom}</div>${hero ? `<div class="page-thumb" ${tag(hero)}>${picture(hero.asset, hero.assetL)}</div>` : ''}</div><div class="content">${content}</div></div><div class="fade-top"></div><div class="fade-bottom"></div></div>`;
    else if (mode === 'panel2')
      markup = `${bg}<div class="panel-top">${coverTop}${coverBottom}</div><div class="panel-card"><div class="scroll" id="reader" tabindex="0"><div class="content">${content}</div></div><div class="fade-top"></div><div class="fade-bottom"></div></div>`;
    else
      markup = `${bg}<div class="scroll" id="reader" tabindex="0">${cover}<div class="content">${content}</div></div><div class="fade-top"></div><div class="fade-bottom"></div>`;
    markup += ctaButton(cta);
    if (c.hand)
      markup += `<div class="hand hint" id="hint" aria-hidden="true">${picture('fcm-cover/hand.png', 'fcm-cover/handL.png')}</div>`;
  } else {
    const inner = zone('content'),
      card = zone('card').map(block).join(''),
      below = zone('below').map(block).join('');
    if (mode === 'alertphoto')
      markup = `${bg}<div class="layout"><div class="k-card">${card}${ctaButton(cta, 'in-card')}${zone('card-after').map(block).join('')}</div>${below}</div>`;
    else if (mode === 'aichat')
      markup = `${bg}<div class="layout">${inner.map(block).join('')}${ctaButton(cta, 'chat-cta')}</div>`;
    else
      markup = `${bg}<div class="layout${c.cardStyle === 'bubble' ? ' bubble-wrap' : ''}">${c.cardStyle === 'bubble' ? `<div class="k-card bubble-card">${inner.map(block).join('')}${ctaButton(cta, 'in-card')}</div>` : inner.map(block).join('') + ctaButton(cta, 'in-flow')}${below}</div>`;
  }
  if (audio && src(audio.asset))
    markup += `<audio id="music" loop preload="none" src="${esc(src(audio.asset))}"></audio>`;

  const font = src(c.fontAsset);
  const family = font ? 'KitFont,' : '';
  const serif = `${family}'Inria Serif',Georgia,'Times New Roman',serif`,
    sans = `${family}-apple-system,'Segoe UI',Roboto,Arial,sans-serif`;
  const P = c.portrait,
    L = c.landscape;
  const cardBg = isHex(c.cardBg) ? c.cardBg : '#ffffff',
    cardOpacity = num(c.cardOpacity, 100) / 100,
    rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',');
  const stageClass = [
    'kit',
    'product-' + project.product,
    'm-' + mode,
    c.stickyCover ? 'sticky' : '',
    preview && mode === 'aichat' && c.previewChat === 'chat' ? 'chat-on chat-done' : '',
    // Without a chat block the AI-chat ad shows its CTA straight away.
    mode === 'aichat' && !blocks.some(b => b.type === 'chat') ? 'chat-done' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const css = `
${font ? `@font-face{font-family:KitFont;src:url("${font}")}` : ''}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;background:${c.background}}
body{-webkit-text-size-adjust:100%;text-size-adjust:100%;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;touch-action:manipulation;overscroll-behavior:none;font-family:${c.font === 'serif' ? serif : sans};color:${c.textColor}}
img{display:block;width:100%;height:auto;-webkit-user-drag:none;pointer-events:none}picture{display:block}
button{font:inherit;border:0;background:none;color:inherit;cursor:pointer}
#stage{position:fixed;inset:0;overflow:hidden;background:${c.background};
 --uw:calc(100vw / 393);--uh:calc(100vh / 852);--u:min(var(--uw),var(--uh));
 --fs:${P.fontSize};--cw:${P.contentWidth}%;--hh:${P.heroHeight}vh;--ctaw:${P.ctaWidth}%;--ctab:${num(P.ctaBottom, 4)}vh;--gap:calc(${P.gap} * var(--u));--ph:${P.panelHeight}%;--colw:${num(L.coverWidth, 40)}vw;
 --accent:${c.accent};--mark:${isHex(c.markColor) ? c.markColor : c.accent};--mark-text:${isHex(c.markText) ? c.markText : 'inherit'};--lh:${c.lineHeight};
 --card:rgba(${rgb(cardBg)},${cardOpacity});--card-r:calc(${num(c.cardRadius, 16)} * var(--u));--card-line:${isHex(c.cardBorder) ? c.cardBorder : 'transparent'}}
@media (min-aspect-ratio:1/1){#stage{--uw:calc(100vw / 852);--uh:calc(100vh / 393);--u:min(var(--uw),var(--uh));--fs:${L.fontSize};--cw:${L.contentWidth}%;--hh:100vh;--ctaw:${L.ctaWidth}%;--ctab:${num(L.ctaBottom, 5)}vh;--gap:calc(${L.gap} * var(--u));--ph:${L.panelHeight}%}}
.k-bg{position:absolute;inset:0;pointer-events:none}.k-bg picture,.k-bg img{width:100%;height:100%;object-fit:cover}
.k-bg::after{content:"";position:absolute;inset:0;background:rgba(0,0,0,${num(c.bgShade, 0) / 100})}
/* text: size in design px per block (--bfsp / --bfsl), defaults from the template */
.k-text{width:var(--bw);margin-inline:auto;text-align:var(--ba,center);color:var(--bc,inherit);font-weight:var(--bwt,400);font-style:var(--bst);text-transform:var(--btt);font-size:max(12px,calc(var(--bfsp,var(--fs)) * var(--uw)));line-height:var(--lh);overflow-wrap:anywhere}
@media (min-aspect-ratio:1/1){.k-text{font-size:max(12px,calc(var(--bfsl,var(--fs)) * var(--uh)))}}
.k-title{line-height:1.1;text-wrap:balance}
.k-text p{margin:0 0 .8em}.k-text p:last-child{margin-bottom:0}
mark{background:var(--mark);color:var(--mark-text);padding:0 .2em;border-radius:.3em;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.k-list{list-style:none;display:flex;flex-direction:column;gap:.35em;text-align:left}.k-list li{display:flex;gap:.5em}.k-list .li-mark{flex:none;color:var(--bac,var(--accent));font-weight:700}
.k-image{width:var(--bw);margin-inline:auto}.k-image img{object-fit:contain;max-height:40vh;margin-inline:auto}
.k-logo{width:var(--bw);margin-inline:auto;display:flex;align-items:center;justify-content:center;gap:.4em;color:var(--bc,#fff);font:700 max(13px,calc(var(--bfsp,17) * var(--uw))) ${sans}}
.k-logo .logo-mark{width:1em;height:1.1em;background:linear-gradient(135deg,#a96bff,#6a2cf0);border-radius:.18em .5em .18em .5em}
.k-logo img{max-height:calc(36 * var(--u));width:auto}
.k-stats{width:var(--bw);margin-inline:auto;display:flex;align-items:stretch;justify-content:space-around;gap:4px;background:var(--bbg,#ffffff);color:var(--bc,#151515);border:1px solid var(--bac,#a87cf5);border-radius:calc(10 * var(--u));padding:calc(8 * var(--u)) calc(6 * var(--u));font:500 max(10px,calc(var(--bfsp,12) * var(--uw))) ${sans}}
.k-stats .stat{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;flex:1;line-height:1.15}.k-stats b{font-size:1.25em}.k-stats small{opacity:.6;font-size:.8em}
.k-stats .hot{background:color-mix(in srgb,var(--bac,#a87cf5) 18%,transparent);color:var(--bac,#7b3fe4);border-radius:6px;padding:2px 4px}.k-stats .hot b{font-size:1em}
@media (min-aspect-ratio:1/1){.k-stats,.k-logo{font-size:max(10px,calc(var(--bfsl,var(--bfsp,12)) * var(--uh)))}}
.k-bar{width:var(--bw);margin-inline:auto;background:var(--bbg,#eef2ff);border-radius:calc(8 * var(--u));padding:calc(10 * var(--u));color:var(--bc,#1a1f2e);font:600 max(10px,calc(var(--bfsp,12) * var(--uw))) ${sans}}
.k-bar .bar-head{display:flex;justify-content:space-between;margin-bottom:6px}.k-bar .bar-track{height:calc(10 * var(--u));min-height:6px;border-radius:99px;background:#e2e5ec;overflow:hidden}.k-bar i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#ef3b3b,#f59a23 60%,#f5d123 80%,#35c46b 90%,#2fa7e8)}
.k-bar .bar-value{font-size:1.5em;margin-top:6px}.k-bar .bar-note{display:block;font-weight:400;font-style:italic;opacity:.7;margin-top:4px;font-size:.8em}
.k-timer{width:var(--bw);margin-inline:auto;text-align:center;color:var(--bc,#e0262b);font:800 max(16px,calc(var(--bfsp,24) * var(--uw))) ${sans};font-variant-numeric:tabular-nums}
.k-rings{width:var(--bw);margin-inline:auto;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:calc(8 * var(--u));font:500 max(10px,calc(var(--bfsp,12) * var(--uw))) ${sans};color:var(--bc,#1c2a22)}
.ring-card{background:var(--bbg,#ffffff);border:1px solid #e6e9ee;border-radius:calc(12 * var(--u));padding:calc(10 * var(--u));display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center}.ring-card small{opacity:.65;font-size:.85em}
.ring{width:calc(84 * var(--u));aspect-ratio:1;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--rc) calc(var(--rv) * 1%),#e9ecef 0);margin-top:6px}.ring span{width:76%;aspect-ratio:1;border-radius:50%;background:#fff;display:grid;place-items:center;font-weight:800;font-size:1.6em;color:var(--rc)}
.ring-vs{font-weight:800}
.k-button{width:var(--bw);margin-inline:auto}.k-button button{width:100%;min-height:44px;border:1px solid #d5d9e2;border-radius:calc(8 * var(--u));background:#fff;color:#1d2433;font:600 max(13px,calc(15 * var(--u))) ${sans}}
/* CTA in code; an uploaded image replaces the button face */
.cta-wrap{position:absolute;left:50%;bottom:calc(var(--ctab) + env(safe-area-inset-bottom));transform:translateX(-50%);width:var(--ctaw);min-width:max-content;max-width:min(560px,94vw);z-index:10}
.cta-wrap.in-flow,.cta-wrap.in-card{position:relative;left:auto;bottom:auto;transform:none;margin-inline:auto}
.cta{display:flex;align-items:center;justify-content:center;gap:.4em;width:100%;white-space:nowrap;min-height:max(48px,calc(var(--ch) * var(--u)));padding:0 1em;border-radius:var(--crad);background:linear-gradient(180deg,var(--cbg),var(--cbg2));color:var(--ccol);font:var(--cwt) max(14px,calc(var(--cfs) * var(--u))) ${sans};text-transform:var(--ctt);letter-spacing:.02em;box-shadow:var(--csh)}
.cta.has-image{background:none;box-shadow:none;padding:0}.cta.has-image picture{width:100%}.cta.has-image img{max-height:20vh;object-fit:contain}
.cta.pulse{animation:pulse 1.4s ease-in-out infinite}@keyframes pulse{50%{scale:.94}}
.cta-ic{font-size:1.1em;line-height:1}
@media (prefers-reduced-motion:reduce){.cta.pulse{animation:none}}
.hidden{display:none!important}
${fiction ? fictionCSS(mode, c) : cleanerCSS(mode, c)}
`;
  const config = {
    preview,
    previewSound,
    ios: project.iosUrl,
    android: project.androidUrl,
    motion: mode,
    product: project.product,
    volume: c.volume,
    hand: c.hand,
    native: false
  };
  return `<!doctype html><html lang="${esc(project.language || 'en')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"><title>${esc(project.name)}</title><style>${css}${kitFadeCSS(c)}${positionCSS(project)}</style></head><body><div id="stage" data-block="background" class="${stageClass}">${markup}</div><script>(${runtime.toString()})(${JSON.stringify(config).replace(/</g, '\\u003c')});<\/script></body></html>`;
}

// Fiction Me: a scrolling reader. Portrait: cover on top that scrolls away (or sticks), text below.
// Landscape: cover becomes a fixed left column, text scrolls on the right.
function fictionCSS(mode, c) {
  return `
.scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;touch-action:pan-y;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scrollbar-width:none;cursor:grab}.scroll::-webkit-scrollbar{display:none}.scroll.dragging{cursor:grabbing}
.content{width:var(--cw);margin-inline:auto;display:flex;flex-direction:column;gap:var(--gap);padding:calc(16 * var(--u)) 0 calc(45vh + env(safe-area-inset-bottom))}
.hero{position:relative;width:100%;height:var(--hh);flex:none}
.hero-art{position:absolute;inset:0;overflow:hidden}.hero-art picture,.hero-art img{width:100%;height:100%;object-fit:cover}
.hero-shade{position:absolute;inset:0;pointer-events:none;background:linear-gradient(to bottom,rgba(0,0,0,.35) 0%,transparent 18%,transparent 52%,${c.background} 100%)}
.hero-top,.hero-brand{position:absolute;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:calc(8 * var(--u));padding:0 4%;z-index:2}
.hero-top{top:calc(14 * var(--u) + env(safe-area-inset-top))}.hero-brand{bottom:calc(10 * var(--u))}
.hero-top.flat,.hero-brand.flat{position:relative;top:auto;bottom:auto;padding-top:calc(14 * var(--u))}
.k-title.r-booktitle{font-family:'Inria Serif',Georgia,serif;font-weight:700;letter-spacing:.02em;text-shadow:0 2px 12px rgba(0,0,0,.6)}
.r-chapter{letter-spacing:.02em}
.hand{position:absolute;z-index:9;left:56%;top:58%;width:12%;aspect-ratio:130/340;pointer-events:none;animation:handMove 1.5s linear infinite}.hand img{width:100%;height:100%;object-fit:contain}
@keyframes handMove{0%{transform:translateY(30%);opacity:1}50%,65%{transform:translateY(-30%);opacity:1}76%,100%{transform:translateY(-30%);opacity:0}}
.fade-top,.fade-bottom{position:absolute;left:0;right:0;pointer-events:none;z-index:4}
.fade-top{top:0;height:0}
.fade-bottom{bottom:0;height:max(14%,calc(var(--cta-zone,0px) + 4vh));background:linear-gradient(to bottom,${c.background}00 0%,${c.background} 70%)}
.m-infocard.sticky .hero{position:sticky;top:calc(-1 * (var(--hero-px,40vh) - var(--strip-px,120px)));z-index:3}
.m-infocard .hero-shade{background:linear-gradient(to bottom,transparent 40%,rgba(0,0,0,.75) 100%)}
.m-niche .hero-shade{background:linear-gradient(to bottom,transparent 70%,${c.background} 100%)}
/* page: white book page on a dark frame */
.m-page .page-top{position:absolute;top:calc(10 * var(--u) + env(safe-area-inset-top));left:0;right:0;display:flex;justify-content:center;z-index:3}
.m-page .page-card{position:absolute;left:4%;right:4%;top:calc(48 * var(--u) + env(safe-area-inset-top));bottom:calc(var(--ctab) + max(22px,calc(var(--ch,52) * var(--u) * .5)));background:var(--card);border:1px solid var(--card-line);border-radius:var(--card-r);overflow:hidden}
.m-page .page-head{display:grid;grid-template-columns:1fr 34%;gap:calc(10 * var(--u));align-items:center;padding:calc(14 * var(--u)) 6% 0}
.m-page .page-head-text{display:flex;flex-direction:column;gap:calc(6 * var(--u))}
.m-page .page-thumb img{aspect-ratio:3/4;object-fit:cover;border-radius:calc(8 * var(--u))}
.m-page .content{width:88%;padding-bottom:30%}
.m-page .fade-bottom{height:22%;background:linear-gradient(to bottom,transparent,var(--card) 80%)}
/* panel: text inside a translucent box over the art */
.m-panel2 .panel-top{position:absolute;top:calc(14 * var(--u) + env(safe-area-inset-top));left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:6px;z-index:3}
.m-panel2 .panel-card{position:absolute;left:calc((100% - var(--cw)) / 2);width:var(--cw);top:calc(56 * var(--u) + env(safe-area-inset-top));height:var(--ph);background:var(--card);border:1px solid var(--card-line);border-radius:var(--card-r);overflow:hidden}
.m-panel2 .content{width:88%;padding-bottom:20%}
.m-panel2 .fade-bottom{height:16%;background:linear-gradient(to bottom,transparent,var(--card))}
@media (min-aspect-ratio:1/1){
 .m-titlecover .hero,.m-niche .hero,.m-infocard .hero{position:fixed;left:0;top:0;width:var(--colw);height:100vh;z-index:3}
 .m-titlecover .scroll,.m-niche .scroll,.m-infocard .scroll{left:var(--colw)}
 .m-titlecover .content,.m-niche .content,.m-infocard .content{padding-top:calc(24 * var(--u))}
 .hero-shade{background:linear-gradient(to right,transparent 70%,${c.background} 100%),linear-gradient(to bottom,rgba(0,0,0,.3),transparent 25%,transparent 60%,rgba(0,0,0,.6))}
 .m-titlecover .fade-bottom,.m-niche .fade-bottom,.m-infocard .fade-bottom,.m-titlecover .fade-top,.m-niche .fade-top,.m-infocard .fade-top{left:var(--colw)}
 .m-titlecover .cta-wrap,.m-niche .cta-wrap,.m-infocard .cta-wrap{left:calc(var(--colw) + (100vw - var(--colw)) / 2)}
 .hand{left:calc(var(--colw) + (100vw - var(--colw)) * .55);top:44%;width:auto;height:22vh;aspect-ratio:245/297}
 .m-page .page-card{left:calc((100% - var(--cw)) / 2);right:auto;width:var(--cw);top:calc(46 * var(--u))}
 .m-page .page-head{grid-template-columns:1fr 22%}
 .m-panel2 .panel-card{top:calc(52 * var(--u))}
 .m-page .hand,.m-panel2 .hand{left:58%}
}`;
}

// Cleaner: one centred column; the button follows the content (or sits in the card).
function cleanerCSS(mode, c) {
  return `
.layout{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--gap);padding:calc(24 * var(--u) + env(safe-area-inset-top)) calc((100% - var(--cw)) / 2) calc(24 * var(--u) + env(safe-area-inset-bottom));overflow:hidden}
.layout>.cta-wrap.in-flow{width:var(--ctaw);margin-top:calc(8 * var(--u))}
.k-card{position:relative;width:100%;background:var(--card);border:1px solid var(--card-line);border-radius:var(--card-r);padding:calc(16 * var(--u));display:flex;flex-direction:column;gap:calc(var(--gap) * .6);box-shadow:0 10px 30px rgba(0,0,0,.18)}
.k-card>.cta-wrap.in-card{width:100%}
.bubble-card{border-radius:calc(6 * var(--u));border-width:2px}
.bubble-card::after{content:"";position:absolute;left:50%;bottom:calc(-14 * var(--u));width:calc(24 * var(--u));height:calc(24 * var(--u));background:var(--card);border-right:2px solid var(--card-line);border-bottom:2px solid var(--card-line);transform:translateX(-50%) rotate(45deg)}
.bubble-card>.cta-wrap.in-card{width:var(--ctaw)}
.m-alertphoto .layout{justify-content:center}
.m-alertphoto .k-card{width:var(--cw);max-height:calc(100vh - 12vh);overflow:hidden}
.m-alertphoto .r-alerttitle{display:flex;gap:.4em;align-items:flex-start;justify-content:center}
.m-alertphoto .r-alerttitle::before{content:"";flex:none;width:.6em;height:.6em;margin-top:.3em;border-radius:50%;background:#ef3b3b}
.m-alertphoto .r-footnote{position:absolute;left:0;right:0;bottom:calc(2vh + env(safe-area-inset-bottom));color:var(--bc,#fff);text-shadow:0 1px 3px rgba(0,0,0,.6)}
.m-mockup .k-image.r-mockup img{max-height:46vh}
/* AI chat: question screen → chat with a typed answer → CTA */
.m-aichat .layout{justify-content:center}
.k-chat{width:100%;display:flex;flex-direction:column;align-items:center;gap:calc(28 * var(--u))}
.chat-q1{color:var(--bc,#fff);font:500 max(18px,calc(var(--bfsp,26) * var(--uw))) ${'-apple-system,Segoe UI,Roboto,Arial,sans-serif'};text-align:center;line-height:1.2;text-wrap:balance}
.chat-start{display:flex;align-items:center;gap:.4em;min-height:48px;padding:0 1.3em;border-radius:999px;background:linear-gradient(180deg,#eaf6ff,#b8def5);color:#1f3b58;font:700 max(15px,calc(18 * var(--u))) -apple-system,Segoe UI,Roboto,Arial,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.25);animation:pulse 1.4s ease-in-out infinite}
.chat-screen{display:none;width:100%;flex-direction:column;gap:calc(12 * var(--u))}
.chat-head{align-self:center;color:#fff;font:600 max(13px,calc(15 * var(--u))) -apple-system,Segoe UI,Roboto,Arial,sans-serif;opacity:.9}
.bubble{max-width:86%;padding:calc(10 * var(--u)) calc(14 * var(--u));border-radius:calc(14 * var(--u));font:400 max(12px,calc(15 * var(--u))) -apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.35;overflow-wrap:anywhere}
.bubble.me{align-self:flex-end;background:#3a4050;color:#fff;border-bottom-right-radius:4px}
.bubble.bot{align-self:flex-start;background:#f4f6fa;color:#1d2433;border-bottom-left-radius:4px}
.bubble.typing{display:none;gap:4px}.bubble.typing i{width:7px;height:7px;border-radius:50%;background:#8b93a6;animation:dot 1s infinite}.bubble.typing i:nth-child(2){animation-delay:.15s}.bubble.typing i:nth-child(3){animation-delay:.3s}
@keyframes dot{50%{opacity:.25;transform:translateY(-2px)}}
.bubble.answer{display:none}.bubble.answer p{margin:0 0 .6em}.bubble.answer p:last-child{margin:0}
.m-aichat .chat-cta{display:none}
.chat-on .chat-q1,.chat-on .chat-start{display:none}.chat-on .chat-screen{display:flex}
.chat-on.chat-typing .bubble.typing{display:flex}
.chat-on.chat-answer .bubble.answer,.chat-done .bubble.answer{display:block}
.chat-done .chat-cta{display:block}
.m-aichat .chat-cta.cta-wrap{position:relative;left:auto;bottom:auto;transform:none;margin-inline:auto;width:var(--ctaw)}
@media (min-aspect-ratio:1/1){
 .layout{padding-top:calc(16 * var(--u) + env(safe-area-inset-top));padding-bottom:calc(16 * var(--u))}
 .k-image img{max-height:34vh}
 .m-mockup .layout{display:grid;grid-template-columns:1fr 1fr;grid-auto-flow:dense;align-content:center;column-gap:4%}
 .m-mockup .layout>.r-mockup{grid-column:1;grid-row:1 / span 4}.m-mockup .layout>:not(.r-mockup){grid-column:2}
 .m-mockup .k-image.r-mockup img{max-height:80vh}
 .m-alertphoto .k-card{max-height:94vh;padding:calc(12 * var(--u)) calc(16 * var(--u));gap:calc(6 * var(--u));display:grid;grid-template-columns:1.5fr 1fr;grid-auto-flow:row dense;align-items:center;column-gap:5%}
 .m-alertphoto .k-card>*{grid-column:1}
 .m-alertphoto .layout{padding-top:3vh;padding-bottom:3vh}
 .m-alertphoto .r-footnote{display:none}
 .m-alertphoto .k-card>.r-question,.m-alertphoto .k-card>.cta-wrap,.m-alertphoto .k-card>.k-button,.m-alertphoto .k-card>.k-timer{grid-column:2}
}`;
}

// Text fades for the coded reader: same settings as the original templates (fadeTop / fadeBottom).
function kitFadeCSS(c) {
  let css = '';
  for (const [key, side] of [
    ['fadeTop', 'top'],
    ['fadeBottom', 'bottom']
  ]) {
    const f = c[key];
    if (!f || f.mode === 'auto') continue;
    const sel = `#stage .fade-${side}`;
    if (f.mode === 'off') {
      css += `${sel}{display:none!important}`;
      continue;
    }
    const hex = isHex(f.color) ? f.color : isHex(c.background) ? c.background : '#000000',
      col = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(','),
      a = num(f.strength, 100) / 100;
    css += `${sel}{display:block!important;height:${f.portrait}%!important;background:linear-gradient(to ${side === 'top' ? 'bottom' : 'top'},rgba(${col},${a}) 0%,rgba(${col},${a}) 30%,rgba(${col},0) 100%)!important}@media(min-aspect-ratio:1/1){${sel}{height:${f.landscape}%!important}}`;
  }
  return css;
}
