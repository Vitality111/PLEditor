import {
  addTextGroups,
  addMusicBlocks,
  readPlayable,
  importHTMLDocument,
  extractEditMetadata,
  validTranslate,
  splitTranslate,
  creativeFonts,
  shortLabel,
  sanitizeRich,
  RICH_FONT_KEY,
  twinNode,
  storeLinksIn
} from './html-import.js';
import { drawRulers } from './rulers.js';
import { packPlayable } from './export-packager.js';
import { hintAssetIds } from './hint-assets.js';
import {
  prepareEditorProject,
  imageControlKind,
  normalizeFade,
  layoutNames,
  layoutDescriptions,
  layoutSketch
} from './editor-model.js';
import { buildHTML, escapeHTML as esc, playableHTML } from './engine.js';
import { scopedAssets, slotAssets } from './asset-scope.js';
import { createAssetLoader } from './asset-loader.js';
import { forgetBrowserCopies, saveLast, loadLast } from './storage.js';
import { layoutFailures, failureLabels } from './layout-checks.js';
import {
  ensureSet,
  setMembers,
  createVariant,
  renumber,
  fileName,
  parseFileName,
  normalizeNaming,
  syncSetFields,
  applyLayoutToSet,
  baseName
} from './variations.js';
import { zipSync, strToU8 } from './vendor/fflate.js';
import { KIT_TEMPLATES, kitTemplate } from './kit-templates.js';
import { isKit, KIT_MODES, FICTION_MODES } from './kit.js';
const assetLoader = createAssetLoader();
// Element width in % of its original box: up to 3× bigger than the creative made it.
const MAX_WIDTH = 300;
const $ = s => document.querySelector(s),
  $$ = s => [...document.querySelectorAll(s)],
  clone = x => structuredClone(x),
  uid = () => crypto.randomUUID();
const seed = await fetch('seed.json').then(r => r.json());
for (const a of Object.values(seed.assets).filter(a => a.type === 'font')) {
  try {
    a.data = (await assetLoader.load(a)).data;
  } catch (error) {
    console.warn(error.message);
  }
}
const LABELS = {
  hero: 'Головне зображення',
  title: 'Заголовок',
  story: 'Історія',
  text: 'Текст',
  image: 'Зображення',
  logo: 'Логотип',
  rating: 'Рейтинг',
  list: 'Список',
  comparison: 'До / після',
  cta: 'Кнопка CTA',
  audio: 'Музика',
  stats: 'Картка книги',
  bar: 'Пам’ять',
  timer: 'Таймер',
  rings: 'Порівняння',
  chat: 'Чат',
  button: 'Друга кнопка'
};
const ICONS = {
  hero: '▧',
  title: 'T',
  story: '≡',
  text: '¶',
  image: '▧',
  logo: '◈',
  rating: '☆',
  list: '☷',
  comparison: '◫',
  cta: '↗',
  audio: '♫',
  stats: '▤',
  bar: '▭',
  timer: '◷',
  rings: '◎',
  chat: '✦',
  button: '▢'
};
const LEGACY_TEMPLATES = [
  {
    id: 'cover',
    product: 'fiction',
    title: 'Обкладинка зі скролом',
    description: 'Зображення й історія рухаються разом',
    reference: '00127–00131',
    motion: 'cover',
    image: 'fcm-cover/cpl.png'
  },
  {
    id: 'panel',
    product: 'fiction',
    title: 'Статичний фон',
    description: 'Історія всередині прозорої панелі',
    reference: '00136 / 00138 / 00139',
    motion: 'panel',
    image: 'fcm-panel/bg.png'
  },
  {
    id: 'shrink',
    product: 'fiction',
    title: 'Зображення зі зменшенням',
    description: 'Зображення реагує на прокручування',
    reference: '00137',
    motion: 'shrink',
    image: 'fcm-shrink/bg.png'
  },
  {
    id: 'sticky',
    product: 'fiction',
    title: 'Закріплена обкладинка',
    description: 'Зображення йде вгору, бренд залишається',
    reference: '00140',
    motion: 'sticky',
    image: 'fcm-cover/cpl.png'
  },
  {
    id: 'banner',
    product: 'cleaner',
    title: 'Банер на фоні',
    description: 'Фон, текст-картинка і CTA',
    reference: '00170',
    motion: 'banner',
    image: 'cleaner-banner/ale.png'
  },
  {
    id: 'alert',
    product: 'cleaner',
    title: 'Алерт',
    description: 'Фон, картка алерту з CTA всередині і примітка',
    reference: '00165',
    motion: 'alert',
    image: 'cleaner-alert/ale.png'
  },
  {
    id: 'poster',
    product: 'cleaner',
    title: 'Базовий банер',
    description: 'Фон, головне зображення та CTA',
    reference: '00159',
    motion: 'panel',
    image: 'cleaner/ale.png'
  },
  {
    id: 'checklist',
    product: 'cleaner',
    title: 'Заголовок і список',
    description: 'Створи композицію з текстових блоків',
    reference: 'на основі сімейства списків',
    motion: 'panel',
    image: 'cleaner/aleL.png'
  },
  {
    id: 'comparison',
    product: 'cleaner',
    title: 'До / після',
    description: 'Дві картинки та підписи для порівняння',
    reference: 'на основі 00137 / 00158',
    motion: 'panel',
    image: 'cleaner/ale.png'
  }
];
// Templates shown on the start screen come from the Figma boards (kit-templates.js); older ones stay
// hidden so saved projects keep opening. The image banner (00170) stays available for Cleaner.
// Start-screen templates are the original creatives from the Figma boards, opened as they are
// (app/templates/*.zip, the PlayableAds folders). Earlier builder templates stay hidden so saved
// projects keep working.
const ORIGINALS = [
  { id: 'f-00108', product: 'fiction', title: 'Обкладинка · Chapter', reference: '0012 → 00108' },
  { id: 'f-00110', product: 'fiction', title: 'Обкладинка з назвою', reference: '0007 → 00110' },
  { id: 'f-00106', product: 'fiction', title: 'Обкладинка · POV', reference: '0029 → 00106' },
  { id: 'f-00109', product: 'fiction', title: 'Інфо-картка', reference: '0015 → 00109' },
  { id: 'f-00112', product: 'fiction', title: 'Книжкова сторінка', reference: '0016 → 00112' },
  { id: 'f-00111', product: 'fiction', title: 'Сторінка · червона кнопка', reference: '0051 → 00111' },
  { id: 'f-00105', product: 'fiction', title: 'Текст на панелі', reference: '0056 → 00105' },
  { id: 'c-00176', product: 'cleaner', title: 'Текстовий банер', reference: '0048 → 00176' },
  { id: 'c-00175', product: 'cleaner', title: 'Текст і кроки', reference: '0038 → 00175' },
  { id: 'c-00173', product: 'cleaner', title: 'Бульбашка', reference: '0083 → 00173' },
  { id: 'c-00122-1', product: 'cleaner', title: 'Алерт · Yes / Later', reference: '00122_1' },
  { id: 'c-00112', product: 'cleaner', title: 'Алерт із таймером', reference: '00112_3' },
  { id: 'c-00122-5', product: 'cleaner', title: 'Алерт на фото', reference: '00122_5' },
  { id: 'c-00101', product: 'cleaner', title: 'До / після', reference: '00101_2' }
].map(t => ({ ...t, original: true, source: `templates/${t.id}.zip`, thumb: `templates/${t.id}.jpg` }));
for (const t of LEGACY_TEMPLATES) t.hidden = true;
const TEMPLATES = [
  ...ORIGINALS,
  ...KIT_TEMPLATES.map(t => ({
    hidden: true,
    id: t.id,
    product: t.product,
    title: t.title,
    description: t.description,
    reference: t.reference,
    motion: t.motion
  })),
  ...LEGACY_TEMPLATES
];
for (const t of KIT_TEMPLATES) {
  layoutNames[t.id] = t.title;
  layoutDescriptions[t.id] = t.description;
}
layoutNames.banner = 'Банер з картинок';
const KIT_BLOCK_DEFAULTS = {
  stats: { text: '171 Chapters|Completed\n4.8 ★|Ratings\n*Exclusive|Content', width: 96 },
  bar: { label: 'Storage Used', percent: 83, text: '106 GB of 128 GB', note: '' },
  timer: { seconds: 60, text: '' },
  rings: { width: 100, text: '' },
  chat: {
    question: 'How to clear my phone without spending any money?',
    start: 'Ask AI Chat',
    header: 'AI Chat',
    answer: 'Use the **CleanUp app**.',
    text: ''
  },
  button: { text: 'Later' }
};
function makeBlock(type, props = {}) {
  return {
    id: uid(),
    type,
    enabled: true,
    width: 100,
    align: type === 'story' ? 'left' : 'center',
    text:
      type === 'title'
        ? 'Твій заголовок'
        : type === 'story'
          ? 'Перший абзац історії.\n\nПродовжуй історію тут.'
          : type === 'cta'
            ? 'Continue reading'
            : type === 'list'
              ? 'Review similar photos\nCheck large videos\nRemove old screenshots'
              : type === 'rating'
                ? '4.8 · Readers love it'
                : type === 'logo'
                  ? 'Fiction Me'
                  : 'Твій текст',
    asset: '',
    assetL: '',
    focalX: 50,
    focalY: 30,
    ...(KIT_BLOCK_DEFAULTS[type] || {}),
    ...props
  };
}
function createProject(templateId = 'titlecover') {
  const t = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0],
    fiction = t.product === 'fiction';
  const p = {
    version: 1,
    id: uid(),
    assetIds: [],
    name: fiction ? 'Fiction Me — нова варіація' : 'Cleaner — нова варіація',
    product: t.product,
    template: t.id,
    language: 'en',
    iosUrl: fiction
      ? 'https://apps.apple.com/us/app/fictionme-stories-novels/id1630170714'
      : 'https://apps.apple.com/us/app/cleanup-app-phone-cleaner/id1541639300',
    androidUrl: fiction ? 'https://play.google.com/store/apps/details?id=com.fiction.me' : '',
    updated: Date.now(),
    settings: {
      motion: t.motion,
      background: fiction ? '#ffffff' : '#edf5fd',
      textColor: fiction ? '#19151f' : '#18334b',
      accent: '#9053ed',
      ctaColor: '#ffffff',
      font: fiction ? 'serif' : 'sans',
      fontAsset: fiction ? 'inria' : '',
      bgAsset: '',
      bgAssetL: '',
      bgFocalX: 50,
      bgFocalY: 50,
      bgShade: 0,
      panelOpacity: 67,
      lineHeight: 1.35,
      radius: 8,
      hand: fiction,
      pulse: true,
      volume: 70,
      portrait: { fontSize: 23, contentWidth: 90, heroHeight: 46, ctaWidth: 70, panelHeight: 70, gap: 14 },
      landscape: { fontSize: 21, contentWidth: 84, heroHeight: 70, ctaWidth: 39, panelHeight: 69, gap: 10 }
    },
    blocks: []
  };
  const kit = kitTemplate(t.id);
  if (kit) {
    const base = p.settings;
    Object.assign(base, {
      fontAsset: '',
      bgAsset: '',
      bgAssetL: '',
      bgShade: 0,
      lineHeight: fiction ? 1.42 : 1.4,
      radius: 12,
      hand: fiction,
      stickyCover: false,
      cardStyle: '',
      cardBg: '#ffffff',
      cardOpacity: 100,
      cardRadius: 16,
      cardBorder: '',
      markColor: '',
      markText: '',
      previewChat: 'question'
    });
    const { portrait, landscape, ...rest } = kit.settings;
    Object.assign(base, rest);
    Object.assign(base.portrait, { ctaBottom: 4, coverWidth: 40 }, portrait);
    Object.assign(base.landscape, { ctaBottom: 5, coverWidth: 40 }, landscape);
    p.blocks = kit.blocks(makeBlock, seed.stories?.cover || seed.story);
    return prepareEditorProject(p);
  }
  if (fiction) {
    if (t.id === 'panel') {
      Object.assign(p.settings, {
        background: '#090909',
        textColor: '#ffffff',
        bgAsset: 'fcm-panel/bg.png',
        bgAssetL: 'fcm-panel/bgL.png'
      });
      p.blocks = [
        makeBlock('story', { text: seed.stories?.[t.id] || seed.story }),
        makeBlock('cta', { asset: 'fcm-panel/cta.png' }),
        makeBlock('audio', { asset: 'fcm-panel/bgm.mp3' })
      ];
    } else if (t.id === 'shrink') {
      Object.assign(p.settings, {
        background: '#2d0001',
        textColor: '#ffffff',
        bgAsset: 'fcm-shrink/bg.png',
        bgAssetL: 'fcm-shrink/bgL.png'
      });
      p.settings.portrait.heroHeight = 36;
      // 00137 landscape: text column is min(1688u, 92vw) ≈ 72% of the screen width.
      p.settings.landscape.contentWidth = 72;
      p.blocks = [
        makeBlock('hero', { asset: 'fcm-shrink/hero.png' }),
        makeBlock('story', { text: seed.stories?.[t.id] || seed.story }),
        makeBlock('cta', { asset: 'fcm-shrink/cta.png' }),
        makeBlock('audio', { asset: 'fcm-shrink/bgm.mp3' })
      ];
    } else {
      p.blocks = [
        makeBlock('hero', { asset: 'fcm-cover/cpl.png', assetL: 'fcm-cover/cplL.png' }),
        makeBlock('logo', { asset: 'fcm-cover/brand.png', width: 30 }),
        makeBlock('rating', { asset: 'fcm-cover/rating.png', assetL: 'fcm-cover/ratingL.png', width: 90 }),
        makeBlock('story', { text: seed.stories?.[t.id] || seed.story }),
        makeBlock('cta', { asset: 'fcm-cover/cta.png', assetL: 'fcm-cover/ctaL.png' }),
        makeBlock('audio', { asset: 'fcm-cover/bgm.mp3' })
      ];
    }
  } else {
    Object.assign(p.settings, { accent: '#52b972' });
    p.settings.portrait.fontSize = 25;
    p.settings.portrait.contentWidth = 88;
    if (t.id === 'banner') {
      Object.assign(p.settings, {
        background: '#faf3e6',
        bgAsset: 'cleaner-banner/bg.png',
        bgAssetL: 'cleaner-banner/bgL.png',
        bgFocalY: 0
      });
      p.settings.portrait.contentWidth = 100;
      p.settings.portrait.ctaWidth = 85;
      p.settings.landscape.contentWidth = 100;
      p.settings.landscape.ctaWidth = 36;
      p.blocks = [
        makeBlock('image', {
          label: 'Текст-картинка',
          asset: 'cleaner-banner/ale.png',
          assetL: 'cleaner-banner/aleL.png',
          width: 76
        }),
        makeBlock('cta', {
          text: 'Clean up email',
          asset: 'cleaner-banner/cta.png',
          assetL: 'cleaner-banner/ctaL.png'
        })
      ];
    }
    if (t.id === 'alert') {
      Object.assign(p.settings, {
        background: '#f3d7e3',
        bgAsset: 'cleaner-alert/bg.png',
        bgAssetL: 'cleaner-alert/bgL.png',
        bgFocalY: 0
      });
      p.settings.portrait.ctaWidth = 85;
      p.settings.landscape.ctaWidth = 85;
      p.blocks = [
        makeBlock('image', {
          label: 'Картка алерту',
          role: 'card',
          asset: 'cleaner-alert/ale.png',
          assetL: 'cleaner-alert/aleL.png',
          width: 90
        }),
        makeBlock('cta', {
          text: 'Open CleanUp',
          asset: 'cleaner-alert/cta.png',
          assetL: 'cleaner-alert/ctaL.png'
        }),
        makeBlock('image', {
          label: 'Примітка внизу',
          role: 'footnote',
          asset: 'cleaner-alert/wr.png',
          width: 50
        })
      ];
    }
    if (t.id === 'poster') {
      p.settings.portrait.heroHeight = 38;
      p.settings.landscape.heroHeight = 60;
      p.blocks = [
        makeBlock('image', {
          label: 'Заголовок-картинка',
          asset: 'cleaner/title.png',
          assetL: 'cleaner/titleL.png',
          width: 90
        }),
        makeBlock('hero', { asset: 'cleaner/mcp.png' }),
        makeBlock('image', {
          label: 'Опис-картинка',
          asset: 'cleaner/ale.png',
          assetL: 'cleaner/aleL.png',
          width: 85
        }),
        makeBlock('cta', { text: 'Try CleanUp', asset: 'cleaner/cta.png', assetL: 'cleaner/ctaL.png' })
      ];
    }
    if (t.id === 'checklist')
      p.blocks = [
        makeBlock('title', { text: 'Make room for new memories' }),
        makeBlock('list'),
        makeBlock('cta', { text: 'Try CleanUp' })
      ];
    if (t.id === 'comparison')
      p.blocks = [
        makeBlock('title', { text: 'Same phone. More space.' }),
        makeBlock('comparison', { asset: '', afterAsset: '', text: 'Before', afterText: 'After' }),
        makeBlock('cta', { text: 'Try CleanUp' })
      ];
  }
  return prepareEditorProject(p);
}
let projects = [],
  assets = clone(seed.assets),
  project,
  selected = '',
  libraryTab = 'blocks',
  inspectorTab = 'element',
  orientation = 'portrait',
  past = [],
  future = [],
  scroll = 0,
  saveTimer,
  toastTimer,
  uploadTarget = null;
const builtinAssets = new Set(Object.keys(seed.assets));
// Only the LAST creative is kept, in this browser (IndexedDB), so a reload does not lose the work.
// Opening another creative replaces it. Nothing goes to a server; the exported HTML opens in PB again.
forgetBrowserCopies();
const firstVisit = !project;
// On the very first visit an untouched starter project exists only to fill the editor; it is
// replaced by the first creative the user picks, so it never takes a creative number.
let placeholderId = null;
if (!project) {
  project = ensureSet(createProject(), projects, uid);
  projects.push(project);
  placeholderId = project.id;
}
for (const p of projects)
  for (const key of ['bgAsset', 'bgAssetL'])
    if (['cleaner/bg.png', 'cleaner/bgL.png'].includes(p.settings[key]) && !assets[p.settings[key]])
      p.settings[key] = '';
for (const p of projects) {
  if (p.kind === 'html') {
    addTextGroups(p);
    addMusicBlocks(p, assets);
  }
  prepareEditorProject(p);
  ensureSet(p, projects, uid);
}
selected =
  project.blocks.find(b => b.storyGroup || b.type === 'story' || b.textGroup)?.id || project.blocks[0]?.id;
const resolveAssets = () =>
  Object.fromEntries(
    Object.entries(assets).map(([id, a]) => [
      id,
      { ...a, url: a.url ? new URL(a.url, location.href).href : undefined }
    ])
  );
const block = () => project.blocks.find(b => b.id === selected);
const get = (path, obj = project) => path.split('.').reduce((o, k) => o?.[k], obj);
const set = (path, value, obj = project) => {
  const keys = path.split('.');
  const key = keys.pop();
  keys.reduce((o, k) => o[k], obj)[key] = value;
};
function toast(text) {
  $('#toast').textContent = text;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('#toast').hidden = true), 4500);
}
// Undo/redo restores content, never identity: the variation keeps its set and number, and
// set-wide fields restored from history are applied to the whole set again.
function restoreHistory(json) {
  const restored = JSON.parse(json);
  if (restored.variant !== project.variant) restored.name = project.name;
  for (const k of ['id', 'setId', 'variant', 'isTemplate']) restored[k] = project[k];
  project = restored;
  projects[projects.findIndex(p => p.id === project.id)] = project;
  if (project.setId) syncSetFields(project, projects);
  changed();
  refresh();
}
function snapshot() {
  placeholderId = null;
  past.push(JSON.stringify(project));
  if (past.length > 35) past.shift();
  future = [];
}
function changed() {
  project.updated = Date.now();
  projects[projects.findIndex(p => p.id === project.id)] = project;
  $('#undo').disabled = !past.length;
  $('#redo').disabled = !future.length;
  dirty = true;
  scheduleSave();
}
$('#storageNote').textContent += ' · Зберігається лише останній креатив';
const savedLabel = 'Збережено в цьому браузері · лише останній креатив',
  savingLabel = 'Зберігається…',
  unsavedLabel = 'Не збережено · збережи через «Експорт HTML»';
