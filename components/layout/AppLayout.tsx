'use client';

import { useState } from 'react';
import BottomNav from './BottomNav';
import MoreDrawer from '../tabs/MoreDrawer';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [showMore, setShowMore] = useState(false);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      <main
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
        style={{ paddingBottom: 'var(--app-bottom-nav-pad)' }}
      >
        {children}
      </main>
      <BottomNav onMoreClick={() => setShowMore(true)} />
      {showMore && <MoreDrawer onClose={() => setShowMore(false)} />}
    </div>
  );
}
