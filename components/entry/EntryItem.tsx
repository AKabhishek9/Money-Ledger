'use client';

import { useState } from 'react';
import { Trash2, Pencil, Calendar, ChevronRight, UserRound } from 'lucide-react';
import type { Entry, PersonEntry } from '@/lib/types';
import { formatAmount, formatAmountAbs } from '@/lib/parser';
import { formatRelativeDate } from '@/lib/utils';

type AnyEntry = (Entry | PersonEntry) & { note: string; amount: number; entryDate: Date; rawText: string };

interface EntryItemProps {
  entry: AnyEntry;
  onDelete: () => void;
  onEdit?: () => void;
  showDate?: boolean;
  runningBalance?: number;
}

export default function EntryItem({
  entry,
  onDelete,
  onEdit,
  showDate = true,
  runningBalance,
}: EntryItemProps) {
  const [showActions, setShowActions] = useState(false);

  const isPositive = entry.amount >= 0;

  return (
    <div className="relative">
      {/* Main row */}
      <div
        className="flex items-center gap-3 px-4 py-3 active:opacity-80 transition-opacity"
        style={{ borderBottom: '1px solid var(--color-border)' }}
        onClick={() => setShowActions(!showActions)}
      >
        {/* Amount indicator */}
        <div
          className="w-1 self-stretch rounded-full shrink-0"
          style={{
            background: isPositive ? 'var(--color-income)' : 'var(--color-expense)',
            minHeight: 32,
          }}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div
            className="text-sm truncate font-medium"
            style={{ color: entry.note ? 'var(--color-text)' : 'var(--color-text-muted)' }}
          >
            {entry.note || entry.rawText}
          </div>
          {showDate && (
            <div className="flex items-center gap-1 mt-0.5">
              <Calendar size={11} style={{ color: 'var(--color-text-dim)' }} />
              <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
                {formatRelativeDate(entry.entryDate)}
              </span>
            </div>
          )}
          {'linkedPersonName' in entry && entry.linkedPersonName && (
            <div
              className="flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-md w-fit"
              style={{ background: 'var(--color-accent-bg)', color: 'var(--color-accent)' }}
            >
              <UserRound size={10} />
              <span className="text-[10px] leading-none truncate max-w-28">
                {entry.linkedPersonName}
              </span>
            </div>
          )}
        </div>

        {/* Amount + running balance */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex flex-col items-end gap-0.5">
            <span
              className="font-mono font-semibold text-base"
              style={{ color: isPositive ? 'var(--color-income)' : 'var(--color-expense)' }}
            >
              {formatAmount(entry.amount)}
            </span>
            {runningBalance !== undefined && (
              <span className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>
                = {runningBalance < 0 ? '-' : ''}{formatAmountAbs(runningBalance)}
              </span>
            )}
          </div>
          <ChevronRight
            size={14}
            style={{
              color: 'var(--color-text-dim)',
              transform: showActions ? 'rotate(90deg)' : 'rotate(0)',
              transition: 'transform 0.15s',
            }}
          />
        </div>
      </div>

      {/* Action panel */}
      {showActions && (
        <div
          className="flex items-center gap-2 px-4 py-2 animate-fade-in"
          style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}
        >
          <span
            className="flex-1 text-xs font-mono truncate"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Raw: {entry.rawText}
          </span>
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowActions(false); onEdit(); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: 'var(--color-accent-bg)', color: 'var(--color-accent)' }}
            >
              <Pencil size={13} />
              Edit
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setShowActions(false); onDelete(); }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: 'var(--color-expense-bg)', color: 'var(--color-expense)' }}
          >
            <Trash2 size={13} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
