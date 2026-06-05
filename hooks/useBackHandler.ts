'use client';

import { useEffect, useRef } from 'react';

/**
 * Global stack of back handlers. When the user presses the device back button,
 * we pop the most recent handler and execute it, preventing the app from closing.
 */
const backHandlerStack: Array<{ key: string; handler: () => void }> = [];

let listenerInstalled = false;
let rootGuardActive = false;

function pushSentinel() {
  if (window.history.state?.backHandler !== '__root_guard__') {
    window.history.pushState({ backHandler: '__root_guard__' }, '');
  }
}

function installGlobalListener() {
  if (listenerInstalled) return;
  listenerInstalled = true;

  window.addEventListener('popstate', () => {
    if (backHandlerStack.length > 0) {
      const top = backHandlerStack.pop()!;
      top.handler();
      if (backHandlerStack.length === 0 && rootGuardActive) {
        setTimeout(pushSentinel, 0);
      }
    } else if (rootGuardActive) {
      setTimeout(pushSentinel, 0);
    }
  });
}

/**
 * Hook to integrate component-level sub-navigation with browser history.
 *
 * When `isActive` becomes true, it pushes a history entry and registers a
 * back handler. When the device back button is pressed, the handler fires
 * to close the sub-view instead of exiting the app.
 *
 * @param isActive  Whether a sub-view is currently open
 * @param onBack    Callback to close the sub-view
 * @param key       Unique key for this handler instance
 */
export function useBackHandler(isActive: boolean, onBack: () => void, key: string) {
  const pushedRef = useRef(false);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    installGlobalListener();
  }, []);

  // Push a history entry when the sub-view opens
  useEffect(() => {
    if (isActive && !pushedRef.current) {
      pushedRef.current = true;
      window.history.pushState({ backHandler: key }, '');
      backHandlerStack.push({
        key,
        handler: () => {
          pushedRef.current = false;
          onBackRef.current();
        },
      });
    }

    // If the sub-view was closed programmatically (via the UI close/back button),
    // clean up: remove from stack and go back in history to remove our entry
    if (!isActive && pushedRef.current) {
      pushedRef.current = false;
      const idx = backHandlerStack.findIndex((h) => h.key === key);
      if (idx !== -1) backHandlerStack.splice(idx, 1);
      // Only go back if our entry is still the current history state
      // (it won't be if a router.push already happened)
      if (window.history.state?.backHandler === key) {
        window.history.back();
      }
    }
  }, [isActive, key]);

  // Cleanup on unmount — only remove from stack, do NOT call history.back().
  // If the component is unmounting due to a navigation (router.push), calling
  // history.back() would undo that navigation and break the app.
  useEffect(() => {
    return () => {
      if (pushedRef.current) {
        pushedRef.current = false;
        const idx = backHandlerStack.findIndex((h) => h.key === key);
        if (idx !== -1) backHandlerStack.splice(idx, 1);
        // Do NOT call history.back() here — the history state will be
        // cleaned up naturally by the next navigation or root guard.
      }
    };
  }, [key]);
}

/**
 * Hook to prevent the app from closing when pressing back at the root level.
 */
export function useRootBackGuard() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    installGlobalListener();
    rootGuardActive = true;
    pushSentinel();

    return () => {
      rootGuardActive = false;
    };
  }, []);
}
