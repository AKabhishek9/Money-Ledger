'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import ConfirmModal from '@/components/ConfirmModal';
import { addPerson, deletePerson } from '@/lib/firestore';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { PersonType, Transaction } from '@/lib/types';
import { Plus, X, Trash2, UserCircle, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function PersonsPage() {
  const { user } = useAuth();
  const { persons, transactions, loading, error, isError, refresh } = useData();

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<PersonType>('loan');
  const [personNote, setPersonNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await addPerson(user.uid, { name, type, note: personNote });
      refresh();
      setShowModal(false); 
      setName(''); 
      setPersonNote('');
    } catch (e: any) { 
      console.error(e);
      setFormError(e.message || 'Failed to add person');
    } finally { 
      setSubmitting(false); 
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deletePerson(confirmDelete);
      refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setConfirmDelete(null);
    }
  };

  // Get loan transactions for a given person and compute running balance
  const getPersonLedger = (personId: string) => {
    const personTx = transactions.filter(tx => tx.personId === personId);
    // Sort oldest first for running balance
    const sorted = [...personTx].sort((a, b) => {
      const da = a.date instanceof Date ? a.date : new Date(a.date);
      const db = b.date instanceof Date ? b.date : new Date(b.date);
      return da.getTime() - db.getTime();
    });
    let running = 0;
    const withBalance = sorted.map(tx => {
      if (tx.loanDirection === 'given') running += tx.amount; // they owe more
      else running -= tx.amount; // they paid back
      return { ...tx, runningBalance: running };
    });
    return withBalance.reverse(); // newest first
  };

  if (loading) return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}</div>;

  const personsList = persons || [];

  return (
    <>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>People</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Manage financial relationships</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary text-sm flex items-center gap-2" id="add-person-btn">
          <Plus size={16} /> Add Person
        </button>
      </div>

      {isError && (
        <div className="p-4 rounded-xl flex items-center justify-between gap-4 animate-fade-in" 
          style={{ background: 'rgba(255, 107, 107, 0.1)', border: '1px solid rgba(255, 107, 107, 0.2)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--accent-danger)' }}>
              <UserCircle size={20} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Sync Error</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Could not fetch latest data. Please check your connection or ad-blocker.</p>
            </div>
          </div>
          <button onClick={refresh} className="btn-secondary text-xs px-4 py-2">Retry</button>
        </div>
      )}

      {personsList.length === 0 ? (
        <div className="text-center py-16 stat-card">
          <UserCircle size={48} className="mx-auto mb-4" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-lg mb-2" style={{ color: 'var(--text-tertiary)' }}>No people added yet</p>
          <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>Add people to track loans and shared finances</p>
          <button onClick={() => setShowModal(true)} className="btn-primary text-sm">Add First Person</button>
        </div>
      ) : (
        <div className="space-y-4">
          {personsList.map((p, i) => {
            const isExpanded = expandedPerson === p.id;
            const personLedger = isExpanded ? getPersonLedger(p.id) : [];
            const previewTx = !isExpanded ? getPersonLedger(p.id).slice(0, 3) : [];

            return (
              <div key={p.id} className="stat-card group animate-fade-in-up" style={{ animationDelay: `${i * 80}ms` }}>
                {/* Person Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                      style={{ background: 'var(--gradient-primary)', color: '#fff' }}>
                      {p.name[0].toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{p.name}</h3>
                      {p.note && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{p.note}</p>}
                      <span className={`badge ${p.type === 'self' ? 'badge-income' : p.type === 'managed' ? 'badge-transfer' : 'badge-loan'} mt-1`}>{p.type}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-bold" style={{ color: p.balance > 0 ? 'var(--accent-success)' : p.balance < 0 ? 'var(--accent-danger)' : 'var(--text-secondary)' }}>
                      {p.balance > 0 ? 'Owes you ' : p.balance < 0 ? 'You owe ' : ''}{formatCurrency(Math.abs(p.balance))}
                    </p>
                    <button onClick={() => setConfirmDelete(p.id)} className="opacity-0 group-hover:opacity-100 transition-opacity btn-ghost p-1" style={{ color: 'var(--accent-danger)' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Preview: last 3 transactions (collapsed) */}
                {!isExpanded && previewTx.length > 0 && (
                  <div className="space-y-1.5 mt-3 mb-2">
                    {previewTx.map(tx => (
                      <div key={tx.id} className="flex items-center gap-2 text-xs">
                        {tx.loanDirection === 'given'
                          ? <ArrowUpRight size={12} style={{ color: 'var(--accent-danger)' }} />
                          : <ArrowDownRight size={12} style={{ color: 'var(--accent-success)' }} />
                        }
                        <span className="flex-1 truncate" style={{ color: 'var(--text-tertiary)' }}>
                          {tx.note || tx.category || (tx.loanDirection === 'given' ? 'Loan given' : 'Loan received')}
                        </span>
                        <span className="font-medium" style={{
                          color: tx.loanDirection === 'given' ? 'var(--accent-danger)' : 'var(--accent-success)'
                        }}>
                          {tx.loanDirection === 'given' ? '-' : '+'}{formatCurrency(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Expand/Collapse Button */}
                {getPersonLedger(p.id).length > 0 && (
                  <button
                    onClick={() => setExpandedPerson(isExpanded ? null : p.id)}
                    className="w-full flex items-center justify-center gap-1 py-2 mt-2 rounded-lg text-xs font-medium transition-colors"
                    style={{ color: 'var(--accent-primary)', background: 'var(--bg-surface-hover)' }}
                  >
                    {isExpanded ? <><ChevronUp size={14} /> Hide History</> : <><ChevronDown size={14} /> View All History ({getPersonLedger(p.id).length})</>}
                  </button>
                )}

                {/* Expanded Ledger */}
                {isExpanded && personLedger.length > 0 && (
                  <div className="mt-4 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="grid grid-cols-[1fr_2fr_auto_auto] gap-3 px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-tertiary)', background: 'var(--bg-surface-hover)' }}>
                      <span>Date</span>
                      <span>Note</span>
                      <span className="text-right">Amount</span>
                      <span className="text-right">Balance</span>
                    </div>
                    <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                      {personLedger.map(tx => {
                        const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);
                        return (
                          <div key={tx.id} className="grid grid-cols-[1fr_2fr_auto_auto] gap-3 px-4 py-3 text-xs items-center hover:bg-[var(--bg-surface-hover)] transition-colors">
                            <span style={{ color: 'var(--text-primary)' }}>
                              {txDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </span>
                            <span style={{ color: 'var(--text-secondary)' }}>
                              {tx.note || tx.category || (tx.loanDirection === 'given' ? 'Loan given' : 'Loan received')}
                            </span>
                            <span className="text-right font-medium" style={{
                              color: tx.loanDirection === 'given' ? 'var(--accent-danger)' : 'var(--accent-success)'
                            }}>
                              {tx.loanDirection === 'given' ? '-' : '+'}{formatCurrency(tx.amount)}
                            </span>
                            <span className="text-right font-bold" style={{
                              color: tx.runningBalance > 0 ? 'var(--accent-success)' : tx.runningBalance < 0 ? 'var(--accent-danger)' : 'var(--text-secondary)'
                            }}>
                              {formatCurrency(Math.abs(tx.runningBalance))}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Add Person</h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1"><X size={20} /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Person's name" className="input-field" required id="person-name" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Type</label>
                <div className="flex gap-2">
                  {(['self', 'managed', 'loan'] as PersonType[]).map(t => (
                    <button key={t} type="button" onClick={() => setType(t)} className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize ${type === t ? 'text-white' : ''}`}
                      style={type === t ? { background: 'var(--accent-primary)' } : { background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Note (optional)</label>
                <input value={personNote} onChange={e => setPersonNote(e.target.value)} placeholder="Relationship, context..." className="input-field" id="person-note" />
              </div>

              {formError && (
                <div className="p-3 rounded-lg text-xs font-medium" style={{ background: 'var(--accent-danger)20', color: 'var(--accent-danger)' }}>
                  {formError}
                </div>
              )}

              <button type="submit" disabled={submitting} className="btn-primary w-full py-3" id="person-submit">
                {submitting ? 'Adding...' : 'Add Person'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>

      <ConfirmModal
        open={!!confirmDelete}
        title="Delete Person"
        message="This will permanently delete this person and all their loan transactions."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </>  
  );
}
