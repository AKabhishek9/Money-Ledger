'use client';

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
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fade-in"
      style={{ background: 'var(--color-modal-backdrop)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 animate-scale-in"
        style={{ background: 'var(--color-surface)' }}
      >
        <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--color-text)' }}>
          {title}
        </h3>
        <p className="text-sm mb-5" style={{ color: 'var(--color-text-muted)' }}>
          {message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{
              background: 'var(--color-surface-2)',
              color: 'var(--color-text-muted)',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{
              background: danger ? 'var(--color-expense)' : 'var(--color-accent)',
              color: 'var(--color-on-accent)',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
