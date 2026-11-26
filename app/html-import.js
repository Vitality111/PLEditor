import { unzipSync, strFromU8 } from './vendor/fflate.js';
const parser = html => new DOMParser().parseFromString(html, 'text/html');
const serialize = doc => '<!doctype html>' + doc.documentElement.outerHTML;
const DATA =
  /data:(?:image|font|audio|video|application)\/[\w.+-]+(?:;charset=[\w-]+)?;base64,[A-Za-z\d+/=]+/g;
const mime = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  json: 'application/json',
  txt: 'text/plain',
  csv: 'text/csv',
  wasm: 'application/wasm',
  glb: 'application/octet-stream',
  webm: 'video/webm',
  avif: 'image/avif',
  aac: 'audio/aac'
};
const token = id => 'studio-asset:' + id;
const SILENT_AUDIO = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
function asData(bytes, name) {
  let b = '';
  for (let i = 0; i < bytes.length; i += 16384) b += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return (
    'data:' + (mime[name.split('.').pop().toLowerCase()] || 'application/octet-stream') + ';base64,' + btoa(b)
  );
}
function localPath(ref, base) {
  if (/^(data:|https?:|\/\/|#|blob:)/i.test(ref)) return null;
  return decodeURIComponent(new URL(ref, 'https://package.local/' + base).pathname.slice(1));
}
export async function readPlayable(file) {
  if (file.size > 30e6) throw Error('Файл більший за 30 МБ.');
  if (/\.html?$/i.test(file.name)) return { html: await file.text(), name: file.name };
  if (!/\.zip$/i.test(file.name)) throw Error('Потрібен HTML або ZIP із папкою плейбла.');
  let total = 0,
    count = 0;
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter: f => {
      if (++count > 1500) throw Error('Забагато файлів у ZIP.');
      total += f.originalSize;
      if (total > 60e6) throw Error('Розпакований ZIP більший за 60 МБ.');
      return !f.name.includes('__MACOSX/') && !f.name.endsWith('/');
    }
  });
  const htmlFiles = Object.keys(files).filter(n => /\.html?$/i.test(n));
  const indexes = htmlFiles.filter(n => /(^|\/)index\.html$/i.test(n));
  const entry = htmlFiles.length === 1 ? htmlFiles[0] : indexes.length === 1 ? indexes[0] : null;
  if (!entry) throw Error('У ZIP має бути один HTML або index.html.');
  const read = (ref, base) => {
    const p = localPath(ref, base);
    if (!p) return null;
    if (!files[p]) throw Error('У ZIP відсутній файл: ' + p);
    return { p, bytes: files[p] };
  };
  const assetNames = {};
  const encoded = f => {
    const d = asData(f.bytes, f.p);
    assetNames[d] = f.p.split('/').pop();
    return d;
  };
  const data = (ref, base) => {
    const f = read(ref, base);
    return f ? encoded(f) : ref;
  };
  const css = (text, base, depth = 0) => {
    if (depth > 12) throw Error('Забагато вкладених CSS @import.');
    return text
      .replace(/@import\s+(?:url\()?['"]([^'"]+)['"]\)?\s*;/gi, (_, ref) => {
        const f = read(ref, base);
        if (!f) throw Error('Зовнішній CSS потрібно вбудувати перед імпортом.');
        return css(strFromU8(f.bytes), f.p, depth + 1);
      })
      .replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi, (_, q, ref) => 'url("' + data(ref, base) + '")');
  };
  const doc = parser(strFromU8(files[entry]));
  for (const link of doc.querySelectorAll('link[rel="stylesheet"]')) {
    const f = read(link.getAttribute('href'), entry);
    if (!f) throw Error('Зовнішній CSS потрібно вбудувати.');
    const style = doc.createElement('style');
    style.textContent = css(strFromU8(f.bytes), f.p);
    link.replaceWith(style);
  }
  for (const style of doc.querySelectorAll('style')) style.textContent = css(style.textContent, entry);
  for (const el of doc.querySelectorAll('[style]'))
    el.setAttribute('style', css(el.getAttribute('style'), entry));
  const inlineMediaStrings = text => {
    for (const [path, bytes] of Object.entries(files)) {
      if (!mime[path.split('.').pop().toLowerCase()]) continue;
      const relative = path.startsWith(entry.slice(0, entry.lastIndexOf('/') + 1))
        ? path.slice(entry.lastIndexOf('/') + 1)
        : path;
      for (const ref of [relative, './' + relative])
        for (const quote of ['"', "'"]) {
          const needle = quote + ref + quote;
          if (text.includes(needle))
            text = text.split(needle).join(quote + encoded({ p: path, bytes }) + quote);
        }
    }
    return text;
  };
  for (const script of doc.querySelectorAll('script')) {
    let text = script.textContent;
    if (script.hasAttribute('src')) {
      const f = read(script.getAttribute('src'), entry);
      if (!f) continue;
      text = strFromU8(f.bytes);
      script.removeAttribute('src');
    }
    if (script.type === 'module' && /\b(?:import|export)\b/.test(text))
      throw Error('ES-модулі потрібно спочатку зібрати твоїм inliner.');
    script.textContent = inlineMediaStrings(text).replace(/<\/script/gi, '<\\/script');
  }
  for (const el of doc.querySelectorAll('[src],[poster],[srcset]'))
    for (const a of ['src', 'poster', 'srcset']) {
      if (!el.hasAttribute(a) || el.tagName === 'SCRIPT') continue;
      const v = el.getAttribute(a);
      if (a === 'srcset' && !v.startsWith('data:') && /\s\d/.test(v))
        el.setAttribute(
          a,
          v
            .split(',')
            .map(part => {
              const [ref, size] = part.trim().split(/\s+/);
              return data(ref, entry) + (size ? ' ' + size : '');
            })
            .join(', ')
        );
      else el.setAttribute(a, data(v, entry));
    }
  return { html: serialize(doc), name: entry.split('/').pop(), assetNames };
}
export async function assetDigest(data) {
  const bytes = new Uint8Array(await fetch(data).then(r => r.arrayBuffer()));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map(v => v.toString(16).padStart(2, '0'))
    .join('');
}
export async function withEditMetadata(html, project, assets) {
  const doc = parser(html);
  doc.querySelector('#playable-studio-state')?.remove();
  const manifest = Object.fromEntries(
    await Promise.all(
      Object.entries(assets).map(async ([id, a]) => [
        id,
        { name: a.name, type: a.type, hash: await assetDigest(a.data) }
      ])
    )
  );
  const extraAssets = Object.fromEntries(
    Object.entries(assets)
      .filter(([id, a]) => !html.includes(a.data))
      .map(([id, a]) => [id, a.data])
  );
  const state = structuredClone(project);
  delete state.sourceHTML;
  const el = doc.createElement('script');
  el.type = 'application/json';
  el.id = 'playable-studio-state';
  el.textContent = JSON.stringify({
    format: 'playable-studio-html',
    version: 1,
    project: state,
    manifest,
    extraAssets
  }).replace(/</g, '\\u003c');
  doc.head.append(el);
  return serialize(doc);
}
export async function extractEditMetadata(html) {
  const doc = parser(html),
    el = doc.querySelector('#playable-studio-state');
  if (!el) return null;
  let state;
  try {
    state = JSON.parse(el.textContent);
  } catch {
    throw Error('Пошкоджені дані проєкту в HTML.');
  }
  if (!state.project || !Array.isArray(state.project.blocks)) throw Error('Некоректні дані проєкту в HTML.');
  if (state.format !== 'playable-studio-html' || state.version !== 1)
    throw Error('Версія даних HTML не підтримується.');
  el.remove();
  doc.querySelector('#studio-import-overrides')?.remove();
  const urls = [
      ...new Set([
        ...(serialize(doc).match(DATA) || []),
        ...Object.values(state.extraAssets || {}).filter(
          d => typeof d === 'string' && /^data:[\w.+/-]+(?:;charset=[\w-]+)?;base64,[A-Za-z\d+/=]+$/.test(d)
        )
      ])
    ],
    byHash = new Map(await Promise.all(urls.map(async d => [await assetDigest(d), d]))),
    assets = {};
  for (const [id, a] of Object.entries(state.manifest || {})) {
    if (
      !/^[\w/ .-]{1,150}$/.test(id) ||
      ['__proto__', 'constructor', 'prototype'].includes(id) ||
      !a ||
      !['image', 'font', 'audio', 'file'].includes(a.type)
    )
      throw Error('Некоректний опис асета в HTML.');
    const data = byHash.get(a.hash);
    if (!data) throw Error('У HTML відсутній асет: ' + a.name);
    assets[id] = { id, name: String(a.name), type: a.type, data };
  }
  return { project: state.project, assets, html: serialize(doc) };
}
export function importHTMLDocument(html, name, assetNames = {}) {
  const doc = parser(html);
  doc.querySelector('#playable-studio-state')?.remove();
  doc.querySelector('#studio-import-overrides')?.remove();
  // Elements added in PB come back from the saved edit data, not as part of the creative.
  for (const el of doc.querySelectorAll('.studio-added,#pb-anchor-runtime,#pb-store-links,#pb-cta-runtime')) el.remove();
  for (const el of doc.querySelectorAll('[data-import-base-translate]')) {
    el.style.setProperty('translate', el.getAttribute('data-import-base-translate'), 'important');
    el.removeAttribute('data-import-base-translate');
  }
  for (const el of doc.querySelectorAll('link[rel="stylesheet"],script[src]'))
    if (localPath(el.getAttribute(el.tagName === 'LINK' ? 'href' : 'src') || '', 'index.html'))
      throw Error('HTML має зовнішні файли. Завантаж ZIP із папкою або готовий HTML після inliner.');
  for (const el of doc.querySelectorAll('img[src],source[srcset],audio[src],video[src]')) {
    const src = el.getAttribute('src') || el.getAttribute('srcset');
    if (localPath(src, 'index.html')) throw Error('Асети не вбудовані. Завантаж ZIP із папкою плейбла.');
  }
  const assets = {},
    idsByData = new Map();
  let source = serialize(doc);
  for (const d of [...new Set(source.match(DATA) || [])]) {
    const id = 'upload-' + crypto.randomUUID(),
      type = d.startsWith('data:image/')
        ? 'image'
        : d.startsWith('data:audio/')
          ? 'audio'
          : /^data:(?:font\/|application\/(?:font|x-font|vnd.ms-fontobject))/.test(d)
            ? 'font'
            : 'file';
    assets[id] = { id, type, name: assetNames[d] || type + '-' + (Object.keys(assets).length + 1), data: d };
    idsByData.set(d, id);
    source = source.split(d).join(token(id));
  }
  const parsed = parser(source),
    blocks = [];
  regroupRichText(parsed);
  const storyContainers = wrapLooseText(parsed);
  let counter = 0;
  const usedNodes = new Set();
  const add = (el, type, extra = {}) => {
    if (blocks.length >= 300) return;
    let node = el.getAttribute('data-import-node');
    if (!node || usedNodes.has(node)) node = 'node-' + crypto.randomUUID();
    usedNodes.add(node);
    el.setAttribute('data-import-node', node);
    blocks.push({
      id: crypto.randomUUID(),
      node,
      type,
      enabled: true,
      width: 100,
      align: 'left',
      text: '',
      asset: '',
      assetL: '',
      focalX: 50,
      focalY: 50,
      customStyle: { portrait: {}, landscape: {} },
      ...extra
    });
  };
  const assetRef = v => /^studio-asset:(.+)$/.exec(v || '')?.[1] || '';
  for (const el of parsed.body.querySelectorAll('img')) {
    const roles = {
        title: 'Заголовок',
        mcp: 'Мокап',
        cta: 'Кнопка CTA',
        ale: 'Опис',
        bg: 'Фон',
        hero: 'Головне зображення',
        brand: 'Логотип',
        rating: 'Рейтинг',
        ratingL: 'Рейтинг',
        cover: 'Обкладинка'
      },
      parent = el.closest('.' + Object.keys(roles).join(',.')),
      role = parent ? [...parent.classList].find(c => roles[c]) : '',
      variant = el.classList.contains('land')
        ? ' · ландшафт'
        : el.classList.contains('port')
          ? ' · портрет'
          : '';
    add(el, 'image', {
      label:
        (el.alt ||
          roles[role] ||
          (!/^image-\d+$/.test(assets[assetRef(el.getAttribute('src'))]?.name || '')
            ? assets[assetRef(el.getAttribute('src'))]?.name
            : '') ||
          'Зображення ' + (blocks.length + 1)) + variant,
      asset: assetRef(el.getAttribute('src')),
      assetL: assetRef(
        el.parentElement?.tagName === 'PICTURE'
          ? el.parentElement.querySelector('source')?.getAttribute('srcset')
          : ''
      ),
      originalAsset: assetRef(el.getAttribute('src'))
    });
  }
  // Pictures set as CSS backgrounds (bg.png in the stylesheet) are elements too, so they can be
  // replaced or switched off. Portrait and landscape backgrounds of one box become two elements.
  const cssText = [...parsed.querySelectorAll('style')].map(st => st.textContent).join('\n');
  const seenBg = new Set();
  for (const m of cssText.matchAll(/([^{}@;]+)\{[^{}]*?url\(\s*["']?studio-asset:([^"')\s]+)["']?\s*\)/g)) {
    const id = m[2];
    if (seenBg.has(id) || assets[id]?.type !== 'image' || blocks.length >= 300) continue;
    seenBg.add(id);
    let el = null;
    try {
      el = parsed.querySelector(m[1].trim().split(',')[0]);
    } catch {}
    el ||= parsed.body;
    const node = el.getAttribute('data-import-node') || 'node-' + crypto.randomUUID();
    el.setAttribute('data-import-node', node);
    usedNodes.add(node);
    const landscape = /L\.(png|jpe?g|webp)$/.test(assets[id].name || '') || /orientation\s*:\s*landscape[^{]*\{[^}]*$/.test(cssText.slice(0, m.index));
    blocks.push({
      id: crypto.randomUUID(),
      node,
      type: 'image',
      bgAsset: true,
      enabled: true,
      width: 100,
      align: 'left',
      text: '',
      asset: id,
      assetL: '',
      originalAsset: id,
      focalX: 50,
      focalY: 50,
      customStyle: { portrait: {}, landscape: {} },
      label: 'Фон' + (landscape ? ' · ландшафт' : '')
    });
  }
  // Music and sounds of the creative (played by its script): one element each, to replace or switch off.
  let audioCount = 0;
  for (const [id, a] of Object.entries(assets)) {
    if (a.type !== 'audio' || blocks.length >= 300) continue;
    audioCount++;
    blocks.push({
      id: crypto.randomUUID(),
      node: 'audio-' + audioCount,
      type: 'audio',
      audioAsset: true,
      enabled: true,
      width: 100,
      align: 'left',
      text: '',
      asset: id,
      assetL: '',
      originalAsset: id,
      focalX: 50,
      focalY: 50,
      customStyle: { portrait: {}, landscape: {} },
      label: audioCount > 1 ? 'Музика ' + audioCount : 'Музика'
    });
  }
  const chosen = new Set();
  for (const el of parsed.body.querySelectorAll(
    'h1,h2,h3,h4,h5,h6,p,li,button,a,div,span,strong,em,b,label,small,i,u,mark'
  )) {
    if (
      storyContainers.has(el) ||
      el.closest('script,style,noscript,template') ||
      !el.textContent.trim() ||
      el.querySelector('img,video,canvas')
    )
      continue;
    if ([...chosen].some(parent => parent.contains(el))) continue;
    if (
      !/^(H[1-6]|P|LI|BUTTON|A|LABEL)$/.test(el.tagName) &&
      [...el.querySelectorAll('*')].some(
        child => !/^(SPAN|STRONG|EM|B|I|U|MARK|SMALL|BR|A)$/.test(child.tagName)
      )
    )
      continue;
    chosen.add(el);
    const text = el.textContent.trim();
    add(el, 'text', { label: 'Текст · ' + shortLabel(text, 42), text, originalText: text });
  }
  // The scrolling story box (Chapter, POV and the story inside one <div>, as in the code) is one element
  // in the editor; its parts keep their own text, colour and size and can be hidden, not deleted.
  for (const box of storyContainers) {
    const parts = blocks.filter(
      b => b.type === 'text' && box.contains(parsed.querySelector(`[data-import-node="${b.node}"]`))
    );
    if (parts.length < 2) continue;
    const partName = b => {
      const cls = parsed.querySelector(`[data-import-node="${b.node}"]`).classList;
      return cls.contains('studio-text')
        ? 'Текст історії'
        : cls.contains('chapter')
          ? 'Chapter'
          : cls.contains('pov')
            ? 'POV'
            : 'Рядок · ' + shortLabel(b.text, 24);
    };
    for (const b of parts) b.partLabel = partName(b);
    add(box, 'text', {
      label: 'Текст історії',
      storyGroup: true,
      parts: parts.map(b => b.node),
      text: '',
      originalText: ''
    });
  }
  if (!blocks.length)
    throw Error(
      'У цьому HTML не знайдено текстів або зображень для редагування. Canvas-графіка не підтримується.'
    );
  const motion = parsed.querySelector('.band,.range-probe')
    ? 'shrink'
    : parsed.querySelector('.panel')
      ? 'panel'
      : parsed.querySelector('.cover')
        ? 'cover'
        : 'panel';
  const result = {
    sourceHTML: serialize(parsed),
    blocks,
    assets,
    name: name.replace(/\.html?$/i, ''),
    language: parsed.documentElement.lang || 'en',
    motion
  };
  addTextGroups(result);
  return result;
}
// Story text often sits as a bare text node next to elements (Fiction Me: <div class="pov">…</div><br>
// then the chapter), and the creative's own script turns blank lines into paragraph breaks at runtime.
// Such text gets its own <span> so it can be selected and edited; blank lines stay paragraph breaks
// (white-space:pre-line), which looks the same with or without the script. Surrounding whitespace is
// kept outside the span, so the original script still sees what it saw before.
function wrapLooseText(doc) {
  const containers = new Set();
  const css = [...doc.querySelectorAll('style')].map(s => s.textContent).join('');
  if (/white-space\s*:\s*pre/i.test(css)) return containers;
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const loose = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const parent = n.parentElement;
    if (!parent || !/^(DIV|SECTION|ARTICLE|MAIN|BODY)$/.test(parent.tagName)) continue;
    if (parent.closest('script,style,noscript,template')) continue;
    if (n.data.replace(/\s+/g, ' ').trim().length < 40) continue;
    if (!parent.children.length && !/(?:\r?\n){2,}/.test(n.data.trim())) continue;
    loose.push(n);
  }
  for (const n of loose) {
    const [, lead, body, tail] = /^(\s*)([\s\S]*?\S)(\s*)$/.exec(n.data);
    const text = body
      .split(/(?:\r?\n){2,}/)
      .map(part => part.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n\n');
    const span = doc.createElement('span');
    span.className = 'studio-text';
    span.style.whiteSpace = 'pre-line';
    // A text that stands on its own lines (start of the box, after <br> or a block) becomes a block,
    // so width and position work on it; text inside a sentence with inline neighbours stays inline.
    const sideOk = (node, dir) => {
      let x = node[dir];
      while (x && x.nodeType === 3 && !x.data.trim()) x = x[dir];
      return !x || (x.nodeType === 1 && /^(BR|DIV|P|H[1-6]|SECTION|ARTICLE|UL|OL|IMG|PICTURE)$/.test(x.tagName));
    };
    if (sideOk(n, 'previousSibling') && sideOk(n, 'nextSibling')) span.style.display = 'block';
    span.textContent = text;
    containers.add(n.parentElement);
    n.replaceWith(...[lead && doc.createTextNode(lead), span, tail && doc.createTextNode(tail)].filter(Boolean));
  }
  return containers;
}
// Export and «Грати»: the wrapper exists only for editing. The text goes back to being a plain text
// node exactly where it was, so the creative's own script formats it (paragraphs, effects) as before.
// A wrapper stays only when the studio has to style it: hidden, moved or restyled text.
function unwrapLooseText(doc, project) {
  for (const span of doc.querySelectorAll('span.studio-text')) {
    const b = project.blocks.find(b => b.id === span.getAttribute('data-studio-block'));
    const styled =
      b &&
      (b.enabled === false ||
        ['portrait', 'landscape'].some(
          o => b.position?.[o]?.x || b.position?.[o]?.y || Object.keys(b.customStyle?.[o] || {}).length
        ));
    if (styled) continue;
    const parent = span.parentNode;
    // A font chosen for this text stays on the box that holds it.
    // Formatted text keeps its wrapper (paragraphs shown by white-space), so it opens again in PB as one text.
    if (b?.rich) continue;
    if (b?.font && parent.nodeType === 1)
      parent.setAttribute('data-studio-font', ((parent.getAttribute('data-studio-font') || '') + ' ' + b.id).trim());
    span.replaceWith(doc.createTextNode(span.textContent));
    parent.normalize();
  }
}
// Keep paragraph records for existing edits, but expose their shared story as one block.
export function addTextGroups(project) {
  if (project.blocks.some(b => b.textGroup)) return;
  const doc = parser(project.sourceHTML),
    nodes = new Map(project.blocks.filter(b => b.type === 'text').map(b => [b.node, b]));
  const candidates = [...doc.body.querySelectorAll('div,article,section')].filter(
    el =>
      !el.matches('.reader,.scroll-container,.panel,#reader') &&
      el.querySelectorAll('p').length >= 2 &&
      [...el.querySelectorAll('*')].every(n =>
        /^(DIV|ARTICLE|SECTION|P|H[1-6]|SPAN|STRONG|EM|B|I|U|BR|SMALL|MARK)$/.test(n.tagName)
      )
  );
  for (const el of candidates.filter(
    el => !candidates.some(parent => parent !== el && parent.contains(el))
  )) {
    const members = [...el.querySelectorAll('[data-import-node]')]
      .map(n => nodes.get(n.getAttribute('data-import-node')))
      .filter(Boolean);
    if (members.length < 2 || project.blocks.length >= 300) continue;
    const node = el.getAttribute('data-import-node') || 'node-' + crypto.randomUUID();
    el.setAttribute('data-import-node', node);
    const text = members.map(b => b.text).join('\n\n');
    project.blocks.push({
      id: crypto.randomUUID(),
      node,
      type: 'text',
      textGroup: true,
      memberNodes: members.map(b => b.node),
      label: 'Весь текст · ' + members.length + ' абзаців',
      text,
      originalText: text,
      enabled: true,
      position: { portrait: { x: 0, y: 0 }, landscape: { x: 0, y: 0 } },
      customStyle: { portrait: {}, landscape: {} }
    });
  }
  project.sourceHTML = serialize(doc);
}
export function importedDocument(project, assets, { positionCSS, preview = false }) {
  let html = project.sourceHTML,
    linkRouter = '';
  if (!preview) ({ html, router: linkRouter } = applyStoreLinks(html, project));
  // A replaced CSS background: the stylesheet points at the new picture.
  // A CSS background with its own landscape picture: a copy of the rule for landscape screens.
  for (const b of project.blocks) {
    if (!b.bgAsset || !b.originalAsset || !b.assetL || !assets[b.assetL]) continue;
    const t = token(b.originalAsset).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp('([^{}@;]+)\\{([^{}]*' + t + '[^{}]*)\\}', 'g'), (rule, sel, body) =>
      rule +
      '@media (min-aspect-ratio: 1/1){' +
      sel +
      '{' +
      body.split(token(b.originalAsset)).join(token(b.assetL)).replace(/;?\s*$/, '') +
      '}}'
    );
  }
  for (const b of project.blocks) {
    if (!(b.bgAsset || b.audioAsset) || !b.originalAsset) continue;
    // Music switched off: the creative's script gets a silent sound instead (nothing breaks).
    if (b.audioAsset && !b.enabled) html = html.split(token(b.originalAsset)).join(SILENT_AUDIO);
    else if (b.asset && b.asset !== b.originalAsset && assets[b.asset])
      html = html.split(token(b.originalAsset)).join(token(b.asset));
  }
  // Pictures hidden in both orientations do not go into the file at all (a weightless placeholder of
  // the same proportions keeps the layout), unless a shown element still uses the same file.
  const hiddenFiles = new Set();
  if (!preview) {
    const shown = new Set(
      project.blocks.filter(b => b.enabled).flatMap(b => [b.asset, b.assetL, b.originalAsset]).filter(Boolean)
    );
    for (const b of project.blocks)
      if (!b.enabled && b.type === 'image')
        for (const id of [b.asset, b.assetL, b.originalAsset])
          if (id && !shown.has(id) && assets[id]?.type === 'image') hiddenFiles.add(id);
    for (const id of hiddenFiles) html = html.split(token(id)).join(placeholderFor(assets[id]));
  }
  for (const [id, a] of Object.entries(assets)) html = html.split(token(id)).join(a.data || a.url || '');
  const doc = parser(html);
  doc.title = project.name;
  doc.querySelector('#playable-studio-state')?.remove();
  doc.querySelector('#studio-import-overrides')?.remove();
  let rules = '',
    hasRich = false;
  // Elements added in the studio (text, picture) sit on top of the creative, centred; X/Y and width
  // move and size them like any other element. They never catch taps meant for the creative.
  const added = project.blocks.filter(b => b.added && ['text', 'image'].includes(b.type));
  for (const b of added.filter(b => b.type === 'text')) {
    const v = b.addedStyle || {},
      num = (x, d, min, max) => (Number.isFinite(Number(x)) ? Math.min(max, Math.max(min, Number(x))) : d),
      hex = /^#[\da-f]{6}$/i.test(v.plateColor || '') ? v.plateColor : '#000000',
      alpha = Math.round((num(v.plateOpacity, 55, 0, 100) / 100) * 255)
        .toString(16)
        .padStart(2, '0');
    rules +=
      `.studio-added[data-import-node="${b.node}"]{text-align:${['left', 'center', 'right'].includes(v.align) ? v.align : 'center'};` +
      `line-height:${num(v.lineHeight, 1.25, 0.9, 2.5)};padding:${num(v.padY, 8, 0, 60)}px ${num(v.padX, 12, 0, 60)}px` +
      (v.plate ? `;background:${hex}${alpha};border-radius:${num(v.radius, 10, 0, 40)}px;text-shadow:none` : '') +
      '}';
  }
  for (const b of added) {
    // A picture without a file yet: a placeholder in the editor, nothing in the export.
    const empty = b.type === 'image' && !assets[b.asset];
    if (empty && !preview) continue;
    if (!b.enabled && !preview) continue; // hidden everywhere: not in the file
    const el = doc.createElement(b.type === 'image' && !empty ? 'img' : 'div');
    el.className = 'studio-added' + (empty ? ' studio-added-empty' : '');
    el.setAttribute('data-import-node', b.node);
    const anchor = anchorAttr(b, project);
    if (anchor) el.setAttribute('data-pb-anchor', anchor);
    if (empty) el.textContent = 'Картинка: завантаж файл';
    else if (b.type === 'image') el.setAttribute('alt', '');
    doc.body.append(el);
  }
  if (added.length)
    rules +=
      // The creative's own font; a clear default size and colour; text wraps inside the box.
      '.studio-added{position:fixed;left:50%;top:38%;transform:translateX(-50%);z-index:30;width:80%;box-sizing:border-box;margin:0;text-align:center;white-space:pre-line;overflow-wrap:anywhere;font-family:inherit;font-weight:600;font-size:24px;line-height:1.25;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.6);pointer-events:none}img.studio-added{height:auto;display:block;text-shadow:none;padding:0}' +
      (preview
        ? '.studio-added-empty{padding:28px 8px;outline:2px dashed #ffffffaa;background:#00000055;font-size:15px}'
        : '');
  for (const b of project.blocks) {
    const el = [...doc.querySelectorAll('[data-import-node]')].find(
      e => e.getAttribute('data-import-node') === b.node
    );
    if (!el) continue;
    el.setAttribute('data-studio-block', b.id);
    if (b.cta && b.enabled) el.setAttribute('data-pb-cta', '');
    if (!b.added) {
      const anchor = anchorAttr(b, project);
      if (anchor) el.setAttribute('data-pb-anchor', anchor);
    }
    if (
      el.style.getPropertyValue('translate') &&
      ['portrait', 'landscape'].some(o => b.position?.[o]?.x || b.position?.[o]?.y)
    ) {
      const base = el.style.getPropertyValue('translate');
      el.setAttribute('data-import-base-translate', base);
      el.style.removeProperty('translate');
      rules += `[data-studio-block="${b.id}"]{translate:${base}!important}`;
    }
    // Imported containers may define the height and position of other elements.
    // Hide their content without collapsing the original layout.
    if (!b.enabled && b.bgAsset) rules += `[data-import-node="${b.node}"]{background-image:none!important}`;
    else if (!b.enabled)
      rules += `[data-studio-block="${b.id}"]{visibility:hidden!important;opacity:0!important;pointer-events:none!important}[data-studio-block="${b.id}"] *{visibility:hidden!important;pointer-events:none!important}`;
    // Shown in one orientation only.
    for (const o of ['portrait', 'landscape'])
      if (b.enabled && b.hide?.[o])
        rules +=
          (o === 'landscape' ? '@media(min-aspect-ratio:1/1){' : '@media(max-aspect-ratio:1/1){') +
          (b.added
            ? `[data-studio-block="${b.id}"]{display:none!important}}`
            : `[data-studio-block="${b.id}"]{visibility:hidden!important;pointer-events:none!important}[data-studio-block="${b.id}"] *{visibility:hidden!important}}`);
    if (b.textGroup || b.storyGroup) el.setAttribute('data-studio-text-group', 'true');
    // A hidden Chapter/POV inside the story box leaves no gap: the line break after it goes too.
    if (!b.enabled && project.blocks.some(g => g.storyGroup && g.parts?.includes(b.node)))
      rules += `[data-studio-block="${b.id}"],[data-studio-block="${b.id}"]+br{display:none!important}`;
    if (b.type === 'text' && !b.textGroup && b.rich) {
      // Formatted text (bold, italic, a font for some words).
      el.replaceChildren(richFragment(doc, b, assets, creativeFonts(project.sourceHTML), !b.added));
      el.setAttribute('data-studio-rich', '');
      rules += '[data-studio-block="' + b.id + '"]{white-space:pre-wrap!important;text-wrap:pretty}';
      hasRich = true;
    } else if (b.type === 'text' && !b.textGroup && b.text !== b.originalText) {
      removeHardBreaks(el);
      // Text added in PB keeps every line break as typed; original texts follow the paragraph rule.
      patchTextContent(el, b.added ? String(b.text).replace(/\r\n?/g, '\n') : automaticText(b.text));
      rules += '[data-studio-block="' + b.id + '"]{white-space:pre-wrap!important;text-wrap:pretty}';
    }
    // One picture for both orientations, a landscape picture added in PB: the picture gets a landscape
    // source (<picture> that takes no space of its own, so the layout stays the same).
    if (b.type === 'image' && !b.bgAsset && !b.ctaCode && assets[b.assetL] && el.tagName === 'IMG' && el.parentElement?.tagName !== 'PICTURE') {
      const pic = doc.createElement('picture'),
        src = doc.createElement('source');
      pic.style.display = 'contents';
      src.setAttribute('media', '(min-aspect-ratio: 1/1)');
      el.replaceWith(pic);
      pic.append(src, el);
    }
    if (b.type === 'image' && !b.bgAsset && assets[b.asset] && hiddenFiles.has(b.asset)) {
      el.setAttribute('src', placeholderFor(assets[b.asset]));
      if (el.parentElement?.tagName === 'PICTURE')
        for (const src of el.parentElement.querySelectorAll('source')) src.setAttribute('srcset', placeholderFor(assets[b.asset]));
    } else if (b.type === 'image' && !b.bgAsset && assets[b.asset]) {
      el.setAttribute('src', assets[b.asset].data || assets[b.asset].url);
      if (el.parentElement.tagName === 'PICTURE')
        for (const src of el.parentElement.querySelectorAll('source'))
          src.setAttribute(
            'srcset',
            assets[b.assetL]?.data || assets[b.assetL]?.url || assets[b.asset].data || assets[b.asset].url
          );
    }
    // Coded CTA: the button picture is replaced by a styled element that keeps the picture's classes,
    // position and proportions, so the creative's own CSS (portrait/landscape) and click handler still apply.
    if (b.type === 'image' && b.ctaCode && typeof b.ctaCode === 'object') {
      const c = b.ctaCode,
        hex = v => (/^#[\da-f]{6}$/i.test(v || '') ? v : null),
        n = (v, d, min, max) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : d);
      const target = el.parentElement?.tagName === 'PICTURE' ? el.parentElement : el;
      const btn = doc.createElement('span');
      for (const a of [...el.attributes])
        if (!['src', 'srcset', 'alt', 'loading', 'width', 'height', 'decoding'].includes(a.name))
          btn.setAttribute(a.name, a.value);
      btn.classList.add('studio-cta');
      btn.setAttribute('role', 'button');
      btn.setAttribute('aria-label', String(c.text || ''));
      const bg = hex(c.bg) || '#7b2ff2';
      btn.style.setProperty('--sc-bg', bg);
      btn.style.setProperty('--sc-bg2', hex(c.bg2) || bg);
      btn.style.setProperty('--sc-color', hex(c.color) || '#ffffff');
      btn.style.setProperty('--sc-ratio', String(n(c.ratio, 4, 1, 12)));
      btn.style.setProperty('--sc-fs', String(n(c.fontSize, 42, 15, 80)));
      btn.style.setProperty('--sc-r', String(n(c.radius, 50, 0, 50)));
      btn.style.setProperty('--sc-weight', String(n(c.weight, 700, 100, 900)));
      btn.style.setProperty('--sc-tt', c.upper ? 'uppercase' : 'none');
      btn.style.setProperty('--sc-shadow', c.shadow === false ? 'none' : '0 4px 14px rgba(0,0,0,.25)');
      const label = doc.createElement('span');
      label.className = 'studio-cta-label';
      label.textContent = String(c.text || '');
      btn.append(label);
      target.replaceWith(btn);
      if (!rules.includes('.studio-cta-label'))
        rules +=
          ':where(.studio-cta){display:block;width:100%;aspect-ratio:var(--sc-ratio);container-type:size;border-radius:calc(var(--sc-r) * 1cqh);background:linear-gradient(180deg,var(--sc-bg),var(--sc-bg2));color:var(--sc-color);box-shadow:var(--sc-shadow);cursor:pointer}.studio-cta-label{display:flex;align-items:center;justify-content:center;width:100%;height:100%;padding:0 6%;box-sizing:border-box;white-space:nowrap;line-height:1;font:var(--sc-weight) calc(var(--sc-fs) * 1cqh) -apple-system,"Segoe UI",Roboto,Arial,sans-serif;text-transform:var(--sc-tt);pointer-events:none}';
    }
    for (const o of ['portrait', 'landscape']) {
      const c = b.customStyle?.[o] || {},
        declarations = [];
      if (Number.isFinite(c.fontSize))
        declarations.push(`font-size:${Math.max(8, Math.min(100, c.fontSize))}px!important`);
      if (Number.isFinite(c.width))
        declarations.push(
          // The original max-width/max-height must not stop an element from growing.
          `width:${Math.max(5, Math.min(300, c.width))}%!important;max-width:none!important;max-height:none!important` +
            (b.type === 'text' && !b.added ? ';margin-left:auto!important;margin-right:auto!important' : '')
        );
      if (/^#[\da-f]{6}$/i.test(c.color || '')) declarations.push(`color:${c.color}!important`);
      if (declarations.length)
        rules +=
          (o === 'landscape' ? '@media(min-aspect-ratio:1/1){' : '@media(max-aspect-ratio:1/1){') +
          `[data-studio-block="${b.id}"]{${declarations.join(';')}}}`;
    }
  }
  for (const b of project.blocks.filter(b => b.textGroup && (b.rich || b.text !== b.originalText))) {
    const el = [...doc.querySelectorAll('[data-import-node]')].find(
      e => e.getAttribute('data-import-node') === b.node
    );
    if (el) patchTextGroup(el, b, assets, creativeFonts(project.sourceHTML));
    if (el && b.rich) hasRich = true;
  }
  if (hasRich)
    rules += richCSS(
      creativeFonts(project.sourceHTML),
      [...doc.querySelectorAll('style')].map(x => x.textContent).join('\n')
    );
  for (const b of project.blocks.filter(b => b.textGroup))
    for (const o of ['portrait', 'landscape']) {
      const c = b.customStyle?.[o] || {},
        d = [];
      if (Number.isFinite(c.fontSize))
        d.push('font-size:' + Math.max(8, Math.min(100, c.fontSize)) + 'px!important');
      if (/^#[\da-f]{6}$/i.test(c.color || '')) d.push('color:' + c.color + '!important');
      if (d.length)
        rules +=
          (o === 'landscape' ? '@media(min-aspect-ratio:1/1){' : '@media(max-aspect-ratio:1/1){') +
          '[data-studio-block="' +
          b.id +
          '"] :is(p,h1,h2,h3,h4,h5,h6,span,strong,em,b,i,u,small,mark){' +
          d.join(';') +
          '}}';
    }
  // Font chosen in PB for a text element (whole box, Chapter/POV included). An uploaded font is embedded.
  const fonts = creativeFonts(project.sourceHTML),
    faces = new Set();
  for (const b of project.blocks.filter(b => b.type === 'text' && b.font)) {
    const stack = fontStack(b, assets, fonts);
    if (!stack) continue;
    if (b.font === 'asset' && !faces.has(b.fontAsset)) {
      faces.add(b.fontAsset);
      const a = assets[b.fontAsset];
      rules = `@font-face{font-family:"PB Font ${b.fontAsset}";src:url("${a.data || a.url}");font-display:block}` + rules;
    }
    const sel = `[data-studio-block="${b.id}"],[data-studio-font~="${b.id}"]`;
    rules += `:is(${sel}),:is(${sel}) *{font-family:${stack}!important}`;
  }
  if (project.blocks.some(b => b.cta && b.enabled)) rules += '[data-pb-cta]{pointer-events:auto!important;cursor:pointer}';
  const style = doc.createElement('style');
  style.id = 'studio-import-overrides';
  style.textContent = rules + importPositionCSS(project);
  doc.head.append(style);
  if (preview) {
    for (const el of doc.querySelectorAll('script,iframe,object,embed,base,meta[http-equiv],link'))
      el.remove();
    for (const el of doc.querySelectorAll('*'))
      for (const a of [...el.attributes])
        if (/^on/i.test(a.name) || a.name === 'srcdoc' || /^javascript:/i.test(a.value))
          el.removeAttribute(a.name);
    for (const media of doc.querySelectorAll('audio,video')) {
      media.removeAttribute('autoplay');
      media.setAttribute('muted', '');
    }
    for (const el of doc.querySelectorAll('a,form')) {
      el.removeAttribute('href');
      el.removeAttribute('action');
    }
    const prior = doc.getElementById('stage');
    if (prior && prior !== doc.body) {
      prior.id = 'imported-stage';
      for (const st of doc.querySelectorAll('style'))
        st.textContent = st.textContent.replace(/#stage\b/g, '#imported-stage');
    }
    doc.body.id = 'stage';
    doc.body.setAttribute('data-studio-block', 'background');
    const styles =
      [...doc.querySelectorAll('style')].map(s => s.textContent).join('\n') +
      '\n[data-import-node]{pointer-events:auto!important}';
    doc.querySelectorAll('style').forEach(s => s.remove());
    const combined = doc.createElement('style');
    combined.textContent = styles;
    doc.head.append(combined);
  } else {
    unwrapLooseText(doc, project);
    if (doc.querySelector('[data-pb-cta]')) {
      // Elements made clickable in PB open the store like the creative's own CTA button.
      const own = storeLinksIn(html),
        sc = doc.createElement('script');
      sc.id = 'pb-cta-runtime';
      sc.textContent =
        '(function(){var I=' +
        JSON.stringify(safeLink(project.linkIos) || own.ios || safeLink(project.linkAndroid) || own.android) +
        ',A=' +
        JSON.stringify(safeLink(project.linkAndroid) || own.android || safeLink(project.linkIos) || own.ios) +
        ';var busy=0;document.addEventListener("click",function(e){var t=e.target&&e.target.closest&&e.target.closest("[data-pb-cta]");if(!t)return;' +
        'if(typeof window.handleCTA==="function"){window.handleCTA();return}if(busy)return;busy=1;setTimeout(function(){busy=0},1500);' +
        'var u=/android/i.test(navigator.userAgent)?A:I;try{if(window.mraid&&typeof mraid.open==="function"){mraid.open(u);return}}catch(x){}' +
        'try{var w=window.open(u,"_blank");if(!w)location.href=u}catch(x){location.href=u}},false)})();';
      doc.body.append(sc);
    }
    if (linkRouter) {
      const sc = doc.createElement('script');
      sc.id = 'pb-store-links';
      sc.textContent = linkRouter;
      doc.head.prepend(sc);
    }
    if (doc.querySelector('[data-pb-anchor]')) {
      const sc = doc.createElement('script');
      sc.id = 'pb-anchor-runtime';
      sc.textContent = '(' + placeAnchored.toString() + ')(document,window);';
      doc.body.append(sc);
    }
  }
  return serialize(doc);
}

export function validTranslate(value) {
  return typeof value === 'string' &&
    (/^-?[\d.]+(?:px|%|em|rem|vw|vh)?$/.test(value) || /^calc\([-+*/\d.\s%a-z(),]+\)$/i.test(value))
    ? value
    : '0px';
}
function importPositionCSS(project) {
  let css = '';
  for (const b of project.blocks)
    for (const o of ['portrait', 'landscape']) {
      const p = b.position?.[o] || {},
        base = b.translateBase?.[o] || {};
      if (!p.x && !p.y) continue;
      if (b.anchor?.[o]?.node) continue; // placed next to its anchor, see placeAnchored()
      css +=
        (o === 'landscape' ? '@media(min-aspect-ratio:1/1){' : '@media(max-aspect-ratio:1/1){') +
        `[data-studio-block="${b.id}"]{--studio-x:${Number(p.x) || 0};--studio-y:${Number(p.y) || 0};--studio-base-x:${validTranslate(base.x)};--studio-base-y:${validTranslate(base.y)};translate:calc(var(--studio-base-x) + var(--studio-x)*1vw) calc(var(--studio-base-y) + var(--studio-y)*1vh)!important}}`;
    }
  return css;
}

function patchTextContent(el, value) {
  const old = el.textContent;
  let prefix = 0,
    suffix = 0;
  while (prefix < old.length && prefix < value.length && old[prefix] === value[prefix]) prefix++;
  while (
    suffix < old.length - prefix &&
    suffix < value.length - prefix &&
    old[old.length - 1 - suffix] === value[value.length - 1 - suffix]
  )
    suffix++;
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT),
    nodes = [];
  let offset = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    nodes.push({ node, start: offset, end: offset + node.data.length });
    offset += node.data.length;
  }
  if (!nodes.length) {
    el.textContent = value;
    return;
  }
  const insertion = nodes.find(n => prefix <= n.end) || nodes.at(-1);
  for (const item of nodes) {
    const text = item.node.data,
      before = text.slice(0, Math.max(0, Math.min(text.length, prefix - item.start))),
      after = text.slice(Math.max(0, Math.min(text.length, old.length - suffix - item.start)));
    item.node.data = before + (item === insertion ? value.slice(prefix, value.length - suffix) : '') + after;
  }
}

function patchTextGroup(el, b, assets = {}, fonts = []) {
  const richParts = b.rich ? sanitizeRich(b.rich).replace(/\r\n?/g, '\n').split(/\n\s*\n/) : null;
  const nodes = b.memberNodes
      .map(key =>
        [...el.querySelectorAll('[data-import-node]')].find(n => n.getAttribute('data-import-node') === key)
      )
      .filter(Boolean),
    parts = b.text.split(/\n\s*\n/);
  if (!nodes.length) return;
  for (let i = 0; i < Math.max(nodes.length, parts.length); i++) {
    if (i >= parts.length) {
      nodes[i].remove();
      continue;
    }
    let node = nodes[i];
    if (!node) {
      node = el.ownerDocument.createElement('p');
      const last = nodes.at(-1);
      node.className = last.className;
      last.after(node);
      nodes.push(node);
    }
    removeHardBreaks(node);
    if (richParts) {
      node.replaceChildren(richFragment(el.ownerDocument, { ...b, rich: richParts[i] || '' }, assets, fonts, true));
      if (!richParts[i] || !sanitizeRich(richParts[i])) node.textContent = automaticText(parts[i]);
      node.setAttribute('data-studio-rich', '');
    } else patchTextContent(node, automaticText(parts[i]));
    node.style.setProperty('white-space', 'normal', 'important');
    node.style.setProperty('text-wrap', 'pretty');
  }
}

export function splitTranslate(value) {
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

function automaticText(value) {
  return value
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map(p => p.replace(/[ \t]*\n[ \t]*/g, ' '))
    .join('\n\n');
}
function removeHardBreaks(el) {
  for (const br of el.querySelectorAll('br')) br.replaceWith(el.ownerDocument.createTextNode(' '));
}

// Short list label: cut on a word boundary and mark the cut with an ellipsis.
export const shortLabel = (text, max) => {
  const t = String(text).replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, '') + '…';
};

// Font families the creative itself ships (@font-face), so a text can switch to another font of the creative.
export function creativeFonts(sourceHTML) {
  const names = new Set();
  for (const m of String(sourceHTML || '').matchAll(/@font-face\s*\{[^}]*?font-family\s*:\s*["']?([^;"'}]+?)["']?\s*[;}]/g))
    names.add(m[1].trim());
  return [...names].filter(n => /^[\p{L}\p{N} _-]{1,60}$/u.test(n));
}
// The CSS font-family for a text element's font choice ('' keeps the creative's own font).
export const FONT_CHOICES = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: 'Arial, Helvetica, sans-serif',
  system: '-apple-system, "SF Pro Text", "Segoe UI", Roboto, Arial, sans-serif',
  rounded: '"Trebuchet MS", "Segoe UI", Arial, sans-serif',
  mono: 'ui-monospace, Menlo, Consolas, monospace'
};
function fontStack(b, assets, fonts) {
  const f = String(b.font || '');
  if (FONT_CHOICES[f]) return FONT_CHOICES[f];
  if (f.startsWith('family:') && fonts.includes(f.slice(7))) return `"${f.slice(7)}", sans-serif`;
  if (f === 'asset' && assets[b.fontAsset]) return `"PB Font ${b.fontAsset}", sans-serif`;
  return '';
}

