'use client';

import { X, Download, Share } from 'lucide-react';
import type { InstallState } from '@/hooks/useInstallPrompt';

interface InstallBannerProps {
  installState: InstallState;
  onInstall: () => void;
  onDismiss: () => void;
}

export default function InstallBanner({ installState, onInstall, onDismiss }: InstallBannerProps) {
  // iOS: show manual share instructions
  if (installState === 'ios') {
    return (
      <div
        className="fixed bottom-0 left-0 right-0 z-50 px-4 animate-slide-up"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div
          className="glass-banner rounded-2xl p-4"
          style={{
            boxShadow: '0 -4px 32px rgba(0,0,0,0.4)',
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              {/* App icon */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                style={{ background: 'var(--color-accent-bg)' }}
              >
                📒
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>
                  Install Money Ledger
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  Add to home screen for offline access
                </p>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="p-1.5 rounded-full shrink-0"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-muted)' }}
            >
              <X size={14} />
            </button>
          </div>

          {/* iOS instructions */}
          <div
            className="glass-input rounded-xl p-3 flex items-start gap-3"
          >
            <Share size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--color-accent)' }} />
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              Tap the{' '}
              <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                Share button
              </span>{' '}
              at the bottom of Safari, then tap{' '}
              <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                &quot;Add to Home Screen&quot;
              </span>
              .
            </p>
          </div>

          <button
            onClick={onDismiss}
            className="glass-btn-secondary w-full mt-3 py-2.5 rounded-xl text-sm font-medium"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Got it
          </button>
        </div>
      </div>
    );
  }

  // Android / Chrome: show install button
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 px-4 animate-slide-up"
      style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div
        className="glass-banner rounded-2xl p-4"
        style={{
          boxShadow: '0 -4px 32px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header row */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
            style={{ background: 'var(--color-accent-bg)' }}
          >
            📒
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>
              Install Money Ledger
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Works offline · No app store needed
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-full shrink-0"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-muted)' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={onDismiss}
            className="glass-btn-secondary flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Maybe Later
          </button>
          <button
            onClick={onInstall}
            className="glass-btn-primary flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            style={{ color: 'var(--color-on-accent)' }}
          >
            <Download size={15} strokeWidth={2.5} />
            Install App
          </button>
        </div>
      </div>
    </div>
  );
}
