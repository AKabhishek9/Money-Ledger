import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Tab, MoneyWindow, Entry, Person, PersonEntry, VaultItem } from '@/lib/types';
import { getMonthWindowTitle, getMonthKey } from '@/lib/utils';

// ─── Helpers ────────────────────────────────────────────────────────────────

const toDate = (v: unknown): Date =>
  v instanceof Timestamp ? v.toDate() : v instanceof Date ? v : new Date();

const withTimeout = <T>(p: Promise<T>, ms = 10000): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error('Request timed out. Check your connection.')), ms)
    ),
  ]);

// ─── USER INITIALIZATION ─────────────────────────────────────────────────────

/**
 * Called on first login. Creates system tabs + current month window.
 */
export async function initializeUserData(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const snap = await withTimeout(getDoc(userRef));
  if (snap.exists()) return; // already initialized

  const batch = writeBatch(db);

  // User document
  batch.set(userRef, {
    uid: userId,
    createdAt: serverTimestamp(),
  });

  // System tabs
  const systemTabs = [
    { name: 'Personal', type: 'personal', icon: '📓', order: 0, isSystem: true },
    { name: 'People', type: 'people', icon: '👥', order: 1, isSystem: true },
    { name: 'Vault', type: 'vault', icon: '🔐', order: 2, isSystem: true },
  ];

  const tabIds: Record<string, string> = {};
  for (const tab of systemTabs) {
    const tabRef = doc(collection(db, 'tabs'));
    tabIds[tab.type] = tabRef.id;
    batch.set(tabRef, {
      ...tab,
      userId,
      pinned: false,
      archived: false,
      createdAt: serverTimestamp(),
    });
  }

  // Auto-create current month window for Personal tab
  const monthWindowRef = doc(collection(db, 'windows'));
  batch.set(monthWindowRef, {
    userId,
    tabId: tabIds['personal'],
    title: getMonthWindowTitle(),
    monthKey: getMonthKey(),
    order: 0,
    pinned: true,
    archived: false,
    inRecycleBin: false,
    autoMonthly: true,
    createdAt: serverTimestamp(),
  });

  await withTimeout(batch.commit());
}

// ─── TABS ────────────────────────────────────────────────────────────────────

export async function getTabs(userId: string): Promise<Tab[]> {
  const q = query(
    collection(db, 'tabs'),
    where('userId', '==', userId),
    orderBy('order', 'asc')
  );
  const snap = await withTimeout(getDocs(q));
  return snap.docs.map((d) => ({
    ...d.data(),
    id: d.id,
    createdAt: toDate(d.data().createdAt),
  })) as Tab[];
}

export async function addTab(
  userId: string,
  data: { name: string; icon: string }
): Promise<string> {
  const existing = await getTabs(userId);
  const order = existing.length;
  const ref = doc(collection(db, 'tabs'));
  await withTimeout(
    setDoc(ref, {
      ...data,
      userId,
      type: 'custom',
      order,
      pinned: false,
      archived: false,
      isSystem: false,
      createdAt: serverTimestamp(),
    })
  );
  return ref.id;
}

export async function updateTab(id: string, data: Partial<Tab>): Promise<void> {
  await withTimeout(updateDoc(doc(db, 'tabs', id), { ...data }));
}

export async function deleteTab(id: string): Promise<void> {
  // Delete all windows and entries in this tab
  const windowsSnap = await getDocs(query(collection(db, 'windows'), where('tabId', '==', id)));
  const batch = writeBatch(db);

  for (const w of windowsSnap.docs) {
    const entriesSnap = await getDocs(
      query(collection(db, 'entries'), where('windowId', '==', w.id))
    );
    entriesSnap.docs.forEach((e) => batch.delete(e.ref));
    batch.delete(w.ref);
  }

  batch.delete(doc(db, 'tabs', id));
  await withTimeout(batch.commit());
}

// ─── WINDOWS ─────────────────────────────────────────────────────────────────

export async function getWindows(userId: string, tabId: string): Promise<MoneyWindow[]> {
  const q = query(
    collection(db, 'windows'),
    where('userId', '==', userId),
    where('tabId', '==', tabId),
    where('archived', '==', false),
    where('inRecycleBin', '==', false),
    orderBy('pinned', 'desc'),
    orderBy('order', 'asc')
  );
  const snap = await withTimeout(getDocs(q));
  return snap.docs.map((d) => ({
    ...d.data(),
    id: d.id,
    createdAt: toDate(d.data().createdAt),
  })) as MoneyWindow[];
}

export async function getArchivedWindows(userId: string, tabId: string): Promise<MoneyWindow[]> {
  const q = query(
    collection(db, 'windows'),
    where('userId', '==', userId),
    where('tabId', '==', tabId),
    where('archived', '==', true)
  );
  const snap = await withTimeout(getDocs(q));
  return snap.docs.map((d) => ({
    ...d.data(),
    id: d.id,
    createdAt: toDate(d.data().createdAt),
  })) as MoneyWindow[];
}

