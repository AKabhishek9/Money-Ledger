'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useMemo,
  useCallback,
} from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ensureSystemData } from '@/lib/bootstrap';
import { getDb } from '@/lib/db';

import {
  incrementalSync,
  setupSyncListener,
  clearLocalData,
  startRealtimeSync,
  stopRealtimeSync,
  processSyncQueue,
  purgeExpiredBinItems,
} from '@/lib/sync';
import { useStore } from '@/store/useStore';

interface AuthContextType {
  user: FirebaseUser | null;
  userId: string | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cachedUserId, setCachedUserId] = useState<string | null>(null);
  const storeUserId = useStore((state) => state.userId);

  useEffect(() => {
    // 1. FAST-PATH: If we have a cached UID, load local data immediately
    const cachedUid = localStorage.getItem('money_ledger_last_uid');
    let fastPathTriggered = false;

    if (cachedUid) {
      setCachedUserId(cachedUid);
      fastPathTriggered = true;
      // Load Dexie into store RIGHT NOW — synchronously starts, sets storeUserId fast
      prepareLocalData(cachedUid).catch(() => undefined);
    }

    // 2. TIMEOUT SAFETY: If auth takes too long, stop the loader.
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 2500);

    const unsub = onAuthStateChanged(auth, async (u) => {
      clearTimeout(timeoutId);

      if (u) {
        // Official user found online
        localStorage.setItem('money_ledger_last_uid', u.uid);
        setCachedUserId(u.uid);
        try {
          await prepareLocalData(u.uid);
        } catch (err) {
          console.error('Failed to prepare local data:', err);
        }
      } else {
        // Firebase returned null — two possible reasons:
        // A) User is genuinely signed out
        // B) User is offline and Firebase cannot verify the token
        //
        // If we have a cachedUid AND we are offline, case B applies.
        // Do NOT reset the store — the user IS logged in, Firebase just
        // cannot confirm it without internet.
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
        const hasCachedSession = !!localStorage.getItem('money_ledger_last_uid');

        if (isOffline && hasCachedSession) {
          // Offline with a valid cached session — trust local data
          // Just unblock the loading screen — store already has data from fast-path
          setLoading(false);
          return;
        }

        // Genuinely signed out — clear everything
        stopRealtimeSync();
        useStore.getState().reset();
        if (fastPathTriggered) {
          localStorage.removeItem('money_ledger_last_uid');
        }
        setCachedUserId(null);
      }

      setUser((prev) => {
        if (prev?.uid === u?.uid) return prev;
        return u;
      });
      setLoading(false);
    });

    const cleanupSync = setupSyncListener();
    return () => {
      clearTimeout(timeoutId);
      unsub();
      cleanupSync();
      stopRealtimeSync();
    };
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged fires → prepareLocalData → ensureSystemData handles everything
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign in failed.';
      setError(friendlyError(msg));
      throw e;
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    setError(null);
    try {
      const r = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(r.user, { displayName: name });
      // onAuthStateChanged fires → prepareLocalData → ensureSystemData handles everything
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign up failed.';
      setError(friendlyError(msg));
      throw e;
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // onAuthStateChanged fires → prepareLocalData → ensureSystemData handles everything
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Google sign in failed.';
      setError(friendlyError(msg));
      throw e;
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Password reset failed.';
      setError(friendlyError(msg));
      throw e;
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    stopRealtimeSync();
    // Flush any pending offline writes before wiping local data
    if (navigator.onLine) {
      await processSyncQueue().catch(() => undefined);
    }
    await firebaseSignOut(auth);
    await clearLocalData();
    useStore.getState().reset();
    setCachedUserId(null);
  }, []);

  const userId = useMemo(() => {
    if (user?.uid) return user.uid;
    if (storeUserId) return storeUserId;
    // FIXED: BUG-M3
    return cachedUserId;
  }, [user?.uid, storeUserId, cachedUserId]);

  const stableUser = useMemo(() => user, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(
    () => ({ user: stableUser, userId, loading, error, signIn, signUp, signInWithGoogle, resetPassword, signOut, clearError }),
    [stableUser, userId, loading, error, signIn, signUp, signInWithGoogle, resetPassword, signOut, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/**
 * Startup sequence:
 * 1. Flush any locally-queued writes to Firestore
 * 2. Incremental sync  →  new device = full hydration once
 *                         existing device = only changed docs since lastSyncTime
 * 3. Ensure system tabs / month-window exist locally
 * 4. Load Dexie into Zustand (renders UI immediately)
 * 5. Purge recycle-bin items older than 30 days (fire-and-forget)
 */
const preparingFor = new Map<string, Promise<void>>();

async function prepareLocalData(userId: string): Promise<void> {
  const existing = preparingFor.get(userId);
  if (existing) return existing;

  // FIXED: BUG-C2
  const promise = _prepareLocalData(userId);
  preparingFor.set(userId, promise);
  promise.finally(() => preparingFor.delete(userId));
  return promise;
}

async function _prepareLocalData(userId: string): Promise<void> {
  const db = await import('@/lib/db').then((m) => m.getDb());
  const hasLocalData = (await db.tabs.where('userId').equals(userId).count()) > 0;

  if (hasLocalData) {
    // Returning device — show local data instantly from Dexie
    await useStore.getState().init(userId);
  }
  // New device: don't show anything yet — wait for sync below

  // All network work runs in background — never blocks the UI
  await (async () => {
    // Step 1: push any pending local writes first
    try {
      await processSyncQueue();
    } catch {
      // offline — fine
    }

    // Step 2: sync from Firestore
    // New device  → fullHydrateFromFirestore (all docs)
    // Old device  → delta sync (only changed docs since lastSyncTime)
    try {
      await incrementalSync(userId);
    } catch {
      // offline — local data still valid
    }

    // Step 3: refresh Zustand with the fully synced Dexie state FIRST
    await useStore.getState().init(userId);

    // Step 4: THEN create system defaults — reads hydrated Dexie, won't duplicate
    await ensureSystemData(userId);

    // Step 4b: start realtime listeners AFTER initial sync
    // This prevents the initial onSnapshot from doing duplicate work
    startRealtimeSync(userId);

    // Step 5: cleanup
    purgeExpiredBinItems(userId).catch(() => undefined);
  })();
}

function friendlyError(msg: string): string {
  if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential'))
    return 'Incorrect email or password.';
  if (msg.includes('email-already-in-use')) return 'This email is already registered.';
  if (msg.includes('weak-password')) return 'Password must be at least 6 characters.';
  if (msg.includes('invalid-email')) return 'Please enter a valid email address.';
  if (msg.includes('network')) return 'Network error. Check your connection.';
  if (msg.includes('popup-closed')) return 'Sign in was cancelled.';
  return msg;
}
