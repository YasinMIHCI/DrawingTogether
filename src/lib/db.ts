/** Petit stockage clé → valeur dans IndexedDB (les dessins sont trop gros pour localStorage). */
const DB_NAME = 'drawingtogether';
const STORE = 'kv';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result as T);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/** Lecture tolérante : renvoie undefined si IndexedDB est indisponible (navigation privée…). */
export async function dbGet<T>(key: string): Promise<T | undefined> {
  try {
    return await run<T>('readonly', (s) => s.get(key));
  } catch {
    return undefined;
  }
}

export async function dbSet(key: string, value: unknown): Promise<boolean> {
  try {
    await run('readwrite', (s) => s.put(value, key));
    return true;
  } catch {
    return false;
  }
}

export async function dbDelete(key: string): Promise<void> {
  try {
    await run('readwrite', (s) => s.delete(key));
  } catch {
    /* rien à faire */
  }
}
