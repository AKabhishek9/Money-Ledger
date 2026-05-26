'use client';

import { useState, useEffect } from 'react';
import BottomNav from './BottomNav';
import MoreDrawer from '../tabs/MoreDrawer';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import InstallBanner from '@/components/ui/InstallBanner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [showMore, setShowMore] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const { installState, showBanner, triggerInstall, dismissBanner } = useInstallPrompt();
  const [isOnline, setIsOnline] = useState(
    typeof window !== 'undefined' ? navigator.onLine : true
  );

  // Listen for keyboard-toggle to remove bottom padding when keyboard is open
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setKeyboardOpen(detail?.open ?? false);
    };
    window.addEventListener('keyboard-toggle', handler);
    return () => window.removeEventListener('keyboard-toggle', handler);
  }, []);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      {/* Animated mesh gradient background */}
      <div className="mesh-bg" aria-hidden="true">
        <div className="mesh-orb mesh-orb-1" />
        <div className="mesh-orb mesh-orb-2" />
        <div className="mesh-orb mesh-orb-3" />
      </div>

      {!isOnline && (
        <div
          className="glass-panel text-center text-[10px] py-1 font-medium px-4 leading-tight relative z-10"
          style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-glass-border)' }}
        >
          You are offline. Entries will be saved locally and synced when you reconnect.
        </div>
      )}
      <main
        className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden"
        style={{ paddingBottom: keyboardOpen ? 0 : 'var(--app-bottom-nav-pad)' }}
      >
        {children}
      </main>
      <BottomNav onMoreClick={() => setShowMore(true)} />
      {showMore && <MoreDrawer onClose={() => setShowMore(false)} />}
      {showBanner && (installState === 'available' || installState === 'ios') && (
        <InstallBanner
          installState={installState}
          onInstall={triggerInstall}
          onDismiss={dismissBanner}
        />
      )}
    </div>
  );
}
