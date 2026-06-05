'use client';

import { getDb } from '@/lib/db';
import { queueSync } from '@/lib/sync';
import { v4 as uuid } from 'uuid';
import { getMonthKey, getMonthWindowTitle } from '@/lib/utils';
import { useStore } from '@/store/useStore';

const bootstrapPromises = new Map<string, Promise<void>>();

export async function ensureSystemData(userId: string): Promise<void> {
  if (bootstrapPromises.has(userId)) {
    return bootstrapPromises.get(userId)!;
  }

  // FIXED: BUG-L12 — set the map entry BEFORE starting async work to prevent
  // same-tick concurrent callers from starting a duplicate
  const promise = (async () => {
    const db = getDb();
    const now = new Date();

    const existingTabs = await db.tabs.where('userId').equals(userId).toArray();

    // ── Ensure Personal Tab ──────────────────────────────────────────────────
    let personalTab = existingTabs.find((tab) => tab.type === 'personal');

    if (!personalTab) {
      // Double-check DB — Firestore hydration may have just populated it
      // This prevents creating a duplicate tab when site data was cleared
      const recheckTabs = await db.tabs.where('userId').equals(userId).toArray();
      personalTab = recheckTabs.find((tab) => tab.type === 'personal');
    }

    if (!personalTab) {
      personalTab = {
        id: `personal-${userId}`, // Maintain deterministic ID logic
        userId,
        name: 'Personal',
        icon: '📓',
        type: 'personal',
        order: 0,
        pinned: false,
        archived: false,
        isSystem: true,
        createdAt: now,
        updatedAt: now,  // ← required for delta sync
      };

      await db.tabs.add(personalTab);
      useStore.getState().patchTab(personalTab);
      await queueSync(
        'tabs',
        'upsert',
        personalTab.id,
        personalTab as unknown as Record<string, unknown>
      );
    }

    // ── Cleanup duplicate Personal tabs ─────────────────────────────────────
    const allPersonalTabs = existingTabs.filter((t) => t.type === 'personal');
    if (allPersonalTabs.length > 1) {
      // Keep the first one (by order, then createdAt), delete the rest
      const sorted = [...allPersonalTabs].sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      const keep = sorted[0];
      personalTab = keep;
      const dupes = sorted.slice(1);
      for (const dupe of dupes) {
        // Move any windows from the duplicate tab to the kept tab
        const dupeWindows = await db.windows.where('tabId').equals(dupe.id).toArray();
        for (const win of dupeWindows) {
          await db.windows.update(win.id, { tabId: keep.id, updatedAt: now });
          await queueSync('windows', 'upsert', win.id, { tabId: keep.id, updatedAt: now });
        }
        // Delete the duplicate tab
        await db.tabs.delete(dupe.id);
        await queueSync('tabs', 'delete', dupe.id);
      }
    }

    // ── Cleanup duplicate month windows ────────────────────────────────────
    // After merging duplicate tabs, multiple windows may share the same monthKey.
    // Keep the oldest, move entries from duplicates into the kept window, then delete dupes.
    const allPersonalWindows = await db.windows
      .where('tabId')
      .equals(personalTab.id)
      .filter((w) => !!w.monthKey && !w.inRecycleBin)
      .toArray();

    const byMonthKey: Record<string, typeof allPersonalWindows> = {};
    for (const w of allPersonalWindows) {
      const mk = w.monthKey!;
      if (!byMonthKey[mk]) byMonthKey[mk] = [];
      byMonthKey[mk].push(w);
    }

    for (const [, group] of Object.entries(byMonthKey)) {
      if (group.length <= 1) continue;
      // Sort: keep the one with the most entries (or oldest as fallback)
      const sorted = group.sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const keep = sorted[0];
      const dupes = sorted.slice(1);

      for (const dupe of dupes) {
        // Move entries from duplicate window to the kept window
        const dupeEntries = await db.entries.where('windowId').equals(dupe.id).toArray();
        for (const entry of dupeEntries) {
          await db.entries.update(entry.id, { windowId: keep.id, updatedAt: now });
          await queueSync('entries', 'upsert', entry.id, { windowId: keep.id, updatedAt: now });
        }
        // Delete the duplicate window
        await db.windows.delete(dupe.id);
        await queueSync('windows', 'delete', dupe.id);
      }
    }

    // ── Ensure Current Month Window ──────────────────────────────────────────
    const currentMonthKey = getMonthKey();

    const existingMonthWindow = await db.windows
      .where('tabId')
      .equals(personalTab.id)
      .filter((window) => window.monthKey === currentMonthKey)
      .first();

    if (!existingMonthWindow) {
      const monthWindow = {
        id: uuid(),
        userId,
        tabId: personalTab.id,
        title: getMonthWindowTitle(),
        order: 0,
        pinned: true,
        archived: false,
        inRecycleBin: false,
        autoMonthly: true,
        monthKey: currentMonthKey,
        createdAt: now,
        updatedAt: now,  // ← required for delta sync
      };

      await db.windows.add(monthWindow);
      useStore.getState().patchWindow(monthWindow);
      await queueSync(
        'windows',
        'upsert',
        monthWindow.id,
        monthWindow as unknown as Record<string, unknown>
      );
    }
  })();

  bootstrapPromises.set(userId, promise);

  try {
    await promise;
  } finally {
    bootstrapPromises.delete(userId);
  }
}
