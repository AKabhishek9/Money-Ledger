'use client';

import { getDb } from '@/lib/db';
import { queueSync } from '@/lib/sync';
import { v4 as uuid } from 'uuid';
import { getMonthKey, getMonthWindowTitle } from '@/lib/utils';

export async function ensureSystemData(userId: string): Promise<void> {
  const db = getDb();

  const existingTabs = await db.tabs.where('userId').equals(userId).toArray();

  // Ensure Personal Tab
  let personalTab = existingTabs.find((tab) => tab.type === 'personal');

  if (!personalTab) {
    personalTab = {
      id: uuid(),
      userId,
      name: 'Personal',
      icon: '📓',
      type: 'personal',
      order: 0,
      pinned: false,
      archived: false,
      isSystem: true,
      createdAt: new Date(),
    };

    await db.tabs.add(personalTab);

    await queueSync(
      'tabs',
      'upsert',
      personalTab.id,
      personalTab as unknown as Record<string, unknown>
    );
  }

  // Ensure Current Month Window
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
      createdAt: new Date(),
    };

    await db.windows.add(monthWindow);

    await queueSync(
      'windows',
      'upsert',
      monthWindow.id,
      monthWindow as unknown as Record<string, unknown>
    );
  }
}
