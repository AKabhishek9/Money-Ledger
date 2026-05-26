# Money Ledger — Full Stack Deep Analysis Report

**Analyst:** Senior Full-Stack Developer  
**Project:** Money-Ledger v2.5.2  
**Stack:** Next.js 16 · React 19 · Firebase 12 (Firestore + Auth) · Dexie (IndexedDB) · Zustand · Tailwind CSS 4 · TypeScript 5  
**Date:** 2026-05-26  

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Critical Bugs (Severity: HIGH)](#critical-bugs)
3. [Medium Bugs](#medium-bugs)
4. [Minor / Low-Severity Bugs](#minor-bugs)
5. [Security Vulnerabilities](#security-vulnerabilities)
6. [Performance Issues](#performance-issues)
7. [Architecture & Design Gaps](#architecture--design-gaps)
8. [Connection & Data-Flow Audit](#connection--data-flow-audit)
9. [Service Worker Audit](#service-worker-audit)
10. [Firebase / Firestore Audit](#firebase--firestore-audit)
11. [Quick-Win Fixes (Actionable Checklist)](#quick-win-fixes)

---

## Executive Summary

The project is a well-structured offline-first PWA. The core idea (local-first with Dexie, synced to Firestore) is solid. However, a full read of every file reveals **3 critical bugs**, **9 medium bugs**, **14 minor bugs**, **4 security vulnerabilities**, and **12 performance issues** that collectively impact correctness, security, and user experience. The most severe issue is a **false security claim**: the Vault UI says items are "encrypted" but the code has zero encryption — plain-text data is stored in both IndexedDB and Firestore.

---

## Critical Bugs

### BUG-C1 · Vault Data Is NOT Encrypted — False UI Claim

**File:** `components/tabs/VaultContent.tsx` (line ~74), `lib/types.ts` (VaultItem interface)

**Description:**  
The UI prominently displays:  
> "Vault items are encrypted and stored securely in your private account."

This is **factually false**. Looking at the entire codebase, there is **zero encryption code** anywhere. `VaultItem.fields` is `Record<string, string>` — plain key-value strings. They are stored as-is in Dexie (IndexedDB, readable by any script on the origin) and synced as-is to Firestore. Anyone who gains access to the browser's IndexedDB or to the Firestore document can read card numbers, CVV, Aadhaar numbers, and PAN in cleartext.

**Fix:**  
Either remove the claim and replace with accurate language, OR implement AES-GCM encryption using the WebCrypto API before writing to Dexie/Firestore and decrypt on read. A user-derived key (from a vault PIN via PBKDF2) should be used. Never store the plaintext in Firestore at all if the claim is to be real.

---

### BUG-C2 · Race Condition in `prepareLocalData` — Double `init()` on Login

**File:** `contexts/AuthContext.tsx` (~line 62–100)

**Description:**  
On login there are **two concurrent code paths** that both call `prepareLocalData(userId)`:
1. The `cachedUid` fast-path fires `prepareLocalData(cachedUid)` immediately.
2. `onAuthStateChanged` fires shortly after with the same `uid` and calls `prepareLocalData(u.uid)` again.

Inside `prepareLocalData`, both paths independently fire `useStore.getState().init(userId)` and `startRealtimeSync(userId)`. The result is:
- Zustand `init()` is called twice — two sets of Dexie queries run concurrently, and whichever finishes second overwrites the first.
- `startRealtimeSync()` is called twice — `stopRealtimeSync()` is called at the start of each, so the first set of listeners is torn down before the second set is set up. But since both paths run concurrently (not sequentially), there is a window where `activeListeners` is half-populated and a snapshot fires.
- `ensureSystemData(userId)` and `purgeExpiredBinItems(userId)` also run twice.

**Fix:**  
Gate `prepareLocalData` per-userId so it only runs once regardless of how many times it is called concurrently:

```typescript
const preparingFor = new Map<string, Promise<void>>();

async function prepareLocalData(userId: string): Promise<void> {
  if (preparingFor.has(userId)) return preparingFor.get(userId)!;
  const promise = _prepareLocalData(userId);
  preparingFor.set(userId, promise);
  promise.finally(() => preparingFor.delete(userId));
  return promise;
}
```

---

### BUG-C3 · `syncQueue` Silently Drops Data After 5 Retries

**File:** `lib/sync.ts` (~line 135–145)

**Description:**  
When a queued sync item fails 5 times, it is silently deleted from the queue:

```typescript
if (retries >= 5) {
  rememberLocalSync(item.collection, item.documentId);
  await db.syncQueue.delete(item.id); // ← user's data is lost
}
```

The user's write (e.g., a new entry) is permanently abandoned with no notification. This means if the user was offline for a while and something went wrong on reconnect, their data silently disappears from the cloud without them knowing. The data still exists in Dexie locally, but it will never be pushed again.

**Fix:**  
Move failed items to a separate `failedSyncQueue` table instead of deleting them. Surface a toast/banner to the user: "Some changes failed to sync. Tap to retry." Provide a manual retry mechanism.

---

## Medium Bugs

### BUG-M1 · `order` Field Uses `count()` — Duplicates on Delete

**File:** `store/useStore.ts` — `addTab`, `addWindow`, `addPerson`

**Description:**  
New items calculate their `order` as:
```typescript
const order = await db.tabs.where('userId').equals(userId).count();
```
If a user has 5 tabs (order 0–4) and deletes tab #2, the count becomes 4. The next new tab gets `order = 4`, which **duplicates** the existing tab at order 4. The UI sort becomes unpredictable.

**Fix:**  
Use `Math.max(...tabs.map(t => t.order), -1) + 1` to always assign `max + 1`. Or assign a large epoch-based number (`Date.now()`) and sort by that.

---

### BUG-M2 · `deleteTab` and `hardDeleteWindow` Use Serial Loops — Extremely Slow

**File:** `store/useStore.ts` (~line 160–180, ~line 240–260)

**Description:**  
```typescript
for (const entry of entries) {
  await queueSync('entries', 'delete', entry.id); // sequential await in loop
}
```
For a tab with 10 windows × 100 entries = 1,000 entries, this runs **1,000 sequential async operations** before the delete completes. Each `queueSync` call does an IndexedDB write. This will freeze the UI for several seconds on mobile.

**Fix:**  
Batch the queue items in one Dexie `bulkAdd`:
```typescript
const syncItems = entries.map(e => ({
  collection: 'entries' as const,
  operation: 'delete' as const,
  documentId: e.id,
  createdAt: Date.now(),
  retries: 0,
}));
await db.syncQueue.bulkAdd(syncItems);
```

---

### BUG-M3 · `userId` in `AuthContext` Reads `localStorage` Inside `useMemo`

**File:** `contexts/AuthContext.tsx` (~line 178)

**Description:**  
```typescript
const userId = useMemo(() => {
  if (user?.uid) return user.uid;
  const storeUserId = useStore.getState().userId;
  if (storeUserId) return storeUserId;
  if (typeof window !== 'undefined') {
    return localStorage.getItem('money_ledger_last_uid'); // ← side effect in memo
  }
  return null;
}, [user?.uid]);
```
`localStorage.getItem` is a side effect inside a `useMemo`. More importantly, the memo only re-computes when `user?.uid` changes — it **never** re-runs when `storeUserId` changes. So if `init()` populates the store's `userId` after the first render, `userId` from context remains `null` until `user?.uid` changes again, causing consumers to get a stale null.

**Fix:**  
Subscribe to the store state in the memo dependencies:
```typescript
const storeUserId = useStore((s) => s.userId);
const userId = useMemo(() => user?.uid ?? storeUserId ?? /* localStorage */, 
  [user?.uid, storeUserId]);
```

---

### BUG-M4 · `addWindow` in `PersonalContent.load` Dependency Array But Never Used

**File:** `components/tabs/PersonalContent.tsx` (~line 85)

**Description:**  
```typescript
const load = useCallback(async () => {
  // ...addWindow is never called here...
}, [userId, addWindow, loadWindows]); // ← addWindow is a stale dep
```
`addWindow` is a Zustand action that is re-created on every state update (Zustand doesn't memoize actions). Every time any Zustand state changes, `addWindow` is a new reference, causing `load` to be re-created, causing `useEffect(() => { load() }, [load])` to re-fire, causing a full data reload. This means **every Firestore real-time patch triggers a full page reload**.

**Fix:**  
Remove `addWindow` from the `useCallback` dependency array.

---

### BUG-M5 · `PersonalContent` windowStats forEach with Async Errors Silently Dropped

**File:** `components/tabs/PersonalContent.tsx` (~line 95, 112, 135)

**Description:**  
Three separate `useEffect` hooks use `windows.forEach(async (w) => { ... })`. The `forEach` callback's returned Promise is ignored — errors are silently swallowed. Additionally, if the component unmounts while these are running, `setWindowStats` is called on an unmounted component.

**Fix:**  
Use `Promise.all` with a cancellation ref:
```typescript
const cancelled = { current: false };
Promise.all(windows.map(async (w) => {
  const entries = await localGetEntries(w.id);
  if (!cancelled.current) setWindowStats(prev => ({...prev, [w.id]: ...}));
})).catch(console.error);
return () => { cancelled.current = true; };
```

---

### BUG-M6 · `SearchContent` Pre-Loads Entire Database Into JS Memory

**File:** `components/tabs/SearchContent.tsx` (~line 185)

**Description:**  
`loadSearchResults` runs on mount and loads **all** entries, personEntries, vaultItems, windows, tabs, and persons into JS heap simultaneously. For a power user with 5,000 entries, this can easily be 5–10 MB of objects. There is no pagination, no lazy loading, and no cleanup. `allResults` is set in state and held until the component unmounts.

This also loads vault item field values into the search index (card numbers, CVV codes) as plain strings that are searchable and held in memory.

**Fix:**  
- Implement lazy search: only run the Dexie queries when the user actually types, with a debounce.
- Exclude vault sensitive field values from the search index (only search on `title` and `type`).
- Add a result limit (e.g., show top 50 matches).

---

### BUG-M7 · `toFirestore` Only Converts Top-Level Date Values

**File:** `lib/sync.ts` (~line 70)

**Description:**  
`toFirestore` iterates top-level keys only. If any `data` object ever gains a nested object containing `Date` values, those won't be converted to Firestore `Timestamp` and will be stored as plain strings, breaking delta sync queries that filter by `updatedAt > since`.

Currently the schema is flat, but `VaultItem.fields: Record<string, string>` has a nested object. If fields ever contain dates in the future, this silently breaks.

**Fix:**  
Make `toFirestore` recursive, or add an explicit note in code that nested Date values are not supported and will throw in development:
```typescript
if (typeof value === 'object' && value !== null && !(value instanceof Date) && !(value instanceof Timestamp)) {
  result[key] = toFirestore(value as Record<string, unknown>);
}
```

---

### BUG-M8 · `useInstallPrompt` — `appinstalled` Event Listener Is Never Removed

**File:** `hooks/useInstallPrompt.ts` (~line 79)

**Description:**  
```typescript
window.addEventListener('appinstalled', () => {
  setInstallState('installed');
  setShowBanner(false);
  setDeferredPrompt(null);
});
// ← not added to the cleanup return
```
The `appinstalled` listener is added inside a `useEffect` but is never removed in the cleanup function. If `userId` changes (unlikely but possible), the effect runs again, adding a second listener. Memory leak.

**Fix:**  
Store a reference to the handler and remove it in the cleanup:
```typescript
const installedHandler = () => { ... };
window.addEventListener('appinstalled', installedHandler);
return () => {
  window.removeEventListener('beforeinstallprompt', handler);
  window.removeEventListener('appinstalled', installedHandler);
};
```

---

### BUG-M9 · `computeRunningBalance` Re-Sorts Already-Sorted Arrays

**File:** `lib/entries.ts` (~line 95)

**Description:**  
`localGetEntries` returns entries already sorted by `entryDate` via Dexie's `.sortBy('entryDate')`. But `computeRunningBalance` sorts again:
```typescript
const sorted = [...entries].sort((a, b) => { ... });
```
This creates a **new array copy and sorts it on every call**. For a window with 500 entries, this is O(n log n) work happening on every render and every remote sync event.

**Fix:**  
Since the input is already sorted by `entryDate`, only the tie-break by `createdAt` needs to be applied. Add a note or skip the full sort when the array arrives pre-sorted. Or pass an `alreadySorted: boolean` flag.

---

## Minor Bugs

### BUG-L1 · `isMathExpression` Doesn't Detect Negative-Leading Expressions

**File:** `lib/parser.ts` (~line 20)

The regex `/^\d/` requires the expression to start with a digit. An expression like `-500+200` starts with `-` and falls through to Pattern 2, being parsed as `-500` with note `"+200"` — wrong result.

---

### BUG-L2 · `safeEval` Uses `Function()` Constructor — CSP Incompatible

**File:** `lib/parser.ts` (~line 12)

The comment says `// no eval()` but `new Function(...)` IS eval. Any Content Security Policy with `script-src` that omits `'unsafe-eval'` will block this silently. The expression will fail to evaluate and fall through to another pattern. Add `'unsafe-eval'` to the CSP header or implement a proper recursive descent parser.

---

### BUG-L3 · PDF Text Alignment Uses Character-Count Heuristic

**File:** `lib/pdf.ts` (~lines 138, 155)

```typescript
x: columns.amount - amountText.length * 4.4,
```
PDF text width depends on actual character metrics, not character count. Digits like "1" are narrower than "W". For Helvetica, the average is ~5.5pts per character at size 9, not 4.4. Right-alignment will be visually off, especially for longer amounts like `+Rs.1,23,456.78`.

**Fix:** Use `font.widthOfTextAtSize(amountText, size)` from pdf-lib for accurate measurement.

---

### BUG-L4 · `safeText` Strips the ₹ Symbol From PDF Output

**File:** `lib/pdf.ts` (~line 19)

```typescript
function safeText(text: string): string {
  return text.replace(/[^\x20-\x7E]/g, ' ');
}
```
The Indian Rupee symbol `₹` is Unicode U+20B9, which is above `\x7E`. It is replaced with a space. The `formatPdfAmount` function deliberately uses `Rs.` instead of `₹` to work around this, but the `note` and `rawText` fields may contain `₹` typed by users — those will appear as spaces in the PDF. This is a silent data corruption bug in exported PDFs.

---

### BUG-L5 · `EntryInput` Keyboard Height Baseline Captured Once at Mount

**File:** `components/entry/EntryInput.tsx` (~line 52)

```typescript
const initialHeight = vv.height; // captured once, stale after orientation change
```
`initialHeight` is captured when the effect first runs. If the user rotates the device, `initialHeight` is wrong. The keyboard detection will either always report open or always report closed after rotation.

**Fix:** Re-capture `initialHeight` on orientation change or use `window.innerHeight` dynamically.

---

### BUG-L6 · `isRecentLocalSync` Iterates Entire Map on Every Call

**File:** `lib/sync.ts` (~line 50)

The cleanup loop runs inside `isRecentLocalSync` which is called for **every document in every Firestore snapshot**. For a user with 1,000 entries, a sync event calls `isRecentLocalSync` ~1,000 times, each potentially scanning the full `recentLocalSyncIds` map.

**Fix:** Clean up on a `setInterval` timer instead of inside the hot path.

---

### BUG-L7 · `MoreDrawer` Calls `loadTabs` on Every Open

**File:** `components/tabs/MoreDrawer.tsx` (~line 30)

```typescript
useEffect(() => {
  if (!user) return;
  loadTabs(user.uid); // runs every time MoreDrawer mounts
}, [user, loadTabs]);
```
`MoreDrawer` is a bottom sheet that mounts on every "More" click. `loadTabs` fires on each open, even if the store already has fresh tabs. This triggers an unnecessary Dexie query and a Zustand state update on every drawer open.

**Fix:** Check if `tabs.length > 0` before calling `loadTabs`, or remove the effect entirely since tabs are already in the Zustand store.

---

### BUG-L8 · `PeopleContent` and `PersonalContent` Call `load()` After Every Mutation

Both pages call `load()` after every mutation (add, edit, delete). `load()` does a full re-fetch from Dexie and rebuilds state. But the store already has the updated state from the mutation. This is unnecessary double work on every write operation.

**Fix:** Use surgical state updates (the `patchWindow`/`patchPerson` pattern already in Zustand) instead of full reloads.

---

### BUG-L9 · `archive/page.tsx` Doesn't Listen to `money-ledger-remote-sync`

**File:** `app/archive/page.tsx`

The Archive page loads archived/recycled windows once on mount but never subscribes to `money-ledger-remote-sync`. If another device archives a window while this page is open, the list will be stale until the user navigates away and back.

---

### BUG-L10 · `VaultContent` Search Exposes Sensitive Field Values in JS State

**File:** `components/tabs/VaultContent.tsx` (~line 85)

The vault search filters on `Object.values(i.fields)` — meaning CVV codes, full card numbers, Aadhaar numbers, and passwords are all held in the `items` state array and compared as plain strings. While the values are already accessible via `i.fields`, the `filtered` array holds them all in memory for the duration of the component lifecycle.

---

### BUG-L11 · `handleAddWindow` Calls `load()` Unnecessarily After Adding

**File:** `components/tabs/PersonalContent.tsx` (~line 175)

After `addWindow`, the store already has the new window (Zustand `set` is called inside `addWindow`). Calling `load()` immediately after does a redundant Dexie query and overwrites the fresh state with slightly stale data (the stat calculation hasn't run for the new window yet).

---

### BUG-L12 · `bootstrapPromises` Cache Never Handles Concurrent Same-User Calls

**File:** `lib/bootstrap.ts` (~line 10)

The dedup map works for sequential calls (the promise is set before `await`), but if two callers call `ensureSystemData(userId)` in the **exact same tick** before either has set the map entry, the Promise race is not handled. This is an extremely narrow window but is possible in the double-`prepareLocalData` race described in BUG-C2.

---

### BUG-L13 · `next.config.ts` Has `reactStrictMode: false`

**File:** `next.config.ts`

React Strict Mode is disabled. This masks double-invoke bugs in effects (cleanup not properly done, stale closures, memory leaks). The bugs in BUG-M5, BUG-M8, and BUG-L4 would have been caught earlier in development if Strict Mode was enabled.

**Fix:** Set `reactStrictMode: true` and fix the resulting warnings.

---

### BUG-L14 · `WindowView` Prop Named `window` Shadows Global `window`

**File:** `components/windows/WindowView.tsx` (~line 34)

```typescript
export default function WindowView({ window: w, userId, onBack, persons }: WindowViewProps) {
```
The prop is destructured as `w` (good), but the parameter name `window` still appears in the function signature. Inside the same component, `window.addEventListener(...)` refers to the global object. This works currently but is a trap for future developers who might add code using `window.someProperty` intending the prop.

**Fix:** Rename the prop to `moneyWindow` or `pageWindow` in both the interface and the destructuring.

---

## Security Vulnerabilities

### SEC-1 · Vault Stores Sensitive Data in Plaintext (CRITICAL)

Covered in BUG-C1. Card numbers, CVV, Aadhaar, PAN, and passwords are stored unencrypted in both IndexedDB and Firestore. Anyone with access to the browser's developer tools can read all vault data. Anyone who gains read access to the Firestore project (misconfigured rules, insider threat) reads all vault data.

---

### SEC-2 · No Firebase App Check — Config Harvesting Possible

**File:** `lib/firebase.ts`

`NEXT_PUBLIC_FIREBASE_*` values are embedded in the client bundle (as designed for Firebase). Without Firebase App Check, anyone can copy these values and make Firestore API calls as your project outside the app — writing documents, reading other users' data (limited by rules), or triggering Auth operations (e.g., creating accounts in bulk).

**Fix:** Enable Firebase App Check with reCAPTCHA v3 or device attestation. This adds a `X-Firebase-AppCheck` token requirement to all Firestore/Auth requests.

---

### SEC-3 · Firestore `update` Rules Don't Validate Field Types

**File:** `firestore.rules`

The `update` rule for all collections only checks `isOwner(resource.data.userId)` but performs **no field validation**. A malicious client (or XSS attack) could:
- Set `amount` to `"hacked"` (a string) on any entry, breaking computations.
- Inject arbitrary fields into any document.
- Change `userId` via a crafted write (since `request.resource.data.userId` is not validated on update).

**Fix:** Add field type validation in Firestore rules for updates:
```javascript
allow update: if isAuth() && isOwner(resource.data.userId)
  && request.resource.data.userId == resource.data.userId // prevent userId change
  && (request.resource.data.keys().hasOnly(resource.data.keys() + ['updatedAt'])); // prevent new fields
```

---

### SEC-4 · No Input Length Limits on Entry `rawText` or `note`

**File:** `firestore.rules`, `components/entry/EntryInput.tsx`

The `create` rule for entries validates `rawText.size() > 0` but sets **no upper bound**. The UI input has no `maxLength` attribute. A user could submit a `rawText` of 100 MB, which would be stored in Firestore and downloaded to every device on sync. This is a denial-of-service vector.

**Fix:**
- In Firestore rules: `&& request.resource.data.rawText.size() <= 500`
- In the input component: `<input maxLength={500} />`

---

## Performance Issues

### PERF-1 · No Virtualization on Entry Lists — DOM Explosion

**File:** `components/windows/WindowView.tsx`, `components/people/PersonLedger.tsx`

All entries for a window are rendered as individual DOM nodes in a single scroll container. A window with 2,000 entries renders 2,000+ `<div>` nodes simultaneously. On mobile, this causes severe jank during scroll and can crash low-memory browsers.

**Fix:** Implement virtual scrolling. For a React 19 + Tailwind project, a lightweight option is `react-virtual` or `@tanstack/react-virtual`. Only render the visible ≈ 20 entries plus a small overscan buffer.

---

### PERF-2 · `loadSearchResults` Loads All 6 Tables in Parallel — Memory Spike

**File:** `components/tabs/SearchContent.tsx` (~line 185)

`Promise.all` loads every entry, personEntry, vaultItem, window, tab, and person into JavaScript heap simultaneously on mount. For a user with large data, this is 4–8 MB of IndexedDB data all in RAM at once, plus the transformation into `SearchResult[]` objects. The result is held in `allResults` state forever.

**Fix:**
- Move `loadSearchResults` from `useEffect` on mount to inside the debounced handler (lazy).
- Add a `limit(500)` cap on entries to avoid unbounded memory use.
- Do not include vault field values in the search text.

---

### PERF-3 · `processSyncQueue` Not Debounced — N Concurrent Instances for N Rapid Writes

**File:** `lib/sync.ts` (~line 100)

Each call to `queueSync` fires `processSyncQueue()` immediately via:
```typescript
if (navigator.onLine) {
  processSyncQueue().catch(() => undefined);
}
```
The `isProcessing` flag prevents true concurrency, but each new call starts its own async race to acquire the lock. If the user types 10 entries quickly, 10 `processSyncQueue` invocations are in-flight simultaneously, all queuing up after each other. This wastes event-loop time.

**Fix:** Debounce or throttle the `processSyncQueue` trigger:
```typescript
const debouncedProcess = debounce(() => processSyncQueue().catch(() => {}), 500);
if (navigator.onLine) debouncedProcess();
```

---

### PERF-4 · Firestore Realtime Listeners Query ALL User Documents

**File:** `lib/sync.ts` (~line 235)

The realtime sync sets up 6 listeners, each with `where('userId', '==', userId)`. For the `entries` collection, this matches **every entry ever written** by the user. Firestore sends the full snapshot diff on reconnect. For a user with 10,000 entries, this is an expensive and bandwidth-heavy operation every time the app comes online.

**Fix:** Add a `where('updatedAt', '>', cutoff)` filter to the realtime listener queries to limit the snapshot to recently changed documents. Use `lastSyncTime` as the cutoff:
```typescript
query(
  collection(firestoreDb, collectionName),
  where('userId', '==', userId),
  where('updatedAt', '>', Timestamp.fromDate(lastSyncTime ?? new Date(0)))
)
```

---

### PERF-5 · `PersonalContent` Fetches Stats for ALL Windows on Every Load

**File:** `components/tabs/PersonalContent.tsx` (~line 95)

After loading, the `load` function iterates every window and calls `localGetEntries(w.id)` to compute stats. A user with 24 months of data has 24 windows × N entries each. This runs on: initial mount, every tab focus, every remote sync for `entries`, and every time `load` is recreated (BUG-M4).

**Fix:** Cache computed stats in Zustand or compute them lazily per-window only when the card is visible (Intersection Observer). For the balance total, store a denormalized `cachedTotal` on the `MoneyWindow` document and update it only on entry mutations.

---

### PERF-6 · `Zustand patchWindow` Rebuilds `windowsByTabId` Entirely on Every Patch

**File:** `store/useStore.ts` (~line 95)

Every time a remote Firestore document changes and `patchWindow` is called:
```typescript
const windowsByTabId = Object.fromEntries(
  Object.entries(state.windowsByTabId).map(([tabId, tabWindows]) => [...])
);
```
This rebuilds **all tab window arrays** for all tabs even though only one document changed. With 5 tabs × 10 windows each, this creates 6 new arrays and 1 new object on every patch.

**Fix:** Only rebuild the single affected tab's array:
```typescript
const affectedTabWindows = state.windowsByTabId[incoming.tabId] ?? [];
// ... only update the affected tab
return {
  windowsByTabId: {
    ...state.windowsByTabId,
    [incoming.tabId]: updatedList,
  }
};
```

---

### PERF-7 · `sortWindows` Called Inside `patchWindow` for Every Remote Snapshot

**File:** `store/useStore.ts` (~line 95)

`patchWindow` calls `sortWindows(updated.filter(isVisibleWindow))` which creates a new sorted array copy on every Firestore snapshot for windows. Sorting 10 windows is cheap, but this runs inside Zustand's synchronous `set()` callback, blocking the React render cycle.

**Fix:** Memoize the sort result and only re-sort when the inputs actually change. Use `useMemo` in components rather than storing pre-sorted arrays in the store.

---

### PERF-8 · `pdf-lib` and `papaparse` Are Not Lazy-Loaded

**File:** `lib/pdf.ts`, `lib/export.ts`

Both `pdf-lib` (~150 KB gzipped) and `papaparse` (~20 KB) are imported at the top of `lib/pdf.ts` and `lib/export.ts`, which means they are included in the initial JS bundle. Most users will never export a PDF. This unnecessarily inflates the initial bundle and First Contentful Paint time.

**Fix:**
```typescript
// In WindowView.tsx — lazy import on demand
const handleExportPDF = async () => {
  const { exportWindowToPDF } = await import('@/lib/pdf');
  exportWindowToPDF(w.title, entries);
};
```

---

### PERF-9 · `Fira_Code` Font Loaded With `preload: false` but `display: swap`

**File:** `app/layout.tsx`

`Fira_Code` uses `display: swap`, which means it will cause a **Flash of Unstyled Text** (FOUT) on initial load — numeric amounts will briefly render in the fallback system font before Fira Code loads. With `preload: false`, the browser doesn't prefetch the font, making the FOUT window larger.

**Fix:** Either set `display: 'optional'` (no FOUT, amounts use system font if Fira Code isn't cached) or set `preload: true` so the font loads before paint.

---

### PERF-10 · `SearchContent` Uses `debounce` Imported from `lib/utils` But Needs Re-Creation on Every Mount

**File:** `components/tabs/SearchContent.tsx` (~line 42)

```typescript
const doSearch = useCallback(
  debounce((q, pool) => { ... }, 200),
  [] // eslint-disable-line
);
```
The `debounce` wrapper creates a closure over the `timer` variable. Because the dependency array is `[]`, this closure is created once and never re-created. The `eslint-disable` comment suppresses the warning that `allResults` is stale inside the closure. The workaround of passing `pool` as a parameter works, but it's fragile. If `allResults` update timing changes, results will be out of sync.

**Fix:** Use a `useRef` for the debounce timer instead of the utility function, allowing proper access to current state:
```typescript
const timerRef = useRef<ReturnType<typeof setTimeout>>();
const handleChange = (val: string) => {
  setQuery(val);
  clearTimeout(timerRef.current);
  timerRef.current = setTimeout(() => {
    // allResults is current here via closure over setResults + allResults ref
  }, 200);
};
```

---

### PERF-11 · `globalTotalBalance` in `PersonalContent` Recalculates on Every `windowStats` Update

**File:** `components/tabs/PersonalContent.tsx` (~line 52)

```typescript
const globalTotalBalance = useMemo(() => {
  return Object.values(windowStats).reduce((sum, w) => sum + w.total, 0);
}, [windowStats]);
```
`windowStats` is an object. Since it's updated via spread (`{ ...prevStats, [w.id]: ... }`), a **new object reference** is created on every window stat update. This causes `globalTotalBalance` to recalculate after every single window's stat loads, even though the final total only matters when all windows are loaded.

---

### PERF-12 · `window.history.replaceState` Called on Every Tab Click

**File:** `components/layout/AppLayout.tsx` (~line 48)

```typescript
const handleTabChange = useCallback((index: number) => {
  setActiveTab(index);
  if (window.location.pathname !== targetPath) {
    window.history.replaceState(null, '', targetPath);
  }
}, []);
```
`history.replaceState` is called synchronously on every tab click. While inexpensive, this interacts with Next.js's router internals and can cause issues with the browser's back-button behavior in `output: 'export'` mode (static export). The URL changes but the router state does not update, which can confuse `useSearchParams` and `usePathname` hooks on the same page.

---

## Architecture & Design Gaps

### ARCH-1 · Dual State Sources — Local State + Zustand Store Create Drift

**Pattern seen in:** `PersonalContent`, `PeopleContent`, `app/tab/page.tsx`

Every page maintains its own local `useState` for data (`windows`, `persons`) alongside the Zustand store. This creates two sources of truth that can drift:
1. User adds a window → Zustand store updated → local `windows` updated via `useEffect` watching `cachedWindows`.
2. Remote sync fires → `patchWindow` updates Zustand → the `useEffect` updates local state.
3. But `windowStats` is local state — it's not in the Zustand store, so it gets stale.

**Fix:** Move `windowStats` into Zustand (keyed by windowId). Components should read only from the store using `useStore(selector)`, never maintaining a parallel copy of the same data.

---

### ARCH-2 · `bootstrapPromises` Uses Module-Level State — SSR Unsafe

**File:** `lib/bootstrap.ts`

`bootstrapPromises` is a `Map` at module scope. In a Next.js SSR environment (even with `output: 'export'`, the server build phase executes modules), this map persists across requests. If two builds or two SSR requests run concurrently, they share the map. The `'use client'` directive should prevent this, but it's a fragile reliance.

---

### ARCH-3 · No Error Boundary Around Tab Content Components

None of the tab content components (`PersonalContent`, `PeopleContent`, `VaultContent`, `SearchContent`) are wrapped in React Error Boundaries. An unhandled exception in any of these components (e.g., Dexie throws an unexpected error, a null reference) will unmount the entire app and show a blank white screen. 

**Fix:** Wrap each content component in an Error Boundary that shows a friendly "Something went wrong" message with a retry button.

---

### ARCH-4 · `persons` Tab in Types Missing — No 'people' TabType

**File:** `lib/types.ts`

```typescript
export type TabType = 'personal' | 'people' | 'vault' | 'custom';
```
There is a `people` type in `TabType` but the `bootstrap.ts` only creates a `personal` system tab. The `people`, `vault`, and `search` sections are hard-coded routes, not actual tabs in the database. However, the `BottomNav` hard-codes 4 tab indices (0=personal, 1=people, 2=vault, 3=search). If the system ever tries to create a `people` or `vault` tab in the database, it would conflict with the hard-coded navigation logic.

---

## Connection & Data-Flow Audit

### DATA-FLOW: Write Path

```
UI Action
  → localAddEntry() / localUpdateEntry() etc.
  → Dexie.entries.add() / .update()
  → queueSync() → db.syncQueue.add()
  → processSyncQueue() [if online]
    → firestoreDb.setDoc() with merge
    → rememberLocalSync()
    → db.syncQueue.delete()
    → saveLastSyncTime()
```

**Issue:** `processSyncQueue` uses `setDoc` with `merge: true` for upserts. This means a **delete followed by a re-create** of the same document ID could be partially merged if the delete Firestore op fails but the re-create succeeds. The sync queue processes in order (`orderBy('createdAt')`), which helps, but if the delete fails and is retried later while a new create is already in Firestore, the merged result is unpredictable.

---

### DATA-FLOW: Read Path (New Device)

```
Login
  → prepareLocalData(userId)
  → processSyncQueue() [flush pending]
  → incrementalSync(userId)
    → lastSyncTime == null → fullHydrateFromFirestore()
      → getDocsFromServer() for all 6 collections
      → db.bulkPut() for each
  → useStore.init(userId) [load into Zustand]
  → ensureSystemData(userId) [create personal tab if missing]
  → startRealtimeSync(userId) [ongoing listeners]
```

**Issue:** `fullHydrateFromFirestore` uses `Promise.allSettled` — if the `entries` collection hydration fails (e.g., network timeout), the app still marks sync as done via `saveLastSyncTime` if `atLeastOneSynced` is true (from another collection succeeding). On next startup, the app does delta sync starting from the incorrect `lastSyncTime`, **missing all entries**.

**Fix:** Only save `lastSyncTime` if **all** collections synced successfully, not just one.

---

### DATA-FLOW: Realtime Sync Path

```
Firestore onSnapshot fires
  → filter out pending local writes (queuedIds, recentLocalSyncIds)
  → for genuine remote changes:
    → db.table.put(record)
    → patchStoreWithRemoteDoc() [surgical Zustand update]
    → notifyRemoteSync() [custom event]
  → components listen to 'money-ledger-remote-sync' and reload as needed
```

**Issue:** The `notifyRemoteSync` custom event is fired **after** all Dexie writes but the Zustand `patchStore` operations are `async`. The custom event fires synchronously via `window.dispatchEvent`, but components listening to it immediately call `localGetEntries()` which reads Dexie. Since Dexie writes are async, there is a **race between the event firing and the writes completing**. Components may read stale Dexie data.

**Fix:** Move `notifyRemoteSync()` to after all `await` operations complete, and ensure it's the last operation in the snapshot handler.

---

## Service Worker Audit

### SW-1 · `_next/` Assets Not Cached — Offline JS/CSS Breaks

**File:** `scripts/generate-sw.mjs` (~line SW content)

```javascript
if (url.pathname.startsWith('/_next/')) {
  return; // ← skips ALL Next.js JS/CSS bundles
}
```
The SW explicitly skips ALL requests to `/_next/` paths. Since `output: 'export'` puts JS/CSS under `/_next/static/`, the app's JavaScript and CSS are **never cached by the service worker**. In offline mode, the HTML shell loads from cache but the JS/CSS bundles fail to load from network, resulting in a broken UI.

**Fix:** Cache `_next/static/` assets (they have content hashes in filenames, so they're safe to cache indefinitely):
```javascript
if (url.pathname.startsWith('/_next/static/')) {
  // Cache-first for hashed static assets
  event.respondWith(cacheFirst(event.request));
  return;
}
if (url.pathname.startsWith('/_next/')) {
  return; // skip non-static _next routes (e.g., /_next/image)
}
```

---

### SW-2 · Service Worker Uses SHA-1 for Cache Revision

**File:** `scripts/generate-sw.mjs` (~line 28)

`crypto.createHash('sha1')` is used for file revision hashes. SHA-1 has known collision vulnerabilities. While not a practical attack vector for cache-busting, use SHA-256 instead:
```javascript
const hashSum = crypto.createHash('sha256');
```

---

### SW-3 · SW `activate` Doesn't Call `self.skipWaiting()`

**File:** `scripts/generate-sw.mjs`

The generated SW calls `self.clients.claim()` in `activate` but never calls `self.skipWaiting()` in `install`. This means a new SW version will be installed but **won't activate until all tabs using the old SW are closed**. Users on mobile who keep the app open in the background will run a stale version indefinitely.

**Fix:** Add `self.skipWaiting()` in the install handler:
```javascript
self.addEventListener('install', (event) => {
  self.skipWaiting(); // activate immediately
  event.waitUntil(caches.open(CACHE_NAME).then(...));
});
```

---

### SW-4 · Firebase Auth googleapis Requests Cached Without Expiry

**File:** `scripts/generate-sw.mjs`

Firebase auth requests to `*.googleapis.com` are cached in a `'firebase-auth'` cache and served from cache on network failure. However, auth tokens are time-limited. Serving a stale auth response from cache can cause the Firebase SDK to work with an expired token until it's cleared.

**Fix:** Add a max-age check or use a stale-while-revalidate strategy with a short TTL (e.g., 5 minutes) for auth requests.

---

## Firebase / Firestore Audit

### FB-1 · Missing `updatedAt` Index for Delta Sync

**File:** `firestore.indexes.json`

The delta sync query is:
```typescript
where('userId', '==', userId),
where('updatedAt', '>', since)
```
The `firestore.indexes.json` defines a `(userId, entryDate)` index for entries, but **not** `(userId, updatedAt)`. Firestore will require a composite index for this query. Without it, delta sync will fail with `FirebaseError: The query requires an index` in production.

**Fix:** Add these indexes for all 6 collections:
```json
{
  "collectionGroup": "entries",
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "updatedAt", "order": "ASCENDING" }
  ]
}
```

---

### FB-2 · `experimentalAutoDetectLongPolling` — Undocumented Breaking API

**File:** `lib/firebase.ts` (~line 32)

The comment explains the rationale correctly, but `experimentalAutoDetectLongPolling` is marked "experimental" in Firebase SDK docs. It may change or be removed in future Firebase SDK versions. The fallback `getFirestore(app)` in the catch block would silently revert to default behavior, losing the long-polling benefit without warning.

---

### FB-3 · No Firestore Emulator Support for Local Development

The project has no `.env.local` example for emulator configuration. Developers running locally are hitting production Firestore. This risks accidental production data mutation during development and incurs Firebase costs for development usage.

**Fix:** Add to `.env.example`:
```
NEXT_PUBLIC_USE_FIRESTORE_EMULATOR=true
```
And in `lib/firebase.ts`:
```typescript
if (process.env.NEXT_PUBLIC_USE_FIRESTORE_EMULATOR === 'true') {
  connectFirestoreEmulator(db, 'localhost', 8080);
}
```

---

## Quick-Win Fixes

A prioritized checklist for the development agent. Items marked 🔴 are critical, 🟡 medium, 🟢 low:

```
🔴 BUG-C1  — Remove false "encrypted" claim from VaultContent.tsx UI text immediately
🔴 BUG-C2  — Add prepareLocalData dedup guard (Map<userId, Promise>) in AuthContext
🔴 BUG-C3  — Replace sync queue silent-drop with a failedQueue + user notification
🔴 SEC-1   — Remove false encryption claim (same as BUG-C1)
🔴 SW-1    — Cache /_next/static/ assets in the service worker
🔴 FB-1    — Add (userId, updatedAt) composite indexes for all 6 collections

🟡 BUG-M1  — Fix order calculation to use max(order) + 1
🟡 BUG-M2  — Replace serial delete loops with bulkAdd to syncQueue
🟡 BUG-M3  — Add storeUserId to AuthContext userId memo dependencies
🟡 BUG-M4  — Remove addWindow from load useCallback deps in PersonalContent
🟡 BUG-M5  — Add cancellation refs to async forEach blocks
🟡 BUG-M6  — Make SearchContent search lazy (on type, not on mount)
🟡 BUG-M8  — Fix missing appinstalled listener cleanup in useInstallPrompt
🟡 BUG-M9  — Remove redundant sort in computeRunningBalance
🟡 SEC-3   — Add userId immutability check to Firestore update rules
🟡 SEC-4   — Add rawText.size() <= 500 to Firestore rules and maxLength to inputs
🟡 PERF-3  — Debounce the processSyncQueue trigger in queueSync
🟡 PERF-4  — Add updatedAt filter to realtime listener queries
🟡 PERF-8  — Lazy-import pdf-lib and papaparse on demand
🟡 SW-3    — Add self.skipWaiting() in SW install handler
🟡 FB-3    — Add Firestore emulator config support

🟢 BUG-L1  — Fix isMathExpression to handle negative-leading expressions
🟢 BUG-L3  — Use font.widthOfTextAtSize() for PDF right-alignment
🟢 BUG-L4  — Handle ₹ symbol in safeText (use WinAnsi encoding or warn)
🟢 BUG-L5  — Re-capture keyboard baseline height on orientation change
🟢 BUG-L7  — Guard MoreDrawer's loadTabs with tabs.length > 0 check
🟢 BUG-L9  — Add remote-sync listener to archive/page.tsx
🟢 BUG-L13 — Re-enable reactStrictMode: true and fix resulting warnings
🟢 BUG-L14 — Rename MoneyWindow prop from 'window' to 'moneyWindow'
🟢 PERF-1  — Add virtual scrolling to WindowView and PersonLedger entry lists
🟢 PERF-5  — Compute window stats lazily or store denormalized totals
🟢 PERF-6  — Only rebuild affected tab in patchWindow instead of all tabs
🟢 PERF-9  — Set Fira_Code display to 'optional' to eliminate FOUT
🟢 ARCH-3  — Wrap all tab content components in React Error Boundaries
🟢 SEC-2   — Enable Firebase App Check
🟢 SW-2    — Switch SW file hashing from SHA-1 to SHA-256
```

---

*Report generated by full static analysis of all source files: `store/useStore.ts`, `lib/sync.ts`, `lib/entries.ts`, `lib/parser.ts`, `lib/pdf.ts`, `lib/export.ts`, `lib/firebase.ts`, `lib/db.ts`, `lib/bootstrap.ts`, `lib/utils.ts`, `lib/types.ts`, `contexts/AuthContext.tsx`, `components/tabs/PersonalContent.tsx`, `components/tabs/PeopleContent.tsx`, `components/tabs/SearchContent.tsx`, `components/tabs/VaultContent.tsx`, `components/tabs/MoreDrawer.tsx`, `components/windows/WindowView.tsx`, `components/windows/EditEntrySheet.tsx`, `components/entry/EntryInput.tsx`, `components/entry/EntryItem.tsx`, `components/people/PersonLedger.tsx`, `components/layout/AppLayout.tsx`, `components/layout/BottomNav.tsx`, `components/auth/AuthGuard.tsx`, `components/sw/RegisterSW.tsx`, `hooks/useInstallPrompt.ts`, `scripts/generate-sw.mjs`, `firestore.rules`, `firestore.indexes.json`, `next.config.ts`, `app/layout.tsx`, `app/login/page.tsx`, `app/archive/page.tsx`, `app/settings/page.tsx`, `app/tab/page.tsx`.*