// ---------- Rich text: bold / italic / underline / font for a part of a text ----------
// Stored as a small markup next to the plain text (block.rich): text with \n, <b>, <i>, <u> and
// <span data-font="KEY">. Formatting never crosses a paragraph break, so the creative's own text
// script (top-level text nodes, blank line → <br><br>) keeps working around the formatted words.
export const RICH_FONT_KEY = /^(serif|sans|system|rounded|mono|family:[\p{L}\p{N} _-]{1,60})$/u;
export function sanitizeRich(markup) {
  if (typeof markup !== 'string' || !markup) return '';
  const tpl = parser('<body></body>').createElement('template');
  tpl.innerHTML = markup.slice(0, 200000);
  let out = '';
  const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const walk = node => {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) out += esc(n.data);
      else if (n.nodeType === 1) {
        const tag = n.tagName.toLowerCase(),
          font = tag === 'span' && RICH_FONT_KEY.test(n.getAttribute('data-font') || '') ? n.getAttribute('data-font') : '';
        const open = ['b', 'i', 'u'].includes(tag) ? `<${tag}>` : font ? `<span data-font="${font}">` : '';
        out += open;
        walk(n);
        if (open) out += tag === 'span' ? '</span>' : `</${tag}>`;
      }
    }
  };
  walk(tpl.content);
  return /<(b|i|u|span)\b/.test(out) ? out : '';
}
export const richPlain = markup => {
  const tpl = parser('<body></body>').createElement('template');
  tpl.innerHTML = markup || '';
  return tpl.content.textContent;
};
// The rich text as nodes of the creative's document. «collapse»: single line breaks inside a paragraph
// become spaces (as for any original text); added elements keep every line break.
function richFragment(doc, b, assets, fonts, collapse) {
  let markup = sanitizeRich(b.rich).replace(/\r\n?/g, '\n');
  if (collapse)
    markup = markup
      .split(/\n\s*\n/)
      .map(p => p.replace(/[ \t]*\n[ \t]*/g, ' '))
      .join('\n\n');
  const tpl = doc.createElement('template');
  tpl.innerHTML = markup;
  const italic = italicFamily(fonts),
    ownFont = !b.font || (italic && b.font === 'family:' + italic.base);
  for (const span of tpl.content.querySelectorAll('span[data-font]')) {
    const stack = fontStack({ font: span.getAttribute('data-font') }, assets, fonts);
    if (stack) span.style.setProperty('font-family', stack, 'important');
  }
  if (italic && ownFont)
    for (const i of tpl.content.querySelectorAll('i'))
      if (!i.closest('span[data-font]')) i.className = 'studio-it';
  // Bold in the creative's own font: see boldFaces().
  if (ownFont)
    for (const b of tpl.content.querySelectorAll('b'))
      if (!b.closest('span[data-font]')) {
        b.className = 'studio-b';
        for (const i of b.querySelectorAll('i.studio-it')) i.className = 'studio-it studio-b';
      }
  return tpl.content;
}
// A creative that ships its italic as a separate family («Inria Serif» + «Inria Serif It»):
// italic words use that real italic instead of a slanted regular.
function italicFamily(fonts) {
  for (const base of fonts) {
    const it = fonts.find(f => f !== base && new RegExp('^' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[ -]?(It|Italic)$', 'i').test(f));
    if (it) return { base, it };
  }
  return null;
}
function richCSS(fonts, styleText) {
  const italic = italicFamily(fonts),
    base = italic?.base || (fonts.length === 1 ? fonts[0] : '');
  return (
    '[data-studio-rich] b,[data-studio-rich] strong{font-weight:700}' +
    (italic ? `.studio-it{font-family:"${italic.it}",serif!important;font-style:normal!important}` : '') +
    boldFaces(styleText, base, italic?.it)
  );
}
// A creative font declared for a weight range (font-weight:100 900) with one regular file is never
// made bold by the browser. For bold words PB adds the same file once more as a 400-weight face
// («<family> PB»), which the browser does embolden.
function boldFaces(styleText, base, it) {
  if (!base) return '';
  let css = '';
  for (const [family, cls] of [
    [base, '.studio-b'],
    [it, '.studio-it.studio-b']
  ]) {
    if (!family) continue;
    const face = [...String(styleText).matchAll(/@font-face\s*\{[^}]*\}/g)]
      .map(m => m[0])
      .find(f => new RegExp('font-family\\s*:\\s*["\']?' + family.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '["\']?\\s*[;}]').test(f));
    const src = face && /src\s*:\s*((?:url\([^)]*\)|[^;}])+)/.exec(face)?.[1];
    if (!src || !/font-weight\s*:\s*\d+\s+\d+/.test(face)) continue;
    css += `@font-face{font-family:"${family} PB";src:${src};font-weight:400;font-style:normal}${cls}{font-family:"${family} PB",serif!important}`;
  }
  return css;
}

