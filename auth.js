// Username/password accounts backed by Firebase Authentication.
// Firebase Auth stores only a salted scrypt hash of each password; the app never
// writes a password to Firestore. Firebase Auth needs an email, so each username
// maps to a private placeholder address that is never shown or emailed.
import { getFirebase, loadAuthSdk } from './firebase.js';
import { createProfile } from './userStore.js';

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
const LEGACY_USER_ID_KEY = 'burger-ranker-user-id';
export const MIN_PASSWORD_LENGTH = 8;

// Set while a sign-up is finishing so the auth listener waits for the profile to exist.
let signupInProgress = null;

const usernameToEmail = (username) => `${username.trim().toLowerCase()}@users.nyc-burger-ranker.app`;

export function validateCredentials(username, password) {
  if (!USERNAME_PATTERN.test(username.trim())) {
    return 'Usernames are 3 to 20 letters, numbers or underscores.';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Passwords need at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

function friendlyAuthError(error) {
  switch (error?.code) {
    case 'auth/email-already-in-use':
      return 'That username is taken. Please choose another.';
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Wrong username or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a minute and try again.';
    case 'auth/weak-password':
      return `Passwords need at least ${MIN_PASSWORD_LENGTH} characters.`;
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return 'Sign-in is not enabled yet. Turn on Email/Password in the Firebase console under Authentication.';
    case 'auth/network-request-failed':
      return 'Could not reach the server. Check your connection and try again.';
    default:
      return error?.message || 'Something went wrong. Please try again.';
  }
}

// Calls back with { uid, username } when signed in, or null when signed out.
// Firebase keeps the session in the browser, so people stay signed in between visits.
export async function watchAuth(callback) {
  const { auth } = await getFirebase();
  const { onAuthStateChanged } = await loadAuthSdk();
  return onAuthStateChanged(auth, async (user) => {
    if (signupInProgress) await signupInProgress.catch(() => {});
    callback(user ? { uid: user.uid, username: user.displayName || user.email?.split('@')[0] || '' } : null);
  });
}

export function signUp(username, password) {
  signupInProgress = createAccount(username, password);
  const done = () => { signupInProgress = null; };
  signupInProgress.then(done, done);
  return signupInProgress;
}

async function createAccount(username, password) {
  const invalid = validateCredentials(username, password);
  if (invalid) throw new Error(invalid);

  const name = username.trim();
  const { auth } = await getFirebase();
  const { createUserWithEmailAndPassword, updateProfile } = await loadAuthSdk();

  let credential;
  try {
    credential = await createUserWithEmailAndPassword(auth, usernameToEmail(name), password);
  } catch (error) {
    throw new Error(friendlyAuthError(error));
  }
  const { uid } = credential.user;
  await updateProfile(credential.user, { displayName: name });

  let legacyUserId = null;
  try {
    legacyUserId = localStorage.getItem(LEGACY_USER_ID_KEY);
  } catch {
    // Storage can be blocked; there is just nothing to carry over then.
  }
  await createProfile(uid, name, legacyUserId);

  return { uid, username: name };
}

export async function logIn(username, password) {
  const { auth } = await getFirebase();
  const { signInWithEmailAndPassword } = await loadAuthSdk();
  try {
    const credential = await signInWithEmailAndPassword(auth, usernameToEmail(username), password);
    return { uid: credential.user.uid, username: credential.user.displayName || username.trim() };
  } catch (error) {
    throw new Error(friendlyAuthError(error));
  }
}

export async function logOut() {
  const { auth } = await getFirebase();
  const { signOut } = await loadAuthSdk();
  await signOut(auth);
}
