'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface BottomSheetProps {
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  height?: 'auto' | 'full' | 'half';
}

export default function BottomSheet({ title, onClose, children, height = 'auto' }: BottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [startY, setStartY] = useState<number | null>(null);
  const [currentY, setCurrentY] = useState<number | null>(null);

  // Prevent body scroll
  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
    setCurrentY(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY === null) return;
    const y = e.touches[0].clientY;
    if (y > startY) {
      // Prevent scrolling the body underneath if we're swiping down
      // Actually, just record the Y
      setCurrentY(y);
    }
  };

  const handleTouchEnd = () => {
    if (startY !== null && currentY !== null) {
      if (currentY - startY > 50) {
        onClose();
      }
    }
    setStartY(null);
    setCurrentY(null);
  };

  const heights = {
    auto: 'max-h-[90dvh]',
    full: 'h-[90dvh]',
    half: 'h-[50dvh]',
  };

  const deltaY = (currentY !== null && startY !== null) ? currentY - startY : 0;

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end animate-fade-in"
      style={{ background: 'var(--color-sheet-backdrop)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`flex flex-col rounded-t-[1.35rem] animate-slide-up ${heights[height]}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          background: 'var(--color-glass-heavy)',
          backdropFilter: 'blur(24px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
          borderTop: '1px solid var(--color-glass-border-accent)',
          boxShadow: 'var(--shadow-glass)',
          transform: deltaY > 0 ? `translateY(${deltaY}px)` : 'translateY(0)',
          transition: currentY === null ? 'transform 0.2s ease-out' : 'none',
        }}
      >
        {/* Handle bar */}
        <div className="flex shrink-0 justify-center pb-1 pt-2.5 pointer-events-none">
          <div className="rounded-full" style={{ width: 40, height: 5, background: 'var(--color-border-2)' }} />
        </div>

        {/* Header */}
        {title && (
          <div
            className="flex shrink-0 items-center justify-between px-4 py-2.5"
            style={{ borderBottom: '1px solid var(--color-glass-border)' }}
          >
            <h2 className="text-base font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="glass-btn-secondary flex h-10 w-10 items-center justify-center rounded-xl transition-opacity duration-150 active:opacity-80"
              style={{
                color: 'var(--color-text-muted)',
              }}
              aria-label="Close"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">{children}</div>

        {/* Safe area bottom */}
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>,
    document.body
  );
}
