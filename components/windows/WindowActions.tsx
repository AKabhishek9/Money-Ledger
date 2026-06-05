'use client';

import BottomSheet from '@/components/ui/BottomSheet';
import Confirm from '@/components/ui/Confirm';
import MoveToTabSheet from '@/components/windows/MoveToTabSheet';
import type { MoneyWindow } from '@/lib/types';

// ── Add Page Sheet ──────────────────────────────────────────────────────────

interface AddPageSheetProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function AddPageSheet({ value, onChange, onSubmit, onClose }: AddPageSheetProps) {
  return (
    <BottomSheet title="New Page" onClose={onClose}>
      <div className="p-4 flex flex-col gap-4">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Page title (e.g. Business Expenses)"
          className="glass-input w-full px-4 py-3 rounded-xl text-sm outline-none"
          style={{ color: 'var(--color-text)' }}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          autoFocus
        />
        <button
          onClick={onSubmit}
          disabled={!value.trim()}
          className="glass-btn-primary w-full py-3 rounded-xl text-sm font-semibold"
          style={{
            opacity: value.trim() ? 1 : 0.5,
            color: 'var(--color-on-accent)',
          }}
        >
          Create Page
        </button>
      </div>
    </BottomSheet>
  );
}

// ── Rename Page Sheet ───────────────────────────────────────────────────────

interface RenamePageSheetProps {
  value: string;
  originalTitle: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function RenamePageSheet({ value, originalTitle, onChange, onSubmit, onClose }: RenamePageSheetProps) {
  const canSave = value.trim() && value.trim() !== originalTitle;
  return (
    <BottomSheet title="Rename Page" onClose={onClose}>
      <div className="p-4 flex flex-col gap-4">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Page title"
          className="glass-input w-full px-4 py-3 rounded-xl text-sm outline-none"
          style={{ color: 'var(--color-text)' }}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          autoFocus
        />
        <button
          onClick={onSubmit}
          disabled={!canSave}
          className="glass-btn-primary w-full py-3 rounded-xl text-sm font-semibold"
          style={{
            opacity: canSave ? 1 : 0.5,
            color: 'var(--color-on-accent)',
          }}
        >
          Save
        </button>
      </div>
    </BottomSheet>
  );
}

// ── Delete Confirm ──────────────────────────────────────────────────────────

interface DeletePageConfirmProps {
  window: MoneyWindow;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeletePageConfirm({ window: w, onConfirm, onCancel }: DeletePageConfirmProps) {
  return (
    <Confirm
      title="Move to Trash?"
      message={`"${w.title}" will be moved to the recycle bin.`}
      confirmLabel="Delete"
      danger
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

// ── Move to Tab Sheet ───────────────────────────────────────────────────────

interface MovePageSheetProps {
  window: MoneyWindow;
  onClose: () => void;
  onMoved: () => void;
}

export function MovePageSheet({ window: w, onClose, onMoved }: MovePageSheetProps) {
  return (
    <MoveToTabSheet
      window={w}
      onClose={onClose}
      onMoved={onMoved}
    />
  );
}
