// Shared by the editor and standalone preview; export embeds the same files.
export function hintAssetIds(project) {
  return project.product === 'fiction' && project.settings.hand
    ? ['fcm-cover/hand.png', 'fcm-cover/handL.png']
    : [];
}