export async function getRecycleBinWindows(userId: string): Promise<MoneyWindow[]> {
  const q = query(
    collection(db, 'windows'),
    where('userId', '==', userId),
    where('inRecycleBin', '==', true)
  );
  const snap = await withTimeout(getDocs(q));
  return snap.docs.map((d) => ({
    ...d.data(),
    id: d.id,
    createdAt: toDate(d.data().createdAt),
  })) as MoneyWindow[];
}

export async function addWindow(
  userId: string,
  tabId: string,
  title: string
): Promise<string> {
  const existing = await getWindows(userId, tabId);
  const order = existing.length;
  const ref = doc(collection(db, 'windows'));
  await withTimeout(
    setDoc(ref, {
      userId,
      tabId,
      title,
      order,
      pinned: false,
      archived: false,
      inRecycleBin: false,
      autoMonthly: false,
      createdAt: serverTimestamp(),
    })
  );
  return ref.id;
}

export async function updateWindow(id: string, data: Partial<MoneyWindow>): Promise<void> {
  await withTimeout(updateDoc(doc(db, 'windows', id), { ...data }));
}

/** Move to recycle bin (soft delete) */
export async function softDeleteWindow(id: string): Promise<void> {
  await withTimeout(updateDoc(doc(db, 'windows', id), { inRecycleBin: true }));
}

/** Restore from recycle bin */
export async function restoreWindow(id: string): Promise<void> {
  await withTimeout(updateDoc(doc(db, 'windows', id), { inRecycleBin: false }));
}

/** Permanently delete window and all its entries */
export async function deleteWindowPermanently(id: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'windows', id));
  const snap = await getDocs(query(collection(db, 'entries'), where('windowId', '==', id)));
  snap.docs.forEach((d) => batch.delete(d.ref));
  await withTimeout(batch.commit());
}

/**
 * Ensure current month window exists in Personal tab.
 * Returns the window id.
 */
export async function ensureMonthWindow(userId: string, personalTabId: string): Promise<string> {
  const key = getMonthKey();
  const q = query(
    collection(db, 'windows'),
    where('userId', '==', userId),
    where('tabId', '==', personalTabId),
    where('monthKey', '==', key)
  );
  const snap = await withTimeout(getDocs(q));
  if (!snap.empty) return snap.docs[0].id;

  // Create it
  const ref = doc(collection(db, 'windows'));
  await withTimeout(
    setDoc(ref, {
      userId,
      tabId: personalTabId,
      title: getMonthWindowTitle(),
      monthKey: key,
      order: 0,
      pinned: true,
      archived: false,
      inRecycleBin: false,
      autoMonthly: true,
      createdAt: serverTimestamp(),
    })
  );
  return ref.id;
}

// ─── ENTRIES ─────────────────────────────────────────────────────────────────

export async function getEntries(userId: string, windowId: string): Promise<Entry[]> {
  const q = query(
    collection(db, 'entries'),
    where('userId', '==', userId),
    where('windowId', '==', windowId),
    orderBy('entryDate', 'desc')
  );
  const snap = await withTimeout(getDocs(q));
  return snap.docs.map((d) => ({
    ...d.data(),
    id: d.id,
    entryDate: toDate(d.data().entryDate),
    createdAt: toDate(d.data().createdAt),
    updatedAt: toDate(d.data().updatedAt),
  })) as Entry[];
}

