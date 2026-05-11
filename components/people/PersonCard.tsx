'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Trash2, Pencil, ChevronRight } from 'lucide-react';
import { formatAmount } from '@/lib/parser';
import type { Person } from '@/lib/types';

interface PersonCardProps {
  person: Person;
  balance: number;
  entryCount: number;
  onClick: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

export default function PersonCard({
  person,
  balance,
  entryCount,
  onClick,
  onDelete,
  onEdit,
}: PersonCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isPositive = balance > 0;
  const isZero = balance === 0;

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  return (
    <div className="mx-4 mb-3 relative">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3.5 rounded-2xl px-4 py-3.5 text-left transition-all duration-200 active:opacity-90"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-card-sm)',
        }}
      >
        {/* Avatar */}
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold"
          style={{
            background: isZero
              ? 'var(--color-surface-2)'
              : isPositive
                ? 'var(--color-income-bg)'
                : 'var(--color-expense-bg)',
            color: isZero ? 'var(--color-text-muted)' : isPositive ? 'var(--color-income)' : 'var(--color-expense)',
          }}
        >
          {person.name.charAt(0).toUpperCase()}
        </div>

        {/* Name + note */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.9375rem] font-semibold leading-tight tracking-tight" style={{ color: 'var(--color-text)' }}>
            {person.name}
          </p>
          <p className="mt-1 truncate text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
            {person.note && ` · ${person.note}`}
          </p>
        </div>

        {/* Balance + chevron */}
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="amount-mono text-base font-semibold tabular-nums"
            style={{
              color: isZero ? 'var(--color-text-muted)' : isPositive ? 'var(--color-income)' : 'var(--color-expense)',
            }}
          >
            {isZero ? '₹0' : formatAmount(balance)}
          </span>
          <ChevronRight size={16} style={{ color: 'var(--color-text-dim)' }} />
        </div>
      </button>

      {/* 3-dot menu */}
      <div className="absolute right-2 top-2" ref={menuRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-opacity active:opacity-70"
          style={{ color: 'var(--color-text-dim)' }}
          aria-label="More options"
        >
          <MoreVertical size={16} />
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 top-10 z-30 animate-fade-in overflow-hidden rounded-xl py-1"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border-2)',
              boxShadow: 'var(--shadow-card)',
              minWidth: 160,
            }}
          >
            <button
              type="button"
              onClick={() => { setMenuOpen(false); onEdit(); }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[0.8125rem] font-medium transition-opacity active:opacity-80"
              style={{ color: 'var(--color-text)' }}
            >
              <Pencil size={14} />
              Edit
            </button>
            <button
              type="button"
              onClick={() => { setMenuOpen(false); onDelete(); }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[0.8125rem] font-medium transition-opacity active:opacity-80"
              style={{ color: 'var(--color-expense)' }}
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
