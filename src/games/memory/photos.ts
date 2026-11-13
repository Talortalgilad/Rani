import { FAMILY_MAX } from './decks/free';

/**
 * The family photos (SPEC-memory.md section 4): each one is cut to a square in the middle, made 256 x 256 and kept in IndexedDB on the
 * phone, and nowhere else. Nothing is uploaded. They are shown through object URLs (blob:), so no network is involved.
 */
const DB = 'rani-memory-family';
const STORE = 'photos';
export const PHOTO_SIZE = 256;

export interface Photo { id: string; blob: Blob; at: number }

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
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

/** The photos, in the order they were added. */
export async function listPhotos(): Promise<Photo[]> {
  const all = (await run<Photo[]>('readonly', (s) => s.getAll())) ?? [];
  return all.sort((a, b) => a.at - b.at);
}
export const countPhotos = async (): Promise<number> => (await run<number>('readonly', (s) => s.count())) ?? 0;
export const deletePhoto = (id: string): Promise<unknown> => run('readwrite', (s) => s.delete(id));
export const clearPhotos = (): Promise<unknown> => run('readwrite', (s) => s.clear());

/** The square that is cut from the middle of a picture of w x h: its corner and side. */
export function centerSquare(w: number, h: number): { x: number; y: number; side: number } {
  const side = Math.min(w, h);
  return { x: Math.floor((w - side) / 2), y: Math.floor((h - side) / 2), side };
}

/** A picture file as a 256 x 256 square (a jpeg blob). Null when the file is not a picture the browser can read. */
export async function squareBlob(file: Blob): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(file);
    const { x, y, side } = centerSquare(bmp.width, bmp.height);
    const c = document.createElement('canvas');
    c.width = c.height = PHOTO_SIZE;
    const g = c.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    g.drawImage(bmp, x, y, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
    bmp.close?.();
    return await new Promise<Blob | null>((res) => c.toBlob((b) => res(b), 'image/jpeg', 0.86));
  } catch {
    return null;
  }
}

export interface AddResult { added: number; skipped: number; full: boolean }
/** Adds the chosen pictures (up to 15 in all): the ones that cannot be read or do not fit are counted as skipped. */
export async function addPhotos(files: File[]): Promise<AddResult> {
  let have = await countPhotos();
  let added = 0;
  let skipped = 0;
  for (const f of files) {
    if (have >= FAMILY_MAX) {
      skipped++;
      continue;
    }
    const blob = await squareBlob(f);
    if (!blob) {
      skipped++;
      continue;
    }
    const at = Date.now() + added;
    await run('readwrite', (s) => s.put({ id: `p${at}${Math.floor(Math.random() * 1e4)}`, blob, at } satisfies Photo));
    have++;
    added++;
  }
  return { added, skipped, full: have >= FAMILY_MAX };
}

/** Object URLs for the photos (keys "fam:<id>"). The caller revokes them when the round is over. */
export async function photoUrls(): Promise<{ ids: string[]; urls: Map<string, string> }> {
  const ph = await listPhotos();
  const urls = new Map<string, string>();
  for (const p of ph) urls.set(`fam:${p.id}`, URL.createObjectURL(p.blob));
  return { ids: ph.map((p) => p.id), urls };
}
export const revokeUrls = (urls: Map<string, string>): void => urls.forEach((u) => URL.revokeObjectURL(u));
