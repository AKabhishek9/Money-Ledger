'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Download } from 'lucide-react';
import type { Person, PersonEntry } from '@/lib/types';
import {
  computeRunningBalance,
  localAddPersonEntry,
  localDeletePersonEntry,
  localGetPersonEntries,
  localUpdatePersonEntry,
} from '@/lib/entries';
import { parseEntry, formatAmount, calcTotal } from '@/lib/parser';
import { exportPersonToCSV } from '@/lib/export';
import { exportPersonToPDF } from '@/lib/pdf';
import EntryInput from '@/components/entry/EntryInput';
import EntryItem from '@/components/entry/EntryItem';
import EditEntrySheet from '@/components/windows/EditEntrySheet';

interface PersonLedgerProps {
  person: Person;
  userId: string;
}

export default function PersonLedger({ person, userId }: PersonLedgerProps) {
  const [entries, setEntries] = useState<PersonEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editEntry, setEditEntry] = useState<PersonEntry | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await localGetPersonEntries(person.id);
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }, [person.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  const handleAdd = async (rawText: string, amount: number, note: string, type: string, entryDate: Date) => {
    const entry = await localAddPersonEntry(userId, person.id, {
      rawText,
      amount,
      note,
      entryDate,
    });
    setEntries((prev) => [entry, ...prev]);
  };

  const handleDelete = async (e: PersonEntry) => {
    await localDeletePersonEntry(e.id);
    setEntries((prev) => prev.filter((x) => x.id !== e.id));
  };

  const handleEdit = async (entry: PersonEntry, rawText: string) => {
    const parsed = parseEntry(rawText);
    if (!parsed.isValid) return;
    await localUpdatePersonEntry(entry.id, {
      rawText: parsed.rawText,
      amount: parsed.amount,
      note: parsed.note,
    });
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entry.id
          ? { ...e, rawText: parsed.rawText, amount: parsed.amount, note: parsed.note }
          : e
      )
    );
  };

  const balance = calcTotal(entries.map((e) => e.amount));
  const isPositive = balance > 0;
  const isZero = balance === 0;
  const entriesWithBalance = computeRunningBalance(entries);
  const displayedEntries = [...entriesWithBalance].reverse();

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      {/* Balance header */}
      <div
        className="px-4 py-4 shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="flex items-end justify-between mb-3">
          {/* Avatar + name */}
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold"
              style={{
                background: isZero
                  ? 'var(--color-surface-2)'
                  : isPositive
                  ? 'var(--color-income-bg)'
                  : 'var(--color-expense-bg)',
                color: isZero
                  ? 'var(--color-text-muted)'
                  : isPositive
                  ? 'var(--color-income)'
                  : 'var(--color-expense)',
              }}
            >
              {person.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-base" style={{ color: 'var(--color-text)' }}>
                {person.name}
              </p>
              {person.note && (
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {person.note}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportPersonToCSV(person.name, entries)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
            >
              <Download size={13} />
              CSV
            </button>
            <button
              onClick={() => exportPersonToPDF(person.name, entries)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
            >
              <Download size={13} />
              PDF
            </button>
          </div>
        </div>

        {/* Balance */}
        <div
          className="rounded-2xl p-4 flex items-center justify-between"
          style={{
            background: isZero
              ? 'var(--color-surface-2)'
              : isPositive
              ? 'var(--color-income-bg)'
              : 'var(--color-expense-bg)',
          }}
        >
          <div>
            <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
              Net Balance
            </p>
            <p
              className="font-mono font-bold text-2xl"
              style={{
                color: isZero
                  ? 'var(--color-text-muted)'
                  : isPositive
                  ? 'var(--color-income)'
                  : 'var(--color-expense)',
              }}
            >
              {isZero ? '₹0' : formatAmount(balance)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl">{isZero ? '✅' : isPositive ? '⬆️' : '⬇️'}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              {isZero ? 'Settled up' : isPositive ? `${person.name} owes you` : `You owe ${person.name}`}
            </p>
          </div>
        </div>

        {/* Helper text */}
        <p className="text-xs mt-2 text-center" style={{ color: 'var(--color-text-dim)' }}>
          +amount = {person.name} owes you &nbsp;·&nbsp; -amount = you owe
        </p>
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm loading-pulse" style={{ color: 'var(--color-text-muted)' }}>
              Loading…
            </p>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="text-4xl mb-3">📒</div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
              No transactions yet
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
              +5000 lent money &nbsp;·&nbsp; -2000 received back
            </p>
          </div>
        ) : (
          <>
            {displayedEntries.map((entry) => (
              <EntryItem
                key={entry.id}
                entry={entry}
                runningBalance={entry.runningBalance}
                onDelete={() => handleDelete(entry)}
                onEdit={() => setEditEntry(entry)}
              />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <div
        className="shrink-0 border-t"
        style={{
          borderColor: 'var(--color-border)',
          background: 'var(--color-background, var(--color-bg))',
        }}
      >
        <EntryInput
          onAdd={handleAdd}
          placeholder="+5000 lent money  ·  -2000 received back"
        />
      </div>

      {editEntry && (
        <EditEntrySheet
          entry={editEntry}
          onSave={(raw) => { handleEdit(editEntry, raw); setEditEntry(null); }}
          onClose={() => setEditEntry(null)}
        />
      )}
    </div>
  );
}
