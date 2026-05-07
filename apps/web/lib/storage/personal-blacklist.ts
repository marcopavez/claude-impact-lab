"use client";

// Wrapper minimalista sobre IndexedDB para la blacklist personal del usuario.
//
// Decisiones:
//   - Sin librerías externas (idb, dexie). API nativa de IndexedDB.
//   - Client-only: en SSR todas las funciones resuelven inmediatamente con
//     valores neutros para no romper hidratación.
//   - Eventos: tras add/remove disparamos un CustomEvent en window para que
//     componentes suscritos refresquen sin polling.
//   - Sin migraciones: VERSION=1 en MVP. Cambios de schema = bump de versión
//     + lógica en onupgradeneeded.

const DB_NAME = "vigia-personal";
const STORE = "blacklist";
const VERSION = 1;
export const PERSONAL_BLACKLIST_EVENT = "vigia:personal-blacklist-changed";

export type PersonalBlacklistEntry = {
  caller_id_e164: string;
  reason: string;
  /** ISO string. */
  added_at: string;
  source_audio_id?: string;
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "caller_id_e164" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

function dispatchChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PERSONAL_BLACKLIST_EVENT));
}

export async function addToPersonalBlacklist(
  entry: PersonalBlacklistEntry,
): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.put(entry);
    req.onsuccess = () => resolve();
    req.onerror = () =>
      reject(req.error ?? new Error("IndexedDB put failed"));
  });
  db.close();
  dispatchChanged();
}

export async function removeFromPersonalBlacklist(
  callerId: string,
): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.delete(callerId);
    req.onsuccess = () => resolve();
    req.onerror = () =>
      reject(req.error ?? new Error("IndexedDB delete failed"));
  });
  db.close();
  dispatchChanged();
}

export async function isInPersonalBlacklist(
  callerId: string,
): Promise<boolean> {
  if (!isBrowser()) return false;
  const db = await openDb();
  const result = await new Promise<boolean>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.get(callerId);
    req.onsuccess = () => resolve(req.result !== undefined);
    req.onerror = () =>
      reject(req.error ?? new Error("IndexedDB get failed"));
  });
  db.close();
  return result;
}

export async function listPersonalBlacklist(): Promise<
  PersonalBlacklistEntry[]
> {
  if (!isBrowser()) return [];
  const db = await openDb();
  const result = await new Promise<PersonalBlacklistEntry[]>(
    (resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = () =>
        resolve((req.result ?? []) as PersonalBlacklistEntry[]);
      req.onerror = () =>
        reject(req.error ?? new Error("IndexedDB getAll failed"));
    },
  );
  db.close();
  return result;
}