let dirty = false;
function scheduleSave() {
  if (placeholderId) return;
  $('#saveStatus').textContent = savingLabel;
  $('#saveStatus').classList.remove('saved');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => save().catch(() => {}), 500);
}
// Files the kept creative needs: everything its variations point at (hidden elements included),
// except PB's own built-in files, which are always there.
function lastSet() {
  const members = project.setId ? setMembers(projects, project.setId) : [];
  return members.length ? members : [project];
}
function assetsToKeep(list) {
  const ids = new Set();
  for (const p of list) {
    for (const id of referencedAssets({ ...p, blocks: p.blocks.map(b => ({ ...b, enabled: true })) })) ids.add(id);
    for (const b of p.blocks)
      for (const k of ['asset', 'assetL', 'afterAsset', 'fontAsset', 'originalAsset']) if (b[k]) ids.add(b[k]);
  }
  return Object.fromEntries([...ids].filter(id => assets[id] && !builtinAssets.has(id)).map(id => [id, assets[id]]));
}
// Saves the last creative (all its variations). The untouched starter project is never saved.
function save() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (placeholderId || !project) return Promise.resolve();
  const record = {
    version: 1,
    savedAt: Date.now(),
    currentId: project.id,
    projects: JSON.parse(JSON.stringify(lastSet())),
    assets: assetsToKeep(lastSet())
  };
  return saveLast(record).then(
    () => {
      if (saveTimer) return; // a newer change is about to be saved
      $('#saveStatus').textContent = savedLabel;
      $('#saveStatus').classList.add('saved');
    },
    e => {
      $('#saveStatus').textContent = unsavedLabel;
      // Mostly a full disk or a private window; the work is still in the tab.
      if (!save.warned) toast('Не вдалося зберегти креатив у браузері: ' + (e?.message || 'немає місця'));
      save.warned = true;
      throw e;
    }
  );
}
// Leaving the page: the last pending change is written right away.
addEventListener('pagehide', () => {
  if (saveTimer) save().catch(() => {});
});
// «Відкрити preview ↗»: the creative as exported, full screen in a new tab, in a sandbox.
async function openStandalonePreview() {
  const tab = open('', '_blank');
  if (!tab) return toast('Браузер заблокував нову вкладку. Дозволь спливні вікна для PB.');
  tab.document.write('<!doctype html><title>PB — preview</title><body style="margin:0;background:#0d0e11;color:#eceef2;font:14px -apple-system,Arial">Завантаження…</body>');
  try {
    const config = clone(project),
      html = playableHTML(buildHTML(config, await preparedAssets(config), { preview: false }));
    const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(project.name)} — PB preview</title><style>html,body,iframe{margin:0;width:100%;height:100%;border:0;background:#000}</style></head><body><iframe sandbox="allow-scripts"></iframe></body></html>`;
    tab.document.open();
    tab.document.write(page);
    tab.document.close();
    tab.document.querySelector('iframe').srcdoc = html;
  } catch (e) {
    tab.document.body.textContent = 'Не вдалося зібрати preview: ' + e.message;
  }
}
function refresh({ inspector = true, library = true, preview = true } = {}) {
  prepareEditorProject(project);
  $('#layoutName').textContent =
    project.kind === 'html' ? 'Імпортований плейбл' : layoutNames[project.template] || 'Власна композиція';
  $('#changeLayout').hidden = project.kind === 'html';
  $('#productLabel').textContent =
    project.kind === 'html' ? 'HTML / ZIP' : project.product === 'fiction' ? 'FICTION ME' : 'CLEANER';
  if (library) renderLibrary();
  if (inspector) renderInspector();
  if (preview) renderPreview();
  $('#projectName').value = project.name;
  renderVariants();
  $$('[data-product]').forEach(e => e.classList.toggle('active', e.dataset.product === project.product));
  $('#undo').disabled = !past.length;
  $('#redo').disabled = !future.length;
}
function renderVariants() {
  const nav = $('#variantTabs');
  if (!nav) return;
  if (project.isTemplate || !project.setId) {
    nav.hidden = true;
    $('#export').textContent = 'Експорт HTML';
    return;
  }
  const members = setMembers(projects, project.setId);
  nav.hidden = false;
  nav.innerHTML =
    `<span class="variant-number" title="Номер креативу">${esc(project.naming?.number || '—')}</span>` +
    members
      .map(
        p =>
          `<button class="variant-tab ${p.id === project.id ? 'active' : ''}" data-variant-id="${p.id}" aria-pressed="${p.id === project.id}" title="${esc(fileName(p))}">${p.variant}</button>`
      )
      .join('') +
    '<button class="variant-tab add" id="addVariant" title="Нова варіація: копія поточної, далі заміни картинки">+ Варіація</button>' +
    (members.length > 1
      ? `<button class="variant-tab remove" id="removeVariant" title="Видалити варіацію ${project.variant}">×</button>`
      : '');
  $('#export').textContent = members.length > 1 ? `Експорт ZIP · ${members.length}` : 'Експорт HTML';
  updateFileNames();
}
function updateFileNames() {
  const list = $('#fileNames');
  if (!list || !project.setId) return;
  list.innerHTML = setMembers(projects, project.setId)
    .map(p => `<li class="${p.id === project.id ? 'current' : ''}">${esc(fileName(p))}</li>`)
    .join('');
  const num = $('#variantTabs .variant-number');
  if (num) num.textContent = normalizeNaming(project.naming || {}, project).number || '—';
}
let previewRevision = 0,
  previewTimer,
  previewSound = false,
  editPositions = false,
  playMode = false,
  dragLabel = '',
  lastExport = null,
  loadedSignature = '',
  pendingSignature = '',
  lastPreviewHTML = '';
function setPlayMode(on) {
  if (playMode === on) return;
  playMode = on;
  $('#modeEdit').classList.toggle('active', !on);
  $('#modePlay').classList.toggle('active', on);
  if (!on) $('#playFrame').srcdoc = '';
  loadedSignature = '';
  renderPreview();
}
function renderPreview() {
  const t = TEMPLATES.find(t => t.id === project.template);
  $('#previewTitle').textContent =
    project.kind === 'html' ? project.name : layoutNames[t?.id] || 'Власна композиція';
  $('#motionBadge').textContent =
    project.kind === 'html'
      ? 'Макет · CSS-анімації'
      : {
          panel: 'Статичний фон',
          cover: 'Скрол обкладинки',
          shrink: 'Зменшення на скролі',
          sticky: 'Закріплений бренд',
          banner: 'Банер на фоні',
          alert: 'Алерт з CTA',
          titlecover: 'Арт іде вгору',
          niche: 'Арт іде вгору',
          infocard: 'Картка книги',
          page: 'Скрол у сторінці',
          panel2: 'Скрол у панелі',
          textbanner: 'Статичний',
          aichat: 'Анімація чату',
          alertphoto: 'Статичний',
          mockup: 'Статичний',
          compare: 'Статичний'
        }[project.settings.motion] || '';
  const revision = ++previewRevision,
    config = clone(project);
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => loadPreview(config, revision), 80);
}
async function preparedAssets(config, includeAudio = true) {
  const pairs = await Promise.all(
    referencedAssets(config).map(async id => {
      const a = assets[id];
      if (!a) throw Error('Відсутній асет: ' + id);
      return [
        id,
        a.type === 'audio' && !includeAudio
          ? { ...a, data: undefined, url: undefined }
          : await assetLoader.load(a)
      ];
    })
  );
  return Object.fromEntries(pairs);
}
async function loadPreview(config, revision, overrideAssets = null) {
  const state = $('#previewState'),
    frame = $('#preview');
  state.hidden = false;
  state.classList.remove('error');
  state.querySelector('span').textContent = 'Завантаження preview…';
  $('#retryPreview').hidden = true;
  try {
    const packed = overrideAssets || (await preparedAssets(config));
    if (revision !== previewRevision) return;
    if (playMode) {
      // The creative runs exactly as exported: its own scripts, animations and taps.
      const play = $('#playFrame');
      play.onload = () => {
        if (revision === previewRevision) state.hidden = true;
      };
      // Show and size the frame first: creatives measure the screen when they start, and a hidden
      // frame has no size (white screen on the second test run).
      sizePreview();
      play.srcdoc = playableHTML(buildHTML(config, packed, { preview: false }));
      return;
    }
    const html = buildHTML(config, packed, { preview: true, previewSound });
    const signature = JSON.stringify([
      config.id,
      config.product,
      config.settings.motion,
      config.blocks.map(b => [b.id, b.type, b.enabled])
    ]);
    lastPreviewHTML = html;
    $('#standalonePreview').setAttribute('aria-disabled', 'false');
    if (loadedSignature === signature) {
      state.hidden = true;
      frame.contentWindow.postMessage(
        {
          type: 'update-document',
          html,
          token: revision,
          config: {
            editPositions,
            selected,
            previewSound,
            volume: config.settings.volume,
            hand: config.settings.hand
          }
        },
        '*'
      );
    } else {
      // A full reload: until the new page reports ready, nothing may be sent as an in-place update
      // (an update sent to a loading frame is lost and the preview stays blank).
      pendingSignature = signature;
      loadedSignature = '';
      frame.onload = () => {
        if (revision !== previewRevision) return;
        frame.contentWindow.postMessage(
          {
            type: 'init-preview',
            html,
            token: revision,
            config: {
              preview: true,
              imported: config.kind === 'html',
              previewSound,
              editPositions,
              selected,
              native: config.kind === 'html' || config.product === 'fiction',
              product: config.product,
              motion: config.settings.motion,
              volume: config.settings.volume,
              hand: config.settings.hand,
              ios: config.iosUrl,
              android: config.androidUrl
            }
          },
          location.origin
        );
      };
      frame.src = 'frame.html?revision=' + revision;
    }
    sizePreview();
  } catch (error) {
    if (revision !== previewRevision) return;
    state.classList.add('error');
    state.querySelector('span').textContent = error.message;
    $('#retryPreview').hidden = false;
  }
}
function sizePreview() {
  let [w, h] = $('#device').value.split(',').map(Number);
  if (orientation === 'landscape') [w, h] = [h, w];
  const area = $('#previewArea'),
    shell = $('#deviceShell'),
    screen = $('#deviceScreen'),
    frame = $('#preview'),
    surface = $('#previewSurface');
  const landscape = orientation === 'landscape';
  // The preview is the bare screen of the chosen size: one phone frame would not match the other sizes.
  shell.classList.toggle('landscape', landscape);
  const baseW = w,
    baseH = h;
  const chosen = $('#previewZoom').value;
  const padding = editPositions ? 76 : 24;
  const fit = Math.min((area.clientWidth - padding) / baseW, (area.clientHeight - padding) / baseH, 1);
  const shellScale =
    chosen === 'fit'
      ? Math.max(0.05, fit)
      : Number(chosen);
  const sw = baseW * shellScale,
    sh = baseH * shellScale;
  shell.style.width = sw + 'px';
  shell.style.height = sh + 'px';
  const insetX = 0,
    insetY = 0;
  const iw = sw - 2 * insetX,
    ih = sh - 2 * insetY,
    scale = Math.min(iw / w, ih / h);
  screen.style.cssText = `left:${insetX}px;top:${insetY}px;width:${iw}px;height:${ih}px;`;
  frame.style.width = w + 'px';
  frame.style.height = h + 'px';
  frame.style.left = (iw - w * scale) / 2 + 'px';
  frame.style.top = (ih - h * scale) / 2 + 'px';
  frame.style.transform = 'none';
  frame.style.zoom = scale;
  $('#playFrame').style.cssText = frame.style.cssText;
  frame.hidden = playMode;
  $('#playFrame').hidden = !playMode;
  surface.style.width = Math.max(sw + padding, area.clientWidth) + 'px';
  surface.style.height = Math.max(sh + padding, area.clientHeight) + 'px';
  shell.style.left = Math.round((surface.clientWidth - sw) / 2) + 'px';
  shell.style.top = Math.round((surface.clientHeight - sh) / 2) + 'px';
  drawRulers({
    surface,
    shell,
    frame,
    horizontal: $('#horizontalRuler'),
    vertical: $('#verticalRuler'),
    badge: $('#dragReadout'),
    enabled: editPositions,
    width: w,
    height: h,
    label: dragLabel
  });
  $('#zoom').textContent = Math.round(scale * 100) + '%';
}
new ResizeObserver(sizePreview).observe($('#previewArea'));
let chooserProduct = project.product,
  chooserMode = 'new',
  chooserStep = 'product';
// Start screen: 1) product, 2) template or own playable. «Змінити композицію» skips step 1.
function openChooser(mode = 'new', start = false) {
  save().catch(() => {});
  chooserMode = mode;
  chooserProduct = project.product;
  chooserStep = mode === 'change' ? 'template' : 'product';
  document.body.classList.add('choosing');
  $('#chooser').hidden = false;
  $('#editor').hidden = true;
  $('#cancelChooser').hidden = start && firstVisit;
  $('#cancelChooser').textContent = start ? 'Продовжити останній' : 'Назад до редактора';
  renderChooser();
}
function closeChooser() {
  document.body.classList.remove('choosing');
  $('#chooser').hidden = true;
  $('#editor').hidden = false;
  sizePreview();
}
function renderChooser() {
  const productName = chooserProduct === 'fiction' ? 'Fiction Me' : 'Cleaner';
  $('#productPick').hidden = chooserStep !== 'product';
  $('#compositionGrid').hidden = chooserStep !== 'template';
  $('#chooserBack').hidden = chooserStep !== 'template' || chooserMode === 'change';
  $('#chooserTitle').textContent =
    chooserStep === 'product'
      ? 'Що робимо?'
      : chooserMode === 'change'
        ? 'Інший шаблон'
        : productName + ': обери шаблон';
  $('#chooserSub').textContent =
    chooserStep === 'product'
      ? 'Обери продукт — далі шаблон або свій плейбл.'
      : chooserMode === 'change'
        ? 'Поточний креатив зміниться; скасувати можна кнопкою ↶.'
        : 'Справжні креативи без переробки. Обраний відкриється копією з новим номером.';
  if (chooserStep !== 'template') return;
  const upload =
    chooserMode === 'change'
      ? ''
      : `<article class="composition-card upload-card"><div class="upload-face" aria-hidden="true">↑</div><h2>Свій плейбл</h2><p>HTML або ZIP</p><button class="btn secondary full-width" id="importPlayable">Завантажити</button></article>`;
  $('#compositionGrid').innerHTML =
    upload +
    TEMPLATES.filter(t => t.product === chooserProduct && !t.hidden && !(t.original && chooserMode === 'change'))
      .map(
        t =>
          `<article class="composition-card"><div class="composition-thumb"${t.original ? '' : ` data-thumb="${t.id}"`}>${t.original ? `<img src="${t.thumb}" alt="" loading="lazy">` : ''}</div><h2>${esc(t.title || layoutNames[t.id])}</h2><p>${esc(t.reference || '')}</p><button class="btn primary full-width" data-choose="${t.id}">${chooserMode === 'change' && project.template === t.id ? 'Поточний' : 'Обрати'}</button></article>`
      )
      .join('') +
    projects
      .filter(p => p.isTemplate && p.product === chooserProduct)
      .map(
        p =>
          `<article class="composition-card"><div class="composition-thumb" data-thumb-project="${p.id}"></div><h2>${esc(baseName(p.name))}</h2><p>Моя композиція</p><button class="btn primary full-width" data-custom-template="${p.id}">Обрати</button></article>`
      )
      .join('');
  renderThumbs();
}
// Live thumbnails: the real template rendered small, without scripts.
let thumbToken = 0;
async function renderThumbs() {
  const token = ++thumbToken;
  for (const el of $$('#compositionGrid [data-thumb], #compositionGrid [data-thumb-project]')) {
    const p = el.dataset.thumb
      ? createProject(el.dataset.thumb)
      : projects.find(x => x.id === el.dataset.thumbProject);
    if (!p) continue;
    let html;
    try {
      html = buildHTML(p, await preparedAssets(p, false), { preview: true });
    } catch {
      continue;
    }
    if (token !== thumbToken) return;
    const f = document.createElement('iframe');
    f.setAttribute('sandbox', 'allow-same-origin');
    f.setAttribute('tabindex', '-1');
    f.setAttribute('aria-hidden', 'true');
    f.srcdoc = html.replace(/<script>[\s\S]*?<\/script>/g, '');
    el.style.setProperty('--thumb-scale', String((el.clientWidth || 180) / 393));
    el.replaceChildren(f);
  }
}
addEventListener('resize', () =>
  $$('#compositionGrid [data-thumb], #compositionGrid [data-thumb-project]').forEach(el =>
    el.style.setProperty('--thumb-scale', String((el.clientWidth || 180) / 393))
  )
);
async function openOriginal(t) {
  try {
    const blob = await fetch(t.source).then(r => {
      if (!r.ok) throw Error('Не вдалося завантажити шаблон (' + r.status + ').');
      return r.blob();
    });
    await importPlayable(new File([blob], t.source.split('/').pop(), { type: 'application/zip' }), { template: t });
  } catch (e) {
    toast(e.message);
  }
}
function chooseComposition(id) {
  const original = ORIGINALS.find(t => t.id === id);
  if (original) {
    openOriginal(original);
    return;
  }
  if (chooserMode === 'new') {
    newTemplate(id);
  } else {
    snapshot();
    const base = createProject(id),
      old = project.blocks;
    project.template = id;
    if (kitTemplate(id)) {
      // Coded templates bring their own colours, sizes and card; the user's pictures stay.
      const keep = Object.fromEntries(
        [
          'bgAsset',
          'bgAssetL',
          'fontAsset',
          'fadeTop',
          'fadeBottom',
          'compressImages',
          'exportImageQuality',
          'volume'
        ]
          .filter(k => project.settings[k] !== undefined && project.settings[k] !== '')
          .map(k => [k, project.settings[k]])
      );
      project.settings = { ...base.settings, ...keep };
    }
    project.settings.motion = base.settings.motion;
    for (const key of ['bgAsset', 'bgAssetL'])
      if (!project.settings[key]) project.settings[key] = base.settings[key];
    // Reuse the user's blocks slot by slot: same type and same role (card / footnote), each block once.
    const used = new Set();
    project.blocks = base.blocks.map(b => {
      const match = old.find(x => !used.has(x.id) && x.type === b.type && (x.role || '') === (b.role || ''));
      if (!match) return b;
      used.add(match.id);
      // Keep the user's text and pictures; place the block where the new template expects it.
      const placed = { ...match, zone: b.zone, role: b.role };
      if (!b.zone) delete placed.zone;
      if (!b.role) delete placed.role;
      return placed;
    });
    // Blocks the new template has no place for are kept, hidden, so nothing the user made is lost.
    for (const b of old)
      if (
        !used.has(b.id) &&
        !['logo', 'rating', 'audio'].includes(b.type) &&
        (b.type !== 'hero' || !project.blocks.some(x => x.type === 'hero'))
      )
        project.blocks.push({
          ...b,
          enabled: false,
          zone: kitTemplate(id)
            ? project.product === 'cleaner' && kitTemplate(id).motion === 'alertphoto'
              ? 'card'
              : 'content'
            : b.zone
        });
    selected = project.blocks.find(b => b.type === 'hero')?.id || project.blocks[0]?.id;
    changed();
    refresh();
  }
  closeChooser();
}
function visibleBlocks(p = project) {
  const members = new Set(
    p.blocks.flatMap(b => (b.textGroup ? b.memberNodes : b.storyGroup ? b.parts || [] : []))
  );
  return p.blocks.filter(b => !members.has(b.node));
}
// «+ Додати елемент» stays open while several elements are added in a row.
let addSectionOpen = false;
document.addEventListener(
  'toggle',
  e => {
    if (e.target.classList?.contains('add-section')) addSectionOpen = e.target.open;
  },
  true
);
function renderLibrary() {
  let s = '';
  {
    s =
      project.kind === 'html'
        ? ''
        : `<button class="background-row ${selected === 'background' ? 'active' : ''}" data-select="background"><span class="background-swatch" style="background:${project.settings.background}"></span><span>Фон креативу</span></button>${project.product === 'fiction' ? `<button class="background-row ${selected === 'fades' ? 'active' : ''}" data-select="fades"><span class="background-swatch" style="background:linear-gradient(#111,transparent 45%,transparent 55%,#111)"></span><span>Затемнення тексту</span></button>` : ''}<div class="section-label">ЕЛЕМЕНТИ · ${visibleBlocks().length}</div>`;
    if (project.kind === 'html') s += `<div class="section-label">ЕЛЕМЕНТИ · ${visibleBlocks().length}</div>`;
    for (const b of visibleBlocks())
      s += `<div class="block-row ${selected === b.id ? 'active' : ''}"><button class="block-select" data-select="${b.id}"><span class="block-icon">${assets[b.asset]?.type === 'image' ? `<img src="${esc(assets[b.asset].data || assets[b.asset].url)}" alt="">` : ICONS[b.type]}</span><span class="block-name">${esc(b.label || LABELS[b.type])}<small>${b.enabled ? (b.hide?.landscape ? 'Лише в портреті' : b.hide?.portrait ? 'Лише в ландшафті' : '') : 'Приховано'}</small></span></button><div class="block-tools">${project.kind !== 'html' && !['hero', 'logo', 'rating', 'cta', 'audio'].includes(b.type) ? `<button data-move="${b.id}" data-dir="-1" aria-label="Перемістити ${LABELS[b.type]} вище" title="Вище">↑</button><button data-move="${b.id}" data-dir="1" aria-label="Перемістити ${LABELS[b.type]} нижче" title="Нижче">↓</button>` : ''}<button data-visible="${b.id}" aria-label="Показати або приховати ${LABELS[b.type]}" title="Показати / приховати">${b.enabled ? '◉' : '○'}</button></div></div>`;
    if (project.kind === 'html')
      s +=
        '<details class="add-section"' + (addSectionOpen ? ' open' : '') + '><summary>+ Додати елемент</summary><div class="add-blocks"><button data-add-html="text">Текст</button><button data-add-html="image">Картинка</button></div><small class="muted">Новий елемент з\'явиться поверх креативу. Посунь його й зміни ширину у вкладці «Елемент».</small></details>';
    if (project.kind !== 'html')
      s +=
        '<details class="add-section"' + (addSectionOpen ? ' open' : '') + '><summary>+ Додати елемент</summary><div class="add-blocks">' +
        Object.keys(LABELS)
          .filter(k =>
            isKit(project)
              ? (project.product === 'fiction'
                  ? ['text', 'title', 'story', 'image', 'logo', 'stats', 'audio']
                  : ['text', 'title', 'image', 'list', 'button', 'bar', 'timer']
                ).includes(k)
              : !['stats', 'bar', 'timer', 'rings', 'chat', 'button'].includes(k) &&
                (project.product === 'fiction' || !['story', 'audio', 'logo', 'rating'].includes(k))
          )
          .map(k => `<button data-add="${k}">${LABELS[k]}</button>`)
          .join('') +
        '</div></details>';
  }
  // Files of the creative, right under the elements (one panel, nothing hidden behind a tab).
  // A file used by an element opens that element on click.
  {
    const files = scopedAssets(project, assets),
      user = b => [b.asset, b.assetL, b.afterAsset, b.fontAsset];
    s +=
      `<div class="section-label files-label">ФАЙЛИ · ${files.length}</div>` +
      '<div class="upload-zone"><button class="btn secondary full-width" id="uploadAssets">Завантажити файли</button><small>Зображення, аудіо, шрифти. Можна перетягнути файли сюди.</small></div><div class="asset-grid">';
    for (const a of files) {
      const owner = project.blocks.find(b => user(b).includes(a.id));
      s += `<div class="asset-card${owner ? ' used' : ''}">${owner ? `<button class="asset-open" data-open-block="${owner.id}" title="Відкрити: ${esc(owner.label || LABELS[owner.type])}" aria-label="Відкрити елемент ${esc(owner.label || LABELS[owner.type])}"></button>` : ''}${a.type === 'image' ? `<img src="${esc(a.data || a.url)}" alt="">` : `<div class="asset-icon">${a.type === 'audio' ? '♫' : a.type === 'font' ? 'Aa' : 'FILE'}</div>`}<strong>${esc(a.name)}</strong>${!a.builtin && !owner ? `<button data-delete-asset="${esc(a.id)}" aria-label="Видалити файл" title="Видалити файл">×</button>` : ''}</div>`;
    }
    s += '</div>';
  }
  $('#libraryBody').innerHTML = s;
  $$('[data-tab]').forEach(e => e.classList.toggle('active', e.dataset.tab === libraryTab));
}
const field = (label, control, help = '') =>
  `<div class="field"><label>${label}</label>${control.replace(/aria-label="Точне значення [^"]*"/g, `aria-label="${label}: точне значення"`).replace(/aria-label="(?:block|settings)\.[^"]*"/g, `aria-label="${label}"`)}${help ? `<small class="muted">${help}</small>` : ''}</div>`;
