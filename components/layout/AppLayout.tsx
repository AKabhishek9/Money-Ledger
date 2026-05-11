'use client';

import { useState, useEffect } from 'react';
import BottomNav from './BottomNav';
import MoreDrawer from '../tabs/MoreDrawer';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [showMore, setShowMore] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Listen for keyboard-toggle to remove bottom padding when keyboard is open
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setKeyboardOpen(detail?.open ?? false);
    };
    window.addEventListener('keyboard-toggle', handler);
    return () => window.removeEventListener('keyboard-toggle', handler);
  }, []);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      <main
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
        style={{ paddingBottom: keyboardOpen ? 0 : 'var(--app-bottom-nav-pad)' }}
      >
        {children}
      </main>
      <BottomNav onMoreClick={() => setShowMore(true)} />
      {showMore && <MoreDrawer onClose={() => setShowMore(false)} />}
    </div>
  );
}
