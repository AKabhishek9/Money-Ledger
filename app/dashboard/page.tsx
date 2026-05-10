'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, ArrowUpRight, ArrowDownRight, ArrowRightLeft, ChevronRight } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const { sections, transactions, loading, isError, refresh } = useData();

  const totalBalance = sections.reduce((s, sec) => s + sec.balance, 0);
  const now = new Date();

  if (loading) return (
    <div className="space-y-6">
      <div className="skeleton h-24 rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="skeleton h-40 rounded-2xl" />)}
      </div>
    </div>
  );

  const txIcon = (type: string) => {
    if (type === 'income') return <ArrowUpRight size={14} style={{ color: 'var(--accent-success)' }} />;
    if (type === 'expense') return <ArrowDownRight size={14} style={{ color: 'var(--accent-danger)' }} />;
    return <ArrowRightLeft size={14} style={{ color: '#74b9ff' }} />;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Good {now.getHours() < 12 ? 'Morning' : now.getHours() < 17 ? 'Afternoon' : 'Evening'},{' '}
            {user?.displayName?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-3xl font-bold mt-2" style={{ color: 'var(--accent-primary)' }}>
            {formatCurrency(totalBalance)}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Total across all sections</p>
        </div>
        <Link href="/dashboard/transactions" className="btn-primary text-sm flex items-center gap-2 no-underline">
          <Plus size={16} /> Add
        </Link>
      </div>

      {isError && (
        <div className="p-4 rounded-xl flex items-center justify-between gap-4"
          style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)' }}>
          <p className="text-sm" style={{ color: 'var(--accent-danger)' }}>Failed to load. Check your connection.</p>
          <button onClick={refresh} className="btn-secondary text-xs px-4">Retry</button>
        </div>
      )}

      {/* Sections Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
            Your Sections
          </h2>
          <Link href="/dashboard/sections" className="text-xs font-medium" style={{ color: 'var(--accent-primary)' }}>
            Manage
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sections.map(sec => {
            const secTx = transactions.filter(t => t.sectionId === sec.id).slice(0, 2);
            return (
              <Link
                key={sec.id}
                href={`/dashboard/ledger?section=${sec.id}`}
                className="block p-5 rounded-2xl no-underline group transition-all duration-200 hover:scale-[1.02]"
                style={{
                  background: 'var(--bg-surface)',
                  border: `1px solid var(--border-subtle)`,
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {/* Section Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                      style={{ background: `${sec.color}25`, color: sec.color }}>
                      {sec.name[0].toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {sec.name}
                    </span>
                  </div>
                  <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--text-tertiary)' }} />
                </div>

                {/* Balance */}
                <p className="text-2xl font-bold mb-3"
                  style={{ color: sec.balance >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                  {formatCurrency(sec.balance)}
                </p>

                {/* Last 2 transactions */}
                {secTx.length > 0 ? (
                  <div className="space-y-1.5">
                    {secTx.map(tx => (
                      <div key={tx.id} className="flex items-center gap-1.5">
                        {txIcon(tx.type)}
                        <span className="text-xs truncate flex-1" style={{ color: 'var(--text-tertiary)' }}>
                          {tx.note || tx.category || tx.type}
                        </span>
                        <span className="text-xs font-medium" style={{
                          color: tx.type === 'income' ? 'var(--accent-success)' : 'var(--accent-danger)'
                        }}>
                          {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No transactions yet</p>
                )}
              </Link>
            );
          })}

          {/* Add Section Card */}
          <Link href="/dashboard/sections"
            className="flex flex-col items-center justify-center p-5 rounded-2xl no-underline transition-all duration-200 hover:scale-[1.02]"
            style={{ border: '2px dashed var(--border-default)', color: 'var(--text-tertiary)' }}>
            <Plus size={24} className="mb-2" />
            <span className="text-sm font-medium">New Section</span>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-tertiary)' }}>
          Recent Activity
        </h2>
        <div className="space-y-2">
          {transactions.slice(0, 8).map(tx => {
            const sec = sections.find(s => s.id === tx.sectionId);
            return (
              <div key={tx.id} className="flex items-center gap-4 p-4 rounded-xl"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: 'var(--bg-surface-hover)' }}>
                  {txIcon(tx.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {tx.note || tx.category || tx.type}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {sec?.name || 'Unknown'} · {formatDate(tx.date instanceof Date ? tx.date : new Date(tx.date))}
                  </p>
                </div>
                <p className="text-sm font-bold"
                  style={{ color: tx.type === 'income' ? 'var(--accent-success)' : tx.type === 'expense' ? 'var(--accent-danger)' : 'var(--text-primary)' }}>
                  {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}{formatCurrency(tx.amount)}
                </p>
              </div>
            );
          })}
          {transactions.length === 0 && (
            <div className="text-center py-12 rounded-xl" style={{ background: 'var(--bg-surface)' }}>
              <p style={{ color: 'var(--text-tertiary)' }}>No transactions yet</p>
              <Link href="/dashboard/transactions" className="btn-primary text-sm mt-4 inline-block no-underline">
                Add First Transaction
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
