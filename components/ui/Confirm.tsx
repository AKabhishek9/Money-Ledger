'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function Confirm({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-6 animate-fade-in"
      style={{ background: 'var(--color-modal-backdrop)' }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 animate-scale-in glass-heavy">

        <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--color-text)' }}>
          {title}
        </h3>
        <p className="text-sm mb-5" style={{ color: 'var(--color-text-muted)' }}>
          {message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="glass-btn-secondary flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{
              color: 'var(--color-text-muted)',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="glass-btn-primary flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{
              background: danger ? 'var(--color-expense)' : undefined,
              color: 'var(--color-on-accent)',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
