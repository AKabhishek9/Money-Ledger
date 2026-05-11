'use client';

import { getDb } from '@/lib/db';
import { queueSync } from '@/lib/sync';
import type { Entry, PersonEntry } from '@/lib/types';

interface AddEntryInput {
  rawText: string;
  amount: number;
  note: string;
  type: string;
  entryDate: Date;
  linkedPersonId?: string;
  linkedPersonName?: string;
}

interface AddPersonEntryInput {
  rawText: string;
  amount: number;
  note: string;
  entryDate: Date;
  linkedEntryId?: string;
  linkedWindowId?: string;
}

export async function localAddEntry(
  userId: string,
  windowId: string,
  data: AddEntryInput
): Promise<Entry> {
  const db = getDb();
  const { v4: uuid } = await import('uuid');
  const now = new Date();
  const entry: Entry = {
    id: uuid(),
    userId,
    windowId,
    rawText: data.rawText,
    amount: data.amount,
    note: data.note,
    type: data.type as Entry['type'],
    entryDate: data.entryDate,
    linkedPersonId: data.linkedPersonId,
    linkedPersonName: data.linkedPersonName,
    createdAt: now,
    updatedAt: now,
  };

  await db.entries.add(entry);
  await queueSync('entries', 'upsert', entry.id, entry as unknown as Record<string, unknown>);
  return entry;
}

export async function localAddPersonEntry(
  userId: string,
  personId: string,
  data: AddPersonEntryInput
): Promise<PersonEntry> {
  const db = getDb();
  const { v4: uuid } = await import('uuid');
  const now = new Date();
  const entry: PersonEntry = {
    id: uuid(),
    userId,
    personId,
    rawText: data.rawText,
    amount: data.amount,
    note: data.note,
    entryDate: data.entryDate,
    linkedEntryId: data.linkedEntryId,
    linkedWindowId: data.linkedWindowId,
    createdAt: now,
    updatedAt: now,
  };

  await db.personEntries.add(entry);
  await queueSync(
    'personEntries',
    'upsert',
    entry.id,
    entry as unknown as Record<string, unknown>
  );
  return entry;
}

export async function localUpdateEntry(id: string, data: Partial<Entry>): Promise<void> {
  const db = getDb();
  const updated = { ...data, updatedAt: new Date() };
  await db.entries.update(id, updated);
  await queueSync('entries', 'upsert', id, updated as Record<string, unknown>);
}

export async function localUpdatePersonEntry(
  id: string,
  data: Partial<PersonEntry>
): Promise<void> {
  const db = getDb();
  const updated = { ...data, updatedAt: new Date() };
  await db.personEntries.update(id, updated);
  await queueSync('personEntries', 'upsert', id, updated as Record<string, unknown>);
}

export async function localDeleteEntry(id: string): Promise<void> {
  const db = getDb();
  const linkedPersonEntries = await db.personEntries.where('linkedEntryId').equals(id).toArray();

  for (const entry of linkedPersonEntries) {
    await db.personEntries.delete(entry.id);
    await queueSync('personEntries', 'delete', entry.id);
  }

  await db.entries.delete(id);
  await queueSync('entries', 'delete', id);
}

export async function localDeletePersonEntry(id: string): Promise<void> {
  const db = getDb();
  const personEntry = await db.personEntries.get(id);

  if (personEntry?.linkedEntryId) {
    await db.entries
      .where('id')
      .equals(personEntry.linkedEntryId)
      .modify((entry) => {
        delete entry.linkedPersonId;
        delete entry.linkedPersonName;
        entry.updatedAt = new Date();
      });
    await queueSync('entries', 'upsert', personEntry.linkedEntryId, {
      linkedPersonId: undefined,
      linkedPersonName: undefined,
      updatedAt: new Date(),
    });
  }

  await db.personEntries.delete(id);
  await queueSync('personEntries', 'delete', id);
}

export async function localGetEntries(windowId: string): Promise<Entry[]> {
  const db = getDb();
  return db.entries.where('windowId').equals(windowId).sortBy('entryDate');
}

export async function localGetPersonEntries(personId: string): Promise<PersonEntry[]> {
  const db = getDb();
  return db.personEntries.where('personId').equals(personId).sortBy('entryDate');
}

export function computeRunningBalance<T extends { amount: number; entryDate: Date; createdAt?: Date }>(
  entries: T[]
): Array<T & { runningBalance: number }> {
  const sorted = [...entries].sort((a, b) => {
    const byEntryDate = a.entryDate.getTime() - b.entryDate.getTime();
    if (byEntryDate !== 0) return byEntryDate;

    const aCreatedAt = a.createdAt?.getTime() ?? 0;
    const bCreatedAt = b.createdAt?.getTime() ?? 0;
    return aCreatedAt - bCreatedAt;
  });

  let runningBalance = 0;
  const withBalance = sorted.map((entry) => {
    runningBalance += entry.amount;
    return { ...entry, runningBalance };
  });

  return withBalance.reverse();
}
