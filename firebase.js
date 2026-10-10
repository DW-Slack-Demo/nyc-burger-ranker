// Firebase setup shared by auth and data code. The SDK is loaded from Google's CDN.
const SDK = 'https://www.gstatic.com/firebasejs/10.7.1';

const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "burger-rating-app.firebaseapp.com",
  projectId: "burger-rating-app",
  storageBucket: "burger-rating-app.firebasestorage.app",
  messagingSenderId: "148456854796",
  appId: "1:148456854796:web:a750700ca0b7eb65d1a529"
};

export const loadFirestoreSdk = () => import(/* @vite-ignore */ `${SDK}/firebase-firestore.js`);
export const loadAuthSdk = () => import(/* @vite-ignore */ `${SDK}/firebase-auth.js`);

let firebasePromise = null;

// Returns { db, auth }, initializing Firebase once.
export function getFirebase() {
  if (!firebasePromise) {
    firebasePromise = (async () => {
      const { initializeApp } = await import(/* @vite-ignore */ `${SDK}/firebase-app.js`);
      const { getFirestore } = await loadFirestoreSdk();
      const { getAuth } = await loadAuthSdk();
      const app = initializeApp(FIREBASE_CONFIG);
      return { db: getFirestore(app), auth: getAuth(app) };
    })();
    firebasePromise.catch(() => { firebasePromise = null; });
  }
  return firebasePromise;
}
