# Money Ledger — PWA Install Prompt
> Add a native-feeling install prompt so users can add Money Ledger to their home screen.
> This adds 3 new files and updates 1 existing file.
> Do not change any existing logic, CSS variables, or component patterns.
> After all steps: run `npx tsc --noEmit` then `npm run build` then `git push`.

---

## WHAT YOU ARE BUILDING

```
┌─────────────────────────────────────┐
│ 📒 Install Money Ledger             │
│ Add to home screen — works offline  │
│                                     │
│ [Maybe Later]      [Install App →]  │
└─────────────────────────────────────┘
```

- Shows automatically after 4 seconds on first visit
- Never shows again after user taps "Maybe Later"
- On iOS Safari: shows manual instructions (iOS blocks auto-prompt)
- In Settings: "Install App" row triggers the same prompt anytime
- If already installed: Settings row shows "Already installed ✓"

---

## STEP 1 — Create `hooks/useInstallPrompt.ts`

Create this file at `hooks/useInstallPrompt.ts`:

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';

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
  const [installState, setInstallState] = useState<InstallState>('idle');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Already running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
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

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setInstallState('installed');
      setShowBanner(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

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
```

---

## STEP 2 — Create `components/ui/InstallBanner.tsx`

Create this file at `components/ui/InstallBanner.tsx`:

```tsx
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
        className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-safe animate-slide-up"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div
          className="rounded-2xl p-4"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-2)',
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
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
            >
              <X size={14} />
            </button>
          </div>

          {/* iOS instructions */}
          <div
            className="rounded-xl p-3 flex items-start gap-3"
            style={{ background: 'var(--color-surface-2)' }}
          >
            <Share size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--color-accent)' }} />
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              Tap the{' '}
              <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                Share button
              </span>{' '}
              at the bottom of Safari, then tap{' '}
              <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                "Add to Home Screen"
              </span>
              .
            </p>
          </div>

          <button
            onClick={onDismiss}
            className="w-full mt-3 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-muted)' }}
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
        className="rounded-2xl p-4"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-2)',
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
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={onDismiss}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
          >
            Maybe Later
          </button>
          <button
            onClick={onInstall}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
          >
            <Download size={15} strokeWidth={2.5} />
            Install App
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## STEP 3 — Add `InstallBanner` to `components/layout/AppLayout.tsx`

Open `components/layout/AppLayout.tsx`.

**Add imports at the top:**
```typescript
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import InstallBanner from '@/components/ui/InstallBanner';
```

**Inside `AppLayout` component, add the hook and banner.** Find the return statement and add right before the closing tag.

Find the existing return in AppLayout (it wraps children with offline banner + bottom nav). Add the install banner at the very end, just before the final closing `</div>` or `</>`:

```tsx
// Add hook at the top of the component function:
const { installState, showBanner, triggerInstall, dismissBanner } = useInstallPrompt();

// Add just before the closing tag of the return:
{showBanner && (installState === 'available' || installState === 'ios') && (
  <InstallBanner
    installState={installState}
    onInstall={triggerInstall}
    onDismiss={dismissBanner}
  />
)}
```

---

## STEP 4 — Add Install Row to `app/settings/page.tsx`

**Add imports at the top of the file:**
```typescript
import { Download, CheckCircle } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
```

**Inside `SettingsContent` function, add the hook:**
```typescript
const { installState, triggerInstall } = useInstallPrompt();
```

**Add a new SettingsGroup for "App" before the existing "About" group.** Find the `{/* About */}` comment and add this BEFORE it:

```tsx
{/* App Installation */}
{installState !== 'installed' && installState !== 'unsupported' && (
  <SettingsGroup
    label="App"
    items={[
      {
        icon: <Download size={18} />,
        label: 'Install App',
        value: installState === 'ios' ? 'Tap Share → Add to Home Screen' : 'Add to home screen',
        onPress: installState === 'available' ? triggerInstall : undefined,
      },
    ]}
  />
)}

{installState === 'installed' && (
  <SettingsGroup
    label="App"
    items={[
      {
        icon: <CheckCircle size={18} />,
        label: 'App Installed',
        value: 'Running from home screen ✓',
        valueColor: 'var(--color-income)',
      },
    ]}
  />
)}
```

---

## STEP 5 — Add `animate-slide-up` to `app/globals.css` (if not already there)

Open `app/globals.css`. Search for `animate-slide-up`.

If it does NOT exist, add this at the bottom of the file:

```css
/* PWA Install Banner animation */
@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slide-up {
  animation: slide-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
```

If `animate-slide-up` already exists, skip this step.

---

## VERIFICATION CHECKLIST

Run through every item after all steps are done:

```
TYPESCRIPT
[ ] npx tsc --noEmit → zero errors

BUILD
[ ] npm run build → completes with zero errors

ANDROID / CHROME
[ ] Open site in Chrome on Android
[ ] After 4 seconds → install banner appears at bottom
[ ] Tap "Maybe Later" → banner disappears, never shows again
[ ] Open site again → banner does NOT show (dismissed state saved)
[ ] Go to Settings → "Install App" row visible
[ ] Tap "Install App" → Chrome install dialog appears
[ ] Accept → app installs to home screen
[ ] Re-open from home screen → Settings shows "App Installed ✓"

iOS SAFARI
[ ] Open site in Safari on iPhone
[ ] After 4 seconds → banner appears with Share button instructions
[ ] Tap "Got it" → banner disappears
[ ] Settings → shows "Tap Share → Add to Home Screen" hint

ALREADY INSTALLED
[ ] Open site from home screen (standalone mode)
[ ] Banner does NOT appear
[ ] Settings shows "App Installed · Running from home screen ✓"

DESKTOP CHROME
[ ] Banner appears after 4s (Chrome supports install on desktop)
[ ] Install button works

DEPLOY
[ ] git add .
[ ] git commit -m "feat: PWA install prompt banner + settings integration"
[ ] git push origin main
```

---

*Money Ledger PWA Install Prompt · May 2026*
