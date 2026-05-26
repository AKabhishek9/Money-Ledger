'use client';

import { useState, useEffect, useCallback } from 'react';
import BottomNav from './BottomNav';
import TabContainer from './TabContainer';
import MoreDrawer from '../tabs/MoreDrawer';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import InstallBanner from '@/components/ui/InstallBanner';

/** URL pathnames for the 4 main tabs (order matches tab indices) */
const TAB_PATHS = ['/personal', '/people', '/vault', '/search'] as const;

interface AppLayoutProps {
  children?: React.ReactNode;
  /** When set, renders the horizontal tab container instead of children */
  initialTab?: number;
}

export default function AppLayout({ children, initialTab }: AppLayoutProps) {
  const isTabMode = initialTab !== undefined;
  const [activeTab, setActiveTab] = useState(initialTab ?? 0);
  const [showMore, setShowMore] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const { installState, showBanner, triggerInstall, dismissBanner } = useInstallPrompt();
  const [hasSyncFailures, setHasSyncFailures] = useState(false);
  const [retryingSync, setRetryingSync] = useState(false);
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

  useEffect(() => {
    const handleSyncFailed = () => setHasSyncFailures(true);
    window.addEventListener('money-ledger-sync-failed', handleSyncFailed);
    return () => window.removeEventListener('money-ledger-sync-failed', handleSyncFailed);
  }, []);

  const handleRetryFailedSync = useCallback(async () => {
    setRetryingSync(true);
    try {
      const { retryFailedSyncQueue } = await import('@/lib/sync');
      await retryFailedSyncQueue();
      // FIXED: BUG-C3
      setHasSyncFailures(false);
    } finally {
      setRetryingSync(false);
    }
  }, []);

  /** Switch to a tab and update the URL via replaceState (no navigation) */
  const handleTabChange = useCallback((index: number) => {
    setActiveTab(index);
    // Update the browser URL so bookmarks/refresh land on the right tab
    const targetPath = TAB_PATHS[index] ?? '/personal';
    if (window.location.pathname !== targetPath) {
      window.history.replaceState(null, '', targetPath);
    }
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
      {hasSyncFailures && (
        <button
          type="button"
          onClick={handleRetryFailedSync}
          disabled={retryingSync}
          className="glass-panel text-center text-[10px] py-1 font-medium px-4 leading-tight relative z-10"
          style={{ color: 'var(--color-expense)', borderBottom: '1px solid var(--color-glass-border)' }}
        >
          {retryingSync ? 'Retrying failed sync...' : 'Some changes failed to sync. Tap to retry.'}
        </button>
      )}
      <main
        className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden"
        style={{ paddingBottom: keyboardOpen ? 0 : 'var(--app-bottom-nav-pad)' }}
      >
        {isTabMode ? (
          <TabContainer activeTab={activeTab} />
        ) : (
          children
        )}
      </main>
      <BottomNav
        onMoreClick={() => setShowMore(true)}
        activeTab={isTabMode ? activeTab : undefined}
        onTabChange={isTabMode ? handleTabChange : undefined}
      />
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
