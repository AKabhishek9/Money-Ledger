'use client';

import { useState } from 'react';
import { ChevronRight, Copy, Check } from 'lucide-react';
import type { VaultItem } from '@/lib/types';
import { VAULT_TEMPLATES } from '@/lib/types';

interface VaultCardProps {
  item: VaultItem;
  onDelete: () => void;
}

export function VaultCard({ item, onDelete }: VaultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const tmpl = VAULT_TEMPLATES[item.type];

  const handleCopy = (value: string, field: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  return (
    <div
      className="mx-4 mb-3 overflow-hidden rounded-2xl transition-all duration-200"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: expanded ? 'var(--shadow-card)' : 'var(--shadow-card-sm)',
      }}
    >
      {/* Header row */}
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-opacity active:opacity-90"
        onClick={() => setExpanded(!expanded)}
      >
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
          style={{ background: 'var(--color-surface-2)' }}
        >
          {tmpl?.icon || '🔒'}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.9375rem] font-semibold leading-tight" style={{ color: 'var(--color-text)' }}>
            {item.title}
          </p>
          <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {tmpl?.label || item.type} · {Object.keys(item.fields).length} fields
          </p>
        </div>

        <ChevronRight
          size={18}
          strokeWidth={2}
          className="shrink-0 transition-transform duration-200"
          style={{
            color: 'var(--color-text-dim)',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {/* Expanded fields */}
      {expanded && (
        <div
          className="animate-fade-in border-t px-4 py-3"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {Object.entries(item.fields).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="text-[0.625rem] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                  {key}
                </p>
                <p className="mt-0.5 truncate font-mono text-sm" style={{ color: 'var(--color-text)' }}>
                  {value || '—'}
                </p>
              </div>
              {value && (
                <button
                  type="button"
                  onClick={() => handleCopy(value, key)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-opacity active:opacity-70"
                  style={{
                    background: copiedField === key ? 'var(--color-income-bg)' : 'var(--color-surface-2)',
                    color: copiedField === key ? 'var(--color-income)' : 'var(--color-text-muted)',
                  }}
                >
                  {copiedField === key ? <Check size={14} /> : <Copy size={14} />}
                </button>
              )}
            </div>
          ))}

          {/* Delete */}
          <button
            type="button"
            onClick={onDelete}
            className="mt-2 w-full rounded-xl py-2.5 text-xs font-semibold transition-opacity active:opacity-80"
            style={{ background: 'var(--color-expense-bg)', color: 'var(--color-expense)' }}
          >
            Delete Item
          </button>
        </div>
      )}
    </div>
  );
}
