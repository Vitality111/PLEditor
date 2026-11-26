// Only assets belonging to the selected template or this project's uploads.
const scopes = {
  cover: 'fcm-cover/',
  sticky: 'fcm-cover/',
  panel: 'fcm-panel/',
  shrink: 'fcm-shrink/',
  banner: 'cleaner-banner/',
  titlecover: 'fcm-',
  niche: 'fcm-',
  infocard: 'fcm-',
  page: 'fcm-',
  panel2: 'fcm-',
  textbanner: 'cleaner',
  steps: 'cleaner',
  bubble: 'cleaner',
  aichat: 'cleaner',
  alertphoto: 'cleaner',
  mockup: 'cleaner',
  compare: 'cleaner',
  alert: 'cleaner-alert/',
  poster: 'cleaner/',
  checklist: 'cleaner/',
  comparison: 'cleaner-compare/'
};
export function projectAssetIds(project) {
  const ids = new Set(project.assetIds || []);
  for (const b of project.blocks || [])
    for (const k of ['asset', 'assetL', 'afterAsset']) if (b[k]) ids.add(b[k]);
  for (const k of ['bgAsset', 'bgAssetL', 'fontAsset'])
    if (project.settings?.[k]) ids.add(project.settings[k]);
  return ids;
}
export function scopedAssets(project, assets, type) {
  const ids = projectAssetIds(project),
    prefix = scopes[project.template];
  return Object.values(assets).filter(
    a => (!type || a.type === type) && (ids.has(a.id) || (a.builtin && prefix && a.id.startsWith(prefix)))
  );
}
export function slotAssets(project, assets, path, type, current) {
  const list = scopedAssets(project, assets, type);
  // A slot displays its own default(s), not every unrelated image in the template.
  const role = path.startsWith('settings.bg')
    ? 'background'
    : path === 'settings.fontAsset'
      ? 'font'
      : project.blocks.find(b => b.id === project.selectedBlock)?.type;
  return list.filter(a => {
    if (a.id === current || !a.builtin || type !== 'image') return true;
    const name = a.name.toLowerCase();
    if (role === 'background') return /^bg(?:l|\d*)?\./.test(name);
    if (role === 'hero') return /^(cpl|hero|mcp)(?:l)?\./.test(name);
    if (role === 'cta') return /^cta(?:l)?\./.test(name);
    if (role === 'logo') return /^(brand|logo)(?:l)?\./.test(name);
    if (role === 'rating') return /^(rating|rate)(?:l)?\./.test(name);
    return true;
  });
}
