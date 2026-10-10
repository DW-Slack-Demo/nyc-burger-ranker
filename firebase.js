// Firebase setup shared by auth and data code. The SDK is loaded from Google's CDN.
// Without an API key the app runs in demo mode: accounts, lists and follows are kept
// in this browser only, so the prototype can be tried before Firebase is set up.
const SDK = 'https://www.gstatic.com/firebasejs/10.7.1';

const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "nyc-top-10.firebaseapp.com",
  projectId: "nyc-top-10",
  storageBucket: "nyc-top-10.firebasestorage.app",
  messagingSenderId: "1008750104141",
  appId: "1:1008750104141:web:607e759c887f2c95d01604"
};

// Firestore queues reads and writes while it can't reach the database, which looks like
// an endless spinner. Calls that the UI waits on give up after this long instead.
const DATABASE_TIMEOUT_MS = 15000;

export const DATABASE_UNREACHABLE = `Couldn't reach the database. Check that Firestore is created in the Firebase project "${FIREBASE_CONFIG.projectId}" and that the app's API key comes from that same project.`;

export function withTimeout(promise) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(DATABASE_UNREACHABLE)), DATABASE_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Turns Firestore errors into messages a person can act on.
export function databaseErrorMessage(error) {
  if (error?.code === 'permission-denied') {
    return `The database refused the request. Check that the security rules from firestore.rules are published in the Firebase project "${FIREBASE_CONFIG.projectId}".`;
  }
  if (error?.code === 'unavailable' || error?.code === 'not-found' || error?.message === DATABASE_UNREACHABLE) {
    return DATABASE_UNREACHABLE;
  }
  return error?.message || 'Something went wrong talking to the database.';
}

export const isDemoMode = !FIREBASE_CONFIG.apiKey;

export const loadFirestoreSdk = () => (isDemoMode
  ? import('./demo/firestore.js')
  : import(/* @vite-ignore */ `${SDK}/firebase-firestore.js`));
export const loadAuthSdk = () => (isDemoMode
  ? import('./demo/auth.js')
  : import(/* @vite-ignore */ `${SDK}/firebase-auth.js`));

let firebasePromise = null;

// Returns { db, auth }, initializing Firebase once.
export function getFirebase() {
  if (!firebasePromise) {
    firebasePromise = (async () => {
      const firestore = await loadFirestoreSdk();
      const { getAuth } = await loadAuthSdk();
      if (isDemoMode) return { db: firestore.getFirestore(null), auth: getAuth(null) };
      const app = (await import(/* @vite-ignore */ `${SDK}/firebase-app.js`)).initializeApp(FIREBASE_CONFIG);
      // Firestore's default streaming connection gets cut off by some phone browsers, ad
      // blockers, VPNs and work networks, which shows up as "Couldn't reach the database".
      // Plain repeated requests (long polling) get through those.
      const db = firestore.initializeFirestore(app, { experimentalForceLongPolling: true });
      return { db, auth: getAuth(app) };
    })();
    firebasePromise.catch(() => { firebasePromise = null; });
  }
  return firebasePromise;
}
