'use client';

import { useEffect, useRef } from 'react';

/**
 * Global stack of back handlers. When the user presses the device back button,
 * we pop the most recent handler and execute it, preventing the app from closing.
 *
 * This design avoids conflicts between multiple popstate listeners by ensuring
 * only one handler fires per back press — the most recently registered one.
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
      // A sub-view is open — call its back handler
      const top = backHandlerStack.pop()!;
      top.handler();
      // If the stack is now empty and the root guard is active, re-push sentinel
      if (backHandlerStack.length === 0 && rootGuardActive) {
        setTimeout(pushSentinel, 0);
      }
    } else if (rootGuardActive) {
      // No sub-views open — re-push sentinel to prevent app close
      setTimeout(pushSentinel, 0);
    }
  });
}

/**
 * Hook to integrate component-level sub-navigation with browser history.
 *
 * When `isActive` becomes true (e.g. user opens a window/person/sheet), it pushes
 * a history entry and registers a back handler. When the user presses the device
 * back button, the handler fires to close the sub-view instead of exiting the app.
 *
 * @param isActive  Whether a sub-view is currently open
 * @param onBack    Callback to close the sub-view (e.g. `setWindowId(null)`)
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

    // If the sub-view was closed programmatically (via the UI back button),
    // clean up: remove from stack and go back in history to remove our entry
    if (!isActive && pushedRef.current) {
      pushedRef.current = false;
      // Remove our handler from the stack
      const idx = backHandlerStack.findIndex((h) => h.key === key);
      if (idx !== -1) backHandlerStack.splice(idx, 1);
      // Go back to remove the history entry we pushed
      if (window.history.state?.backHandler === key) {
        window.history.back();
      }
    }
  }, [isActive, key]);

  // Cleanup on unmount: if still pushed, clean up
  useEffect(() => {
    return () => {
      if (pushedRef.current) {
        pushedRef.current = false;
        const idx = backHandlerStack.findIndex((h) => h.key === key);
        if (idx !== -1) backHandlerStack.splice(idx, 1);
        if (window.history.state?.backHandler === key) {
          window.history.back();
        }
      }
    };
  }, [key]);
}

/**
 * Hook to prevent the app from closing when pressing back at the root level.
 * Pushes a sentinel history entry. The global popstate listener re-pushes it
 * whenever the stack is empty.
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
