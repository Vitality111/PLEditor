export function createAssetLoader(fetchFile = fetch) {
  const pending = new Map();
  async function load(asset) {
    if (!asset) throw new Error('Асета немає у проєкті.');
    if (asset.data) return { ...asset, url: undefined };
    const url = new URL(asset.url, location.href).href;
    if (!pending.has(url))
      pending.set(
        url,
        (async () => {
          const abort = new AbortController(),
            timer = setTimeout(() => abort.abort(), 15000);
          let response;
          try {
            response = await fetchFile(url, { credentials: 'same-origin', signal: abort.signal });
          } catch (error) {
            if (error.name === 'AbortError')
              throw new Error('Перевищено час завантаження ' + asset.name + '. Спробуй ще раз.');
            throw error;
          } finally {
            clearTimeout(timer);
          }
          if (!response.ok) throw new Error(`Не вдалося завантажити ${asset.name} (${response.status}).`);
          const blob = await response.blob();
          if (blob.type.includes('text/html'))
            throw new Error(`Немає доступу до ${asset.name}. Перезавантаж сторінку.`);
          const data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          });
          return data;
        })().catch(error => {
          pending.delete(url);
          throw error;
        })
      );
    return { ...asset, data: await pending.get(url), url: undefined };
  }
  return { load };
}
