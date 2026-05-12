'use client';

import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import type { Table } from 'dexie';
import { getDb } from '@/lib/db';
import { db as firestoreDb } from '@/lib/firebase';

type SyncCollection = 'tabs' | 'windows' | 'entries' | 'persons' | 'personEntries' | 'vault';

const HYDRATION_INTERVAL_MS = 10 * 60 * 1000;
const SYNC_COLLECTIONS: SyncCollection[] = [
  'tabs',
  'windows',
  'entries',
  'persons',
  'personEntries',
  'vault',
];

const REALTIME_COLLECTIONS: SyncCollection[] = SYNC_COLLECTIONS;

const hydrationKey = (userId: string) => 'ml_hydrated_' + userId;

let isProcessing = false;
const recentLocalSyncIds = new Map<string, number>();
const RECENT_LOCAL_SYNC_TTL_MS = 30_000;


function syncDocumentKey(collectionName: SyncCollection, documentId: string): string {
  return `${collectionName}:${documentId}`;
}

function rememberLocalSync(collectionName: SyncCollection, documentId: string): void {
  recentLocalSyncIds.set(syncDocumentKey(collectionName, documentId), Date.now());
}

function isRecentLocalSync(collectionName: SyncCollection, documentId: string): boolean {
  const now = Date.now();
  for (const [key, createdAt] of recentLocalSyncIds) {
    if (now - createdAt > RECENT_LOCAL_SYNC_TTL_MS) {
      recentLocalSyncIds.delete(key);
    }
  }

  return recentLocalSyncIds.has(syncDocumentKey(collectionName, documentId));
}

function notifyRemoteSync(collectionName: SyncCollection): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('money-ledger-remote-sync', { detail: { collection: collectionName } })
  );
}

/**
 * Recursively convert Date objects (and date-like ISO strings) to Firestore Timestamps.
 * This handles the case where IndexedDB serializes nested Dates back as strings.
 */
function toFirestore(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Date) {
      result[key] = Timestamp.fromDate(value);
    } else if (typeof value === 'string' && isIsoDateString(value)) {
      // IndexedDB may have serialised Date to ISO string inside nested 'data'
      result[key] = Timestamp.fromDate(new Date(value));
    } else if (value === undefined) {
      result[key] = deleteField();
    } else {
      result[key] = value;
    }
  }

  return result;
}

/** Check if a string looks like an ISO-8601 date */
function isIsoDateString(s: string): boolean {
  // Match: 2026-05-11T06:30:00.000Z  or  2026-05-11T12:06:43+05:30
  if (s.length < 20 || s.length > 35) return false;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s);
}

function fromFirestore(data: Record<string, unknown>, id: string): Record<string, unknown> {
  const converted: Record<string, unknown> = { ...data, id };

  for (const [key, value] of Object.entries(converted)) {
    if (value instanceof Timestamp) {
      converted[key] = value.toDate();
    }
  }

  return converted;
}

export async function queueSync(
  collectionName: SyncCollection,
  operation: 'upsert' | 'delete',
  documentId: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (typeof window === 'undefined') return;

  const db = getDb();
  await db.syncQueue.add({
    collection: collectionName,
    operation,
    documentId,
    data,
    createdAt: Date.now(),
    retries: 0,
  });

  if (navigator.onLine) {
    processSyncQueue().catch(() => undefined);
  }
}

export async function processSyncQueue(): Promise<void> {
  if (typeof window === 'undefined' || !navigator.onLine) return;
  if (isProcessing) return;

  isProcessing = true;
  try {
    const db = getDb();
    const items = await db.syncQueue.orderBy('createdAt').limit(100).toArray();
    if (items.length === 0) return;

    for (const item of items) {
      if (item.id === undefined) continue;

      try {
        if (item.operation === 'upsert' && item.data) {
          await setDoc(doc(firestoreDb, item.collection, item.documentId), toFirestore(item.data), {
            merge: true,
          });
        } else if (item.operation === 'delete') {
          await deleteDoc(doc(firestoreDb, item.collection, item.documentId));
        }

        rememberLocalSync(item.collection, item.documentId);
        await db.syncQueue.delete(item.id);
      } catch (err) {
        console.warn(`Sync failed for ${item.collection}/${item.documentId}:`, err);
        const retries = item.retries + 1;

        if (retries >= 5) {
          rememberLocalSync(item.collection, item.documentId);
        await db.syncQueue.delete(item.id);
        } else {
          await db.syncQueue.update(item.id, { retries });
        }
      }
    }
  } finally {
    isProcessing = false;
  }
}

/**
 * Pull Firestore data only when local data is missing or stale.
 * Dexie remains the primary source of truth for normal app opens.
 */
export async function hydrateFromFirestore(userId: string): Promise<void> {
  if (typeof window === 'undefined') return;

  const lastHydration = localStorage.getItem(hydrationKey(userId));
  const now = Date.now();

  if (lastHydration && now - Number.parseInt(lastHydration, 10) < HYDRATION_INTERVAL_MS) {
    return;
  }

  const db = getDb();
  const localCount = await db.tabs.where('userId').equals(userId).count();

  if (localCount === 0) {
    await fullHydrateFromFirestore(userId);
  } else if (navigator.onLine) {
    deltaHydrateFromFirestore(userId).catch(() => undefined);
  }

  localStorage.setItem(hydrationKey(userId), String(now));
}

