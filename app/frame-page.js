import { runCreative } from './engine.js';
// Only the editor on this same origin can initialize this trusted renderer.
// Script tags in the payload are never executed: runtime comes from the module.
addEventListener('message', async event => {
  if (event.source !== parent || event.origin !== location.origin || event.data?.type !== 'init-preview')
    return;
  const { html, config, token } = event.data;
  const parsed = new DOMParser().parseFromString(html, 'text/html'),
    stage = parsed.getElementById('stage');
  if (!stage) return;
  if (config.imported) {
    for (const a of [...document.documentElement.attributes])
      document.documentElement.removeAttribute(a.name);
    for (const a of [...parsed.documentElement.attributes])
      document.documentElement.setAttribute(a.name, a.value);
  }
  document.title = parsed.title;
  document.documentElement.lang = parsed.documentElement.lang;
  document.head.querySelector('style').textContent = parsed.querySelector('style').textContent;
  if (stage === parsed.body) {
    for (const a of [...document.body.attributes]) document.body.removeAttribute(a.name);
    for (const a of [...stage.attributes]) document.body.setAttribute(a.name, a.value);
    document.body.replaceChildren(...[...stage.childNodes].map(n => document.importNode(n, true)));
  } else {
    document.body.removeAttribute('id');
    document.body.removeAttribute('style');
    document.body.className = '';
    document.body.replaceChildren(document.importNode(stage, true));
  }
  runCreative({ ...config, preview: true });
  await document.fonts.ready;
  await Promise.all(
    [...document.images].map(img =>
      img.complete
        ? Promise.resolve()
        : new Promise(resolve => {
            img.onload = img.onerror = resolve;
          })
    )
  );
  if ([...document.images].some(img => !img.naturalWidth)) {
    parent.postMessage(
      { type: 'preview-error', token, error: 'Не вдалося декодувати зображення. Перевір асет.' },
      location.origin
    );
    return;
  }
  parent.postMessage({ type: 'preview-ready', token }, location.origin);
});
