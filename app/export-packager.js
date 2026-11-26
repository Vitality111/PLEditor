import { withEditMetadata } from './html-import.js';
// Browser-only analogue of the local inliner's packaging stages.
// Originals are never overwritten; audio, fonts and animated images stay intact.
let codecs;
async function minifiers() {
  if (!codecs)
    codecs = Promise.all([import('./vendor/terser.js'), import('./vendor/lightningcss.js')])
      .then(async ([, css]) => {
        await css.default();
        return { css, js: globalThis.Terser };
      })
      .catch(error => {
        codecs = null;
        throw error;
      });
  return codecs;
}
const bytes = s => new Blob([s]).size;
export function smallerImage(original, candidate, minGain = 0.1) {
  return candidate?.startsWith('data:image/webp;') && candidate.length < original.length * (1 - minGain)
    ? candidate
    : original;
}
const dataURL = blob =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
async function compressImage(asset, quality) {
  const data = asset.data;
  if (!data || !/^data:image\/(png|jpeg|webp);/i.test(data)) return asset;
  const blob = await fetch(data).then(r => r.blob());
  if (blob.type === 'image/webp') {
    const header = new Uint8Array(await blob.slice(0, 32).arrayBuffer());
    if (String.fromCharCode(...header.slice(12, 16)) === 'VP8X' && header[20] & 2) return asset;
  }
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    const encoded = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality / 100));
    if (!encoded) return asset;
    const result = smallerImage(data, await dataURL(encoded));
    return result === data ? asset : { ...asset, data: result };
  } finally {
    bitmap.close();
  }
}
export async function packPlayable(
  project,
  assets,
  buildHTML,
  { quality = 72, compress = true, onProgress = () => {} } = {}
) {
  const before = buildHTML(project, assets),
    packed = {},
    entries = Object.entries(assets);
  let changed = 0;
  for (const [id, a] of entries) {
    onProgress(`Асети ${Object.keys(packed).length + 1}/${entries.length}`);
    packed[id] = compress && a.type === 'image' ? await compressImage(a, quality) : a;
    if (packed[id].data !== a.data) changed++;
  }
  onProgress('Стиснення CSS та JavaScript');
  const html = await withEditMetadata(await minifyPlayable(buildHTML(project, packed)), project, packed);
  return { html, assets: packed, before: bytes(before), after: bytes(html), imagesChanged: changed };
}
export async function minifyPlayable(html) {
  const { css, js } = await minifiers(),
    doc = new DOMParser().parseFromString(html, 'text/html');
  for (const style of doc.querySelectorAll('style'))
    style.textContent = new TextDecoder().decode(
      css.transform({
        filename: 'playable.css',
        code: new TextEncoder().encode(style.textContent),
        minify: true
      }).code
    );
  for (const script of doc.querySelectorAll('script:not([src])')) {
    if (script.type && !['text/javascript', 'application/javascript', 'module'].includes(script.type))
      continue;
    const result = await js.minify(script.textContent, {
      ecma: 2020,
      module: script.type === 'module',
      compress: { passes: 2 },
      mangle: true,
      format: { comments: false, inline_script: true }
    });
    if (!result.code) {
      script.remove();
      continue;
    }
    script.textContent = result.code;
  }
  // Only structural whitespace is removed. Text spaces and paragraph breaks survive.
  const walk = document.createTreeWalker(doc, NodeFilter.SHOW_COMMENT);
  const comments = [];
  while (walk.nextNode()) comments.push(walk.currentNode);
  comments.forEach(n => n.remove());
  for (const el of doc.querySelectorAll('html,head,body,picture'))
    for (const n of [...el.childNodes]) if (n.nodeType === 3 && !n.textContent.trim()) n.remove();
  return '<!doctype html>' + doc.documentElement.outerHTML;
}