async function fullHydrateFromFirestore(userId: string): Promise<void> {
  const db = getDb();

  await Promise.allSettled(
    SYNC_COLLECTIONS.map(async (collectionName) => {
      try {
        const q = query(collection(firestoreDb, collectionName), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return;

        const records = snapshot.docs.map((snapshotDoc) =>
          fromFirestore(snapshotDoc.data(), snapshotDoc.id)
        );
        const table = db.table(collectionName) as Table<Record<string, unknown>, string>;
        await table.bulkPut(records);
      } catch (err) {
        console.warn(`Hydration failed for ${collectionName}:`, err);
      }
    })
  );
}

async function deltaHydrateFromFirestore(userId: string): Promise<void> {
  const db = getDb();
  const since = Timestamp.fromDate(new Date(Date.now() - HYDRATION_INTERVAL_MS));

  await Promise.allSettled(
    SYNC_COLLECTIONS.map(async (collectionName) => {
      try {
        const q = query(
          collection(firestoreDb, collectionName),
          where('userId', '==', userId),
          where('updatedAt', '>=', since)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return;

        const records = snapshot.docs.map((snapshotDoc) =>
          fromFirestore(snapshotDoc.data(), snapshotDoc.id)
        );
        const table = db.table(collectionName) as Table<Record<string, unknown>, string>;
        await table.bulkPut(records);
      } catch {
        // Local data is still valid if a delta sync fails.
      }
    })
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// REAL-TIME SYNC â€” Firestore onSnapshot listeners so other devices see changes
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type Unsubscribe = () => void;

let activeListeners: Unsubscribe[] = [];

/**
 * Start real-time Firestore listeners for all collections.
 * When another device writes to Firestore, these listeners update Dexie,
 * and the store re-initialises so the UI reflects the change.
 */
export function startRealtimeSync(userId: string): () => void {
  // Tear down any previous listeners first
  stopRealtimeSync();

  if (typeof window === 'undefined') return () => undefined;

  const db = getDb();
  const collections = REALTIME_COLLECTIONS;

  // Debounce store refresh â€” multiple snapshots fire close together
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleStoreRefresh = () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
      try {
        // Dynamic import to avoid circular dependency
        const { useStore } = await import('@/store/useStore');
        const state = useStore.getState();
        if (state.userId) {
          await state.init(state.userId);
        }
      } catch {
        // Store not ready yet â€” ignore
      }
    }, 500);
  };

  for (const collectionName of collections) {
    try {
      const q = query(collection(firestoreDb, collectionName), where('userId', '==', userId));

      const unsub = onSnapshot(
        q,
        { includeMetadataChanges: true },
        async (snapshot) => {
          const hasServerChanges = snapshot.docChanges().some(
            (change) => !change.doc.metadata.hasPendingWrites
          );
          if (!hasServerChanges) return;

          const queuedIds = new Set(
            (await db.syncQueue.toArray()).map((item) => item.documentId)
          );

          const genuinelyRemoteChanges = snapshot.docChanges().filter(
            (change) =>
              !queuedIds.has(change.doc.id) &&
              !isRecentLocalSync(collectionName, change.doc.id) &&
              !change.doc.metadata.hasPendingWrites
          );

          if (genuinelyRemoteChanges.length === 0) return;

          const table = db.table(collectionName) as Table<Record<string, unknown>, string>;

          for (const change of genuinelyRemoteChanges) {
            if (change.type === 'removed') {
              await table.delete(change.doc.id).catch(() => undefined);
            } else {
              await table
                .put(fromFirestore(change.doc.data(), change.doc.id))
                .catch(() => undefined);
            }
          }

          notifyRemoteSync(collectionName);
          scheduleStoreRefresh();
        },
        (error) => {
          console.warn(`Realtime listener error for ${collectionName}:`, error);
        }
      );

      activeListeners.push(unsub);
    } catch (err) {
      console.warn(`Failed to start listener for ${collectionName}:`, err);
    }
  }

  return () => stopRealtimeSync();
}

/** Tear down all active Firestore listeners. */
export function stopRealtimeSync(): void {
  for (const unsub of activeListeners) {
    try {
      unsub();
    } catch {
      // already cleaned up
    }
  }
  activeListeners = [];
}

/**
 * Setup online/offline event listener to flush sync queue.
 */
export function setupSyncListener(): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const handleOnline = () => {
    processSyncQueue().catch(() => undefined);
  };

  window.addEventListener('online', handleOnline);

  if (navigator.onLine) {
    handleOnline();
  }

  return () => window.removeEventListener('online', handleOnline);
}

export async function clearLocalData(): Promise<void> {
  const db = getDb();
  await Promise.all([
    db.tabs.clear(),
    db.windows.clear(),
    db.entries.clear(),
    db.persons.clear(),
    db.personEntries.clear(),
    db.vault.clear(),
    db.syncQueue.clear(),
  ]);
}
