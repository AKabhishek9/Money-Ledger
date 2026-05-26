import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  type Firestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth: Auth = getAuth(app);

// Offline-first: Firestore with persistent local cache
// experimentalAutoDetectLongPolling bypasses ad blockers that block
// Firestore's WebSocket channels to googleapis.com — it auto-falls
// back to standard HTTP long-polling which is unblockable.
const db: Firestore = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
      experimentalAutoDetectLongPolling: true,
    });
  } catch {
    return getFirestore(app);
  }
})();

if (
  typeof window !== 'undefined' &&
  process.env.NEXT_PUBLIC_USE_FIRESTORE_EMULATOR === 'true'
) {
  try {
    // FIXED: FB-3
    connectFirestoreEmulator(db, 'localhost', 8080);
  } catch {
    // Emulator may already be connected during hot reload.
  }
}

if (
  typeof window !== 'undefined' &&
  process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY
) {
  try {
    // FIXED: SEC-2
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(
        process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY
      ),
      isTokenAutoRefreshEnabled: true,
    });
  } catch {
    // App Check may already be initialized during hot reload.
  }
}

export { auth, db };
export default app;
