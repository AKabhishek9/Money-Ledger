'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Shield, Lock } from 'lucide-react';
import Header from '@/components/layout/Header';
import Loader from '@/components/ui/Loader';
import { VaultCard } from '@/components/vault/VaultCard';
import VaultForm from '@/components/vault/VaultForm';
import Confirm from '@/components/ui/Confirm';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/lib/db';
import { queueSync } from '@/lib/sync';
import type { VaultItem, VaultType } from '@/lib/types';
import { v4 as uuid } from 'uuid';

export default function VaultContent() {
  const { userId } = useAuth();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<VaultItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VaultItem | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const db = getDb();
      const data = await db.vault.where('userId').equals(userId).sortBy('createdAt');
      setItems(data.reverse());
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Re-fetch vault items when browser tab becomes visible or remote sync happens
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };
    const handleRemoteSync = (event: Event) => {
      const collection = (event as CustomEvent<{ collection?: string }>).detail?.collection;
      if (collection === 'vault') load();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('money-ledger-remote-sync', handleRemoteSync);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('money-ledger-remote-sync', handleRemoteSync);
    };
  }, [load]);

  const handleAdd = async (type: VaultType, title: string, fields: Record<string, string>) => {
    if (!userId) return;
    const db = getDb();
    const now = new Date();
    const item: VaultItem = {
      id: uuid(),
      userId: userId,
      type,
      title,
      fields,
      createdAt: now,
      updatedAt: now,
    };
    await db.vault.add(item);
    await queueSync('vault', 'upsert', item.id, item as unknown as Record<string, unknown>);
    load();
  };

  const handleEdit = async (type: VaultType, title: string, fields: Record<string, string>) => {
    if (!editTarget) return;
    const db = getDb();
    const updated: Partial<VaultItem> = {
      type,
      title,
      fields,
      updatedAt: new Date(),
    };
    await db.vault.update(editTarget.id, updated);
    await queueSync('vault', 'upsert', editTarget.id, {
      ...editTarget,
      ...updated,
    } as unknown as Record<string, unknown>);
    setEditTarget(null);
    load();
  };

  const handleDelete = async (item: VaultItem) => {
    const db = getDb();
    await db.vault.delete(item.id);
    await queueSync('vault', 'delete', item.id);
    setDeleteTarget(null);
    load();
  };

  const filtered = search.trim()
    ? items.filter(
        (i) =>
          i.title.toLowerCase().includes(search.toLowerCase()) ||
          i.type.toLowerCase().includes(search.toLowerCase()) ||
          Object.values(i.fields).some((value) =>
            value.toLowerCase().includes(search.toLowerCase())
          )
      )
    : items;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Secure Information Vault"
        rightAction={
          <button
            onClick={() => { setEditTarget(null); setShowForm(true); }}
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
          >
            <Plus size={20} />
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Security notice card */}
        <div className="px-4 pt-4 pb-2">
          <div
            className="flex items-center gap-3 rounded-2xl p-4"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border-2)',
              boxShadow: 'var(--shadow-card-sm)',
            }}
          >
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'var(--color-gold-bg)' }}
            >
              <Shield size={20} style={{ color: 'var(--color-gold)' }} />
            </div>
            <p className="text-[0.8125rem] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
              Vault items are encrypted and stored securely in your private account. Only you can access them.
            </p>
          </div>
        </div>

        {/* Search bar */}
        {items.length > 3 && (
          <div className="px-4 mb-3">
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <Search size={15} style={{ color: 'var(--color-text-muted)' }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vault…"
                className="flex-1 text-sm outline-none bg-transparent"
                style={{ color: 'var(--color-text)' }}
              />
            </div>
          </div>
        )}

        {/* Section header */}
        {filtered.length > 0 && (
          <div className="px-4 pt-2 pb-1">
            <p className="text-balance-label">Your Secure Items</p>
          </div>
        )}

        {loading ? (
          <Loader label="Loading vault..." />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4"
              style={{ background: 'var(--color-surface-2)' }}
            >
              <Lock size={28} style={{ color: 'var(--color-text-dim)' }} />
            </div>
            <p className="font-semibold text-base mb-1" style={{ color: 'var(--color-text)' }}>
              {search ? 'No matches' : 'Vault is empty'}
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {search ? 'Try a different search' : 'Store bank details, cards, and secure notes'}
            </p>
          </div>
        ) : (
          <div className="pt-1">
            {filtered.map((item) => (
              <VaultCard
                key={item.id}
                item={item}
                onDelete={() => setDeleteTarget(item)}
                onEdit={() => { setEditTarget(item); setShowForm(true); }}
              />
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <VaultForm
          initialItem={editTarget}
          onSave={editTarget ? handleEdit : handleAdd}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
        />
      )}

      {deleteTarget && (
        <Confirm
          title="Delete vault item?"
          message={`"${deleteTarget.title}" will be permanently deleted.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
