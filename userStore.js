// Per-user data in Firestore: users/{uid} holds the username, who they follow,
// one saved top-10 list per category under rankings[categoryKey], and the spots they
// want to try per category under wantToTry[categoryKey], and the spots they've tried beyond
// their top 10 under tried[categoryKey]. Those are the NYC lists; other cities' lists sit
// under cities[cityKey] with the same three fields, and homeCity is the city the app opens to.
// usernames/{lowercase name} records which account owns each username.
import { getFirebase, loadFirestoreSdk, withTimeout } from './firebase.js';

// True if another account already uses this username. Before sign-in only the
// usernames collection can be checked; once signed in (ownUid given), profiles made
// before that collection existed are checked too.
export async function isUsernameTaken(username, ownUid = null) {
  const { db } = await getFirebase();
  const { doc, getDoc, collection, query, where, getDocs } = await loadFirestoreSdk();
  const lower = username.trim().toLowerCase();
  const claim = await withTimeout(getDoc(doc(db, 'usernames', lower)));
  if (claim.exists() && claim.data().uid !== ownUid) return true;
  if (!ownUid) return false;
  const profiles = await withTimeout(getDocs(query(collection(db, 'users'), where('usernameLower', '==', lower))));
  return profiles.docs.some((d) => d.id !== ownUid);
}

// Reserves a username for this account. Does nothing if it already owns it.
export async function claimUsername(uid, username) {
  const { db } = await getFirebase();
  const { doc, getDoc, setDoc } = await loadFirestoreSdk();
  const ref = doc(db, 'usernames', username.trim().toLowerCase());
  const claim = await withTimeout(getDoc(ref));
  if (claim.exists()) {
    if (claim.data().uid === uid) return;
    throw new Error('That username is taken. Please choose another.');
  }
  await withTimeout(setDoc(ref, { uid }));
}

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
    wantToTry: {},
    tried: {},
    following: [],
    createdAt: now,
    updatedAt: now,
  }));
}

// Saves every city's rankings, want-to-try and Tried lists so they are there the next time
// the user signs in. lists is { nyc: { rankings, wantToTry, tried }, miami: { ... } }.
export async function saveLists(uid, lists) {
  const { db } = await getFirebase();
  const { doc, setDoc } = await loadFirestoreSdk();
  const { nyc, ...otherCities } = lists;
  await setDoc(doc(db, 'users', uid), {
    rankings: nyc.rankings,
    wantToTry: nyc.wantToTry,
    tried: nyc.tried,
    cities: otherCities,
    ranking: nyc.rankings.burgers || [], // legacy field read by older clients
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

// Which city the app opens to for this user.
export async function saveHomeCity(uid, city) {
  const { db } = await getFirebase();
  const { doc, setDoc } = await loadFirestoreSdk();
  await setDoc(doc(db, 'users', uid), { homeCity: city }, { merge: true });
}

// One leaderboard entry per user per city per category, replaced each time they
// resubmit. NYC entries keep the ids they had before there were other cities.
export async function submitRanking(uid, username, city, category, items) {
  const { db } = await getFirebase();
  const { doc, setDoc } = await loadFirestoreSdk();
  const id = city === 'nyc' ? `${uid}_${category}` : `${uid}_${city}_${category}`;
  await setDoc(doc(db, 'submissions', id), {
    userId: uid,
    username,
    city,
    category,
    items,
    ...(city === 'nyc' && category === 'burgers' && { burgers: items }), // legacy field
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

// Everyone who follows uid, with their id so their profile can be opened.
export async function loadFollowers(uid) {
  const { db } = await getFirebase();
  const { collection, query, where, getDocs } = await loadFirestoreSdk();
  const snapshot = await getDocs(query(collection(db, 'users'), where('following', 'array-contains', uid)));
  return snapshot.docs
    .map((d) => ({ userId: d.id, username: d.data().username }))
    .filter((u) => u.username);
}

export async function setFollowing(uid, targetUid, follow) {
  const { db } = await getFirebase();
  const { doc, updateDoc, arrayUnion, arrayRemove } = await loadFirestoreSdk();
  await updateDoc(doc(db, 'users', uid), {
    following: follow ? arrayUnion(targetUid) : arrayRemove(targetUid),
  });
}
