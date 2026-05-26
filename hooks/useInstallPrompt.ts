'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// The BeforeInstallPromptEvent is not in standard TypeScript types
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallState =
  | 'idle'          // not yet determined
  | 'available'     // can install (Android/Desktop Chrome)
  | 'ios'           // iOS Safari — must show manual instructions
  | 'installed'     // already running as installed PWA
  | 'unsupported';  // browser does not support install

const DISMISSED_KEY = 'ml_install_dismissed';

export function useInstallPrompt() {
  const { userId } = useAuth();
  const [installState, setInstallState] = useState<InstallState>('idle');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!userId) {
      setShowBanner(false);
      return;
    }

    // Already running as installed PWA
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setInstallState('installed');
      return;
    }

    // iOS Safari — no beforeinstallprompt, needs manual instructions
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isIOS && isSafari) {
      setInstallState('ios');
      // Show banner after 4s if not dismissed before
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (!dismissed) {
        const timer = setTimeout(() => setShowBanner(true), 4000);
        return () => clearTimeout(timer);
      }
      return;
    }

    // Listen for Chrome/Android install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setInstallState('available');

      // Auto-show banner after 4s if not dismissed before
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (!dismissed) {
        const timer = setTimeout(() => setShowBanner(true), 4000);
        return () => clearTimeout(timer);
      }
    };
    const installedHandler = () => {
      setInstallState('installed');
      setShowBanner(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      // FIXED: BUG-M8
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, [userId]);

  // Trigger the install prompt (Chrome/Android)
  const triggerInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallState('installed');
    }
    setDeferredPrompt(null);
    setShowBanner(false);
  }, [deferredPrompt]);

  // Dismiss the banner — never show again automatically
  const dismissBanner = useCallback(() => {
    setShowBanner(false);
    localStorage.setItem(DISMISSED_KEY, '1');
  }, []);

  return {
    installState,
    showBanner,
    triggerInstall,
    dismissBanner,
  };
}