// ---------- Elements added in PB, tied to an element of the creative ----------
// A new picture or text is placed next to an element of the creative (the «anchor»: rating, logo,
// story box…) and follows it on every screen: position, width and text size are kept as parts of the
// anchor's width. Without an anchor (or when it is hidden) the element keeps its screen placement.
// The same function runs in the editor preview and, as a small inline script, in the exported HTML.
export function placeAnchored(doc, win) {
  var props = ['left', 'top', 'width', 'transform', 'font-size', 'max-width', 'translate'];
  var rectOf = function (a) {
    var t = a && doc.querySelector('[data-import-node="' + a.n + '"]');
    var r = t && t.getBoundingClientRect();
    return r && r.width && r.height ? r : null;
  };
  // k < 1 squeezes the element toward its anchor (and shrinks a new element) when there is no room.
  var place = function (el, a, k) {
    var r = rectOf(a);
    if (!r) {
      if (el.getAttribute('data-pb-placed')) for (var i = 0; i < props.length; i++) el.style.removeProperty(props[i]);
      el.removeAttribute('data-pb-placed');
      return;
    }
    // a.e: measured from the anchor's bottom edge (the element sits in its lower part or below it).
    var y = !a.e && a.y < 0 ? a.y * k : a.y,
      edge = a.e ? r.bottom : r.top;
    if (a.m) {
      // An element of the creative moved in PB: shifted from its own place so that its centre keeps
      // the same distance to the anchor's edge (in parts of the anchor's width).
      el.style.setProperty('translate', 'none', 'important');
      var n = el.getBoundingClientRect();
      var tx = r.left + r.width / 2 + a.x * r.width - (n.left + n.width / 2);
      var ty = edge + y * r.width - (n.top + n.height / 2);
      el.style.setProperty('translate', tx + 'px ' + ty + 'px', 'important');
    } else {
      var s = !a.e && a.y < 0 ? k : 1,
        w = a.w * r.width * s;
      el.style.setProperty('width', w + 'px', 'important');
      el.style.setProperty('max-width', 'none', 'important');
      el.style.setProperty('transform', 'none', 'important');
      if (a.f) el.style.setProperty('font-size', a.f * r.width * s + 'px', 'important');
      el.style.setProperty('left', r.left + r.width / 2 + a.x * r.width - w / 2 + 'px', 'important');
      // From the bottom edge: the element's bottom keeps the distance (its height follows its width).
      var top = a.e ? edge + y * r.width - el.getBoundingClientRect().height : edge + y * r.width;
      el.style.setProperty('top', top + 'px', 'important');
    }
    el.setAttribute('data-pb-placed', '1');
  };
  var run = function () {
    var land = win.matchMedia('(min-aspect-ratio: 1/1)').matches;
    var list = [];
    var els = doc.querySelectorAll('[data-pb-anchor]');
    for (var i = 0; i < els.length; i++) {
      try {
        var a = JSON.parse(els[i].getAttribute('data-pb-anchor'))[land ? 'l' : 'p'];
        list.push({ el: els[i], a: a });
      } catch (e) {}
    }
    var all = function (kOf) {
      for (var j = 0; j < list.length; j++) place(list[j].el, list[j].a, kOf(list[j].a));
    };
    all(function () {
      return 1;
    });
    all(function () {
      return 1;
    }); // an element may be tied to another one that is itself tied
    // Elements above an anchor that run off the top of a short screen: squeeze that group.
    var margin = win.innerHeight * 0.015,
      need = {};
    for (var j = 0; j < list.length; j++) {
      var a = list[j].a,
        r = a && !a.e && a.y < 0 && rectOf(a),
        cs = win.getComputedStyle(list[j].el);
      if (!r || cs.display === 'none' || cs.visibility === 'hidden') continue;
      var top = list[j].el.getBoundingClientRect().top;
      if (top < margin && r.top - top > 1) {
        var k = Math.max(0.3, (r.top - margin) / (r.top - top));
        need[a.n] = Math.min(need[a.n] || 1, k);
      }
    }
    if (Object.keys(need).length)
      all(function (a) {
        return (a && need[a.n]) || 1;
      });
    if (win.pbAfterPlace) win.pbAfterPlace();
  };
  run();
  win.addEventListener('resize', run);
  win.addEventListener('load', run);
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(run);
  win.setTimeout(run, 120);
  win.setTimeout(run, 600);
  win.pbPlaceAnchored = run;
}
// Anchor data for one orientation, as stored on the block (percent of the anchor's width).
// The same element of the other orientation: «rate.png · портрет» ↔ «rateL.png · ландшафт».
export function twinNode(project, node, to = 'landscape') {
  const src = project?.blocks.find(x => x.node === node),
    from = to === 'landscape' ? 'портрет' : 'ландшафт',
    want = to === 'landscape' ? 'ландшафт' : 'портрет',
    base = l => String(l || '').replace(/\s*·\s*(портрет|ландшафт)\s*$/, '').replace(/L(\.\w+)$/, '$1');
  if (!src || !new RegExp('· ' + from + '$').test(src.label || '')) return node;
  const twin = project.blocks.find(
    x => x !== src && !x.added && new RegExp('· ' + want + '$').test(x.label || '') && base(x.label) === base(src.label)
  );
  return twin ? twin.node : node;
}
function anchorAttr(b, project) {
  const out = {};
  if (!b.enabled) return ''; // hidden elements take no place and never squeeze the others
  // A new element placed only in portrait follows the same element's landscape twin in landscape,
  // until it is placed in landscape by hand.
  const pa = b.anchor?.portrait;
  if (b.added && pa?.node && !b.anchor.landscape && !b.position?.landscape?.x && !b.position?.landscape?.y && !b.customStyle?.landscape?.width)
    b = { ...b, anchor: { ...b.anchor, landscape: { ...pa, node: twinNode(project, pa.node) } } };
  for (const [o, k] of [
    ['portrait', 'p'],
    ['landscape', 'l']
  ]) {
    const a = b.anchor?.[o];
    if (!a || typeof a.node !== 'string' || (b.added && !Number.isFinite(a.w))) continue;
    if (!b.added) {
      out[k] = { n: a.node, m: 1, x: (Number(a.x) || 0) / 100, y: (Number(a.y) || 0) / 100, ...(a.e ? { e: 1 } : {}) };
      continue;
    }
    out[k] = {
      ...(a.e ? { e: 1 } : {}),
      n: a.node,
      x: (Number(a.x) || 0) / 100,
      y: (Number(a.y) || 0) / 100,
      w: Math.max(0.01, a.w / 100),
      ...(Number.isFinite(a.f) && a.f > 0 ? { f: a.f / 100 } : {})
    };
  }
  return Object.keys(out).length ? JSON.stringify(out) : '';
}

