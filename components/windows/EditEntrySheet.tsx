'use client';

import { useState } from 'react';
import BottomSheet from '@/components/ui/BottomSheet';
import type { Entry, PersonEntry } from '@/lib/types';
import { parseEntry, formatAmount } from '@/lib/parser';

type AnyEntry = Entry | PersonEntry;

interface EditEntrySheetProps {
  entry: AnyEntry;
  onSave: (rawText: string) => void;
  onClose: () => void;
}

export default function EditEntrySheet({ entry, onSave, onClose }: EditEntrySheetProps) {
  const [raw, setRaw] = useState(entry.rawText);
  const parsed = parseEntry(raw);

  const handleSave = () => {
    if (!parsed.isValid) return;
    onSave(raw.trim());
  };

  return (
    <BottomSheet title="Edit Entry" onClose={onClose}>
      <div className="p-4 flex flex-col gap-4">
        <div>
          <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--color-text-muted)' }}>
            Entry Text
          </label>
          <input
            type="text"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm font-mono outline-none"
            style={{
              background: 'var(--color-surface-2)',
              border: `1px solid ${parsed.isValid ? 'var(--color-accent)' : 'var(--color-border)'}`,
              color: 'var(--color-text)',
            }}
            autoFocus
            spellCheck={false}
          />
        </div>

        {parsed.isValid && (
          <div
            className="flex items-center justify-between p-3 rounded-xl"
            style={{ background: 'var(--color-surface-2)' }}
          >
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {parsed.note || 'No note'}
            </span>
            <span
              className="font-mono font-bold"
              style={{ color: parsed.amount >= 0 ? 'var(--color-income)' : 'var(--color-expense)' }}
            >
              {formatAmount(parsed.amount)}
            </span>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-medium"
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!parsed.isValid}
            className="flex-1 py-3 rounded-xl text-sm font-semibold"
            style={{
              background: parsed.isValid ? 'var(--color-accent)' : 'var(--color-text-dim)',
              color: 'var(--color-on-accent)',
            }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
