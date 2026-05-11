'use client';

import { create } from 'zustand';
import { getDb } from '@/lib/db';
import { queueSync } from '@/lib/sync';
import type { MoneyWindow, Person, Tab } from '@/lib/types';

interface StoreState {
  tabs: Tab[];
  windows: MoneyWindow[];
  persons: Person[];
  isLoaded: boolean;
  userId: string | null;

  init: (userId: string) => Promise<void>;
  reset: () => void;

  loadTabs: (userId: string) => Promise<Tab[]>;
  addTab: (userId: string, data: { name: string; icon: string }) => Promise<string>;
  updateTab: (id: string, data: Partial<Tab>) => Promise<void>;
  deleteTab: (id: string) => Promise<void>;

  loadWindows: (userId: string, tabId: string) => Promise<MoneyWindow[]>;
  addWindow: (
    userId: string,
    tabId: string,
    title: string,
    extra?: Partial<MoneyWindow>
  ) => Promise<string>;
  updateWindow: (id: string, data: Partial<MoneyWindow>) => Promise<void>;
  softDeleteWindow: (id: string) => Promise<void>;
  restoreWindow: (id: string) => Promise<void>;
  hardDeleteWindow: (id: string) => Promise<void>;

  loadPersons: (userId: string) => Promise<Person[]>;
  addPerson: (userId: string, name: string, note: string) => Promise<string>;
  updatePerson: (id: string, data: Partial<Person>) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
}

export const useStore = create<StoreState>((set, get) => ({
  tabs: [],
  windows: [],
  persons: [],
  isLoaded: false,
  userId: null,

  init: async (userId) => {
    const db = getDb();
    const [tabs, persons] = await Promise.all([
      db.tabs.where('userId').equals(userId).sortBy('order'),
      db.persons.where('userId').equals(userId).sortBy('order'),
    ]);

    set({ tabs, persons, isLoaded: true, userId });
  },

  reset: () => set({ tabs: [], windows: [], persons: [], isLoaded: false, userId: null }),

  loadTabs: async (userId) => {
    const db = getDb();
    const tabs = await db.tabs.where('userId').equals(userId).sortBy('order');
    set({ tabs });
    return tabs;
  },

  addTab: async (userId, data) => {
    const db = getDb();
    const { v4: uuid } = await import('uuid');
    const id = uuid();
    const now = new Date();
    const order = await db.tabs.where('userId').equals(userId).count();
    const tab: Tab = {
      id,
      userId,
      name: data.name,
      icon: data.icon,
      type: 'custom',
      order,
      pinned: false,
      archived: false,
      isSystem: false,
      createdAt: now,
    };

    await db.tabs.add(tab);
    await queueSync('tabs', 'upsert', id, tab as unknown as Record<string, unknown>);
    set((state) => ({ tabs: [...state.tabs, tab] }));
    return id;
  },

  updateTab: async (id, data) => {
    const db = getDb();
    await db.tabs.update(id, data);
    await queueSync('tabs', 'upsert', id, data as Record<string, unknown>);
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, ...data } : tab)),
    }));
  },

  deleteTab: async (id) => {
    const db = getDb();
    const windows = await db.windows.where('tabId').equals(id).toArray();

    for (const window of windows) {
      const entries = await db.entries.where('windowId').equals(window.id).toArray();
      for (const entry of entries) {
        await queueSync('entries', 'delete', entry.id);
      }
      await db.entries.where('windowId').equals(window.id).delete();
      await queueSync('windows', 'delete', window.id);
    }

    await db.windows.where('tabId').equals(id).delete();
    await db.tabs.delete(id);
    await queueSync('tabs', 'delete', id);
    set((state) => ({
      tabs: state.tabs.filter((tab) => tab.id !== id),
      windows: state.windows.filter((window) => window.tabId !== id),
    }));
  },

  loadWindows: async (userId, tabId) => {
    const db = getDb();
    const windows = await db.windows
      .where('[userId+tabId]')
      .equals([userId, tabId])
      .filter((window) => !window.archived && !window.inRecycleBin)
      .sortBy('order');

    const sorted = windows.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.monthKey && b.monthKey) return b.monthKey.localeCompare(a.monthKey);
      return a.order - b.order;
    });

    set({ windows: sorted });
    return sorted;
  },

  addWindow: async (userId, tabId, title, extra = {}) => {
    const db = getDb();
    const { v4: uuid } = await import('uuid');
    const id = uuid();
    const order = await db.windows.where('tabId').equals(tabId).count();
    const window: MoneyWindow = {
      id,
      userId,
      tabId,
      title,
      order,
      pinned: false,
      archived: false,
      inRecycleBin: false,
      autoMonthly: false,
      createdAt: new Date(),
      ...extra,
    };

    await db.windows.add(window);
    await queueSync('windows', 'upsert', id, window as unknown as Record<string, unknown>);
    set((state) => ({ windows: [...state.windows, window] }));
    return id;
  },

  updateWindow: async (id, data) => {
    const db = getDb();
    await db.windows.update(id, data);
    await queueSync('windows', 'upsert', id, data as Record<string, unknown>);
    set((state) => ({
      windows: state.windows.map((window) => (window.id === id ? { ...window, ...data } : window)),
    }));
  },

  softDeleteWindow: async (id) => {
    await get().updateWindow(id, { inRecycleBin: true });
  },

  restoreWindow: async (id) => {
    await get().updateWindow(id, { inRecycleBin: false });
  },

  hardDeleteWindow: async (id) => {
    const db = getDb();
    const entries = await db.entries.where('windowId').equals(id).toArray();

    for (const entry of entries) {
      await queueSync('entries', 'delete', entry.id);
    }

    await db.entries.where('windowId').equals(id).delete();
    await db.windows.delete(id);
    await queueSync('windows', 'delete', id);
    set((state) => ({ windows: state.windows.filter((window) => window.id !== id) }));
  },

  loadPersons: async (userId) => {
    const db = getDb();
    const persons = await db.persons.where('userId').equals(userId).sortBy('order');
    set({ persons });
    return persons;
  },

  addPerson: async (userId, name, note) => {
    const db = getDb();
    const { v4: uuid } = await import('uuid');
    const id = uuid();
    const now = new Date();
    const order = await db.persons.where('userId').equals(userId).count();
    const person: Person = {
      id,
      userId,
      name,
      note,
      order,
      createdAt: now,
      updatedAt: now,
    };

    await db.persons.add(person);
    await queueSync('persons', 'upsert', id, person as unknown as Record<string, unknown>);
    set((state) => ({ persons: [...state.persons, person] }));
    return id;
  },

  updatePerson: async (id, data) => {
    const db = getDb();
    const updated = { ...data, updatedAt: new Date() };
    await db.persons.update(id, updated);
    await queueSync('persons', 'upsert', id, updated as Record<string, unknown>);
    set((state) => ({
      persons: state.persons.map((person) => (person.id === id ? { ...person, ...updated } : person)),
    }));
  },

  deletePerson: async (id) => {
    const db = getDb();
    const personEntries = await db.personEntries.where('personId').equals(id).toArray();

    for (const entry of personEntries) {
      await queueSync('personEntries', 'delete', entry.id);
    }

    await db.personEntries.where('personId').equals(id).delete();
    await db.persons.delete(id);
    await queueSync('persons', 'delete', id);
    set((state) => ({ persons: state.persons.filter((person) => person.id !== id) }));
  },
}));