// Files exported by PB 0.11.0 put formatted story text straight into its box (text + <b>/<i> next to
// each other). Such a run is wrapped back into one text element, so it opens as one story again.
function regroupRichText(doc) {
  const inline = n =>
    n.nodeType === 3 || (n.nodeType === 1 && /^(B|I|U|EM|STRONG)$/.test(n.tagName)) || (n.nodeType === 1 && n.tagName === 'SPAN' && n.hasAttribute('data-font'));
  for (const box of doc.querySelectorAll('[data-studio-rich]')) {
    if (box.matches('span.studio-text,p,h1,h2,h3,h4,h5,h6,li')) continue;
    let run = [];
    const flush = () => {
      const text = run.map(n => n.textContent).join('');
      if (run.some(n => n.nodeType === 1) && text.replace(/\s+/g, ' ').trim().length >= 40) {
        while (run.length && run[0].nodeType === 3 && !run[0].data.trim()) run.shift();
        while (run.length && run.at(-1).nodeType === 3 && !run.at(-1).data.trim()) run.pop();
        const span = doc.createElement('span');
        span.className = 'studio-text';
        span.style.whiteSpace = 'pre-line';
        span.style.display = 'block';
        run[0].before(span);
        span.append(...run);
      }
      run = [];
    };
    for (const n of [...box.childNodes]) {
      if (inline(n)) run.push(n);
      else flush();
    }
    flush();
    box.removeAttribute('data-studio-rich');
  }
}

