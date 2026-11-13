/** The recordings made in the studio live in the phone (IndexedDB), one mp3 for each id: nothing leaves the phone unless a parent exports them. */
const DB = 'rani-english-voice';
const STORE = 'clips';

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function run<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const req = f(db.transaction(STORE, mode).objectStore(STORE));
          req.onsuccess = () => (resolve(req.result), db.close());
          req.onerror = () => (resolve(undefined), db.close());
        } catch {
          resolve(undefined);
        }
      }),
  );
}

export const putClip = (id: string, blob: Blob): Promise<unknown> => run('readwrite', (s) => s.put(blob, id));
export const deleteClip = (id: string): Promise<unknown> => run('readwrite', (s) => s.delete(id));
export const getClip = (id: string): Promise<Blob | undefined> => run<Blob>('readonly', (s) => s.get(id) as IDBRequest<Blob>);
export const clipIds = async (): Promise<string[]> => ((await run<IDBValidKey[]>('readonly', (s) => s.getAllKeys())) ?? []).map(String);
