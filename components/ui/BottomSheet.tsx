'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  height?: 'auto' | 'full' | 'half';
}

export default function BottomSheet({ title, onClose, children, height = 'auto' }: BottomSheetProps) {
  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const heights = {
    auto: 'max-h-[90dvh]',
    full: 'h-[90dvh]',
    half: 'h-[50dvh]',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`rounded-t-3xl flex flex-col animate-slide-up ${heights[height]}`}
        style={{ background: 'var(--color-surface)' }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div
            className="rounded-full"
            style={{ width: 36, height: 4, background: 'var(--color-border-2)' }}
          />
        </div>

        {/* Header */}
        {title && (
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <h2 className="font-semibold text-base" style={{ color: 'var(--color-text)' }}>
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-xl"
              style={{
                background: 'var(--color-surface-2)',
                color: 'var(--color-text-muted)',
              }}
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">{children}</div>

        {/* Safe area bottom */}
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  );
}
