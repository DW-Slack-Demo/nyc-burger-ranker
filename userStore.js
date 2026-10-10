// Per-user data in Firestore: users/{uid} holds the username, who they follow,
// and one saved top-10 list per category under rankings[categoryKey].
import { getFirebase, loadFirestoreSdk, withTimeout } from './firebase.js';

export async function loadUser(uid) {
  const { db } = await getFirebase();
  const { doc, getDoc } = await loadFirestoreSdk();
  const snapshot = await withTimeout(getDoc(doc(db, 'users', uid)));
  return snapshot.exists() ? { userId: uid, ...snapshot.data() } : null;
}

// Creates users/{uid} for a new account. A burger list made on this browser before
// accounts existed (stored under the old random id) is carried over.
export async function createProfile(uid, username, legacyUserId = null) {
  const { db } = await getFirebase();
  const { doc, getDoc, setDoc } = await loadFirestoreSdk();

  const rankings = {};
  if (legacyUserId) {
    try {
      const legacy = await withTimeout(getDoc(doc(db, 'users', legacyUserId)));
      const data = legacy.exists() && !legacy.data().hasAccount ? legacy.data() : null;
      const burgers = data?.rankings?.burgers || data?.ranking;
      if (burgers?.length) rankings.burgers = burgers;
    } catch (error) {
      console.warn('Could not carry over the list from before sign-up:', error);
    }
  }

  const now = new Date().toISOString();
  await withTimeout(setDoc(doc(db, 'users', uid), {
    username,
    usernameLower: username.toLowerCase(),
    hasAccount: true,
    rankings,
    following: [],
    createdAt: now,
    updatedAt: now,
  }));
}

// Saves every category's list so it is there the next time the user signs in.
export async function saveRankings(uid, rankings) {
  const { db } = await getFirebase();
  const { doc, setDoc } = await loadFirestoreSdk();
  await setDoc(doc(db, 'users', uid), {
    rankings,
    ranking: rankings.burgers || [], // legacy field read by older clients
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

// One leaderboard entry per user per category, replaced each time they resubmit.
export async function submitRanking(uid, username, category, items) {
  const { db } = await getFirebase();
  const { doc, setDoc } = await loadFirestoreSdk();
  await setDoc(doc(db, 'submissions', `${uid}_${category}`), {
    userId: uid,
    username,
    category,
    items,
    ...(category === 'burgers' && { burgers: items }), // legacy field
    timestamp: new Date().toISOString(),
  });
}

// Everyone with an account, for the discover list.
export async function loadAllUsers() {
  const { db } = await getFirebase();
  const { collection, query, where, getDocs } = await loadFirestoreSdk();
  const snapshot = await getDocs(query(collection(db, 'users'), where('hasAccount', '==', true)));
  return snapshot.docs.map((d) => ({ userId: d.id, ...d.data() }));
}

export async function loadFollowers(uid) {
  const { db } = await getFirebase();
  const { collection, query, where, getDocs } = await loadFirestoreSdk();
  const snapshot = await getDocs(query(collection(db, 'users'), where('following', 'array-contains', uid)));
  return snapshot.docs.map((d) => d.data().username).filter(Boolean);
}

export async function setFollowing(uid, targetUid, follow) {
  const { db } = await getFirebase();
  const { doc, updateDoc, arrayUnion, arrayRemove } = await loadFirestoreSdk();
  await updateDoc(doc(db, 'users', uid), {
    following: follow ? arrayUnion(targetUid) : arrayRemove(targetUid),
  });
}
