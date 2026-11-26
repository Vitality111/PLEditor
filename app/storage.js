// PB keeps only ONE thing: the last creative (its variations and the files it uses) in this browser,
// so a reload or a closed tab does not lose the work. Opening another creative replaces it.
// Nothing goes to a server; earlier versions' browser copy («playable-studio-v1») is removed.
const DB = 'pb-last-v1',
  STORE = 'last',
  KEY = 'creative';

export function forgetBrowserCopies() {
  try {
    indexedDB.deleteDatabase('playable-studio-v1');
  } catch {}
}

function open() {
  return new Promise((resolve, reject) => {
    const q = indexedDB.open(DB, 1);
    q.onupgradeneeded = () => q.result.createObjectStore(STORE);
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
    q.onblocked = () => reject(Error('blocked'));
  });
}
function run(mode, fn) {
  return open().then(
    db =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode),
          req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => (db.close(), resolve(req?.result));
        tx.onerror = tx.onabort = () => (db.close(), reject(tx.error));
      })
  );
}
// record: { version, savedAt, currentId, projects, assets }
export const saveLast = record => run('readwrite', s => s.put(record, KEY));
export const loadLast = () => run('readonly', s => s.get(KEY)).catch(() => null);
export const clearLast = () => run('readwrite', s => s.delete(KEY)).catch(() => {});