const textInput = (path, value) => `<input data-prop="${path}" value="${esc(value)}">`;
const range = (path, value, min, max, step = 1, suffix = '') =>
  `<div class="field-row"><input aria-label="${path}" type="range" data-prop="${path}" value="${value}" min="${min}" max="${max}" step="${step}"><input aria-label="Точне значення ${path}" class="range-number" type="number" data-prop="${path}" value="${value}" min="${min}" max="${max}" step="${step}"><span>${suffix}</span></div>`;
const toggle = (label, path, value) =>
  `<label class="toggle-row">${label}<input type="checkbox" data-prop="${path}" ${value ? 'checked' : ''}></label>`;
const color = (label, path, value) =>
  field(
    label,
    `<div class="field-row"><input type="color" data-prop="${path}" value="${value}"><span>${value}</span></div>`
  );
function visibilityControl(b) {
  // Elements of original creatives: shown in portrait and/or landscape, each on its own.
  if (project.kind === 'html' && !b.bgAsset && !b.textGroup && !b.storyGroup) {
    const shown = o => b.enabled && !b.hide?.[o],
      box = (o, label) =>
        `<label class="toggle-row">${label}${o === orientation ? ' <small class="muted">· зараз на екрані</small>' : ''}<input type="checkbox" data-show-for="${o}" ${shown(o) ? 'checked' : ''}></label>`;
    return (
      '<div class="section-label">Показувати</div>' +
      box('portrait', 'У портреті') +
      box('landscape', 'У ландшафті') +
      (!shown('portrait') && !shown('landscape') ? '<small class="muted">Елемент приховано в обох орієнтаціях.</small>' : '')
    );
  }
  return (
    toggle(b.textGroup ? 'Показувати весь текст' : 'Показувати елемент', 'block.enabled', b.enabled) +
    (b.enabled
      ? '<small class="muted">Вимкни, щоб приховати ' +
        (b.textGroup ? 'весь текст' : 'цей елемент') +
        ' у preview та експорті.</small>'
      : '<div class="notice">' +
        (b.textGroup ? 'Весь текст приховано.' : 'Елемент приховано.') +
        '<button class="btn secondary full-width" data-visible="' +
        b.id +
        '">Показати знову</button></div>')
  );
}
// ---------- Rich text editor (original creatives) ----------
// Select words and make them bold / italic / underlined or give them another font, like in a design
// tool. «key» is 'block' (the selected element) or 'part.<id>' (Chapter / POV / story in the story box).
const RICH_FONTS = () => [
  ['', 'Шрифт тексту'],
  ...creativeFonts(project.sourceHTML).map(f => ['family:' + f, f]),
  ['serif', 'Georgia'],
  ['sans', 'Arial'],
  ['system', 'Системний'],
  ['rounded', 'Trebuchet'],
  ['mono', 'Моноширинний']
];
const RICH_PREVIEW_FONT = {
  serif: 'Georgia, serif',
  sans: 'Arial, sans-serif',
  system: '-apple-system, "Segoe UI", sans-serif',
  rounded: '"Trebuchet MS", sans-serif',
  mono: 'ui-monospace, Menlo, monospace'
};
function richEditorHTML(b) {
  const tpl = document.createElement('template');
  tpl.innerHTML = b.rich ? sanitizeRich(b.rich) : '';
  if (!b.rich) tpl.content.append(document.createTextNode(b.text || ''));
  for (const sp of tpl.content.querySelectorAll('span[data-font]')) {
    const k = sp.dataset.font;
    sp.title = k.startsWith('family:') ? k.slice(7) : RICH_FONTS().find(([v]) => v === k)?.[1] || k;
    if (RICH_PREVIEW_FONT[k]) sp.style.fontFamily = RICH_PREVIEW_FONT[k];
  }
  const div = document.createElement('div');
  div.append(tpl.content);
  return div.innerHTML;
}
function richField(label, key, b, rows, hint = '') {
  return field(
    label,
    `<div class="rich-tools" role="toolbar" aria-label="Форматування виділеного тексту">` +
      `<button type="button" class="rich-btn" data-rich-cmd="bold" data-rich-for="${key}" title="Жирний (Cmd/Ctrl+B)" aria-label="Жирний"><b>Ж</b></button>` +
      `<button type="button" class="rich-btn" data-rich-cmd="italic" data-rich-for="${key}" title="Курсив (Cmd/Ctrl+I)" aria-label="Курсив"><i>К</i></button>` +
      `<button type="button" class="rich-btn" data-rich-cmd="underline" data-rich-for="${key}" title="Підкреслений (Cmd/Ctrl+U)" aria-label="Підкреслений"><u>П</u></button>` +
      `<select class="rich-font" data-rich-font="${key}" aria-label="Шрифт виділеного тексту" title="Шрифт виділеного тексту">${RICH_FONTS()
        .map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`)
        .join('')}</select>` +
      `<button type="button" class="rich-btn" data-rich-cmd="clear" data-rich-for="${key}" title="Прибрати форматування з виділеного" aria-label="Прибрати форматування">✕</button>` +
      `</div><div class="rich-edit" contenteditable="true" spellcheck="false" data-rich="${key}" style="--rows:${rows}" role="textbox" aria-multiline="true" aria-label="${esc(label)}">${richEditorHTML(b)}</div>`,
    hint || 'Виділи слова й натисни Ж / К / П або обери шрифт. Порожній рядок = новий абзац.'
  );
}
// Editor DOM → plain text + markup (or '' when nothing is formatted).
function readRich(root) {
  const runs = [];
  const walk = (node, st) => {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) {
        runs.push({ ...st, text: n.data.replace(/ /g, ' ') });
        continue;
      }
      if (n.nodeType !== 1) continue;
      const t = n.tagName;
      if (t === 'BR') {
        runs.push({ ...st, text: '\n' });
        continue;
      }
      const s = { ...st };
      if (t === 'B' || t === 'STRONG') s.b = true;
      if (t === 'I' || t === 'EM') s.i = true;
      if (t === 'U') s.u = true;
      const fw = n.style?.fontWeight;
      if (fw) s.b = fw === 'bold' || fw === 'bolder' || Number(fw) >= 600;
      if (n.style?.fontStyle) s.i = n.style.fontStyle === 'italic';
      const td = n.style?.textDecorationLine || n.style?.textDecoration;
      if (td) s.u = /underline/.test(td);
      const face = t === 'FONT' ? n.getAttribute('face') : n.getAttribute('data-font');
      if (face != null) s.f = RICH_FONT_KEY.test(face) ? face : '';
      if (/^(DIV|P)$/.test(t) && runs.length && !runs.at(-1).text.endsWith('\n')) runs.push({ ...st, text: '\n' });
      walk(n, s);
    }
  };
  walk(root, { b: false, i: false, u: false, f: '' });
  let markup = '',
    plain = '',
    styled = false;
  const e = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  for (const r of runs) {
    plain += r.text;
    for (const part of r.text.split(/(\n)/)) {
      if (!part) continue;
      if (part === '\n') {
        markup += '\n';
        continue;
      }
      let h = e(part);
      if (part.trim() && (r.b || r.i || r.u || r.f)) {
        styled = true;
        if (r.u) h = `<u>${h}</u>`;
        if (r.i) h = `<i>${h}</i>`;
        if (r.b) h = `<b>${h}</b>`;
        if (r.f) h = `<span data-font="${r.f}">${h}</span>`;
      }
      markup += h;
    }
  }
  // Neighbouring words with the same style become one element.
  for (let prev = ''; prev !== markup; ) {
    prev = markup;
    markup = markup.replace(/<\/(b|i|u)><\1>/g, '').replace(/<\/span><span data-font="([^"]+)">/g, (m, f, i, all) => {
      const open = all.lastIndexOf('<span data-font="', i);
      return all.startsWith(`<span data-font="${f}">`, open) ? '' : m;
    });
  }
  plain = plain.replace(/\s+$/, '');
  markup = markup.replace(/\s+$/, '');
  return { plain, rich: styled ? sanitizeRich(markup) : '' };
}
let richSelection = null,
  richTyping = null;
document.addEventListener('selectionchange', () => {
  const sel = getSelection();
  if (!sel.rangeCount) return;
  const box = sel.anchorNode?.parentElement?.closest?.('[data-rich]') || (sel.anchorNode?.closest?.('[data-rich]'));
  if (box) richSelection = { key: box.dataset.rich, range: sel.getRangeAt(0).cloneRange() };
});
function richTarget(key) {
  const m = /^part\.(.+)$/.exec(key);
  return m ? project.blocks.find(b => b.id === m[1]) : block();
}
function richChanged(box) {
  const obj = richTarget(box.dataset.rich);
  if (!obj) return;
  const { plain, rich } = readRich(box);
  if (plain === obj.text && (rich || '') === (obj.rich || '')) return;
  if (richTyping !== box) {
    snapshot();
    richTyping = box;
  }
  obj.text = plain;
  if (rich) obj.rich = rich;
  else delete obj.rich;
  if (box.dataset.rich === 'block' && project.kind === 'html') {
    obj.label = obj.textGroup
      ? 'Весь текст · ' + plain.split(/\n\s*\n/).length + ' абзаців'
      : 'Текст · ' + shortLabel(plain, 42);
    renderLibrary();
  }
  changed();
  refresh({ inspector: false, library: false });
}
function richCommand(key, cmd, value) {
  const box = $$('[data-rich]').find(x => x.dataset.rich === key);
  if (!box) return;
  box.focus();
  if (richSelection?.key === key && box.contains(richSelection.range.startContainer)) {
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(richSelection.range);
  }
  if (getSelection().isCollapsed) return toast('Спочатку виділи слова в полі тексту.');
  document.execCommand('styleWithCSS', false, false);
  if (cmd === 'clear') document.execCommand('removeFormat');
  else if (cmd === 'font') document.execCommand('fontName', false, value || 'inherit');
  else document.execCommand(cmd);
  richChanged(box);
}
document.addEventListener('input', e => {
  const box = e.target.closest?.('[data-rich]');
  if (box) richChanged(box);
});
document.addEventListener('focusout', e => {
  if (e.target.closest?.('[data-rich]')) richTyping = null;
});
document.addEventListener('keydown', e => {
  const box = e.target.closest?.('[data-rich]');
  if (!box) return;
  // Enter = a line break inside the text (a blank line makes a paragraph), not a new block.
  if (e.key === 'Enter') {
    e.preventDefault();
    document.execCommand('insertLineBreak');
  }
  if ((e.metaKey || e.ctrlKey) && ['b', 'i', 'u'].includes(e.key.toLowerCase())) {
    e.preventDefault();
    e.stopPropagation();
    document.execCommand('styleWithCSS', false, false);
    document.execCommand({ b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]);
    richChanged(box);
  }
});
document.addEventListener('paste', e => {
  const box = e.target.closest?.('[data-rich]');
  if (!box) return;
  e.preventDefault();
  document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
});
// Toolbar buttons must not take the selection away from the text.
document.addEventListener('mousedown', e => {
  if (e.target.closest?.('[data-rich-cmd]')) e.preventDefault();
});
document.addEventListener('change', e => {
  const key = e.target.dataset?.richFont;
  if (key === undefined) return;
  richCommand(key, 'font', e.target.value);
  e.target.value = '';
});
function fontFields(b) {
  const own = creativeFonts(project.sourceHTML),
    current = b.font || '',
    opts = [
      ['', 'Як у креативі'],
      ...own.map(f => ['family:' + f, f + ' · з креативу']),
      ['serif', 'Georgia · із засічками'],
      ['sans', 'Arial · без засічок'],
      ['system', 'Системний (SF / Segoe)'],
      ['rounded', 'Trebuchet · мʼякий'],
      ['mono', 'Моноширинний'],
      ...(assets[b.fontAsset] ? [['asset', 'Свій: ' + assets[b.fontAsset].name]] : [])
    ];
  return (
    '<div class="divider"></div>' +
    field(
      'Шрифт',
      `<select data-prop="block.font">${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === current ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`
    ) +
    '<div class="font-actions"><button class="btn secondary full-width" type="button" data-upload="block.fontAsset" data-asset-type="font">' +
    (assets[b.fontAsset] ? 'Завантажити інший шрифт' : 'Завантажити свій шрифт (.ttf, .otf, .woff)') +
    '</button>' +
    '<button class="text-btn full-width" type="button" data-font-all="' +
    esc(b.id) +
    '">Цей шрифт — для всього тексту</button></div><div class="divider"></div>'
  );
}
function assetField(label, path, current, type = 'image') {
  const opts = slotAssets({ ...project, selectedBlock: selected }, assets, path, type, current),
    a = assets[current];
  return field(
    label,
    `<div class="asset-slot">${type === 'image' && a ? `<img src="${esc(a.data || a.url)}" alt="">` : ''}<span>${a ? esc(a.name) : 'Не додано'}</span></div><button class="btn secondary full-width" type="button" data-upload="${path}" data-asset-type="${type}">${a ? 'Замінити' : 'Завантажити'} ${type === 'font' ? 'шрифт' : type === 'audio' ? 'аудіо' : 'зображення'}</button>${opts.length ? `<details class="asset-options"><summary>Обрати з файлів композиції</summary><select data-prop="${path}" aria-label="${label}"><option value="">${label.includes('ландшафт') ? 'Як у портреті' : 'Без асета'}</option>${opts.map(a => `<option value="${esc(a.id)}" ${current === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></details>` : ''}`
  );
}
function fadeFields() {
  const c = project.settings;
  const part = (key, title) => {
    const f = c[key],
      p = 'settings.' + key + '.';
    let s =
      `<h4>${title}</h4>` +
      field(
        'Режим',
        `<select data-prop="${p}mode">${[
          ['auto', c.motion === 'panel' ? 'Як у шаблоні (немає)' : 'Як у шаблоні'],
          ['custom', 'Своє'],
          ['off', 'Вимкнено']
        ]
          .map(([v, l]) => `<option value="${v}" ${f.mode === v ? 'selected' : ''}>${l}</option>`)
          .join('')}</select>`
      );
    if (f.mode === 'custom')
      s +=
        color('Колір', p + 'color', f.color || c.background) +
        field('Висота · портрет', range(p + 'portrait', f.portrait, 0, 60, 1, '%')) +
        field('Висота · ландшафт', range(p + 'landscape', f.landscape, 0, 60, 1, '%')) +
        field('Щільність', range(p + 'strength', f.strength, 0, 100, 1, '%'));
    return s;
  };
  return (
    '<p class="muted">Градієнти, що ховають текст біля верхнього й нижнього краю області читання. «Своє» — свій колір, висота (% екрана або панелі) і щільність. «Вимкнено» прибирає градієнт.</p>' +
    part('fadeTop', 'Зверху') +
    '<div class="divider"></div>' +
    part('fadeBottom', 'Знизу')
  );
}
function backgroundFields() {
  const c = project.settings;
  return (
    color('Колір фону', 'settings.background', c.background) +
    assetField('Фон · портрет', 'settings.bgAsset', c.bgAsset) +
    assetField('Фон · ландшафт', 'settings.bgAssetL', c.bgAssetL) +
    (c.bgAsset || c.bgAssetL
      ? field('Затемнення', range('settings.bgShade', c.bgShade, 0, 85, 1, '%')) +
        field('Фокус по горизонталі', range('settings.bgFocalX', c.bgFocalX, 0, 100, 1, '%')) +
        field('Фокус по вертикалі', range('settings.bgFocalY', c.bgFocalY, 0, 100, 1, '%'))
      : '')
  );
}
// File name and variation controls; the same block is shown for imported HTML.
function namingFields() {
  if (project.isTemplate)
    return '<div class="notice">Це збережена композиція. Створи з неї креатив на екрані вибору композиції, щоб отримати номер і варіації.</div><div class="divider"></div>';
  const members = setMembers(projects, project.setId),
    n = project.naming || {};
  const clash = projects.some(
    p =>
      !p.isTemplate &&
      p.setId !== project.setId &&
      p.product === project.product &&
      p.language === project.language &&
      normalizeNaming(p.naming || {}, p).number === normalizeNaming(n, project).number &&
      normalizeNaming(p.naming || {}, p).code === normalizeNaming(n, project).code
  );
  const kinds = ['nc', 'cr', 'lz'];
  if (n.kind && !kinds.includes(n.kind)) kinds.push(n.kind);
  return (
    `<div class="notice">Креатив <b>${esc(n.number || '—')}</b> · варіація ${project.variant || 1} з ${members.length || 1}</div>` +
    field(
      'Номер креативу',
      `<input data-prop="naming.number" value="${esc(n.number || '')}" inputmode="numeric" maxlength="6">`,
      'Однаковий для всіх варіацій. Наступний вільний підставляється сам.'
    ) +
    '<div class="field-grid">' +
    field('Мова', `<input data-prop="language" value="${esc(project.language || 'en')}" maxlength="3">`) +
    field(
      'Тип',
      `<select data-prop="naming.kind">${kinds.map(k => `<option value="${k}" ${n.kind === k ? 'selected' : ''}>${k}</option>`).join('')}</select>`
    ) +
    field(
      'Референс',
      `<input data-prop="naming.ref" value="${esc(n.ref || '')}" inputmode="numeric" maxlength="6" placeholder="—">`
    ) +
    '</div>' +
    `<details class="naming-more"><summary>Префікс і код шаблону</summary>` +
    field('Префікс', textInput('naming.prefix', n.prefix || 'am_kd_vt')) +
    field('Код шаблону', textInput('naming.code', n.code || '')) +
    '</details>' +
    (clash
      ? '<div class="notice warn">Інший креатив у «Мої проєкти» вже має цей номер. Файли матимуть однакові імена.</div>'
      : '') +
    field('Файли', '<ol class="file-list" id="fileNames"></ol>') +
    (members.length > 1
      ? `<button class="btn primary full-width" id="exportSetInspector">Експорт усіх варіацій · ZIP</button><button class="btn secondary full-width" id="exportOne">Тільки варіація ${project.variant} · HTML</button>${project.kind === 'html' ? '' : '<div class="divider"></div><button class="btn secondary full-width" id="applyLayout">Розкладку цієї варіації → усім</button><p class="muted">Переносить розміри, позиції, кольори й порядок блоків. Картинки, фон і тексти кожної варіації залишаються.</p>'}`
      : '<button class="btn primary full-width" id="exportOne">Експорт HTML</button><p class="muted">Щоб зробити варіації 2 і 3, натисни «+ Варіація» вгорі.</p>') +
    '<div class="divider"></div>'
  );
}
// Store links of an original creative: empty = the creative's own; one = both platforms.
function storeLinkFields() {
  const own = storeLinksIn(project.sourceHTML),
    input = (path, value, ph) =>
      `<input data-prop="${path}" type="url" inputmode="url" spellcheck="false" value="${esc(value || '')}" placeholder="${esc(ph || 'https://…')}">`,
    bad = v => v && !validURL(v);
  const ios = project.linkIos || '',
    android = project.linkAndroid || '';
  const note = !ios && !android
    ? 'Порожні поля — креатив відкриває свої посилання.'
    : ios && android
      ? 'iPhone відкриє App Store, Android — Google Play.'
      : 'Вказано одне посилання — його відкриють на всіх телефонах.';
  return (
    '<div class="section-label">Посилання на магазин</div>' +
    field('App Store', input('linkIos', ios, own.ios), bad(ios) ? '<span class="error-text">Потрібне посилання https://…</span>' : '') +
    field('Google Play', input('linkAndroid', android, own.android || 'немає в креативі'), bad(android) ? '<span class="error-text">Потрібне посилання https://…</span>' : '') +
    `<small class="muted" id="linksNote">${note}</small>`
  );
}
function storeAndCompressionFields() {
  const c = project.settings;
  return (
    field('Назва в редакторі', textInput('name', project.name)) +
    (project.kind === 'html'
      ? storeLinkFields()
      : field('App Store', textInput('iosUrl', project.iosUrl)) +
        field('Google Play', textInput('androidUrl', project.androidUrl))) +
    toggle('Стиснути зображення при експорті', 'settings.compressImages', c.compressImages) +
    field('Якість зображень', range('settings.exportImageQuality', c.exportImageQuality, 50, 100, 1, '%')) +
    '<p class="muted">WebP, без зміни роздільності. GIF, аудіо та шрифти вбудовуються без перекодування. CSS і JavaScript мініфікуються. Preview зберігає оригінальну якість.</p><div class="notice">Один HTML на варіацію, асети вбудовані. Портрет і ландшафт. CTA: MRAID, AppLovin, Meta. Ліміт 5 МБ.</div><p class="muted">PB нічого не зберігає. Щоб продовжити пізніше, відкрий експортований HTML через «Свій плейбл» — усі правки на місці.</p>'
  );
}
// ---------- Inspector for coded templates (kit) ----------
const sel = (label, path, value, options) =>
  field(
    label,
    `<select data-prop="${path}">${options.map(([v, l]) => `<option value="${v}" ${String(value) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`
  );
function kitTextStyleFields(b) {
  return (
    sel('Насиченість', 'block.weight', b.weight || 400, [
      [400, 'Звичайний'],
      [500, 'Середній'],
      [600, 'Напівжирний'],
      [700, 'Жирний'],
      [800, 'Дуже жирний']
    ]) +
    toggle('Курсив', 'block.italic', !!b.italic) +
    toggle('ВЕЛИКІ ЛІТЕРИ', 'block.upper', !!b.upper) +
    (b.type === 'list'
      ? sel('Маркер списку', 'block.listStyle', b.listStyle || 'number', [
          ['number', '1. 2. 3.'],
          ['check', '✓'],
          ['dot', '•']
        ])
      : '')
  );
}
function kitBlockFields(b, notice) {
  const fs = orientation === 'portrait' ? 'Portrait' : 'Landscape';
  const size = (def, min = 8, max = 40) =>
    notice +
    field('Розмір тексту', range('block.fontSize' + fs, b['fontSize' + fs] ?? def, min, max, 1, 'px'));
  const width = field('Ширина', range('block.width', b.width ?? 100, 20, 100, 1, '%'));
  switch (b.type) {
    case 'stats':
      return (
        field(
          'Комірки',
          `<textarea data-prop="block.text" rows="4">${esc(b.text)}</textarea>`,
          'Кожна комірка з нового рядка: значення | підпис. Зірочка * на початку виділяє комірку.'
        ) +
        size(12) +
        width +
        color('Фон картки', 'block.bgColor', b.bgColor || '#ffffff') +
        color('Колір тексту', 'block.textColor', b.textColor || '#151515') +
        color('Рамка і виділення', 'block.accentColor', b.accentColor || '#a87cf5')
      );
    case 'bar':
      return (
        field('Підпис', textInput('block.label', b.label || '')) +
        field('Заповнення', range('block.percent', b.percent ?? 83, 0, 100, 1, '%')) +
        field('Значення', textInput('block.text', b.text || '')) +
        field('Примітка', textInput('block.note', b.note || '')) +
        size(12) +
        width +
        color('Фон', 'block.bgColor', b.bgColor || '#eef2ff') +
        color('Колір тексту', 'block.textColor', b.textColor || '#1a1f2e')
      );
    case 'timer':
      return (
        field('Секунд', range('block.seconds', b.seconds ?? 60, 5, 600, 5, 'с')) +
        size(24, 12, 60) +
        color('Колір', 'block.textColor', b.textColor || '#e0262b')
      );
    case 'rings':
      return (
        ['a', 'b']
          .map(
            (k, i) =>
              `<h4>${i ? 'Праворуч' : 'Ліворуч'}</h4>` +
              field(
                'Назва',
                textInput(`block.${k}Title`, b[k + 'Title'] ?? (i ? 'Smart Cleaner' : 'Buy Storage'))
              ) +
              field(
                'Підпис',
                textInput(`block.${k}Sub`, b[k + 'Sub'] ?? (i ? 'No extra cost' : 'Extra cost'))
              ) +
              field('Відсоток', range(`block.${k}Value`, b[k + 'Value'] ?? (i ? 52 : 99), 0, 100, 1, '%')) +
              color('Колір кільця', `block.${k}Color`, b[k + 'Color'] || (i ? '#21a07a' : '#ef5b3f'))
          )
          .join('') +
        field('Текст між картками', textInput('block.vsText', b.vsText || 'VS.')) +
        size(12) +
        width
      );
    case 'chat':
      return (
        sel('Показати в preview', 'settings.previewChat', project.settings.previewChat || 'question', [
          ['question', 'Екран з питанням'],
          ['chat', 'Чат із відповіддю']
        ]) +
        field(
          'Питання',
          `<textarea data-prop="block.question" rows="3">${esc(b.question || '')}</textarea>`
        ) +
        field('Кнопка запуску', textInput('block.start', b.start || 'Ask AI Chat')) +
        field('Заголовок чату', textInput('block.header', b.header || 'AI Chat')) +
        field(
          'Відповідь AI',
          `<textarea data-prop="block.answer" rows="6">${esc(b.answer || '')}</textarea>`,
          '**жирний** · порожній рядок = абзац'
        ) +
        size(26, 14, 40) +
        color('Колір питання', 'block.textColor', b.textColor || '#ffffff')
      );
    case 'button':
      return field('Текст кнопки', textInput('block.text', b.text || '')) + width;
    case 'logo':
      return color('Колір текстового логотипа', 'block.textColor', b.textColor || '#ffffff');
    default:
      return '';
  }
}
function kitCtaFields(b, notice, prefix, o) {
  const image = !!b.asset;
  return (
    (image
      ? '<div class="notice">Зараз замість кнопки — картинка. Видали її нижче, щоб повернути кнопку з кодом.</div>'
      : field('Текст кнопки', textInput('block.text', b.text)) +
        color('Колір кнопки', 'block.bgColor', b.bgColor || project.settings.accent) +
        color(
          'Другий колір (градієнт)',
          'block.bgColor2',
          b.bgColor2 || b.bgColor || project.settings.accent
        ) +
        color('Колір тексту', 'block.textColor', b.textColor || '#ffffff') +
        field('Розмір тексту', range('block.fontSize', b.fontSize ?? 18, 10, 32, 1, 'px')) +
        sel('Насиченість', 'block.weight', b.weight || 700, [
          [400, 'Звичайний'],
          [500, 'Середній'],
          [600, 'Напівжирний'],
          [700, 'Жирний'],
          [800, 'Дуже жирний']
        ]) +
        toggle('ВЕЛИКІ ЛІТЕРИ', 'block.upper', !!b.upper) +
        field('Висота', range('block.height', b.height ?? 52, 32, 80, 1, 'px')) +
        field(
          'Заокруглення',
          range('block.radius', Math.min(b.radius ?? 999, 40), 0, 40, 1, 'px'),
          '40 = пігулка'
        ) +
        toggle('Тінь', 'block.shadow', b.shadow !== false) +
        sel('Іконка', 'block.icon', b.icon || '', [
          ['', 'Без іконки'],
          ['sparkle', '✦ перед текстом'],
          ['arrow', '› після тексту']
        ])) +
    toggle('Пульсація', 'settings.pulse', project.settings.pulse) +
    notice +
    field('Ширина кнопки', range(prefix + 'ctaWidth', o.ctaWidth, 20, 100, 1, '%')) +
    (project.product === 'fiction'
      ? field('Відступ знизу', range(prefix + 'ctaBottom', o.ctaBottom ?? 4, 0, 25, 1, '%'))
      : '') +
    '<details class="asset-options"><summary>Картинка замість кнопки</summary>' +
    assetField('Картинка · портрет', 'block.asset', b.asset) +
    assetField('Картинка · ландшафт', 'block.assetL', b.assetL) +
    (image
      ? '<button class="btn secondary full-width" id="ctaToCode">Повернути кнопку з кодом</button>'
      : '') +
    '</details>'
  );
}
function kitLayoutFields(prefix, o) {
  const c = project.settings,
    mode = c.motion,
    fiction = project.product === 'fiction',
    hasCard = ['page', 'panel2', 'alertphoto'].includes(mode) || c.cardStyle === 'bubble';
  return (
    field('Ширина контенту', range(prefix + 'contentWidth', o.contentWidth, 40, 100, 1, '%')) +
    field('Відстань між елементами', range(prefix + 'gap', o.gap, 0, 48, 1, 'px')) +
    field('Базовий розмір тексту', range(prefix + 'fontSize', o.fontSize, 12, 30, 1, 'px')) +
    (mode === 'panel2'
      ? field('Висота панелі', range(prefix + 'panelHeight', o.panelHeight ?? 70, 40, 80, 1, '%'))
      : '') +
    '<div class="divider"></div>' +
    color('Колір фону', 'settings.background', c.background) +
    color('Колір тексту', 'settings.textColor', c.textColor) +
    sel('Шрифт', 'settings.font', c.fontAsset ? 'custom' : c.font, [
      ...(c.fontAsset ? [['custom', 'Власний шрифт']] : []),
      ['serif', 'Із засічками (книжковий)'],
      ['sans', 'Без засічок']
    ]) +
    assetField('Власний шрифт', 'settings.fontAsset', c.fontAsset, 'font') +
    field('Міжрядковий інтервал', range('settings.lineHeight', c.lineHeight, 1.1, 1.8, 0.05)) +
    color('Фон виділення [[...]]', 'settings.markColor', c.markColor || c.accent) +
    color('Текст виділення', 'settings.markText', c.markText || c.textColor) +
    (hasCard
      ? '<div class="divider"></div><h4>' +
        (mode === 'panel2' ? 'Панель' : mode === 'page' ? 'Сторінка' : 'Картка') +
        '</h4>' +
        color('Колір', 'settings.cardBg', c.cardBg || '#ffffff') +
        field('Непрозорість', range('settings.cardOpacity', c.cardOpacity ?? 100, 20, 100, 1, '%')) +
        field('Заокруглення', range('settings.cardRadius', c.cardRadius ?? 16, 0, 40, 1, 'px')) +
        color('Рамка', 'settings.cardBorder', c.cardBorder || c.cardBg || '#ffffff')
      : '') +
    (mode === 'infocard'
      ? toggle('Смуга з брендом лишається вгорі', 'settings.stickyCover', !!c.stickyCover)
      : '') +
    (fiction
      ? toggle('Рука-підказка прокручування', 'settings.hand', c.hand) +
        '<button class="btn secondary full-width" data-select="fades">Затемнення тексту зверху / знизу</button>'
      : '') +
    '<div class="divider"></div><button class="btn secondary full-width" data-select="background">Фон-картинка</button>'
  );
}
function renderInspector() {
  const c = project.settings,
    b = block(),
    o = c[orientation],
    prefix = 'settings.' + orientation + '.';
  let s = '';
  $$('[data-inspector]').forEach(e => e.classList.toggle('active', e.dataset.inspector === inspectorTab));
  const notice = `<div class="notice">Розміри для: <b>${orientation === 'portrait' ? 'портрета' : 'ландшафту'}</b></div>`;
  if (project.kind === 'html') {
    renderHTMLInspector();
    return;
  }
  if (inspectorTab === 'element') {
    if (selected === 'background') s = '<h3>Фон креативу</h3>' + backgroundFields();
    else if (selected === 'fades') s = '<h3>Затемнення тексту</h3>' + fadeFields();
    else if (!b) s = '<p class="muted">Обери елемент ліворуч або натисни на нього в preview.</p>';
    else {
      s = `<h3>${esc(b.label || LABELS[b.type])}</h3>` + visibilityControl(b);
      if (['story', 'text', 'title', 'list'].includes(b.type))
        s +=
          field(
            b.type === 'story' ? 'Текст історії' : 'Текст',
            `<textarea data-prop="block.text" rows="${b.type === 'story' ? 9 : 4}">${esc(b.text)}</textarea>`,
            ['story', 'text'].includes(b.type) ? '**жирний** · [[виділення]] · порожній рядок = абзац' : ''
          ) +
          notice +
          field(
            'Розмір тексту',
            range(
              'block.fontSize' + (orientation === 'portrait' ? 'Portrait' : 'Landscape'),
              b['fontSize' + (orientation === 'portrait' ? 'Portrait' : 'Landscape')],
              12,
              48,
              1,
              'px'
            )
          ) +
          color('Колір тексту', 'block.textColor', b.textColor || c.textColor) +
          field('Ширина тексту', range('block.width', b.width, 20, 100, 1, '%')) +
          field(
            'Вирівнювання',
            `<select data-prop="block.align">${['left', 'center', 'right'].map((a, i) => `<option value="${a}" ${b.align === a ? 'selected' : ''}>${['Ліворуч', 'По центру', 'Праворуч'][i]}</option>`).join('')}</select>`
          ) +
          (isKit(project) ? kitTextStyleFields(b) : '');
      if (isKit(project)) s += kitBlockFields(b, notice);
      if (b.type === 'hero') {
        const kind = imageControlKind(project, orientation);
        s += notice;
        if (kind === 'scale')
          s +=
            field('Масштаб картинки', range(prefix + 'heroScale', o.heroScale, 50, 150, 1, '%')) +
            field('Зсув по вертикалі', range(prefix + 'heroOffset', o.heroOffset, -10, 25, 1, '%'));
        else if (kind === 'column')
          s += field(
            'Ширина колонки з картинкою',
            range(prefix + 'coverWidth', o.coverWidth, 20, 55, 1, '%')
          );
        else if (kind !== 'none')
          s += field(
            'Висота картинки від екрана',
            range(prefix + 'heroHeight', o.heroHeight, 20, orientation === 'landscape' ? 75 : 65, 1, '%')
          );
        if (isKit(project))
          s +=
            field('Фокус по горизонталі', range('block.focalX', b.focalX ?? 50, 0, 100, 1, '%')) +
            field('Фокус по вертикалі', range('block.focalY', b.focalY ?? 30, 0, 100, 1, '%'));
        if (project.product === 'fiction' && ['cover', 'sticky'].includes(c.motion))
          s +=
            field(
              'Заповнення області',
              `<select data-prop="block.fit"><option value="cover" ${b.fit === 'cover' ? 'selected' : ''}>Заповнити з обрізанням</option><option value="contain" ${b.fit === 'contain' ? 'selected' : ''}>Показати повністю</option></select>`
            ) +
            (b.fit === 'cover'
              ? field('Фокус по горизонталі', range('block.focalX', b.focalX, 0, 100, 1, '%')) +
                field('Фокус по вертикалі', range('block.focalY', b.focalY, 0, 100, 1, '%'))
              : '');
      }
      if (
        ['hero', 'image', 'logo', 'rating', 'cta', 'comparison'].includes(b.type) &&
        !(b.type === 'cta' && isKit(project))
      )
        s +=
          assetField('Зображення · портрет', 'block.asset', b.asset) +
          (['hero', 'image', 'logo', 'rating', 'cta'].includes(b.type)
            ? assetField('Зображення · ландшафт', 'block.assetL', b.assetL)
            : '');
      if (b.type === 'logo') s += field('Текст замість логотипа', textInput('block.text', b.text));
      if (b.type === 'rating' && !b.asset) s += field('Текст рейтингу', textInput('block.text', b.text));
      if (['image', 'logo'].includes(b.type))
        s += field('Ширина зображення', range('block.width', b.width, 20, 100, 1, '%'));
      if (b.type === 'comparison')
        s +=
          assetField('Зображення після', 'block.afterAsset', b.afterAsset) +
          field('Підпис до', textInput('block.text', b.text)) +
          field('Підпис після', textInput('block.afterText', b.afterText || ''));
      if (b.type === 'cta' && isKit(project)) s += kitCtaFields(b, notice, prefix, o);
      else if (b.type === 'cta') {
        s +=
          notice +
          field(
            'Ширина кнопки',
            range(
              prefix + 'ctaWidth',
              o.ctaWidth,
              20,
              project.product === 'fiction' &&
                ['cover', 'sticky'].includes(c.motion) &&
                orientation === 'landscape'
                ? Math.floor((100 - o.coverWidth) * 0.85)
                : 85,
              1,
              '%'
            )
          ) +
          toggle('Пульсація кнопки', 'settings.pulse', c.pulse);
        if (!b.asset)
          s +=
            field('Текст кнопки', textInput('block.text', b.text)) +
            color('Колір кнопки', 'settings.accent', c.accent) +
            color('Колір тексту', 'settings.ctaColor', c.ctaColor) +
            field('Заокруглення', range('settings.radius', c.radius, 0, 28, 1, 'px'));
      }
      if (b.type === 'audio')
        s +=
          assetField('Аудіофайл', 'block.asset', b.asset, 'audio') +
          field('Гучність', range('settings.volume', c.volume, 0, 100, 1, '%')) +
          '<button class="btn secondary" id="listen">Прослухати / зупинити</button>';
      if (b.type !== 'audio')
        s +=
          `<div class="divider"></div><h4>Позиція · ${orientation === 'portrait' ? 'портрет' : 'ландшафт'}</h4><p class="muted">Зсув від базової позиції. Увімкни «Рухати і розтягувати», щоб перетягнути елемент у preview. Рожеві напрямні показують вирівнювання. Alt — без прив’язки.</p>` +
          field(
            'X · горизонталь',
            range(
              'block.position.' + orientation + '.x',
              b.position[orientation].x,
              -100,
              100,
              0.1,
              '% екрана'
            )
          ) +
          field(
            'Y · вертикаль',
            range(
              'block.position.' + orientation + '.y',
              b.position[orientation].y,
              -100,
              100,
              0.1,
              '% екрана'
            )
          ) +
          '<button class="btn secondary full-width" id="resetPosition">Скинути позицію і розмір</button>';
      s +=
        '<div class="divider"></div><button class="text-btn danger" id="removeBlock"> Видалити елемент</button>';
    }
  }
  if (inspectorTab === 'layout' && isKit(project))
    s = '<h3>Оформлення</h3>' + notice + kitLayoutFields(prefix, o);
  else if (inspectorTab === 'layout') {
    s =
      '<h3>Оформлення</h3>' +
      notice +
      field('Ширина області контенту', range(prefix + 'contentWidth', o.contentWidth, 55, 96, 1, '%')) +
      field('Відстань між елементами', range(prefix + 'gap', o.gap, 4, 28, 1, 'px'));
    if (project.product === 'fiction' && c.motion === 'panel')
      s +=
        field('Висота текстової панелі', range(prefix + 'panelHeight', o.panelHeight, 45, 74, 1, '%')) +
        field('Непрозорість панелі', range('settings.panelOpacity', c.panelOpacity, 0, 95, 1, '%'));
    s +=
      field(
        'Шрифт',
        `<select data-prop="settings.font">${c.fontAsset ? '<option value="custom" selected>Власний шрифт</option>' : ''}<option value="serif" ${!c.fontAsset && c.font === 'serif' ? 'selected' : ''}>Georgia · із засічками</option><option value="sans" ${!c.fontAsset && c.font === 'sans' ? 'selected' : ''}>Arial · без засічок</option></select>`
      ) +
      assetField('Власний шрифт', 'settings.fontAsset', c.fontAsset, 'font') +
      field('Міжрядковий інтервал', range('settings.lineHeight', c.lineHeight, 1.1, 1.8, 0.05)) +
      color('Колір виділення', 'settings.accent', c.accent) +
      (project.product === 'fiction' ? toggle('Підказка прокручування', 'settings.hand', c.hand) : '') +
      (project.product === 'fiction'
        ? '<button class="btn secondary full-width" data-select="fades">Затемнення тексту зверху / знизу</button>'
        : '') +
      '<div class="divider"></div><button class="btn secondary full-width" data-select="background">Редагувати фон</button>';
  }
  if (inspectorTab === 'settings') s = '<h3>Експорт</h3>' + namingFields() + storeAndCompressionFields();
  $('#inspectorBody').innerHTML = s;
  $('#inspectorBody').scrollTop = 0;
  updateFileNames();
}
function useProject(p) {
  if (p.kind === 'html') {
    addTextGroups(p);
    addMusicBlocks(p, assets);
  }
  save().catch(() => {});
  project = p;
  selected = p.blocks.find(b => b.storyGroup || b.type === 'story' || b.textGroup)?.id || p.blocks[0]?.id;
  past = [];
  future = [];
  scroll = 0;
  refresh();
  changed();
  closeChooser();
}
// A new creative starts a new set (next free number), variation 1.
function addAsNewSet(p) {
  if (placeholderId) {
    projects = projects.filter(x => x.id !== placeholderId);
    placeholderId = null;
  }
  delete p.setId;
  p.variant = 1;
  if (p.naming) p.naming.number = '';
  ensureSet(p, projects, uid);
  projects.push(p);
  return p;
}
// Imported creatives: a production file name (00170_2_clr_…_pl.html) fills number, variation and
// language, and a file of an already imported creative joins that creative as its next variation.
function addImported(p, sourceName = '') {
  if (placeholderId) {
    projects = projects.filter(x => x.id !== placeholderId);
    placeholderId = null;
  }
  const parsed = parseFileName(sourceName);
  if (parsed && parsed.product === p.product) {
    p.naming = normalizeNaming(parsed.naming, p);
    p.language = parsed.language;
    const sibling = projects.find(
      x =>
        !x.isTemplate &&
        x.product === p.product &&
        normalizeNaming(x.naming || {}, x).number === p.naming.number &&
        normalizeNaming(x.naming || {}, x).code === p.naming.code &&
        x.language === p.language
    );
    if (sibling && !setMembers(projects, sibling.setId).some(x => x.variant === parsed.variant)) {
      p.setId = sibling.setId;
      p.variant = parsed.variant;
      p.name = baseName(sibling.name) + ' · ' + p.variant;
      projects.push(p);
      syncSetFields(sibling, projects);
      return p;
    }
    delete p.setId;
    ensureSet(p, projects, uid);
    p.variant = parsed.variant;
    projects.push(p);
    return p;
  }
  return addAsNewSet(p);
}
function newTemplate(id) {
  const p = addAsNewSet(createProject(id));
  useProject(p);
  toast(`Новий креатив ${p.naming.number}. Попередні — у «Мої проєкти».`);
}
// «Скріншот»: the creative's screen exactly as in the preview (current screen size and orientation,
// without selection or handles), PNG at 2×. Downloaded and, where the browser allows, copied to the
// clipboard to paste into a board.
let screenshotBusy = false;
function loadInFrame(win, src) {
  if (win.htmlToImage) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const sc = win.document.createElement('script');
    sc.src = new URL(src, location.href).href;
    sc.onload = resolve;
    sc.onerror = () => reject(Error('не вдалося завантажити модуль скріншота'));
    win.document.head.append(sc);
  });
}
function screenPixels() {
  let [w, h] = $('#device').value.split(',').map(Number);
  if (orientation === 'landscape') [w, h] = [h, w];
  return [w, h];
}
async function captureFrame(pixelRatio = 2) {
  const frame = $('#preview');
  // A preview that is still loading is waited for (a few seconds), not refused.
  for (let i = 0; i < 40 && !$('#previewState').hidden; i++) await new Promise(r => setTimeout(r, 200));
  if (!frame.contentDocument?.body || !$('#previewState').hidden) throw Error('preview ще завантажується');
  const win = frame.contentWindow,
    doc = frame.contentDocument;
  await loadInFrame(win, 'vendor/html-to-image.js');
  await doc.fonts.ready;
  const selectedEls = [...doc.querySelectorAll('[data-editor-selected]')],
    marks = selectedEls.map(el => el.getAttribute('data-editor-selected'));
  selectedEls.forEach(el => el.removeAttribute('data-editor-selected'));
  // Scrolled boxes (the story) keep their scroll in the picture: the content is shifted while capturing.
  const scrolled = [...doc.querySelectorAll('*')].filter(el => el.scrollTop > 0 && el.firstElementChild);
  const shifts = scrolled.map(el => {
    const kids = [...el.children].filter(k => k.id !== 'resizeHandles'),
      top = el.scrollTop,
      old = kids.map(k => k.style.getPropertyValue('translate'));
    kids.forEach(k => k.style.setProperty('translate', `0 ${-top}px`));
    return () => kids.forEach((k, i) => (old[i] ? k.style.setProperty('translate', old[i]) : k.style.removeProperty('translate')));
  });
  try {
    const [w, h] = screenPixels(),
      bg = win.getComputedStyle(doc.body).backgroundColor;
    return await win.htmlToImage.toBlob(doc.documentElement, {
      width: w,
      height: h,
      pixelRatio,
      cacheBust: false,
      backgroundColor: bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : '#000000',
      style: { overflow: 'hidden' },
      filter: n => !(n.id && ['alignmentHUD', 'resizeHandles', 'editor-controls'].includes(n.id))
    });
  } finally {
    selectedEls.forEach((el, i) => el.setAttribute('data-editor-selected', marks[i]));
    shifts.forEach(undo => undo());
  }
}
function screenshot() {
  if (playMode) return toast('Скріншот робиться в режимі «Редагувати». Перемкнись і натисни ще раз.');
  if (screenshotBusy) return;
  screenshotBusy = true;
  const btn = $('#screenshot');
  btn.textContent = 'Знімаю…';
  const shot = captureFrame(2);
  // Clipboard needs the click itself, so the write starts now with the picture still being made.
  let copied = Promise.resolve(false);
  try {
    if (navigator.clipboard?.write && window.ClipboardItem)
      copied = navigator.clipboard
        .write([new ClipboardItem({ 'image/png': shot.then(b => b) })])
        .then(() => true, () => false);
  } catch {}
  Promise.all([shot, copied])
    .then(([blob, ok]) => {
      const scr = screenPixels().join('x'),
        name = `${fileName(project).replace(/\.html$/i, '')}_${orientation === 'landscape' ? 'land' : 'port'}_${scr}.png`;
      download(blob, name, 'image/png');
      toast(ok ? 'Скріншот завантажено і скопійовано — встав у борду (Cmd/Ctrl+V).' : 'Скріншот завантажено: ' + name);
    })
    .catch(e => toast('Скріншот не вдався: ' + e.message))
    .finally(() => {
      screenshotBusy = false;
      btn.textContent = 'Скріншот ↓';
    });
}
function download(data, name, type) {
  const u = URL.createObjectURL(new Blob([data], { type })),
    a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 5000);
}
const filename = s =>
  s
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 75) || 'playable';
function referencedAssets(p) {
  const ids = new Set(p.kind === 'html' ? p.assetIds || [] : hintAssetIds(p));
  for (const b of p.blocks.filter(b => b.enabled))
    for (const k of ['asset', 'assetL', 'afterAsset']) if (b[k]) ids.add(b[k]);
  for (const k of ['bgAsset', 'bgAssetL', 'fontAsset']) if (p.settings[k]) ids.add(p.settings[k]);
  return [...ids];
}
async function embed(p) {
  return preparedAssets(p, true);
}
const readData = file =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
function exportProblem(p) {
  if (p.kind !== 'html' && !p.blocks.some(b => b.enabled && b.type === 'cta'))
    return 'додай видиму кнопку CTA перед експортом.';
  if (p.kind !== 'html' && (!validURL(p.iosUrl) || (p.androidUrl && !validURL(p.androidUrl))))
    return 'вкажи HTTPS-посилання магазинів у вкладці «Експорт».';
  if (p.kind === 'html' && ((p.linkIos && !validURL(p.linkIos)) || (p.linkAndroid && !validURL(p.linkAndroid))))
    return 'посилання на магазин має починатися з https:// (вкладка «Експорт»).';
  if (!normalizeNaming(p.naming || {}, p).number) return 'вкажи номер креативу у вкладці «Експорт».';
  return '';
}
async function packProject(p, onProgress) {
  const config = clone(p),
    packed = await embed({ ...config, blocks: config.blocks.map(b => ({ ...b, enabled: true })) });
  const result = await packPlayable(config, packed, buildHTML, {
    quality: config.settings.exportImageQuality,
    compress: config.settings.compressImages,
    onProgress
  });
  return { ...result, project: config };
}
const mb = bytes => (bytes / 1e6).toFixed(2) + ' МБ';
const LIMIT = 5_000_000;
async function exportHTML() {
  const problem = exportProblem(project);
  if (problem) return toast(problem[0].toUpperCase() + problem.slice(1));
  const button = $('#export');
  button.disabled = true;
  try {
    lastExport = await packProject(project, t => (button.textContent = t));
    if (lastExport.after > LIMIT) {
      toast(`Після стиснення HTML займає ${mb(lastExport.after)}. Ліміт — 5 МБ.`);
      return;
    }
    const name = fileName(project);
    download(lastExport.html, name, 'text/html');
    dirty = false;
    $('#exportTitle').textContent = 'HTML готовий';
    $('#exportSummary').textContent =
      `${mb(lastExport.before)} → ${mb(lastExport.after)} · менше на ${Math.max(0, Math.round((1 - lastExport.after / lastExport.before) * 100))}%`;
    $('#exportDetail').innerHTML =
      `<b>${esc(name)}</b><br>Стиснуто зображень: ${lastExport.imagesChanged}. CSS і JavaScript мініфіковані. Асети вбудовані. Файл уже завантажено.`;
    $('#exportDialog').showModal();
  } catch (e) {
    toast('Експорт не завершено: ' + e.message);
  } finally {
    button.disabled = false;
    renderVariants();
  }
}
// All variations of the creative in one ZIP: 00186/1/00186_1_clr_…_pl.html, 00186/2/…
async function exportSet() {
  const members = setMembers(projects, project.setId);
  if (members.length < 2) return exportHTML();
  syncSetFields(project, projects);
  for (const p of members) {
    const problem = exportProblem(p);
    if (problem) return toast(`Варіація ${p.variant}: ${problem}`);
  }
  const button = $('#export');
  button.disabled = true;
  try {
    const files = {},
      rows = [];
    for (const p of members) {
      const result = await packProject(
        p,
        t => (button.textContent = `${p.variant}/${members.length} · ${t}`)
      );
      if (result.after > LIMIT)
        throw Error(`варіація ${p.variant} після стиснення займає ${mb(result.after)}. Ліміт — 5 МБ.`);
      const name = fileName(p);
      const key = `${normalizeNaming(p.naming, p).number}/${p.variant}/${name}`;
      if (files[key]) throw Error(`дві варіації мають однакову назву ${name}. Перевір номери варіацій.`);
      files[key] = strToU8(result.html);
      rows.push({ variant: p.variant, name, ...result });
      if (p.id === project.id) lastExport = result;
    }
    const n0 = normalizeNaming(members[0].naming, members[0]),
      zipName = `${n0.number}_${n0.code}.zip`;
    download(zipSync(files, { level: 6 }), zipName, 'application/zip');
    dirty = false;
    $('#exportTitle').textContent = `ZIP готовий · ${rows.length} варіації`;
    $('#exportSummary').textContent = zipName;
    $('#exportDetail').innerHTML =
      '<ol class="export-files">' +
      rows
        .map(
          r =>
            `<li><b>${esc(r.name)}</b><span>${mb(r.after)} · зображень стиснуто: ${r.imagesChanged}</span></li>`
        )
        .join('') +
      '</ol>Кожна варіація — окремий HTML у своїй папці, як у PlayableAds. Файл уже завантажено.';
    $('#exportDialog').showModal();
  } catch (e) {
    toast('Експорт не завершено: ' + e.message);
  } finally {
    button.disabled = false;
    renderVariants();
  }
}
// Project file keeps the whole creative: every variation and the assets they use.
async function saveJSON() {
  try {
    const members = project.isTemplate ? [project] : setMembers(projects, project.setId);
    const packed = {};
    for (const p of members)
      Object.assign(packed, await embed({ ...p, blocks: p.blocks.map(b => ({ ...b, enabled: true })) }));
    const n = normalizeNaming(project.naming || {}, project);
    download(
      JSON.stringify(
        { format: 'playable-studio', version: 1, project, set: members, assets: packed },
        null,
        2
      ),
      (n.number ? `${n.number}_${n.code}` : filename(project.name)) + '.json',
      'application/json'
    );
    toast(
      members.length > 1
        ? `Файл проєкту завантажено: ${members.length} варіації з асетами.`
        : 'Файл проєкту завантажено з асетами.'
    );
  } catch (e) {
    toast(e.message);
  }
}
function validURL(s) {
  try {
    return new URL(s).protocol === 'https:';
  } catch {
    return false;
  }
}
function normalizeProject(raw) {
  if (
    !raw ||
    !['fiction', 'cleaner'].includes(raw.product) ||
    !Array.isArray(raw.blocks) ||
    raw.blocks.length > (raw.kind === 'html' ? 300 : 40)
  )
    throw Error('Некоректна структура проєкту.');
  const p = createProject(
    kitTemplate(raw.template) && raw.product === kitTemplate(raw.template).product
      ? raw.template
      : raw.product === 'fiction'
        ? 'cover'
        : 'poster'
  );
  p.id = uid();
  for (const k of ['name', 'iosUrl', 'androidUrl', 'language'])
    if (typeof raw[k] === 'string') p[k] = raw[k].slice(0, k === 'name' ? 90 : 1000);
  for (const k of ['linkIos', 'linkAndroid']) if (typeof raw[k] === 'string' && raw[k].trim()) p[k] = raw[k].trim().slice(0, 1000);
  if (Number.isInteger(raw.variant) && raw.variant > 0 && raw.variant < 100) p.variant = raw.variant;
  if (!validURL(p.iosUrl) || (p.androidUrl && !validURL(p.androidUrl)))
    throw Error('Проєкт має містити HTTPS-посилання.');
  if (raw.kind === 'html') {
    if (typeof raw.sourceHTML !== 'string' || raw.sourceHTML.length > 40e6)
      throw Error('Некоректний вихідний HTML.');
    p.kind = 'html';
    p.sourceHTML = raw.sourceHTML;
    p.template = 'imported';
    p.assetIds = Array.isArray(raw.assetIds) ? raw.assetIds.filter(v => typeof v === 'string') : [];
  }
  p.template =
    raw.kind === 'html'
      ? 'imported'
      : TEMPLATES.some(t => t.id === raw.template && t.product === raw.product)
        ? raw.template
        : 'custom';
  if (raw.naming && typeof raw.naming === 'object') p.naming = normalizeNaming(raw.naming, p);
  const c = raw.settings || {};
  for (const k of ['background', 'textColor', 'accent', 'ctaColor'])
    if (/^#[\da-f]{6}$/i.test(c[k] || '')) p.settings[k] = c[k];
  for (const [k, min, max] of [
    ['bgFocalX', 0, 100],
    ['bgFocalY', 0, 100],
    ['bgShade', 0, 85],
    ['panelOpacity', 0, 95],
    ['lineHeight', 1.1, 1.8],
    ['radius', 0, 28],
    ['volume', 0, 100],
    ['exportImageQuality', 50, 100]
  ])
    if (Number.isFinite(c[k])) p.settings[k] = Math.min(max, Math.max(min, c[k]));
  for (const k of ['bgAsset', 'bgAssetL', 'fontAsset'])
    if (typeof c[k] === 'string') p.settings[k] = c[k].slice(0, 150);
  for (const k of ['hand', 'pulse', 'compressImages']) if (typeof c[k] === 'boolean') p.settings[k] = c[k];
  for (const k of ['fadeTop', 'fadeBottom']) if (c[k]) p.settings[k] = normalizeFade(c[k], k);
  if (['panel', 'cover', 'shrink', 'sticky', 'banner', 'alert', ...KIT_MODES].includes(c.motion))
    p.settings.motion = c.motion;
  for (const k of ['markColor', 'markText', 'cardBg', 'cardBorder'])
    if (c[k] === '' || /^#[\da-f]{6}$/i.test(c[k] || '')) p.settings[k] = c[k];
  for (const [k, min, max] of [
    ['cardOpacity', 20, 100],
    ['cardRadius', 0, 40]
  ])
    if (Number.isFinite(c[k])) p.settings[k] = Math.min(max, Math.max(min, c[k]));
  if (['', 'bubble'].includes(c.cardStyle)) p.settings.cardStyle = c.cardStyle;
  if (['question', 'chat'].includes(c.previewChat)) p.settings.previewChat = c.previewChat;
  if (typeof c.stickyCover === 'boolean') p.settings.stickyCover = c.stickyCover;
  for (const o of ['portrait', 'landscape'])
    if (Number.isFinite(c[o]?.ctaBottom)) p.settings[o].ctaBottom = Math.min(30, Math.max(0, c[o].ctaBottom));
  if (['serif', 'sans'].includes(c.font)) p.settings.font = c.font;
  for (const o of ['portrait', 'landscape'])
    for (const [k, min, max] of [
      ['fontSize', 10, 34],
      ['contentWidth', 40, 100],
      ['heroHeight', 20, 75],
      ['ctaWidth', 20, 100],
      ['ctaBottom', 0, 30],
      ['panelHeight', 40, 80],
      ['gap', 0, 48],
      ['coverWidth', 20, 55],
      ['heroScale', 50, 150],
      ['heroOffset', -10, 25]
    ])
      if (Number.isFinite(c[o]?.[k])) p.settings[o][k] = Math.min(max, Math.max(min, c[o][k]));
  p.blocks = raw.blocks.map(b => {
    if (!LABELS[b.type]) throw Error('Невідомий тип блоку.');
    const n = makeBlock(b.type);
    for (const k of ['text', 'afterText', 'label'])
      if (typeof b[k] === 'string') n[k] = b[k].slice(0, 100000);
    if (/^[a-z-]{1,24}$/.test(b.role || '')) n.role = b.role;
    if (b.ctaCode && typeof b.ctaCode === 'object') {
      const c = b.ctaCode,
        hex = v => (/^#[\da-f]{6}$/i.test(v || '') ? v : undefined),
        num = (v, min, max) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : undefined);
      n.ctaCode = {
        group: String(c.group || uid()).slice(0, 60),
        text: String(c.text || '').slice(0, 80),
        bg: hex(c.bg),
        bg2: hex(c.bg2),
        color: hex(c.color),
        fontSize: num(c.fontSize, 15, 80),
        weight: num(c.weight, 100, 900),
        upper: c.upper === true,
        radius: num(c.radius, 0, 50),
        ratio: num(c.ratio, 1, 12),
        shadow: c.shadow !== false
      };
    }
    // Fields of the coded (kit) elements and the coded CTA.
    for (const k of [
      'zone',
      'icon',
      'listStyle',
      'note',
      'question',
      'start',
      'header',
      'answer',
      'aTitle',
      'aSub',
      'bTitle',
      'bSub',
      'vsText'
    ])
      if (typeof b[k] === 'string') n[k] = b[k].slice(0, 20000);
    for (const [k, min, max] of [
      ['weight', 100, 900],
      ['radius', 0, 999],
      ['height', 24, 120],
      ['fontSize', 8, 60],
      ['percent', 0, 100],
      ['seconds', 1, 3600],
      ['aValue', 0, 100],
      ['bValue', 0, 100]
    ])
      if (Number.isFinite(Number(b[k])) && b[k] !== '' && b[k] != null)
        n[k] = Math.min(max, Math.max(min, Number(b[k])));
    for (const k of ['italic', 'upper', 'shadow']) if (typeof b[k] === 'boolean') n[k] = b[k];
    for (const k of ['bgColor', 'bgColor2', 'accentColor', 'aColor', 'bColor'])
      if (/^#[\da-f]{6}$/i.test(b[k] || '')) n[k] = b[k];
    for (const k of ['asset', 'assetL', 'afterAsset'])
      if (typeof b[k] === 'string') n[k] = b[k].slice(0, 150);
    if (typeof b.enabled === 'boolean') n.enabled = b.enabled;
    for (const k of ['width', 'focalX', 'focalY'])
      if (Number.isFinite(b[k])) n[k] = Math.min(100, Math.max(k === 'width' ? 20 : 0, b[k]));
    for (const k of ['fontSizePortrait', 'fontSizeLandscape'])
      if (Number.isFinite(b[k])) n[k] = Math.min(60, Math.max(8, b[k]));
    if (/^#[\da-f]{6}$/i.test(b.textColor || '')) n.textColor = b.textColor;
    if (['cover', 'contain'].includes(b.fit)) n.fit = b.fit;
    if (['left', 'center', 'right'].includes(b.align)) n.align = b.align;
    if (raw.kind === 'html') {
      n.node = String(b.node || '').slice(0, 100);
      n.textGroup = b.textGroup === true;
      n.storyGroup = b.storyGroup === true;
      n.added = b.added === true;
      n.bgAsset = b.bgAsset === true;
      if (b.audioAsset === true) n.audioAsset = true;
      if (b.landscapeOwn === true) n.landscapeOwn = true;
      const rich = sanitizeRich(b.rich);
      if (rich) n.rich = rich;
      if (typeof b.font === 'string' && /^(serif|sans|system|rounded|mono|asset|family:[\p{L}\p{N} _-]{1,60})$/u.test(b.font))
        n.font = b.font;
      if (typeof b.fontAsset === 'string') n.fontAsset = b.fontAsset.slice(0, 150);
      if (n.added) n.addedStyle = addedStyle(b.addedStyle);
      if (b.hide && typeof b.hide === 'object') {
        const h = {};
        for (const o of ['portrait', 'landscape']) if (b.hide[o] === true) h[o] = true;
        if (Object.keys(h).length) n.hide = h;
      }
      if (b.anchor && typeof b.anchor === 'object') {
        n.anchor = {};
        for (const o of ['portrait', 'landscape']) {
          const a = b.anchor[o];
          if (a?.screen === true) n.anchor[o] = { screen: true };
          if (!a || typeof a.node !== 'string' || (n.added && !Number.isFinite(a.w))) continue;
          const num = (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0));
          n.anchor[o] = { node: a.node.slice(0, 100), x: num(a.x, -300, 300), y: num(a.y, -600, 600) };
          if (n.added) n.anchor[o].w = num(a.w, 1, 800);
          if (Number.isFinite(a.f)) n.anchor[o].f = num(a.f, 0.5, 80);
          if (a.lock) n.anchor[o].lock = true;
          if (a.e) n.anchor[o].e = 1;
          if (a.v) n.anchor[o].v = 2;
        }
      }
      n.parts = Array.isArray(b.parts) ? b.parts.filter(x => typeof x === 'string').map(x => x.slice(0, 100)) : [];
      if (typeof b.partLabel === 'string') n.partLabel = b.partLabel.slice(0, 60);
      n.memberNodes = Array.isArray(b.memberNodes)
        ? b.memberNodes.filter(x => typeof x === 'string').map(x => x.slice(0, 100))
        : [];
      n.originalText = String(b.originalText || '').slice(0, 100000);
      n.translateBase = Object.fromEntries(
        ['portrait', 'landscape'].map(o => [
          o,
          { x: validTranslate(b.translateBase?.[o]?.x), y: validTranslate(b.translateBase?.[o]?.y) }
        ])
      );
      n.originalAsset = String(b.originalAsset || '').slice(0, 150);
      n.customStyle = { portrait: {}, landscape: {} };
      for (const o of ['portrait', 'landscape']) {
        if (Number.isFinite(b.customStyle?.[o]?.fontSize))
          n.customStyle[o].fontSize = Math.max(5, Math.min(100, b.customStyle[o].fontSize));
        // Width may go beyond the original box (up to 3×), like scaling up in Figma.
        if (Number.isFinite(b.customStyle?.[o]?.width))
          n.customStyle[o].width = Math.max(5, Math.min(MAX_WIDTH, b.customStyle[o].width));
        if (/^#[\da-f]{6}$/i.test(b.customStyle?.[o]?.color || ''))
          n.customStyle[o].color = b.customStyle[o].color;
      }
    }
    n.position = Object.fromEntries(
      ['portrait', 'landscape'].map(o => [
        o,
        { x: Number(b.position?.[o]?.x) || 0, y: Number(b.position?.[o]?.y) || 0 }
      ])
    );
    return n;
  });
  if (
    raw.kind !== 'html' &&
    ['hero', 'cta', 'audio'].some(type => p.blocks.filter(b => b.type === type).length > 1)
  )
    throw Error('Обкладинка, CTA та музика мають бути в одному екземплярі.');
  return prepareEditorProject(p);
}
async function importJSON(file) {
  try {
    if (file.size > 30e6) throw Error('Файл проєкту більший за 30 МБ.');
    const data = JSON.parse(await file.text());
    if (data.format !== 'playable-studio' || data.version !== 1)
      throw Error('Цей формат проєкту не підтримується.');
    const rawList = Array.isArray(data.set) && data.set.length ? data.set.slice(0, 50) : [data.project];
    const list = rawList.map(normalizeProject),
      imported = {};
    for (const [id, a] of Object.entries(data.assets || {})) {
      if (
        !/^[\w/ .-]{1,150}$/.test(id) ||
        !['image', 'font', 'audio', 'file'].includes(a.type) ||
        typeof a.data !== 'string' ||
        !/^data:(image\/(png|jpeg|webp|gif|svg\+xml)|audio\/[\w.+-]+|video\/[\w.+-]+|font\/[\w.+-]+|application\/(font[\w-]*|octet-stream|json|wasm|vnd.ms-fontobject|x-font[\w-]*));base64,[A-Za-z\d+/=\r\n]+$/.test(
          a.data
        )
      )
        throw Error('Некоректний асет у проєкті.');
      imported[id] = { id, name: String(a.name).slice(0, 150), type: a.type, data: a.data };
    }
    const all = { ...seed.assets, ...imported };
    for (const p of list)
      for (const id of referencedAssets({ ...p, blocks: p.blocks.map(b => ({ ...b, enabled: true })) }))
        if (!all[id]) throw Error('У файлі відсутній асет: ' + id);
    const mapped = {};
    for (const [id, a] of Object.entries(imported)) {
      const newId = 'upload-' + uid();
      mapped[id] = newId;
      assets[newId] = { ...a, id: newId };
    }
    for (const p of list) {
      for (const b of p.blocks)
        for (const k of ['asset', 'assetL', 'afterAsset']) if (mapped[b[k]]) b[k] = mapped[b[k]];
      for (const k of ['bgAsset', 'bgAssetL', 'fontAsset'])
        if (mapped[p.settings[k]]) p.settings[k] = mapped[p.settings[k]];
      p.assetIds = [...new Set(Object.values(mapped))];
      if (p.kind === 'html') {
        addTextGroups(p);
        for (const [old, newId] of Object.entries(mapped))
          p.sourceHTML = p.sourceHTML.split('studio-asset:' + old).join('studio-asset:' + newId);
      }
    }
    // The file's creative number is kept; all variations go into one new set.
    const first = list[0];
    if (placeholderId) {
      projects = projects.filter(x => x.id !== placeholderId);
      placeholderId = null;
    }
    ensureSet(first, projects, uid);
    projects.push(first);
    for (const p of list.slice(1)) {
      p.setId = first.setId;
      p.naming = { ...first.naming };
      projects.push(p);
    }
    renumber(projects, first.setId);
    const open = list.find(p => p.variant === data.project?.variant) || first;
    useProject(open);
    toast(
      list.length > 1
        ? `Відкрито креатив ${first.naming.number}: ${list.length} варіації.`
        : 'Проєкт відкрито.'
    );
  } catch (e) {
    toast('Не вдалося відкрити: ' + e.message);
  }
}
function assetType(file) {
  if (/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(file.type)) return 'image';
  if (/^audio\//.test(file.type)) return 'audio';
  if (/\.(ttf|otf|woff2?)$/i.test(file.name)) return 'font';
  return null;
}
async function upload(files) {
  const added = [];
  for (const f of files) {
    const type = assetType(f);
    if (!type) {
      toast('Непідтримуваний формат: ' + f.name);
      continue;
    }
    if (uploadTarget && type !== uploadTarget.type) {
      toast('Потрібен асет типу ' + uploadTarget.type);
      continue;
    }
    if (f.size > 12e6) {
      toast(f.name + ': файл більший за 12 МБ.');
      continue;
    }
    try {
      const id = 'upload-' + uid(),
        a = { id, name: f.name, type, data: await readData(f) };
      if (type === 'font' && a.data.startsWith('data:;')) a.data = a.data.replace('data:;', 'data:font/ttf;');
      assets[id] = a;
      added.push(id);
      project.assetIds = [...new Set([...(project.assetIds || []), id])];
    } catch {
      toast('Не вдалося прочитати ' + f.name);
    }
  }
  if (added.length) {
    snapshot();
    if (uploadTarget) {
      const obj = uploadTarget.path.startsWith('block.') ? block() : project;
      const hadLandscape = !!obj?.assetL;
      if (obj) set(uploadTarget.path.replace(/^block\./, ''), added[0], obj);
      if (obj && uploadTarget.path === 'block.fontAsset') obj.font = 'asset';
      // A landscape picture added in PB (the creative had one picture for both orientations).
      if (obj && uploadTarget.path === 'block.assetL' && project.kind === 'html' && !hadLandscape) obj.landscapeOwn = true;
    }
    changed();
    refresh();
    toast(`Завантажено асетів: ${added.length}`);
  }
  uploadTarget = null;
  $('#assetInput').value = '';
}
function projectsDialog() {
  renderProjects();
  $('#projectDialog').showModal();
}
function renderProjects() {
  const productName = p =>
    p.kind === 'html' ? 'Імпортований HTML' : p.product === 'fiction' ? 'Fiction Me' : 'Cleaner';
  const row = p =>
    `<div class="project-item ${p.id === project.id ? 'current' : ''}"><div><strong>${p.isTemplate ? esc(p.name) : 'Варіація ' + (p.variant || 1)}${p.id === project.id ? ' · відкрита' : ''}</strong><small>${p.isTemplate ? 'Моя композиція' : esc(fileName(p))} · ${new Date(p.updated).toLocaleString('uk-UA')}</small></div><button class="small-btn" data-open-project="${p.id}">Відкрити</button>${p.id !== project.id ? `<button class="small-btn danger" data-delete-project="${p.id}" aria-label="Видалити">×</button>` : ''}</div>`;
  const groups = new Map();
  for (const p of projects.slice().sort((a, b) => b.updated - a.updated)) {
    const key = p.isTemplate ? 'template:' + p.id : p.setId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  $('#projectList').innerHTML = [...groups.values()]
    .map(list => {
      const first = list[0];
      if (first.isTemplate) return `<section class="project-group">${row(first)}</section>`;
      const members = list.slice().sort((a, b) => a.variant - b.variant);
      return `<section class="project-group"><header><b>${esc(first.naming?.number || '—')}</b> ${esc(baseName(first.name))}<small>${productName(first)} · ${esc(layoutNames[first.template] || 'Власна композиція')} · ${members.length} варіац.</small></header>${members.map(row).join('')}</section>`;
    })
    .join('');
}
async function checkMatrix() {
  const results = $('#checkResults');
  results.hidden = false;
  results.innerHTML = '<h3>Перевіряю макет у 16 розмірах…</h3>';
  $('#check') && ($('#check').disabled = true);
  const config = clone(project),
    resolved = await preparedAssets(config);
  const matrix = [
      [320, 480],
      [320, 568],
      [360, 640],
      [375, 667],
      [390, 844],
      [393, 852],
      [412, 915],
      [430, 932]
    ],
    rows = [];
  for (const [w, h] of [...matrix, ...matrix.map(([w, h]) => [h, w])]) {
    const f = document.createElement('iframe');
    f.sandbox = 'allow-scripts allow-same-origin';
    f.style.cssText = `position:fixed;left:-20000px;width:${w}px;height:${h}px;border:0;visibility:hidden`;
    document.body.append(f);
    await new Promise(resolve => {
      f.onload = resolve;
      f.srcdoc = buildHTML(config, resolved, { preview: true });
    });
    await Promise.all(
      [...f.contentDocument.images].map(img =>
        img.complete
          ? Promise.resolve()
          : new Promise(resolve => {
              img.onload = img.onerror = resolve;
            })
      )
    );
    await f.contentDocument.fonts.ready;
    const d = f.contentDocument,
      errors = layoutFailures(d, f.contentWindow).map(code => failureLabels[code] || code);
    const hero = d.querySelector(
      config.product === 'fiction' && ['cover', 'sticky'].includes(config.settings.motion)
        ? '.cover'
        : '.hero'
    );
    if (
      config.blocks.some(b => b.enabled && b.type === 'hero') &&
      (!hero || hero.getBoundingClientRect().width < 1 || hero.getBoundingClientRect().height < 1)
    )
      errors.push('Головне зображення приховане');
    if ([...d.images].some(img => !img.naturalWidth)) errors.push('Не завантажився асет');
    rows.push({ w, h, errors: [...new Set(errors)] });
    f.remove();
    results.innerHTML = '<h3>Перевірка адаптивності</h3>' + tableResults(rows);
  }
  results.innerHTML =
    '<h3>Перевірка адаптивності <button class="text-btn" id="closeChecks" style="float:right">Закрити ×</button></h3>' +
    tableResults(rows) +
    '<p class="muted">Автоперевірка CTA, завантаження асетів, переповнення й тексту. Візуальна перевірка та перевірка в сітці потрібні окремо.</p>';
  $('#check') && ($('#check').disabled = false);
}
const tableResults = rows =>
  '<table>' +
  rows
    .map(
      r =>
        `<tr><td>${r.w} × ${r.h}</td><td class="${r.errors.length ? 'bad' : 'ok'}">${r.errors.length ? r.errors.join(' · ') : '✓ Без виявлених помилок'}</td></tr>`
    )
    .join('') +
  '</table>';
document.addEventListener('input', e => {
  if (e.target.id === 'importStyleElement') {
    selected = e.target.value;
    $('#preview').contentWindow.postMessage(
      { type: 'set-editor-mode', enabled: editPositions, selected },
      location.origin
    );
    renderLibrary();
    renderInspector();
    return;
  }
  let path = e.target.dataset.prop;
  if (!path) return;
  // Parts of the story box (Chapter, POV, story) are edited from the box: «part.<id>.<field>».
  const part = /^part\.([^.]+)\./.exec(path);
  if (part) path = 'block.' + path.slice(part[0].length);
  const obj = part ? project.blocks.find(b => b.id === part[1]) : path.startsWith('block.') ? block() : project;
  if (!obj) return;
  let value =
    e.target.type === 'checkbox'
      ? e.target.checked
      : ['range', 'number'].includes(e.target.type)
        ? Math.min(Number(e.target.max), Math.max(Number(e.target.min), Number(e.target.value)))
        : e.target.value;
  if (get(path.replace(/^block\./, ''), obj) === value) return;
  snapshot();
  if (project.kind === 'html' && path.startsWith('block.position.')) captureTranslate(obj);
  set(path.replace(/^block\./, ''), value, obj);
  if (project.kind === 'html' && path === 'block.text') {
    obj.label = obj.textGroup
      ? 'Весь текст · ' + String(value).split(/\n\s*\n/).length + ' абзаців'
      : 'Текст · ' + shortLabel(value, 42);
    renderLibrary();
    if (obj.textGroup && inspectorTab === 'element') $('#inspectorBody h3').textContent = obj.label;
  }
  if (part) {
    if (['range', 'number'].includes(e.target.type))
      $$('[data-prop]')
        .filter(x => x.dataset.prop === e.target.dataset.prop && x !== e.target)
        .forEach(x => (x.value = value));
    if (e.target.type === 'color') e.target.nextElementSibling.textContent = value;
    changed();
    refresh({ inspector: path === 'block.enabled', library: false });
    return;
  }
  if (path === 'settings.font' && value !== 'custom') project.settings.fontAsset = '';
  if (['range', 'number'].includes(e.target.type))
    $$('[data-prop]')
      .filter(x => x.dataset.prop === path && x !== e.target)
      .forEach(x => (x.value = value));
  if (e.target.type === 'color') e.target.nextElementSibling.textContent = value;
  if (path.startsWith('block.ctaCode.') && path !== 'block.ctaCode.ratio')
    for (const x of ctaGroup(obj)) if (x !== obj) set(path.replace(/^block\./, ''), value, x);
  if (['linkIos', 'linkAndroid'].includes(path)) {
    obj[path] = String(value).trim();
    if (!obj[path]) delete obj[path];
    if (project.setId) for (const v of setMembers(projects, project.setId)) if (v !== project) v[path] = project[path];
    const n = $('#linksNote');
    if (n)
      n.textContent =
        !project.linkIos && !project.linkAndroid
          ? 'Порожні поля — креатив відкриває свої посилання.'
          : project.linkIos && project.linkAndroid
            ? 'iPhone відкриє App Store, Android — Google Play.'
            : 'Вказано одне посилання — його відкриють на всіх телефонах.';
  }
  if (path.startsWith('naming.') || ['language', 'iosUrl', 'androidUrl'].includes(path)) {
    syncSetFields(project, projects);
    updateFileNames();
  }
  changed();
  refresh({
    inspector: path === 'block.enabled' || path === 'block.addedStyle.plate' || path === 'block.font',
    library: path === 'block.enabled'
  });
});
document.addEventListener('change', e => {
  const path = e.target.dataset?.prop || '';
  if (path.startsWith('naming.') || path === 'language') {
    project.naming = normalizeNaming(project.naming || {}, project);
    project.language = (project.language || 'en').trim().toLowerCase() || 'en';
    syncSetFields(project, projects);
    changed();
    renderInspector();
    renderVariants();
    return;
  }
  if (e.target.tagName === 'SELECT' && e.target.dataset.prop) renderInspector();
});
$('#projectName').addEventListener('input', e => {
  snapshot();
  project.name = e.target.value;
  changed();
});
document.addEventListener('click', e => {
  if (e.target.closest('#standalonePreview')) {
    e.preventDefault();
    openStandalonePreview();
    return;
  }
  const el = e.target.closest('button,[data-select]');
  if (!el) return;
  const d = el.dataset;
  if (d.richCmd) return richCommand(d.richFor, d.richCmd);
  if (d.openBlock) {
    // A file in the list: open the element that uses it.
    $(`.block-select[data-select="${d.openBlock}"]`)?.click();
    $(`.block-select[data-select="${d.openBlock}"]`)?.scrollIntoView({ block: 'nearest' });
    return;
  }
  if (d.dropLandscape) {
    const b = project.blocks.find(x => x.id === d.dropLandscape);
    if (b) {
      snapshot();
      b.assetL = '';
      delete b.landscapeOwn;
      changed();
      refresh();
    }
    return;
  }
  if (d.restoreAudio) {
    const b = project.blocks.find(x => x.id === d.restoreAudio);
    if (b) {
      snapshot();
      b.asset = b.originalAsset;
      changed();
      refresh();
    }
    return;
  }
  if (d.tab) {
    libraryTab = d.tab;
    renderLibrary();
  }
  if (d.inspector) {
    inspectorTab = d.inspector;
    renderInspector();
  }
  if (d.pickerProduct) {
    chooserProduct = d.pickerProduct;
    chooserStep = 'template';
    renderChooser();
  }
  if (d.choose) chooseComposition(d.choose);
  if (d.customTemplate) {
    const p = clone(projects.find(p => p.id === d.customTemplate));
    p.id = uid();
    p.isTemplate = false;
    p.name += ' — варіація';
    addAsNewSet(p);
    useProject(p);
    closeChooser();
  }
  if (d.select) {
    selected = d.select;
    $('#preview').contentWindow.postMessage(
      { type: 'set-editor-mode', enabled: editPositions, selected },
      location.origin
    );
    inspectorTab = 'element';
    renderLibrary();
    renderInspector();
  }
  if (d.addHtml) {
    snapshot();
    const b = makeBlock(d.addHtml);
    Object.assign(b, {
      node: 'added-' + b.id,
      added: true,
      label: d.addHtml === 'text' ? 'Новий текст' : 'Нова картинка',
      text: d.addHtml === 'text' ? 'Новий текст' : '',
      originalText: '',
      asset: '',
      assetL: '',
      // Each new element lands a bit lower than the previous one, so they never pile up on one spot.
      position: (() => {
        const y = (project.blocks.filter(x => x.added).length % 5) * 9;
        return { portrait: { x: 0, y }, landscape: { x: 0, y } };
      })(),
      translateBase: { portrait: { x: '0px', y: '0px' }, landscape: { x: '0px', y: '0px' } },
      customStyle: { portrait: {}, landscape: {} },
      addedStyle: { ...ADDED_TEXT_DEFAULTS }
    });
    project.blocks.push(b);
    selected = b.id;
    inspectorTab = 'element';
    changed();
    refresh();
  }
  if (d.deleteBlock) {
    const b = project.blocks.find(x => x.id === d.deleteBlock);
    if (b?.added) {
      snapshot();
      project.blocks = project.blocks.filter(x => x !== b);
      selected = project.blocks[0]?.id || '';
      changed();
      refresh();
    }
  }
  if (d.add) {
    if (['hero', 'cta', 'audio'].includes(d.add) && project.blocks.some(b => b.type === d.add))
      return toast('Такий блок уже є. Увімкни або відредагуй його.');
    if (project.blocks.length >= 40) return toast('До 40 блоків у першій версії.');
    snapshot();
    const b = makeBlock(d.add);
    // In the alert template new elements go into the alert card.
    if (isKit(project) && project.settings.motion === 'alertphoto') b.zone = 'card';
    project.blocks.push(b);
    selected = b.id;
    inspectorTab = 'element';
    changed();
    refresh();
  }
  if (d.move) {
    snapshot();
    const i = project.blocks.findIndex(b => b.id === d.move),
      j = i + Number(d.dir);
    if (j >= 0 && j < project.blocks.length)
      [project.blocks[i], project.blocks[j]] = [project.blocks[j], project.blocks[i]];
    changed();
    refresh();
  }
  if (d.visible) {
    snapshot();
    const b = project.blocks.find(b => b.id === d.visible);
    b.enabled = !b.enabled;
    changed();
    refresh();
  }
  if (d.fontAll) {
    const src = project.blocks.find(b => b.id === d.fontAll);
    if (src) {
      snapshot();
      for (const b of project.blocks.filter(b => b.type === 'text')) {
        b.font = src.font || '';
        b.fontAsset = src.fontAsset || '';
      }
      changed();
      refresh();
      toast(src.font ? 'Шрифт застосовано до всього тексту.' : 'Весь текст — шрифтом креативу.');
    }
  }
  if (d.upload) {
    uploadTarget = { path: d.upload, type: d.assetType };
    $('#assetInput').accept =
      d.assetType === 'font'
        ? '.ttf,.otf,.woff,.woff2'
        : d.assetType === 'audio'
          ? 'audio/*'
          : 'image/png,image/jpeg,image/webp,image/gif';
    $('#assetInput').click();
  }
  if (d.deleteAsset) {
    if (
      projects.some(p =>
        referencedAssets({ ...p, blocks: p.blocks.map(b => ({ ...b, enabled: true })) }).includes(
          d.deleteAsset
        )
      )
    )
      return toast('Асет використовується у проєкті. Спочатку заміни його.');
    delete assets[d.deleteAsset];
    changed();
    renderLibrary();
  }
  if (d.variantId) {
    const p = projects.find(p => p.id === d.variantId);
    if (p && p !== project) useProject(p);
  }
  if (d.openProject) {
    useProject(projects.find(p => p.id === d.openProject));
    closeChooser();
    $('#projectDialog').close();
  }
  if (d.deleteProject) {
    const removed = projects.find(p => p.id === d.deleteProject);
    projects = projects.filter(p => p.id !== d.deleteProject);
    if (removed?.setId) renumber(projects, removed.setId);
    renderVariants();
    changed();
    renderProjects();
  }
  switch (el.id) {
    case 'exportImported':
      exportHTML();
      break;
    case 'importPlayable':
    case 'importPlayableProject':
      $('#playableInput').click();
      break;
    case 'newProject':
      openChooser('new');
      break;
    case 'brandHome':
      // The logo always leads to the start screen (product → template); the current creative stays.
      openChooser('new');
      break;
    case 'changeLayout':
      openChooser('change');
      break;
    case 'convertCta':
      convertCta().catch(e => toast('Не вдалося: ' + e.message));
      break;
    case 'restoreCta':
      if (block()) {
        snapshot();
        for (const x of ctaGroup(block())) delete x.ctaCode;
        changed();
        refresh();
      }
      break;
    case 'ctaToCode':
      if (block()) {
        snapshot();
        block().asset = '';
        block().assetL = '';
        changed();
        refresh();
      }
      break;
    case 'chooserBack':
      chooserStep = 'product';
      renderChooser();
      break;
    case 'cancelChooser':
      closeChooser();
      break;
    case 'portrait':
    case 'landscape':
      orientation = el.id;
      $('#portrait').classList.toggle('active', orientation === 'portrait');
      $('#landscape').classList.toggle('active', orientation === 'landscape');
      sizePreview();
      renderInspector();
      // The other orientation lays out differently: tie new elements there too, once it is shown.
      setTimeout(() => autoAnchor(false), 350);
      break;
    case 'undo':
      if (past.length) {
        future.push(JSON.stringify(project));
        restoreHistory(past.pop());
      }
      break;
    case 'redo':
      if (future.length) {
        past.push(JSON.stringify(project));
        restoreHistory(future.pop());
      }
      break;
    case 'resetPosition':
      if (block()) {
        snapshot();
        block().position[orientation] = { x: 0, y: 0 };
        if (block().anchor) delete block().anchor[orientation];
        // The size dragged with the handles goes back too.
        if (block().customStyle?.[orientation]) delete block().customStyle[orientation].width;
        changed();
        refresh();
      }
      break;
    case 'modeEdit':
    case 'modePlay':
      setPlayMode(el.id === 'modePlay');
      break;
    case 'editPositions':
      if (playMode) setPlayMode(false);
      editPositions = !editPositions;
      dragLabel = '';
      sizePreview();
      $('#editPositions').setAttribute('aria-pressed', String(editPositions));
      $('#editPositions').textContent = editPositions ? '✓ Рухати і розтягувати' : 'Рухати і розтягувати';
      $('#preview').contentWindow.postMessage(
        { type: 'set-editor-mode', enabled: editPositions, selected },
        location.origin
      );
      break;
    case 'closeExport':
      $('#exportDialog').close();
      break;
    case 'previewExport':
      if (lastExport) {
        $('#exportDialog').close();
        loadedSignature = '';
        loadPreview(lastExport.project, ++previewRevision, lastExport.assets);
        $('#exportPreviewNotice').hidden = false;
      }
      break;
    case 'returnOriginal':
      $('#exportPreviewNotice').hidden = true;
      renderPreview();
      break;
    case 'restart':
      scroll = 0;
      loadedSignature = '';
      renderPreview();
      break;
    case 'retryPreview':
      renderPreview();
      break;
    case 'screenshot':
      screenshot();
      break;
    case 'soundToggle':
      previewSound = !previewSound;
      $('#soundToggle').setAttribute('aria-pressed', String(previewSound));
      $('#soundToggle').textContent = previewSound ? 'Звук увімкнено' : 'Звук вимкнено';
      $('#preview').contentWindow.postMessage({ type: 'preview-sound', enabled: previewSound }, '*');
      renderPreview();
      break;
    case 'export':
      exportSet();
      break;
    case 'exportSetInspector':
      exportSet();
      break;
    case 'exportOne':
      exportHTML();
      break;
    case 'addVariant': {
      placeholderId = null;
      const v = createVariant(project, projects, uid, clone);
      projects.push(v);
      useProject(v);
      toast(`Варіація ${v.variant} — копія попередньої. Заміни картинки або текст.`);
      break;
    }
    case 'applyLayout': {
      // Second click within 5 s confirms (no browser dialogs: they are blocked in embedded views).
      if (el.dataset.armed !== 'true') {
        el.dataset.armed = 'true';
        el.textContent = 'Натисни ще раз, щоб перенести розкладку';
        el.classList.add('armed');
        setTimeout(() => {
          if (!el.isConnected) return;
          el.dataset.armed = 'false';
          el.textContent = 'Розкладку цієї варіації → усім';
          el.classList.remove('armed');
        }, 5000);
        break;
      }
      const n = applyLayoutToSet(project, projects, clone);
      changed();
      renderVariants();
      renderInspector();
      toast(
        n ? `Розкладку перенесено у ${n} варіац. Картинки й тексти залишились свої.` : 'Інших варіацій немає.'
      );
      break;
    }
    case 'removeVariant': {
      // Two clicks: the first one arms the button, so a variation is never lost by a stray click.
      const btn = el;
      if (!btn.classList.contains('armed')) {
        btn.classList.add('armed');
        btn.textContent = `Видалити ${project.variant}?`;
        setTimeout(() => btn.isConnected && renderVariants(), 3000);
        break;
      }
      const setId = project.setId,
        gone = project.id;
      projects = projects.filter(p => p.id !== gone);
      renumber(projects, setId);
      useProject(setMembers(projects, setId)[0]);
      changed();
      toast('Варіацію видалено.');
      break;
    }
    case 'projectMenu':
      projectsDialog();
      break;
    case 'closeProjects':
      $('#projectDialog').close();
      break;
    case 'duplicateProject': {
      const p = clone(project);
      p.id = uid();
      p.name = baseName(p.name) + ' — копія';
      p.isTemplate = false;
      addAsNewSet(p);
      useProject(p);
      renderProjects();
      break;
    }
    case 'saveJSON':
    case 'saveJSONInspector':
      saveJSON();
      break;
    case 'importJSON':
      $('#jsonInput').click();
      break;
    case 'uploadAssets':
      uploadTarget = null;
      $('#assetInput').accept = 'image/png,image/jpeg,image/webp,image/gif,audio/*,.ttf,.otf,.woff,.woff2';
      $('#assetInput').click();
      break;
    case 'saveTemplate': {
      const p = clone(project);
      p.id = uid();
      p.name = baseName(p.name) + ' — шаблон';
      p.isTemplate = true;
      delete p.setId;
      delete p.variant;
      p.naming = { ...p.naming, number: '' };
      p.updated = Date.now();
      projects.push(p);
      changed();
      renderLibrary();
      toast('Композицію збережено. Вона доступна при створенні нової варіації.');
      break;
    }
    case 'removeBlock':
      snapshot();
      project.blocks = project.blocks.filter(b => b.id !== selected);
      selected = project.blocks[0]?.id;
      changed();
      refresh();
      break;
    case 'listen':
      listen();
      break;
    case 'check':
      checkMatrix().catch(e => {
        toast('Перевірку не завершено: ' + e.message);
        $('#check') && ($('#check').disabled = false);
      });
      break;
    case 'closeChecks':
      $('#checkResults').hidden = true;
      break;
  }
});
let sound;
function listen() {
  if (sound && !sound.paused) {
    sound.pause();
    return;
  }
  const a = assets[block()?.asset];
  if (!a) return toast('Обери аудіофайл.');
  sound = new Audio(a.data || a.url);
  sound.volume = project.settings.volume / 100;
  sound.play().catch(() => toast('Не вдалося відтворити аудіо.'));
}
$('#playableInput').addEventListener('change', async e => {
  const f = e.target.files[0];
  if (f) await importPlayable(f);
  e.target.value = '';
});
$('#device').addEventListener('change', sizePreview);
$('#previewZoom').addEventListener('change', sizePreview);
$('#assetInput').addEventListener('change', e => upload(e.target.files));
$('#jsonInput').addEventListener('change', e => {
  if (e.target.files[0]) importJSON(e.target.files[0]);
  e.target.value = '';
});
$('#libraryBody').addEventListener('dragover', e => {
  if (e.dataTransfer?.types?.includes('Files')) e.preventDefault();
});
$('#libraryBody').addEventListener('drop', e => {
  if (!e.dataTransfer?.files?.length) return;
  e.preventDefault();
  uploadTarget = null;
  upload(e.dataTransfer.files);
});
addEventListener('message', e => {
  if (e.source === $('#playFrame').contentWindow && e.data?.type === 'studio-cta') {
    toast('Клік по CTA. У рекламі тут відкриється магазин' + (e.data.url ? ': ' + String(e.data.url).slice(0, 80) : '.'));
    return;
  }
  if (e.source !== $('#preview').contentWindow) return;
  if (e.data?.type === 'editor-guides') {
    // Only the readout under the phone changes while dragging; no full re-layout of the preview.
    dragLabel = typeof e.data.label === 'string' ? e.data.label : '';
    const badge = $('#dragReadout');
    badge.textContent = dragLabel;
    badge.hidden = !dragLabel || !editPositions;
  }
  if (e.data?.type === 'position-change') {
    const b = project.blocks.find(b => b.id === e.data.id);
    if (
      b &&
      ['portrait', 'landscape'].includes(e.data.orientation) &&
      Number.isFinite(e.data.x) &&
      Number.isFinite(e.data.y)
    ) {
      snapshot();
      if (project.kind === 'html' && e.data.base) {
        b.translateBase ??= {};
        b.translateBase[e.data.orientation] = {
          x: validTranslate(e.data.base.x),
          y: validTranslate(e.data.base.y)
        };
      }
      b.position[e.data.orientation] = {
        x: Math.max(-100, Math.min(100, e.data.x)),
        y: Math.max(-100, Math.min(100, e.data.y))
      };
      // A moved element is tied to the nearest element of the creative right where it was dropped,
      // so it keeps its place next to it on every screen size.
      if (project.kind === 'html') anchorBlock(b, e.data.orientation);
      selected = b.id;
      changed();
      refresh();
    }
  }
  if (e.data?.type === 'resize-change') {
    const b = project.blocks.find(b => b.id === e.data.id);
    const o = e.data.orientation;
    if (b && ['portrait', 'landscape'].includes(o) && Number.isFinite(e.data.width)) {
      snapshot();
      if (e.data.base) {
        b.translateBase ??= {};
        b.translateBase[o] = { x: validTranslate(e.data.base.x), y: validTranslate(e.data.base.y) };
      }
      b.customStyle ??= { portrait: {}, landscape: {} };
      b.customStyle[o] = { ...b.customStyle[o], width: Math.max(5, Math.min(MAX_WIDTH, e.data.width)) };
      if (Number.isFinite(e.data.x) && Number.isFinite(e.data.y))
        b.position[o] = { x: Math.max(-100, Math.min(100, e.data.x)), y: Math.max(-100, Math.min(100, e.data.y)) };
      if (project.kind === 'html') anchorBlock(b, o);
      selected = b.id;
      changed();
      refresh();
    }
  }
  if (e.data?.type === 'select-block') {
    selected = e.data.id;
    inspectorTab = 'element';
    renderLibrary();
    renderInspector();
  }
  if (e.data?.type === 'preview-cta') toast('CTA працює. У preview магазин не відкривається.');
  if (e.data?.type === 'preview-scroll') scroll = e.data.value;
  if (e.data?.type === 'preview-error' && e.data.token === previewRevision) {
    $('#previewState').hidden = false;
    $('#previewState').classList.add('error');
    $('#previewState').querySelector('span').textContent = e.data.error;
    $('#retryPreview').hidden = false;
  }
  if (e.data?.type === 'preview-ready' && e.data.token === previewRevision) {
    loadedSignature = pendingSignature;
    $('#previewState').hidden = true;
    $('#preview').contentWindow.postMessage({ type: 'set-scroll', value: scroll }, location.origin);
    // Colours and sizes in the panel are read from the loaded creative: refresh them once it is there.
    if (project.kind === 'html' && !$('#inspectorBody').contains(document.activeElement)) renderInspector();
  }
  if (e.data?.type === 'preview-updated' && e.data.token === previewRevision)
    $('#previewState').hidden = true;
  // Opening a creative ties what was placed before anchors existed; while editing, only new elements.
  if (['preview-ready', 'preview-updated'].includes(e.data?.type) && e.data.token === previewRevision) {
    const full = e.data.type === 'preview-ready';
    requestAnimationFrame(() => autoAnchor(full));
  }
});
// New elements that are not tied yet (just added, or from older versions) are tied to the nearest
// element of the creative as they are now, so they stop drifting on other screens.
function autoAnchor(includeMoved = false) {
  if (project.kind !== 'html' || playMode) return;
  if (document.activeElement?.matches?.('#inspectorBody :is(input,select,textarea,[contenteditable])')) return; // never under the user's hands
  const o = orientation,
    todo = project.blocks.filter(
      b =>
        b.enabled &&
        !b.anchor?.[o]?.node &&
        !b.anchor?.[o]?.screen &&
        (b.added
          ? b.type === 'text' || assets[b.asset]
          : includeMoved && !b.bgAsset && (b.position?.[o]?.x || b.position?.[o]?.y))
    );
  let done = 0;
  // Anchors made before 0.12.2 were always measured from the top: measured again as they stand now.
  for (const b of project.blocks.filter(b => b.enabled && b.anchor?.[o]?.node && !b.anchor[o].v && !b.hide?.[o])) {
    const el = previewDoc()?.querySelector('[data-studio-block="' + b.id + '"]'),
      r = el?.getBoundingClientRect();
    if (r?.width && anchorBlock(b, o, b.anchor[o].node, !!b.anchor[o].lock)) done++;
  }
  for (const b of todo) {
    // A new element already placed in the other orientation: tied to the same element's twin there.
    const other = b.anchor?.[o === 'portrait' ? 'landscape' : 'portrait'];
    const twin =
      b.added && other?.node && !b.anchor?.[o] && !b.position?.[o]?.x && !b.position?.[o]?.y
        ? twinNode(project, other.node, o)
        : '';
    const tc = twin && anchorCandidates(previewDoc()).find(c => c.block.node === twin);
    const el = previewDoc()?.querySelector('[data-studio-block="' + b.id + '"]');
    if (tc && el) {
      // Fits next to the twin (same distance as in the other orientation)? Otherwise a visible spot
      // in the middle of the screen, to be put in place by hand.
      const er = el.getBoundingClientRect(),
        ratio = er.width ? er.height / er.width : 0.5,
        w = (other.w / 100) * tc.rect.width,
        top = tc.rect.top + (other.y / 100) * tc.rect.width,
        win = previewDoc().defaultView;
      if (top >= 0 && top + w * ratio <= win.innerHeight) {
        b.anchor[o] = { ...other, node: twin };
        delete b.anchor[o].lock;
        done++;
        continue;
      }
      b.anchor[o] = { auto: true };
      b.position[o] = { x: 0, y: 0 };
      b.customStyle[o] = { ...b.customStyle[o], width: 30 };
      done++;
      continue;
    }
    if (anchorBlock(b, o)) done++;
  }
  if (!done) return;
  changed();
  refresh({ library: false });
}
document.addEventListener('keydown', e => {
  if (
    (e.ctrlKey || e.metaKey) &&
    e.key.toLowerCase() === 'z' &&
    !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)
  ) {
    e.preventDefault();
    $(e.shiftKey ? '#redo' : '#undo').click();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    save()
      .then(() => toast('Проєкт збережено.'))
      .catch(() => {});
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    sound?.pause();
    save().catch(() => {});
  }
});
refresh();
changed();
openChooser('new', true);
// A reload brings back the last creative straight into the editor.
loadLast().then(r => {
  if (!r || !Array.isArray(r.projects) || !r.projects.length || !placeholderId) return;
  try {
    Object.assign(assets, r.assets || {});
    const restored = r.projects;
    for (const p of restored) {
      if (p.kind === 'html') {
    addTextGroups(p);
    addMusicBlocks(p, assets);
  }
      prepareEditorProject(p);
    }
    projects = restored;
    for (const p of projects) ensureSet(p, projects, uid);
    placeholderId = null;
    useProject(projects.find(p => p.id === r.currentId) || projects[0]);
    toast('Відновлено останній креатив. «Новий креатив» — почати інший.');
  } catch (e) {
    console.warn('PB: the last creative could not be restored', e);
  }
});
// Read-only QA hooks; project changes still go through the editor.
window.studio = {
  getProject: () => clone(project),
  getAssets: () => clone(assets),
  getProjects: () => clone(projects),
  save: () => save(),
  buildHTML,
  resolveAssets,
  // Test hook: opens a hidden builder template (kept for older projects) without the start screen.
  newFromTemplate: id => {
    newTemplate(id);
    closeChooser();
  }
};

function renderHTMLInspector() {
  const b = block();
  let s = '';
  if (inspectorTab === 'settings') {
    s =
      '<h3>Експорт</h3>' +
      namingFields() +
      storeAndCompressionFields() +
      '<p class="muted">Оригінальний JavaScript і CTA імпортованого плейбла зберігаються.</p>';
  } else if (inspectorTab === 'layout') {
    s =
      '<h3>Оформлення</h3><div class="notice">Налаштування для ' +
      (orientation === 'portrait' ? 'портрета' : 'ландшафту') +
      '</div>' +
      field(
        'Елемент',
        '<select id="importStyleElement">' +
          visibleBlocks()
            .map(
              x =>
                '<option value="' +
                x.id +
                '" ' +
                (x.id === selected ? 'selected' : '') +
                '>' +
                esc(x.label || LABELS[x.type]) +
                '</option>'
            )
            .join('') +
          '</select>'
      );
    if (b) {
      const st = b.customStyle?.[orientation] || {};
      let el;
      try {
        el = $('#preview').contentDocument?.querySelector('[data-studio-block="' + b.id + '"]');
      } catch {}
      const fontEl = b.textGroup ? el?.querySelector('p,h1,h2,h3,h4,h5,h6') || el : el;
      const c = fontEl ? fontEl.ownerDocument.defaultView.getComputedStyle(fontEl) : null;
      if (b.type === 'text') {
        const rgb = c?.color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/),
          hex = rgb
            ? '#' +
              rgb
                .slice(1)
                .map(n => Number(n).toString(16).padStart(2, '0'))
                .join('')
            : '#111111';
        s +=
          field(
            'Розмір тексту',
            range(
              'block.customStyle.' + orientation + '.fontSize',
              st.fontSize ?? Math.round(parseFloat(c?.fontSize) || 20),
              8,
              100,
              1,
              'px'
            )
          ) +
          color('Колір тексту', 'block.customStyle.' + orientation + '.color', st.color || hex) +
          fontFields(b);
      }
      s += field(
        'Ширина елемента',
        range(
          'block.customStyle.' + orientation + '.width',
          st.width ??
            Math.max(
              5,
              Math.min(
                100,
                Math.round(
                  el && el.parentElement.clientWidth
                    ? (el.offsetWidth / el.parentElement.clientWidth) * 100
                    : 100
                )
              )
            ),
          5,
          100,
          1,
          '%'
        )
      );
    }
    s +=
      '<p class="muted">Початкове оформлення зберігається. Тут змінюються стилі обраного елемента; текст, зображення та позиція — у вкладці «Елемент».</p>';
  } else if (!b) {
    s =
      '<h3>Імпортований плейбл</h3><p class="muted">Обери текст або картинку в preview чи списку елементів.</p>';
  } else if (b.type === 'audio' && b.audioAsset) {
    // Music of the creative (played by its own script): switch off or replace with another file.
    const a = assets[b.asset];
    s =
      '<h3>' +
      esc(b.label || 'Музика') +
      '</h3>' +
      toggle('Музика грає', 'block.enabled', b.enabled) +
      '<small class="muted">Вимкни — і в креативі буде тиша (скрипт креативу не ламається).</small>' +
      (a ? `<audio class="audio-preview" controls preload="none" src="${esc(a.data || a.url || '')}"></audio>` : '') +
      assetField('Файл музики', 'block.asset', b.asset, 'audio') +
      (b.asset !== b.originalAsset
        ? `<button class="btn secondary full-width" data-restore-audio="${b.id}">Повернути музику креативу</button>`
        : '');
  } else {
    const o = orientation,
      styles = b.customStyle[o];
    let el;
    try {
      el = $('#preview').contentDocument?.querySelector('[data-studio-block="' + b.id + '"]');
    } catch {}
    const fontEl = b.textGroup ? el?.querySelector('p,h1,h2,h3,h4,h5,h6') || el : el;
    const rgb = fontEl
        ? fontEl.ownerDocument.defaultView
            .getComputedStyle(fontEl)
            .color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/)
        : null,
      hex = rgb
        ? '#' +
          rgb
            .slice(1)
            .map(n => Number(n).toString(16).padStart(2, '0'))
            .join('')
        : '#111111';
    const font = fontEl ? parseFloat(fontEl.ownerDocument.defaultView.getComputedStyle(fontEl).fontSize) : 20;
    const anchored = !!(b.added && b.anchor?.[o]?.node);
    s = '<h3>' + esc(b.label || LABELS[b.type]) + '</h3>' + visibilityControl(b);
    if (b.storyGroup) s += storyPartsFields(b, o);
    if (b.type === 'text' && !b.storyGroup)
      s +=
        richField(
          'Текст',
          'block',
          b,
          b.textGroup ? 12 : b.added ? 3 : 7,
          b.added
            ? 'Виділи слова й натисни Ж / К / П або обери шрифт. Enter — новий рядок.'
            : 'Виділи слова й натисни Ж / К / П або обери шрифт. Порожній рядок = новий абзац.'
        ) +
        (anchored
          ? ''
          : field(
              'Розмір тексту',
              range(
                'block.customStyle.' + o + '.fontSize',
                styles.fontSize ?? Math.round(font || 20),
                8,
                100,
                1,
                'px'
              )
            )) +
        color('Колір тексту', 'block.customStyle.' + o + '.color', styles.color || hex);
    if (b.added && b.type === 'text') s += addedTextFields(b);
    if (b.type === 'text' && !anchored)
      s += field(
        b.storyGroup ? 'Ширина блоку тексту' : 'Ширина',
        range(
          'block.customStyle.' + o + '.width',
          styles.width ??
            Math.max(
              5,
              Math.min(
                MAX_WIDTH,
                Math.round(
                  el && el.parentElement?.clientWidth ? (el.offsetWidth / el.parentElement.clientWidth) * 100 : 70
                )
              )
            ),
          5,
          MAX_WIDTH,
          1,
          '%'
        ),
        'Вужче або ширше (до 300%); блок лишається по центру.'
      );
    if (b.bgAsset)
      s +=
        '<p class="muted">Фон заданий у стилях креативу. Його можна замінити своєю картинкою або сховати.</p>' +
        assetField(b.assetL ? 'Зображення · портрет' : 'Зображення', 'block.asset', b.asset) +
        landscapePictureField(b);
    else if (b.type === 'image')
      s +=
        (b.added ? '' : ctaCodeFields(b, el)) +
        (b.ctaCode ? '' : assetField(b.assetL ? 'Зображення · портрет' : 'Зображення', 'block.asset', b.asset)) +
        (b.ctaCode ? '' : landscapePictureField(b)) +
        (anchored ? '' : field(
          'Ширина зображення',
          range(
            'block.customStyle.' + o + '.width',
            styles.width ??
              Math.max(
                5,
                Math.min(
                  MAX_WIDTH,
                  Math.round(
                    el && el.parentElement.clientWidth
                      ? (el.offsetWidth / el.parentElement.clientWidth) * 100
                      : 100
                  )
                )
              ),
            5,
            MAX_WIDTH,
            1,
            '%'
          )
        ));
    if (b.added || (b.anchor?.[o]?.node && !b.bgAsset)) s += anchorFields(b, o, el);
    else if (!b.bgAsset)
    s +=
      '<div class="notice">Позиція для ' +
      (o === 'portrait' ? 'портрета' : 'ландшафту') +
      '</div>' +
      field('X · горизонталь', range('block.position.' + o + '.x', b.position[o].x, -100, 100, 0.1, '%')) +
      field('Y · вертикаль', range('block.position.' + o + '.y', b.position[o].y, -100, 100, 0.1, '%')) +
      '<button class="btn secondary full-width" id="resetPosition">Скинути позицію і розмір</button>' +
      (b.added
        ? `<button class="btn secondary full-width danger-btn" data-delete-block="${b.id}">Видалити елемент</button>`
        : '');
  }
  $('#inspectorBody').innerHTML = s;
  $('#inspectorBody').scrollTop = 0;
  updateFileNames();
}
// A separate picture for landscape: for a picture (or background) that is one for both orientations.
// The creative's own two-picture elements keep their landscape field as before.
function landscapePictureField(b) {
  if (b.assetL && !b.landscapeOwn) return assetField('Зображення · ландшафт', 'block.assetL', b.assetL);
  if (b.assetL)
    return (
      assetField('Зображення · ландшафт', 'block.assetL', b.assetL) +
      `<button class="text-btn full-width" type="button" data-drop-landscape="${b.id}">Одна картинка для обох орієнтацій</button>`
    );
  return (
    '<div class="field"><label>Окремо для ландшафту</label>' +
    '<button class="btn secondary full-width" type="button" data-upload="block.assetL" data-asset-type="image">Додати картинку для ландшафту</button>' +
    '<small class="muted">Зараз одна картинка для портрета й ландшафту. Можна дати ландшафту свою.</small></div>'
  );
}
// ---------- New elements tied to the creative («anchor») ----------
// A new picture or text keeps its place next to an element of the creative on every screen size.
// The anchor is picked automatically after a move or resize (the nearest element), or chosen by hand.
function previewDoc() {
  try {
    return $('#preview').contentDocument;
  } catch {
    return null;
  }
}
function anchorCandidates(doc) {
  if (!doc) return [];
  const win = doc.defaultView,
    W = win.innerWidth,
    H = win.innerHeight,
    out = [];
  for (const b of project.blocks) {
    if (b.added || b.bgAsset || !b.enabled || !b.node || b.hide?.[win.matchMedia('(min-aspect-ratio: 1/1)').matches ? 'landscape' : 'portrait']) continue;
    const el = [...doc.querySelectorAll('[data-import-node]')].find(e => e.getAttribute('data-import-node') === b.node);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) continue;
    if (r.width * r.height > W * H * 0.5) continue; // backgrounds and full-screen pictures
    if (/hand|finger|tap/i.test((el.className?.baseVal ?? el.className) + ' ' + (el.parentElement?.className || ''))) continue;
    // Animated elements (pulsing CTA) would make the new element shake.
    let moving = false;
    for (let x = el; x && x !== doc.body; x = x.parentElement)
      if (x.getAnimations?.().some(a => a.playState === 'running' || a.playState === 'paused')) moving = true;
    if (moving) continue;
    out.push({ block: b, el, rect: r });
  }
  return out;
}
function nearestAnchor(rect, cands) {
  let best = null,
    bestD = Infinity;
  for (const c of cands) {
    const r = c.rect,
      gx = Math.max(0, r.left - rect.right, rect.left - r.right),
      gy = Math.max(0, r.top - rect.bottom, rect.top - r.bottom),
      cx = (r.left + r.right) / 2 - (rect.left + rect.right) / 2,
      cy = (r.top + r.bottom) / 2 - (rect.top + rect.bottom) / 2,
      d = Math.hypot(gx, gy) + Math.hypot(cx, cy) * 0.05;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
const round3 = n => Math.round(n * 1000) / 1000;
function isMoving(el, doc) {
  for (let x = el; x && x !== doc.body; x = x.parentElement)
    if (x.getAnimations?.().some(a => a.playState === 'running' || a.playState === 'paused')) return true;
  return false;
}
// Can this block be tied? New elements always; a moved element of the creative unless it is big
// (backgrounds, cover pictures) or animated (it would shake).
function anchorable(b, el, doc) {
  if (b.added) return true;
  if (b.bgAsset || b.storyGroup || b.textGroup || !el) return false;
  const r = el.getBoundingClientRect(),
    win = doc.defaultView;
  return r.width * r.height <= win.innerWidth * win.innerHeight * 0.5 && !isMoving(el, doc);
}
// Ties block b (orientation o) to an anchor, keeping the element exactly where it is now on screen.
function anchorBlock(b, o, node = null, lock = false) {
  const doc = previewDoc(),
    el = doc?.querySelector('[data-studio-block="' + b.id + '"]');
  if (!el || !anchorable(b, el, doc)) return false;
  const rect = el.getBoundingClientRect(),
    cands = anchorCandidates(doc).filter(
      c => c.block !== b && !c.el.contains(el) && !el.contains(c.el) && c.block.anchor?.[o]?.node !== b.node
    ),
    prev = b.anchor?.[o];
  const keep = node || (prev?.lock ? prev.node : '');
  const c = (keep && cands.find(x => x.block.node === keep)) || nearestAnchor(rect, cands);
  if (!c || rect.width < 2) return false;
  const r = c.rect,
    aw = r.width,
    cx = (rect.left + rect.right) / 2 - (r.left + r.right) / 2,
    // In the lower half of the anchor or below it: measured from its bottom edge, so «at the bottom»
    // stays at the bottom however the anchor's proportions change between screens.
    fromBottom = (rect.top + rect.bottom) / 2 > (r.top + r.bottom) / 2;
  b.anchor ??= {};
  b.anchor[o] = b.added
    ? {
        node: c.block.node,
        v: 2,
        ...(fromBottom ? { e: 1 } : {}),
        x: round3((cx / aw) * 100),
        y: round3(((fromBottom ? rect.bottom - r.bottom : rect.top - r.top) / aw) * 100),
        w: round3((rect.width / aw) * 100),
        ...(b.type === 'text' ? { f: round3((parseFloat(doc.defaultView.getComputedStyle(el).fontSize) / aw) * 100) } : {})
      }
    : {
        node: c.block.node,
        v: 2,
        ...(fromBottom ? { e: 1 } : {}),
        x: round3((cx / aw) * 100),
        y: round3((((rect.top + rect.bottom) / 2 - (fromBottom ? r.bottom : r.top)) / aw) * 100)
      };
  if (lock || (prev?.lock && prev.node === c.block.node)) b.anchor[o].lock = true;
  // The screen offset is not used while tied; it comes back if the tie is removed.
  b.position[o] = { x: 0, y: 0 };
  if (b.translateBase) delete b.translateBase[o];
  return true;
}
// Back to the screen: same place on the current screen, in screen percentages.
function unanchorBlock(b, o) {
  const doc = previewDoc(),
    el = doc?.querySelector('[data-studio-block="' + b.id + '"]');
  b.anchor ??= {};
  b.anchor[o] = { screen: true }; // chosen by hand: not tied again automatically
  if (!el) return;
  const win = doc.defaultView,
    W = win.innerWidth,
    H = win.innerHeight,
    r = el.getBoundingClientRect();
  if (!b.added) {
    // Offset from the element's own place, in screen percentages (as before tying).
    el.style.setProperty('translate', 'none', 'important');
    const n = el.getBoundingClientRect();
    el.style.removeProperty('translate');
    b.position[o] = {
      x: round3((((r.left + r.right) / 2 - (n.left + n.right) / 2) / W) * 100),
      y: round3((((r.top + r.bottom) / 2 - (n.top + n.bottom) / 2) / H) * 100)
    };
    return;
  }
  b.customStyle[o] = {
    ...b.customStyle[o],
    width: Math.round((r.width / W) * 1000) / 10,
    ...(b.type === 'text' ? { fontSize: Math.round(parseFloat(win.getComputedStyle(el).fontSize)) } : {})
  };
  b.position[o] = {
    x: round3((((r.left + r.right) / 2 - W / 2) / W) * 100),
    y: round3(((r.top - 0.38 * H) / H) * 100)
  };
}
function anchorFields(b, o, el) {
  const a = b.anchor?.[o]?.node ? b.anchor[o] : null,
    cands = anchorCandidates(previewDoc()),
    name = blk => blk.label || LABELS[blk.type];
  const opts = [['', 'Екран (не прив’язано)'], ...cands.map(c => [c.block.node, name(c.block)])];
  if (a?.node && !opts.some(([v]) => v === a.node)) {
    const blk = project.blocks.find(x => x.node === a.node);
    opts.push([a.node, (blk ? name(blk) : 'Елемент') + ' · не видно на цьому екрані']);
  }
  let s =
    '<div class="notice">' +
    (a?.node
      ? 'Прив’язано до елемента креативу: на всіх екранах тримається біля нього й масштабується разом з ним.'
      : b.added
        ? 'Не прив’язано: позиція рахується від екрана й на інших розмірах може з’їжджати. Посунь елемент або обери, до чого прив’язати.'
        : 'Елемент стоїть на своєму місці в креативі. Якщо посунути його, він прив’яжеться до найближчого елемента.') +
    '</div>' +
    field(
      'Прив’язати до (' + (o === 'portrait' ? 'портрет' : 'ландшафт') + ')',
      `<select data-anchor-choice="${b.id}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === (a?.node || '') ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`
    );
  if (a?.node)
    s +=
      field('X · від центру елемента', range('block.anchor.' + o + '.x', Math.round(a.x * 10) / 10, -150, 150, 0.5, '%')) +
      field(a.e ? 'Y · від низу елемента' : 'Y · від верху елемента', range('block.anchor.' + o + '.y', Math.round(a.y * 10) / 10, -300, 300, 0.5, '%'), b.added ? '' : 'Відстань до центру цього елемента, у відсотках від ширини елемента, до якого прив’язано.') +
      (b.added ? field('Ширина', range('block.anchor.' + o + '.w', Math.round(a.w * 10) / 10, 5, 400, 0.5, '%'), 'У відсотках від ширини елемента, до якого прив’язано.') : '') +
      (b.added && b.type === 'text' && a.f ? field('Розмір тексту', range('block.anchor.' + o + '.f', Math.round(a.f * 10) / 10, 1, 40, 0.1, '%'), 'Росте й меншає разом з елементом.') : '');
  else
    s +=
      field('X · горизонталь', range('block.position.' + o + '.x', b.position[o].x, -100, 100, 0.1, '%')) +
      field('Y · вертикаль', range('block.position.' + o + '.y', b.position[o].y, -100, 100, 0.1, '%'));
  return (
    s +
    '<button class="btn secondary full-width" id="resetPosition">Скинути позицію і розмір</button>' +
    (b.added ? `<button class="btn secondary full-width danger-btn" data-delete-block="${b.id}">Видалити елемент</button>` : '')
  );
}
// A new element moved with the X/Y or width sliders (not tied yet): tied once the slider is released.
document.addEventListener('change', e => {
  const m = /^block\.(?:position\.(portrait|landscape)\.[xy]|customStyle\.(portrait|landscape)\.width)$/.exec(e.target.dataset?.prop || '');
  const b = block();
  if (!m || !b?.added || project.kind !== 'html') return;
  const o = m[1] || m[2];
  if (o !== orientation || b.anchor?.[o]) return;
  setTimeout(() => {
    if (!b.anchor?.[o] && anchorBlock(b, o)) {
      changed();
      refresh({ library: false });
    }
  }, 450);
});
// «Показувати: у портреті / у ландшафті». Hidden in both = switched off (as the eye in the list).
document.addEventListener('change', e => {
  const o = e.target.dataset?.showFor;
  if (!o) return;
  const b = block();
  if (!b) return;
  snapshot();
  const shown = { portrait: b.enabled && !b.hide?.portrait, landscape: b.enabled && !b.hide?.landscape };
  shown[o] = e.target.checked;
  if (!shown.portrait && !shown.landscape) {
    b.enabled = false;
    delete b.hide;
  } else {
    b.enabled = true;
    const h = {};
    for (const k of ['portrait', 'landscape']) if (!shown[k]) h[k] = true;
    if (Object.keys(h).length) b.hide = h;
    else delete b.hide;
  }
  changed();
  refresh();
});
document.addEventListener('change', e => {
  const id = e.target.dataset?.anchorChoice;
  if (!id) return;
  const b = project.blocks.find(x => x.id === id);
  if (!b) return;
  snapshot();
  if (e.target.value) anchorBlock(b, orientation, e.target.value, true);
  else unanchorBlock(b, orientation);
  changed();
  refresh();
});
// Text added in PB: alignment, line spacing, inner padding and an optional plate behind it, so a new
// line reads well on any picture and keeps tidy spacing.
const ADDED_TEXT_DEFAULTS = { align: 'center', lineHeight: 1.25, padX: 14, padY: 8, plate: true, plateColor: '#000000', plateOpacity: 55, radius: 10 };
function addedStyle(v = {}) {
  const n = (x, d, min, max) => (Number.isFinite(Number(x)) ? Math.min(max, Math.max(min, Number(x))) : d);
  const d = ADDED_TEXT_DEFAULTS;
  return {
    align: ['left', 'center', 'right'].includes(v.align) ? v.align : d.align,
    lineHeight: n(v.lineHeight, d.lineHeight, 0.9, 2.5),
    padX: n(v.padX, d.padX, 0, 60),
    padY: n(v.padY, d.padY, 0, 60),
    plate: v.plate === true,
    plateColor: /^#[\da-f]{6}$/i.test(v.plateColor || '') ? v.plateColor : d.plateColor,
    plateOpacity: n(v.plateOpacity, d.plateOpacity, 0, 100),
    radius: n(v.radius, d.radius, 0, 40)
  };
}
function addedTextFields(b) {
  const a = (b.addedStyle = addedStyle(b.addedStyle));
  return (
    field(
      'Вирівнювання',
      `<select data-prop="block.addedStyle.align">${[
        ['left', 'Ліворуч'],
        ['center', 'По центру'],
        ['right', 'Праворуч']
      ]
        .map(([v, l]) => `<option value="${v}" ${a.align === v ? 'selected' : ''}>${l}</option>`)
        .join('')}</select>`
    ) +
    field('Міжрядковий інтервал', range('block.addedStyle.lineHeight', a.lineHeight, 0.9, 2.5, 0.05, '×')) +
    field('Відступ зліва і справа', range('block.addedStyle.padX', a.padX, 0, 60, 1, 'px')) +
    field('Відступ зверху і знизу', range('block.addedStyle.padY', a.padY, 0, 60, 1, 'px')) +
    toggle('Плашка під текстом', 'block.addedStyle.plate', a.plate) +
    (a.plate
      ? color('Колір плашки', 'block.addedStyle.plateColor', a.plateColor) +
        field('Прозорість плашки', range('block.addedStyle.plateOpacity', a.plateOpacity, 0, 100, 1, '%')) +
        field('Заокруглення', range('block.addedStyle.radius', a.radius, 0, 40, 1, 'px'))
      : '')
  );
}
// Story box: Chapter, POV and the story live in one scrolling <div>. They are one element here and
// each part is edited, hidden or recoloured in place, so the box and its scrolling stay the original.
function storyPartsFields(g, o) {
  let doc;
  try {
    doc = $('#preview').contentDocument;
  } catch {}
  let s =
    '<p class="muted">Увесь текст скролу — один блок, як у коді. Chapter і POV можна змінити або сховати; скрол працює як в оригіналі.</p>';
  for (const node of g.parts || []) {
    const p = project.blocks.find(b => b.node === node);
    if (!p) continue;
    const el = doc?.querySelector('[data-studio-block="' + p.id + '"]'),
      cs = el ? el.ownerDocument.defaultView.getComputedStyle(el) : null,
      rgb = cs?.color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/),
      hex = rgb ? '#' + rgb.slice(1).map(n => Number(n).toString(16).padStart(2, '0')).join('') : '#111111',
      styles = p.customStyle[o] || {},
      long = p.text.length > 60,
      key = 'part.' + p.id + '.';
    s +=
      '<div class="story-part"><div class="section-label">' +
      esc(p.partLabel || p.label) +
      '</div>' +
      toggle('Показувати', key + 'enabled', p.enabled) +
      (p.enabled
        ? richField('Текст', 'part.' + p.id, p, long ? 10 : 1, long ? '' : 'Виділи слова й натисни Ж / К / П або обери шрифт.') +
          field(
            'Розмір тексту',
            range(key + 'customStyle.' + o + '.fontSize', styles.fontSize ?? Math.round(parseFloat(cs?.fontSize) || 20), 8, 100, 1, 'px')
          ) +
          color('Колір тексту', key + 'customStyle.' + o + '.color', styles.color || hex)
        : '') +
      '</div>';
  }
  return s;
}
// opts.template: a built-in original creative opened as a template (new number, own name).
// ---------- Coded CTA for original creatives ----------
// The CTA picture can be swapped for a button made in code (text, colours, rounding). The button keeps
// the picture's place, classes and proportions; the creative's own click handler still works.
function looksLikeCta(b, el) {
  return (
    /cta|кнопк/i.test(b.label || '') ||
    /^cta/i.test(assets[b.asset]?.name || '') ||
    !!el?.closest?.('.cta,[data-el="cta"],#cta,button,a')
  );
}
function ctaGroup(b) {
  return b.ctaCode?.group ? project.blocks.filter(x => x.ctaCode?.group === b.ctaCode.group) : [b];
}
function ctaCodeFields(b, el) {
  const c = b.ctaCode;
  if (!c) {
    const button =
      '<button class="btn primary full-width" id="convertCta">Замінити на кнопку з кодом</button><p class="muted">Текст і колір кнопки можна буде змінити. Повернути картинку можна будь-коли.</p>';
    return looksLikeCta(b, el)
      ? '<div class="divider"></div><h4>Кнопка</h4>' + button + '<div class="divider"></div>'
      : '<details class="asset-options"><summary>Зробити з цієї картинки кнопку</summary>' + button + '</details>';
  }
  return (
    '<div class="divider"></div><h4>Кнопка з кодом</h4>' +
    field('Текст кнопки', textInput('block.ctaCode.text', c.text || '')) +
    color('Колір кнопки', 'block.ctaCode.bg', c.bg || '#7b2ff2') +
    color('Другий колір (градієнт)', 'block.ctaCode.bg2', c.bg2 || c.bg || '#7b2ff2') +
    color('Колір тексту', 'block.ctaCode.color', c.color || '#ffffff') +
    field('Розмір тексту', range('block.ctaCode.fontSize', c.fontSize ?? 42, 15, 80, 1, '% висоти')) +
    sel('Насиченість', 'block.ctaCode.weight', c.weight || 700, [
      [400, 'Звичайний'],
      [500, 'Середній'],
      [600, 'Напівжирний'],
      [700, 'Жирний'],
      [800, 'Дуже жирний']
    ]) +
    toggle('ВЕЛИКІ ЛІТЕРИ', 'block.ctaCode.upper', !!c.upper) +
    field('Заокруглення', range('block.ctaCode.radius', c.radius ?? 50, 0, 50, 1, '% висоти'), '50 = пігулка') +
    field('Пропорції (ширина / висота)', range('block.ctaCode.ratio', c.ratio ?? 4, 1, 12, 0.1, '')) +
    toggle('Тінь', 'block.ctaCode.shadow', c.shadow !== false) +
    (ctaGroup(b).length > 1 ? '<p class="muted">Зміни діють і для портрета, і для ландшафту.</p>' : '') +
    '<button class="btn secondary full-width" id="restoreCta">Повернути картинку</button><div class="divider"></div>'
  );
}
// Colour of the button picture: the most saturated pixel along the middle row.
async function sampleCta(asset) {
  const src = asset?.data || asset?.url;
  if (!src) return null;
  const img = new Image();
  img.src = src;
  await img.decode();
  const w = 64,
    h = Math.max(1, Math.round((64 * img.naturalHeight) / img.naturalWidth)),
    cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const row = ctx.getImageData(0, Math.floor(h / 2), w, 1).data;
  let best = null,
    score = -1;
  for (let i = 0; i < row.length; i += 4) {
    const [r, g, b2, a] = [row[i], row[i + 1], row[i + 2], row[i + 3]];
    if (a < 200) continue;
    const sat = Math.max(r, g, b2) - Math.min(r, g, b2);
    if (sat > score) {
      score = sat;
      best = [r, g, b2];
    }
  }
  const hex = best ? '#' + best.map(v => v.toString(16).padStart(2, '0')).join('') : '#7b2ff2';
  const lum = best ? 0.299 * best[0] + 0.587 * best[1] + 0.114 * best[2] : 0;
  return { bg: hex, color: lum > 170 ? '#1d2433' : '#ffffff', ratio: img.naturalWidth / img.naturalHeight };
}
async function convertCta() {
  const b = block();
  if (!b) return;
  const doc = $('#preview').contentDocument,
    el = doc?.querySelector('[data-studio-block="' + b.id + '"]'),
    box = el?.closest('.cta,[data-el="cta"],#cta,button,a') || el?.parentElement;
  // Portrait and landscape pictures of the same button become one coded button.
  const members = project.blocks.filter(x => {
    if (x.type !== 'image' || x.ctaCode) return false;
    if (x.id === b.id) return true;
    const other = doc?.querySelector('[data-studio-block="' + x.id + '"]');
    return !!(box && other && box.contains(other));
  });
  const group = uid(),
    look = (await sampleCta(assets[b.asset]).catch(() => null)) || {};
  const text = (el?.getAttribute('alt') || '').trim() || (project.product === 'fiction' ? 'Continue Reading' : 'Try Now');
  snapshot();
  for (const x of members) {
    const own = (await sampleCta(assets[x.asset]).catch(() => null)) || look;
    x.ctaCode = {
      group,
      text,
      bg: look.bg || '#7b2ff2',
      bg2: look.bg || '#7b2ff2',
      color: look.color || '#ffffff',
      fontSize: 42,
      weight: 700,
      upper: text === text.toUpperCase() && /[A-Z]/.test(text),
      radius: 50,
      ratio: Math.round((own.ratio || look.ratio || 4) * 10) / 10,
      shadow: true
    };
  }
  changed();
  refresh();
  toast('Кнопку зроблено кодом. Зміни текст і колір праворуч.');
}
async function importPlayable(file, opts = {}) {
  try {
    toast(opts.template ? 'Відкриваю шаблон…' : 'Читаю плейбл…');
    const read = await readPlayable(file),
      meta = await extractEditMetadata(read.html);
    if (meta && meta.project.kind !== 'html') {
      const raw = normalizeProject(meta.project);
      const mapped = {};
      for (const [id, a] of Object.entries(meta.assets)) {
        const next = 'upload-' + uid();
        mapped[id] = next;
        assets[next] = { ...a, id: next, builtin: false };
      }
      for (const b of raw.blocks)
        for (const k of ['asset', 'assetL', 'afterAsset']) if (mapped[b[k]]) b[k] = mapped[b[k]];
      for (const k of ['fontAsset', 'bgAsset', 'bgAssetL'])
        if (mapped[raw.settings[k]]) raw.settings[k] = mapped[raw.settings[k]];
      raw.assetIds = Object.values(mapped);
      addImported(raw, read.name);
      useProject(raw);
      $('#projectDialog').close();
      toast('Плейбл відкрито з налаштуваннями конструктора.');
      return;
    }
    const parsed = importHTMLDocument(
        meta?.html || read.html,
        read.name,
        meta
          ? Object.fromEntries(Object.values(meta.assets).map(a => [a.data, a.name]))
          : read.assetNames || {}
      ),
      fromName = parseFileName(read.name),
      product =
        opts.template?.product ||
        fromName?.product ||
        (/(^|[_.])clr([_.]|$)/i.test(read.name) ? 'cleaner' : /(^|[_.])fcm([_.]|$)/i.test(read.name) ? 'fiction' : chooserProduct),
      p = createProject(product === 'fiction' ? 'panel' : 'poster');
    p.kind = 'html';
    p.template = opts.template ? opts.template.id : 'imported';
    p.name = opts.template ? opts.template.title : parsed.name;
    p.language = parsed.language || 'en';
    // Store links set in PB come back with the file (the export already has them in its code).
    for (const k of ['linkIos', 'linkAndroid']) if (typeof meta?.project?.[k] === 'string') p[k] = meta.project[k];
    p.sourceHTML = parsed.sourceHTML;
    p.blocks = parsed.blocks;
    const flat = t => String(t || '').replace(/\s+/g, ' ').trim();
    if (meta?.project.kind === 'html')
      for (const b of p.blocks) {
        const old =
          meta.project.blocks.find(x => x.node === b.node) ||
          // Text that lost its marker (older export): found by its words.
          (b.type === 'text' && !b.storyGroup && !b.textGroup
            ? meta.project.blocks.find(x => x.type === 'text' && !x.added && x.rich && flat(x.text) === flat(b.text))
            : null);
        if (old) {
          b.position = clone(old.position);
          b.translateBase = clone(old.translateBase || {});
          b.customStyle = clone(old.customStyle || { portrait: {}, landscape: {} });
          b.enabled = old.enabled !== false;
          b.label = old.label || b.label;
          // Everything else edited in PB: formatting, fonts, coded CTA.
          const rich = sanitizeRich(old.rich);
          if (rich && b.type === 'text') b.rich = rich;
          if (typeof old.font === 'string') b.font = old.font;
          if (old.fontAsset) b.fontAsset = reuseAsset(old.fontAsset);
          if (old.ctaCode && typeof old.ctaCode === 'object') b.ctaCode = clone(old.ctaCode);
          if (old.anchor && typeof old.anchor === 'object') b.anchor = clone(old.anchor);
          if (old.hide && typeof old.hide === 'object') b.hide = clone(old.hide);
        }
      }
    // Elements added in PB (pictures, texts), with their place and anchor.
    if (meta?.project.kind === 'html')
      for (const old of meta.project.blocks.filter(x => x.added && ['text', 'image'].includes(x.type))) {
        const b = clone(old);
        b.id = crypto.randomUUID();
        if (b.asset) b.asset = reuseAsset(b.asset);
        if (b.fontAsset) b.fontAsset = reuseAsset(b.fontAsset);
        const rich = sanitizeRich(old.rich);
        if (rich) b.rich = rich;
        else delete b.rich;
        p.blocks.push(b);
      }
    function reuseAsset(oldId) {
      const data = meta.assets?.[oldId]?.data;
      if (!data) return '';
      const same = Object.values(parsed.assets).find(a => a.data === data);
      if (same) return same.id;
      const id = 'upload-' + uid();
      parsed.assets[id] = { ...meta.assets[oldId], id, builtin: false };
      return id;
    }
    p.assetIds = Object.keys(parsed.assets);
    p.settings.hand = false;
    p.settings.fontAsset = '';
    p.settings.bgAsset = '';
    p.settings.bgAssetL = '';
    p.settings.motion = parsed.motion;
    Object.assign(assets, parsed.assets);
    prepareEditorProject(p);
    if (opts.template) {
      addAsNewSet(p);
      if (fromName) p.naming.code = fromName.naming.code;
    } else addImported(p, read.name);
    useProject(p);
    $('#projectDialog').close();
    toast(
      opts.template
        ? `Шаблон ${opts.template.reference} відкрито. Новий креатив ${p.naming.number}.`
        : 'Плейбл відкрито. Обери текст або картинку для редагування.'
    );
  } catch (e) {
    toast('Не вдалося імпортувати: ' + e.message);
  }
}

function captureTranslate(b) {
  b.translateBase ??= {};
  if (b.translateBase[orientation]) return;
  const el = $('#preview').contentDocument?.querySelector('[data-studio-block="' + b.id + '"]');
  if (!el) return;
  const c = el.ownerDocument.defaultView.getComputedStyle(el),
    xy = splitTranslate(c.translate);
  b.translateBase[orientation] = {
    x: validTranslate(c.getPropertyValue('--studio-base-x').trim() || xy[0]),
    y: validTranslate(c.getPropertyValue('--studio-base-y').trim() || xy[1])
  };
}