export async function addEntry(
  userId: string,
  windowId: string,
  data: {
    rawText: string;
    amount: number;
    note: string;
    type: string;
    entryDate: Date;
  }
): Promise<string> {
  const ref = doc(collection(db, 'entries'));
  await withTimeout(
    setDoc(ref, {
      ...data,
      userId,
      windowId,
      entryDate: Timestamp.fromDate(data.entryDate),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  return ref.id;
}

export async function updateEntry(
  id: string,
  data: Partial<{
    rawText: string;
    amount: number;
    note: string;
    type: string;
    entryDate: Date;
  }>
): Promise<void> {
  const update: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() };
  if (data.entryDate) update.entryDate = Timestamp.fromDate(data.entryDate);
  await withTimeout(updateDoc(doc(db, 'entries', id), update));
}

export async function deleteEntry(id: string): Promise<void> {
  await withTimeout(deleteDoc(doc(db, 'entries', id)));
}

/** Search entries by note text across all windows for a user */
export async function searchEntries(userId: string): Promise<Entry[]> {
  const q = query(
    collection(db, 'entries'),
    where('userId', '==', userId),
    orderBy('entryDate', 'desc')
  );
  const snap = await withTimeout(getDocs(q));
  return snap.docs.map((d) => ({
    ...d.data(),
    id: d.id,
    entryDate: toDate(d.data().entryDate),
    createdAt: toDate(d.data().createdAt),
    updatedAt: toDate(d.data().updatedAt),
  })) as Entry[];
}

// ─── PERSONS ─────────────────────────────────────────────────────────────────

export async function getPersons(userId: string): Promise<Person[]> {
  const q = query(
    collection(db, 'persons'),
    where('userId', '==', userId),
    orderBy('createdAt', 'asc')
  );
  const snap = await withTimeout(getDocs(q));
  return snap.docs.map((d) => ({
    ...d.data(),
    id: d.id,
    createdAt: toDate(d.data().createdAt),
    updatedAt: toDate(d.data().updatedAt),
  })) as Person[];
}

export async function addPerson(
  userId: string,
  data: { name: string; note: string }
): Promise<string> {
  const existing = await getPersons(userId);
  const ref = doc(collection(db, 'persons'));
  await withTimeout(
    setDoc(ref, {
      ...data,
      userId,
      order: existing.length,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  return ref.id;
}

export async function updatePerson(id: string, data: Partial<Person>): Promise<void> {
  await withTimeout(updateDoc(doc(db, 'persons', id), { ...data, updatedAt: serverTimestamp() }));
}

export async function deletePerson(id: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'persons', id));
  const snap = await getDocs(
    query(collection(db, 'personEntries'), where('personId', '==', id))
  );
  snap.docs.forEach((d) => batch.delete(d.ref));
  await withTimeout(batch.commit());
}

// ─── PERSON ENTRIES ──────────────────────────────────────────────────────────

export async function getPersonEntries(
  userId: string,
  personId: string
): Promise<PersonEntry[]> {
  const q = query(
    collection(db, 'personEntries'),
    where('userId', '==', userId),
    where('personId', '==', personId),
    orderBy('entryDate', 'desc')
  );
  const snap = await withTimeout(getDocs(q));
  return snap.docs.map((d) => ({
    ...d.data(),
    id: d.id,
    entryDate: toDate(d.data().entryDate),
    createdAt: toDate(d.data().createdAt),
    updatedAt: toDate(d.data().updatedAt),
  })) as PersonEntry[];
}

export async function addPersonEntry(
  userId: string,
  personId: string,
  data: { rawText: string; amount: number; note: string; entryDate: Date }
): Promise<string> {
  const ref = doc(collection(db, 'personEntries'));
  await withTimeout(
    setDoc(ref, {
      ...data,
      userId,
      personId,
      entryDate: Timestamp.fromDate(data.entryDate),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  return ref.id;
}

export async function updatePersonEntry(
  id: string,
  data: Partial<{ rawText: string; amount: number; note: string; entryDate: Date }>
): Promise<void> {
  const update: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() };
  if (data.entryDate) update.entryDate = Timestamp.fromDate(data.entryDate);
  await withTimeout(updateDoc(doc(db, 'personEntries', id), update));
}

export async function deletePersonEntry(id: string): Promise<void> {
  await withTimeout(deleteDoc(doc(db, 'personEntries', id)));
}

// ─── VAULT ───────────────────────────────────────────────────────────────────

export async function getVaultItems(userId: string): Promise<VaultItem[]> {
  const q = query(
    collection(db, 'vault'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snap = await withTimeout(getDocs(q));
  return snap.docs.map((d) => ({
    ...d.data(),
    id: d.id,
    createdAt: toDate(d.data().createdAt),
    updatedAt: toDate(d.data().updatedAt),
  })) as VaultItem[];
}

export async function addVaultItem(
  userId: string,
  data: { type: string; title: string; fields: Record<string, string> }
): Promise<string> {
  const ref = doc(collection(db, 'vault'));
  await withTimeout(
    setDoc(ref, {
      ...data,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  return ref.id;
}

export async function updateVaultItem(
  id: string,
  data: Partial<VaultItem>
): Promise<void> {
  await withTimeout(
    updateDoc(doc(db, 'vault', id), { ...data, updatedAt: serverTimestamp() })
  );
}

export async function deleteVaultItem(id: string): Promise<void> {
  await withTimeout(deleteDoc(doc(db, 'vault', id)));
}

// ─── EXPORT HELPERS ──────────────────────────────────────────────────────────

export async function getAllEntriesForWindow(windowId: string): Promise<Entry[]> {
  const q = query(
    collection(db, 'entries'),
    where('windowId', '==', windowId),
    orderBy('entryDate', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    ...d.data(),
    id: d.id,
    entryDate: toDate(d.data().entryDate),
    createdAt: toDate(d.data().createdAt),
    updatedAt: toDate(d.data().updatedAt),
  })) as Entry[];
}
