'use client';

import { useState } from 'react';
import { Eye, EyeOff, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { VaultItem } from '@/lib/types';
import { VAULT_TEMPLATES } from '@/lib/types';

interface VaultCardProps {
  item: VaultItem;
  onDelete: () => void;
}

export function VaultCard({ item, onDelete }: VaultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const template = VAULT_TEMPLATES[item.type];

  const maskValue = (val: string) => {
    if (!val) return '—';
    if (!revealed) return '••••••••';
    return val;
  };

  return (
    <div
      className="mx-4 mb-3 rounded-2xl overflow-hidden"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 p-4 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-xl">{template?.icon || '📄'}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
            {item.title}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {template?.label || item.type}
          </p>
        </div>
        {expanded ? (
          <ChevronUp size={18} style={{ color: 'var(--color-text-muted)' }} />
        ) : (
          <ChevronDown size={18} style={{ color: 'var(--color-text-muted)' }} />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div
          className="px-4 pb-4 animate-fade-in"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <div className="pt-3 flex flex-col gap-2">
            {Object.entries(item.fields).map(([key, val]) => (
              <div key={key} className="flex justify-between items-center">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {key}
                </span>
                <span
                  className="text-sm font-mono font-medium"
                  style={{ color: 'var(--color-text)' }}
                >
                  {maskValue(val)}
                </span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setRevealed(!revealed)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
            >
              {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
              {revealed ? 'Hide' : 'Reveal'}
            </button>
            <button
              onClick={onDelete}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium"
              style={{ background: 'var(--color-expense-bg)', color: 'var(--color-expense)' }}
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
