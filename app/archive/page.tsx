'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { RotateCcw, Trash2, Archive, ChevronRight } from 'lucide-react';
import AuthGuard from '@/components/auth/AuthGuard';
import AppLayout from '@/components/layout/AppLayout';
import Header from '@/components/layout/Header';
import WindowView from '@/components/windows/WindowView';
import Loader from '@/components/ui/Loader';
import Confirm from '@/components/ui/Confirm';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/lib/db';
import { localGetEntries } from '@/lib/entries';
import { useStore } from '@/store/useStore';
import { useBackHandler } from '@/hooks/useBackHandler';
import type { MoneyWindow, Tab, Entry } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { formatAmount } from '@/lib/parser';

export default function ArchivePage() {
  return (
    <AuthGuard>
      <AppLayout>
        <ArchiveContent />
      </AppLayout>
    </AuthGuard>
  );
}

type WindowStats = { total: number; count: number; recentEntries: Entry[] };

function ArchiveContent() {
  const { userId } = useAuth();
  const {
    hardDeleteWindow,
    restoreWindow,
    persons,
    updateWindow: updateWindowStore,
  } = useStore();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [archived, setArchived] = useState<MoneyWindow[]>([]);
  const [recycled, setRecycled] = useState<MoneyWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'archive' | 'trash'>('archive');
  const [deleteTarget, setDeleteTarget] = useState<MoneyWindow | null>(null);
  const [windowId, setWindowId] = useState<string | null>(null);
  const [windowStats, setWindowStats] = useState<Record<string, WindowStats>>({});

  const list = activeView === 'archive' ? archived : recycled;
  const selectedWindow = list.find((w) => w.id === windowId) || null;

  // Handle device back button: close window view and return to list
  useBackHandler(!!windowId, () => setWindowId(null), 'archive-window');

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const db = getDb();
      const [archivedWins, recycledWins, tabList] = await Promise.all([
        db.windows
          .where('userId')
          .equals(userId)
          .filter((w) => w.archived && !w.inRecycleBin)
          .toArray(),
        db.windows
          .where('userId')
          .equals(userId)
          .filter((w) => w.inRecycleBin)
          .toArray(),
        db.tabs.where('userId').equals(userId).toArray(),
      ]);
      setTabs(tabList);
      setArchived(archivedWins);
      setRecycled(recycledWins);

      // Load stats for all windows
      const allWins = [...archivedWins, ...recycledWins];
      const stats: Record<string, WindowStats> = {};
      await Promise.all(
        allWins.map(async (w) => {
          const entries = await localGetEntries(w.id);
          stats[w.id] = {
            total: entries.reduce((sum, e) => sum + e.amount, 0),
            count: entries.length,
            recentEntries: entries.slice(-3),
          };
        })
      );
      setWindowStats(stats);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // FIXED: BUG-L9 — refresh when remote sync changes windows
  useEffect(() => {
    const handleRemoteSync = (event: Event) => {
      const collection = (event as CustomEvent<{ collection?: string }>).detail?.collection;
      if (collection === 'windows' || collection === 'entries') load();
    };
    window.addEventListener('money-ledger-remote-sync', handleRemoteSync);
    return () => window.removeEventListener('money-ledger-remote-sync', handleRemoteSync);
  }, [load]);

  // Refresh stats when returning from window view
  useEffect(() => {
    if (windowId === null && !loading) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowId]);

  const getTabName = (tabId: string) =>
    tabs.find((t) => t.id === tabId)?.name || 'Unknown Tab';

  const handleRestoreFromTrash = async (w: MoneyWindow) => {
    await restoreWindow(w.id);
    if (windowId === w.id) setWindowId(null);
    load();
  };

  const handleRestoreFromArchive = async (w: MoneyWindow) => {
    await updateWindowStore(w.id, { archived: false });
    if (windowId === w.id) setWindowId(null);
    load();
  };

  const handlePermanentDelete = async (w: MoneyWindow) => {
    await hardDeleteWindow(w.id);
    setDeleteTarget(null);
    if (windowId === w.id) setWindowId(null);
    load();
  };

  // ── Window detail view ──
  if (selectedWindow) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Header
          title={selectedWindow.title}
          subtitle={`${activeView === 'archive' ? '📦 Archived' : '🗑️ Trash'} · ${getTabName(selectedWindow.tabId)}`}
          showBack
          onBack={() => setWindowId(null)}
          rightAction={
            <div className="flex gap-1">
              <button
                onClick={() =>
                  activeView === 'archive'
                    ? handleRestoreFromArchive(selectedWindow)
                    : handleRestoreFromTrash(selectedWindow)
                }
                className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold"
                style={{ background: 'var(--color-accent-bg)', color: 'var(--color-accent)' }}
              >
                <RotateCcw size={14} />
                Restore
              </button>
              <button
                onClick={() => setDeleteTarget(selectedWindow)}
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-expense)' }}
              >
                <Trash2 size={18} />
              </button>
            </div>
          }
        />
        <div className="flex-1 min-h-0 flex flex-col">
          <WindowView
            moneyWindow={selectedWindow}
            userId={userId!}
            onBack={() => setWindowId(null)}
            persons={persons}
          />
        </div>

        {deleteTarget && (
          <Confirm
            title="Delete forever?"
            message={`"${deleteTarget.title}" and all its entries will be permanently deleted. This cannot be undone.`}
            confirmLabel="Delete Forever"
            danger
            onConfirm={() => handlePermanentDelete(deleteTarget)}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </div>
    );
  }

  // ── Archive & Trash list ──
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Archive & Trash" />

      {/* Segmented control */}
      <div className="px-4 pb-2 pt-2 shrink-0">
        <div
          className="flex gap-1 rounded-2xl p-1"
          style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
          role="tablist"
        >
          {(['archive', 'trash'] as const).map((v) => {
            const active = activeView === v;
            return (
              <button
                type="button"
                key={v}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveView(v)}
                className="relative flex-1 rounded-xl py-2.5 text-center text-xs font-semibold uppercase tracking-wide transition-[color,transform,background] duration-200"
                style={{
                  background: active ? 'var(--color-surface)' : 'transparent',
                  color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
                  boxShadow: active ? '0 1px 0 rgba(74, 74, 74, 0.08) inset' : undefined,
                }}
              >
                {v === 'archive' ? `Archive (${archived.length})` : `Trash (${recycled.length})`}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <Loader label="Loading archive..." />
      ) : list.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-16 text-center px-6">
          <div className="text-4xl mb-3">{activeView === 'archive' ? '📦' : '🗑️'}</div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
            {activeView === 'archive' ? 'No archived pages' : 'Trash is empty'}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pb-24">
          <div className="flex flex-col gap-3 px-4 pt-2">
            {list.map((w) => {
              const stats = windowStats[w.id];
              const total = stats?.total ?? 0;
              const count = stats?.count ?? 0;
              return (
                <div
                  key={w.id}
                  className="surface-card rounded-2xl overflow-hidden transition-[transform,opacity] duration-150 active:scale-[0.99] active:opacity-95"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                >
                  {/* Tappable card area */}
                  <button
                    type="button"
                    onClick={() => setWindowId(w.id)}
                    className="w-full text-left p-4 pb-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>
                          {w.title}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                          {getTabName(w.tabId)} · {formatDate(w.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {count > 0 && (
                          <div className="text-right">
                            <p
                              className="amount-mono text-sm font-semibold tabular-nums"
                              style={{ color: total >= 0 ? 'var(--color-income)' : 'var(--color-expense)' }}
                            >
                              {formatAmount(total)}
                            </p>
                            <p className="text-[0.625rem] mt-0.5" style={{ color: 'var(--color-text-dim)' }}>
                              {count} {count === 1 ? 'entry' : 'entries'}
                            </p>
                          </div>
                        )}
                        <ChevronRight size={16} style={{ color: 'var(--color-text-dim)' }} />
                      </div>
                    </div>

                    {/* Recent entries preview */}
                    {stats && stats.recentEntries.length > 0 && (
                      <div className="mt-2.5 pt-2.5 flex flex-col gap-1" style={{ borderTop: '1px solid var(--color-border)' }}>
                        {stats.recentEntries.map((entry) => (
                          <div key={entry.id} className="flex items-center justify-between">
                            <p className="truncate text-xs" style={{ color: 'var(--color-text-muted)' }}>
                              {entry.note || entry.rawText}
                            </p>
                            <span
                              className="amount-mono shrink-0 ml-2 text-xs font-medium tabular-nums"
                              style={{ color: entry.amount >= 0 ? 'var(--color-income)' : 'var(--color-expense)' }}
                            >
                              {formatAmount(entry.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </button>

                  {/* Action buttons */}
                  <div className="flex gap-px" style={{ borderTop: '1px solid var(--color-border)' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        activeView === 'archive' ? handleRestoreFromArchive(w) : handleRestoreFromTrash(w);
                      }}
                      className="flex min-h-10 flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-opacity duration-150 active:opacity-80"
                      style={{ color: 'var(--color-accent)' }}
                    >
                      <RotateCcw size={13} strokeWidth={2} />
                      Restore
                    </button>
                    <div className="w-px self-stretch" style={{ background: 'var(--color-border)' }} />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(w);
                      }}
                      className="flex min-h-10 flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-opacity duration-150 active:opacity-80"
                      style={{ color: 'var(--color-expense)' }}
                    >
                      <Trash2 size={13} strokeWidth={2} />
                      Delete forever
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {deleteTarget && (
        <Confirm
          title="Delete forever?"
          message={`"${deleteTarget.title}" and all its entries will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete Forever"
          danger
          onConfirm={() => handlePermanentDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