// ---------- Store links of an original creative ----------
// The links the creative opens on CTA (as written in its code).
const IOS_RE = /https:\/\/(?:itunes|apps)\.apple\.com\/[^\s"'`<>\\)]+/g,
  ANDROID_RE = /https:\/\/play\.google\.com\/store\/[^\s"'`<>\\)]+/g;
export function storeLinksIn(html) {
  const s = String(html || '');
  return { ios: (s.match(IOS_RE) || [])[0] || '', android: (s.match(ANDROID_RE) || [])[0] || '' };
}
const safeLink = u => {
  try {
    const x = new URL(String(u || '').trim());
    return x.protocol === 'https:' ? x.href : '';
  } catch {
    return '';
  }
};
// Links set in PB (Export tab). Empty fields keep the creative's own links. One link → used on both
// platforms. Two links → each phone gets its store, even when the creative's code knows only one link
// (a small router in front of mraid.open / window.open picks by platform at the moment of the tap).
function applyStoreLinks(html, project) {
  const ios = safeLink(project.linkIos),
    android = safeLink(project.linkAndroid);
  if (!ios && !android) return { html, router: '' };
  const forIos = ios || android,
    forAndroid = android || ios;
  html = html.replace(IOS_RE, forIos).replace(ANDROID_RE, forAndroid);
  const router =
    '(function(){var I=' +
    JSON.stringify(forIos) +
    ',A=' +
    JSON.stringify(forAndroid) +
    ';function pick(u){if(typeof u!=="string")return u;if(u!==I&&u!==A&&!/apps\\.apple\\.com|play\\.google\\.com/.test(u))return u;return /android/i.test(navigator.userAgent)?A:I}' +
    'var wo=window.open;window.open=function(u){var a=[].slice.call(arguments);a[0]=pick(u);return wo.apply(window,a)};' +
    'function wrap(){var m=window.mraid;if(m&&typeof m.open==="function"&&!m.__pbLinks){var mo=m.open;m.open=function(u){return mo.call(m,pick(u))};m.__pbLinks=1}}' +
    'wrap();document.addEventListener("DOMContentLoaded",wrap);setTimeout(wrap,0);setTimeout(wrap,500);setTimeout(wrap,2000)})();';
  return { html, router };
}

// Creatives opened before music became an element (or restored from the browser): the music the
// creative's script plays gets its «Музика» element added.
export function addMusicBlocks(project, assets) {
  if (project.kind !== 'html' || typeof project.sourceHTML !== 'string') return false;
  let added = false,
    n = project.blocks.filter(b => b.audioAsset).length;
  const used = new Set(project.blocks.filter(b => b.audioAsset).map(b => b.originalAsset));
  for (const m of project.sourceHTML.matchAll(/studio-asset:([\w-]+)/g)) {
    const id = m[1];
    if (used.has(id) || assets[id]?.type !== 'audio') continue;
    used.add(id);
    n++;
    project.blocks.push({
      id: crypto.randomUUID(),
      node: 'audio-' + n,
      type: 'audio',
      audioAsset: true,
      enabled: true,
      width: 100,
      align: 'left',
      text: '',
      asset: id,
      assetL: '',
      originalAsset: id,
      focalX: 50,
      focalY: 50,
      customStyle: { portrait: {}, landscape: {} },
      label: n > 1 ? 'Музика ' + n : 'Музика'
    });
    added = true;
  }
  return added;
}

// Size of a picture from the first bytes of its data (PNG, GIF, JPEG, WebP), without loading it.
function imageSize(data) {
  const m = /^data:[^,]*;base64,(.*)$/.exec(String(data || ''));
  if (!m) return null;
  let bin;
  try {
    const chunk = m[1].slice(0, 120000);
    bin = atob(chunk.slice(0, chunk.length - (chunk.length % 4)));
  } catch {
    return null;
  }
  const b = i => bin.charCodeAt(i) & 255,
    be16 = i => (b(i) << 8) | b(i + 1),
    be32 = i => ((b(i) << 24) | (b(i + 1) << 16) | (b(i + 2) << 8) | b(i + 3)) >>> 0,
    le16 = i => b(i) | (b(i + 1) << 8);
  if (bin.startsWith('\x89PNG')) return { w: be32(16), h: be32(20) };
  if (bin.startsWith('GIF')) return { w: le16(6), h: le16(8) };
  if (bin.startsWith('RIFF') && bin.slice(8, 12) === 'WEBP') {
    const kind = bin.slice(12, 16);
    if (kind === 'VP8X') return { w: 1 + (b(24) | (b(25) << 8) | (b(26) << 16)), h: 1 + (b(27) | (b(28) << 8) | (b(29) << 16)) };
    if (kind === 'VP8L') {
      const v = b(21) | (b(22) << 8) | (b(23) << 16) | (b(24) << 24);
      return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 };
    }
    if (kind === 'VP8 ') return { w: le16(26) & 0x3fff, h: le16(28) & 0x3fff };
  }
  if (b(0) === 0xff && b(1) === 0xd8) {
    for (let i = 2; i < bin.length - 9; ) {
      if (b(i) !== 0xff) {
        i++;
        continue;
      }
      const mk = b(i + 1);
      if (mk >= 0xc0 && mk <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(mk)) return { w: be16(i + 7), h: be16(i + 5) };
      i += 2 + be16(i + 2);
    }
  }
  return null;
}
// A weightless transparent picture with the same proportions (keeps the layout of a hidden picture).
function placeholderFor(asset) {
  const d = imageSize(asset?.data);
  return d && d.w > 0 && d.h > 0
    ? `data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%27${d.w}%27%20height=%27${d.h}%27/%3E`
    : 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
}
