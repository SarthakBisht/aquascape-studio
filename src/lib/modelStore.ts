"use client";

// Single base-rock-model store. A .glb is multi-MB — too big for the zustand
// localStorage persist (it would blow the ~5 MB quota and silently drop the
// whole scape snapshot). IndexedDB is the native home for large binary blobs.
// ponytail: one model, one IDB key. Per-piece model library = future.

const DB = "aquascape-studio";
const STORE = "models";
const KEY = "baseRock";

function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    };
  });
}

export async function putBaseModel(blob: Blob): Promise<void> {
  await withStore("readwrite", (s) => s.put(blob, KEY));
}

export function getBaseModel(): Promise<Blob | null> {
  return withStore<Blob | undefined>("readonly", (s) => s.get(KEY)).then(
    (b) => b ?? null,
  );
}

export async function clearBaseModel(): Promise<void> {
  await withStore("readwrite", (s) => s.delete(KEY));
}
