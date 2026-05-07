"use client";

// Historial client-side de análisis recientes (IndexedDB).
//
// Mismo patrón que personal-blacklist.ts pero en una DB separada (vigia-history).
// La separación evita coordinar VERSION/onupgradeneeded entre los dos stores; el
// costo de tener 2 DBs IndexedDB es cero.
//
// Cap a MAX_ENTRIES = 10: cuando se inserta el undécimo, droppeamos el más viejo.
// Esto mantiene la lista corta para el cuidador (10 últimos análisis es lo que
// recuerda mentalmente) y evita crecer indefinido el storage en sesiones largas.
//
// Schema deliberadamente mínimo: NO guardamos transcript ni rationale ni patrones.
// Solo metadata para que el cuidador reconozca "este número ya lo vimos sospechoso
// hace 2 días". Si quiere ver el análisis completo, debe re-analizar el audio.
// Esto mantiene N20 (cero PII en reposo) intacto: en IndexedDB queda caller_id +
// verdict, pero NUNCA contenido de la llamada.

const DB_NAME = "vigia-history";
const STORE = "history";
const VERSION = 1;
export const HISTORY_EVENT = "vigia:history-changed";
export const MAX_HISTORY_ENTRIES = 10;

/** Verdict consolidado para mostrar en la lista. Cubre cascada + early-exit. */
export type HistoryVerdict =
  | "fraud"
  | "suspicious"
  | "legit"
  | "unknown"
  | "blacklist_match"
  | "whitelist_pass"
  | "whitelist_verify"
  | "whitelist_message";

export type HistorySeverity = "HIGH" | "MEDIUM" | "LOW";

export type HistoryEntry = {
  /** UUID v4 del response. Primary key — no debería repetirse. */
  audio_id: string;
  /** Echo del caller_id que mandó el form (puede ser el sentinel +56000000000). */
  caller_id_e164: string;
  /** Verdict consolidado. */
  verdict: HistoryVerdict;
  severity: HistorySeverity;
  /** Headline del Notifier o fallback determinista. ≤80 chars. */
  headline: string;
  /** ISO string del momento del análisis. */
  created_at: string;
  /** True si la cascada se cortó en el firewall (sin tocar STT/Claude). */
  was_early_exit: boolean;
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
        db.createObjectStore(STORE, { keyPath: "audio_id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

function dispatchChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HISTORY_EVENT));
}

/**
 * Inserta una entrada y trimmea a MAX_HISTORY_ENTRIES manteniendo las más
 * recientes. Toda la operación corre en una sola transacción readwrite para
 * evitar races (dos análisis seguidos podrían exceder el cap si las
 * inserciones se entrelazan).
 */
export async function addToHistory(entry: HistoryEntry): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);

    const putReq = store.put(entry);
    putReq.onerror = () =>
      reject(putReq.error ?? new Error("IndexedDB put failed"));

    putReq.onsuccess = () => {
      const allReq = store.getAll();
      allReq.onerror = () =>
        reject(allReq.error ?? new Error("IndexedDB getAll failed"));
      allReq.onsuccess = () => {
        const all = (allReq.result ?? []) as HistoryEntry[];
        if (all.length <= MAX_HISTORY_ENTRIES) {
          // tx commit automático.
          return;
        }
        // Sort asc por created_at para identificar las más viejas a eliminar.
        all.sort((a, b) => a.created_at.localeCompare(b.created_at));
        const toDrop = all.slice(0, all.length - MAX_HISTORY_ENTRIES);
        for (const old of toDrop) {
          store.delete(old.audio_id);
        }
      };
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () =>
      reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
  db.close();
  dispatchChanged();
}

/**
 * Devuelve el historial ordenado descendente por created_at (más reciente
 * primero). Se cap defensivamente en MAX_HISTORY_ENTRIES por si quedó algún
 * residuo de versiones previas o de un crash entre el put y el trim.
 */
export async function listHistory(): Promise<HistoryEntry[]> {
  if (!isBrowser()) return [];
  const db = await openDb();
  const all = await new Promise<HistoryEntry[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result ?? []) as HistoryEntry[]);
    req.onerror = () =>
      reject(req.error ?? new Error("IndexedDB getAll failed"));
  });
  db.close();
  all.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return all.slice(0, MAX_HISTORY_ENTRIES);
}

/** Borra todo el historial. Útil si el cuidador quiere demo limpio. */
export async function clearHistory(): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () =>
      reject(req.error ?? new Error("IndexedDB clear failed"));
  });
  db.close();
  dispatchChanged();
}

/** Borra una entrada específica por audio_id. */
export async function removeHistoryEntry(audioId: string): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.delete(audioId);
    req.onsuccess = () => resolve();
    req.onerror = () =>
      reject(req.error ?? new Error("IndexedDB delete failed"));
  });
  db.close();
  dispatchChanged();
}
