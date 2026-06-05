'use client';

import BottomSheet from '@/components/ui/BottomSheet';
import { useStore } from '@/store/useStore';
import { ChevronRight } from 'lucide-react';
import type { MoneyWindow } from '@/lib/types';

interface MoveToTabSheetProps {
  window: MoneyWindow;
  onClose: () => void;
  onMoved: () => void;
}

export default function MoveToTabSheet({ window: w, onClose, onMoved }: MoveToTabSheetProps) {
  const { tabs, updateWindow } = useStore();

  // Filter out current tab, then deduplicate by name+type (handles duplicate Personal tabs from sync)
  const seen = new Set<string>();
  const availableTabs = tabs.filter((t) => {
    if (t.id === w.tabId) return false;
    const key = `${t.type}:${t.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const handleMove = async (targetTabId: string) => {
    await updateWindow(w.id, { tabId: targetTabId });
    onMoved();
    onClose();
  };

  return (
    <BottomSheet title={`Move "${w.title}"`} onClose={onClose}>
      <div className="p-4 flex flex-col gap-1">
        {availableTabs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <div className="text-3xl mb-2">📁</div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
              No other tabs available
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-dim)' }}>
              Create a new tab from the More menu first
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs font-medium px-1 mb-2" style={{ color: 'var(--color-text-muted)' }}>
              Move to:
            </p>
            {availableTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleMove(tab.id)}
                className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-[transform,opacity,background] duration-150 active:scale-[0.99] active:opacity-90"
                style={{
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <span className="text-xl leading-none">{tab.icon || '📁'}</span>
                <span
                  className="flex-1 truncate text-sm font-semibold tracking-tight"
                  style={{ color: 'var(--color-text)' }}
                >
                  {tab.name}
                </span>
                <ChevronRight size={16} style={{ color: 'var(--color-text-dim)' }} />
              </button>
            ))}
          </>
        )}
      </div>
    </BottomSheet>
  );
}
