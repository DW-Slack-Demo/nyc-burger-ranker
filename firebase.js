// Firebase setup shared by auth and data code. The SDK is loaded from Google's CDN.
// Without an API key the app runs in demo mode: accounts, lists and follows are kept
// in this browser only, so the prototype can be tried before Firebase is set up.
const SDK = 'https://www.gstatic.com/firebasejs/10.7.1';

const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "burger-rating-app.firebaseapp.com",
  projectId: "burger-rating-app",
  storageBucket: "burger-rating-app.firebasestorage.app",
  messagingSenderId: "148456854796",
  appId: "1:148456854796:web:a750700ca0b7eb65d1a529"
};

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
      const { getFirestore } = await loadFirestoreSdk();
      const { getAuth } = await loadAuthSdk();
      const app = isDemoMode
        ? null
        : (await import(/* @vite-ignore */ `${SDK}/firebase-app.js`)).initializeApp(FIREBASE_CONFIG);
      return { db: getFirestore(app), auth: getAuth(app) };
    })();
    firebasePromise.catch(() => { firebasePromise = null; });
  }
  return firebasePromise;
}
