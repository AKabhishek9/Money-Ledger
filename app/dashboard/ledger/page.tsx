'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { addTransaction, deleteTransaction, getTransactions } from '@/lib/firestore';
import { formatCurrency, formatDate, formatDateInput } from '@/lib/utils';
import ConfirmModal from '@/components/ConfirmModal';
import type { Transaction, TransactionType } from '@/lib/types';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/types';
import {
  ArrowLeft, Plus, X, Trash2, Pencil, TrendingUp, TrendingDown
} from 'lucide-react';

interface LedgerEntry extends Transaction {
  runningBalance: number;
}

function LedgerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sectionId = searchParams.get('section') || '';
  const { user } = useAuth();
  const { sections, refresh } = useData();

  const section = sections.find(s => s.id === sectionId);

  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [txType, setTxType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(formatDateInput(new Date()));
  const [submitting, setSubmitting] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [confirmDeleteTx, setConfirmDeleteTx] = useState<string | null>(null);

  const loadLedger = async () => {
    if (!user || !sectionId) return;
    setLoadingLedger(true);
    try {
      let allTx: Transaction[] = [];
      let lastDoc: unknown = null;
      let hasMore = true;
      while (hasMore) {
        const result = await getTransactions(user.uid, 100, lastDoc || undefined);
        const sectionTx = result.data.filter(tx => tx.sectionId === sectionId || tx.toSectionId === sectionId);
        allTx = [...allTx, ...sectionTx];
        lastDoc = result.lastDoc;
        hasMore = result.lastDoc !== null;
        if (result.data.length < 100) break;
      }

      const sorted = [...allTx].sort((a, b) => {
        const da = a.date instanceof Date ? a.date : new Date(a.date);
        const db = b.date instanceof Date ? b.date : new Date(b.date);
        return da.getTime() - db.getTime();
      });

      let running = 0;
      const withBalance: LedgerEntry[] = sorted.map(tx => {
        if (tx.type === 'income') running += tx.amount;
        else if (tx.type === 'expense') running -= tx.amount;
        else if (tx.type === 'transfer') {
          if (tx.sectionId === sectionId) running -= tx.amount;
          else running += tx.amount;
        } else if (tx.type === 'loan') {
          if (tx.loanDirection === 'given') running -= tx.amount;
          else running += tx.amount;
        }
        return { ...tx, runningBalance: running };
      });

      setLedger(withBalance.reverse());
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLedger(false);
    }
  };

  useEffect(() => {
    loadLedger();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, sectionId]);

  const handleEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setAmount(String(tx.amount));
    setNote(tx.note || '');
    setCategory(tx.category || '');
    setDate(formatDateInput(tx.date instanceof Date ? tx.date : new Date(tx.date)));
    setTxType(tx.type);
    setShowModal(true);
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDeleteTx) return;
    try {
      await deleteTransaction(confirmDeleteTx);
      refresh();
      await loadLedger();
    } catch (e) { console.error(e); }
    finally { setConfirmDeleteTx(null); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount || !sectionId) return;
    setSubmitting(true);
    try {
      if (editingTx) {
        await deleteTransaction(editingTx.id);
        setEditingTx(null);
      }
      await addTransaction(user.uid, {
        sectionId,
        type: txType,
        amount: parseFloat(amount),
        category,
        note,
        date: new Date(date),
      });
      refresh();
      await loadLedger();
      setShowModal(false);
      setAmount('');
      setNote('');
      setCategory('');
      setDate(formatDateInput(new Date()));
      setTxType('expense');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!sectionId || (!section && !loadingLedger)) {
    return (
      <div className="text-center py-24">
        <p style={{ color: 'var(--text-secondary)' }}>Section not found.</p>
        <Link href="/dashboard" className="btn-primary text-sm mt-4 inline-block no-underline">Go Home</Link>
      </div>
    );
  }

  if (!section) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-12 rounded-xl" />
        <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  const totalIn = ledger.filter(t => t.type === 'income' || (t.type === 'transfer' && t.toSectionId === sectionId)).reduce((s, t) => s + t.amount, 0);
  const totalOut = ledger.filter(t => t.type === 'expense' || (t.type === 'transfer' && t.sectionId === sectionId)).reduce((s, t) => s + t.amount, 0);
  const categories = txType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="btn-ghost p-2 rounded-xl">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold"
              style={{ background: `${section.color}25`, color: section.color }}>
              {section.name[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{section.name}</h1>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{ledger.length} transactions</p>
            </div>
          </div>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary text-sm flex items-center gap-2">
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Current Balance</p>
          <p className="text-xl font-bold" style={{ color: section.balance >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
            {formatCurrency(section.balance)}
          </p>
        </div>
        <div className="p-4 rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs mb-1 flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
            <TrendingUp size={12} /> Total In
          </p>
          <p className="text-xl font-bold" style={{ color: 'var(--accent-success)' }}>
            {formatCurrency(totalIn)}
          </p>
        </div>
        <div className="p-4 rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs mb-1 flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
            <TrendingDown size={12} /> Total Out
          </p>
          <p className="text-xl font-bold" style={{ color: 'var(--accent-danger)' }}>
            {formatCurrency(totalOut)}
          </p>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
        <div className="grid grid-cols-[1fr_2fr_auto_auto_auto] gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b"
          style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border-subtle)' }}>
          <span>Date</span>
          <span>Description</span>
          <span className="text-right">Amount</span>
          <span className="text-right">Balance</span>
          <span></span>
        </div>

        {loadingLedger ? (
          <div className="space-y-px">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="grid grid-cols-[1fr_2fr_auto_auto_auto] gap-4 px-5 py-4">
                {[1,2,3,4,5].map(j => <div key={j} className="skeleton h-4 rounded" />)}
              </div>
            ))}
          </div>
        ) : ledger.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>No transactions yet in this section</p>
            <button onClick={() => setShowModal(true)} className="btn-primary text-sm">Add First Transaction</button>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {ledger.map((tx) => {
              const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);
              const isIn = tx.type === 'income' || (tx.type === 'transfer' && tx.toSectionId === sectionId);
              return (
                <div key={tx.id}
                  className="grid grid-cols-[1fr_2fr_auto_auto_auto] gap-4 px-5 py-4 group hover:bg-[var(--bg-surface-hover)] transition-colors items-center">
                  <div>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                      {txDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {txDate.getFullYear()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {tx.note || tx.category || tx.type}
                    </p>
                    {tx.category && tx.note && (
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{tx.category}</p>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full mt-1"
                      style={{
                        background: tx.type === 'income' ? 'rgba(0,184,148,0.1)' : tx.type === 'expense' ? 'rgba(225,112,85,0.1)' : 'rgba(108,92,231,0.1)',
                        color: tx.type === 'income' ? 'var(--accent-success)' : tx.type === 'expense' ? 'var(--accent-danger)' : 'var(--accent-primary)',
                      }}>
                      {tx.type}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-right min-w-[80px]"
                    style={{ color: isIn ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                    {isIn ? '+' : '-'}{formatCurrency(tx.amount)}
                  </p>
                  <p className="text-sm font-bold text-right min-w-[80px]"
                    style={{ color: tx.runningBalance >= 0 ? 'var(--text-primary)' : 'var(--accent-danger)' }}>
                    {formatCurrency(tx.runningBalance)}
                  </p>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(tx)} className="btn-ghost p-1" title="Edit">
                      <Pencil size={13} style={{ color: 'var(--accent-primary)' }} />
                    </button>
                    <button onClick={() => setConfirmDeleteTx(tx.id)} className="btn-ghost p-1" title="Delete">
                      <Trash2 size={13} style={{ color: 'var(--accent-danger)' }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Transaction Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditingTx(null); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {editingTx ? 'Edit Transaction' : `Add to ${section.name}`}
              </h2>
              <button onClick={() => { setShowModal(false); setEditingTx(null); }} className="btn-ghost p-1"><X size={20} /></button>
            </div>

            <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: 'var(--bg-surface)' }}>
              {(['expense', 'income', 'transfer', 'loan'] as TransactionType[]).map(t => (
                <button key={t} onClick={() => setTxType(t)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize ${txType === t ? 'text-white' : ''}`}
                  style={txType === t ? {
                    background: t === 'income' ? 'var(--accent-success)' : t === 'expense' ? 'var(--accent-danger)' : 'var(--accent-primary)'
                  } : { color: 'var(--text-secondary)' }}>
                  {t}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Amount (₹)</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0.00" className="input-field text-2xl font-bold" required min="0.01" step="0.01" autoFocus />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Note</label>
                <input type="text" value={note} onChange={e => setNote(e.target.value)}
                  placeholder="e.g. ration, electricity, salary..." className="input-field" />
              </div>

              {(txType === 'income' || txType === 'expense') && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Category (optional)</label>
                  <div className="grid grid-cols-5 gap-2">
                    {categories.map(c => (
                      <button key={c.name} type="button" onClick={() => setCategory(c.name)}
                        className="flex flex-col items-center gap-1 p-2 rounded-lg text-xs transition-all"
                        style={{
                          background: category === c.name ? `${c.color}20` : 'var(--bg-surface)',
                          border: category === c.name ? `1px solid ${c.color}40` : '1px solid transparent',
                        }}>
                        <span className="text-lg">{c.icon}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-field" />
              </div>

              <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
                {submitting ? 'Saving...' : editingTx ? 'Save Changes' : `Add ${txType}`}
              </button>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmDeleteTx}
        title="Delete Transaction"
        message="This will delete the transaction and reverse its balance impact."
        confirmLabel="Delete"
        danger
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmDeleteTx(null)}
      />
    </div>
  );
}

export default function LedgerPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="skeleton h-12 rounded-xl" />
        <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    }>
      <LedgerContent />
    </Suspense>
  );
}
