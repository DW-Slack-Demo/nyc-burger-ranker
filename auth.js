// Accounts backed by Firebase Authentication.
// Firebase Auth stores only a salted scrypt hash of each password; the app never
// writes a password to Firestore. Accounts sign in with their real email, so Firebase
// can send password reset links, and keep a unique username (usernames/{name}) for
// display. Older accounts were made with a username only: those map to a private
// placeholder address that is never shown or emailed, until the person adds an email.
import { getFirebase, loadAuthSdk, databaseErrorMessage, isDemoMode } from './firebase.js';
import { createProfile, claimUsername, isUsernameTaken } from './userStore.js';

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLACEHOLDER_DOMAIN = '@users.nyc-burger-ranker.app';
const LEGACY_USER_ID_KEY = 'burger-ranker-user-id';
export const MIN_PASSWORD_LENGTH = 8;

// Set while a sign-up is finishing so the auth listener waits for the profile to exist.
let signupInProgress = null;

const usernameToEmail = (username) => `${username.trim().toLowerCase()}${PLACEHOLDER_DOMAIN}`;
const isPlaceholderEmail = (email) => !email || email.endsWith(PLACEHOLDER_DOMAIN);

export function validateCredentials(username, email, password) {
  if (!USERNAME_PATTERN.test(username.trim())) {
    return 'Usernames are 3 to 20 letters, numbers or underscores.';
  }
  if (!EMAIL_PATTERN.test(email.trim())) {
    return 'Please enter a valid email address.';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Passwords need at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

function friendlyAuthError(error) {
  switch (error?.code) {
    case 'auth/email-already-in-use':
      return 'An account already uses that email. Try logging in, or reset your password.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Wrong email, username or password.';
    case 'auth/requires-recent-login':
      return 'For your security, please log out, log back in, and try again.';
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

// Calls back with { uid, username, hasEmail } when signed in, or null when signed out.
// hasEmail is false for older username-only accounts, which can't get reset emails yet.
// Firebase keeps the session in the browser, so people stay signed in between visits.
export async function watchAuth(callback) {
  const { auth } = await getFirebase();
  const { onAuthStateChanged } = await loadAuthSdk();
  return onAuthStateChanged(auth, async (user) => {
    if (signupInProgress) {
      await signupInProgress.catch(() => {});
      // A failed sign-up signs back out, so report whoever is signed in now.
      user = auth.currentUser;
    }
    callback(user ? {
      uid: user.uid,
      username: user.displayName || (isPlaceholderEmail(user.email) ? user.email?.split('@')[0] : '') || '',
      hasEmail: !isPlaceholderEmail(user.email),
    } : null);
  });
}

export function signUp(username, email, password) {
  signupInProgress = createAccount(username, email, password);
  const done = () => { signupInProgress = null; };
  signupInProgress.then(done, done);
  return signupInProgress;
}

const USERNAME_TAKEN = 'That username is taken. Please choose another.';

async function createAccount(username, email, password) {
  const invalid = validateCredentials(username, email, password);
  if (invalid) throw new Error(invalid);

  const name = username.trim();
  if (await isUsernameTaken(name).catch(() => false)) throw new Error(USERNAME_TAKEN);

  const { auth } = await getFirebase();
  const { createUserWithEmailAndPassword, updateProfile, deleteUser } = await loadAuthSdk();

  let credential;
  try {
    credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  } catch (error) {
    throw new Error(friendlyAuthError(error));
  }
  const { uid } = credential.user;

  // Reserve the username. If someone else got it first, remove the new login so the
  // email can be used again with a different username.
  try {
    if (await isUsernameTaken(name, uid)) throw new Error(USERNAME_TAKEN);
    await claimUsername(uid, name);
  } catch (error) {
    await deleteUser(credential.user).catch(() => logOut().catch(() => {}));
    throw new Error(error.message === USERNAME_TAKEN || error?.code === 'permission-denied'
      ? USERNAME_TAKEN
      : databaseErrorMessage(error));
  }
  await updateProfile(credential.user, { displayName: name });

  let legacyUserId = null;
  try {
    legacyUserId = localStorage.getItem(LEGACY_USER_ID_KEY);
  } catch {
    // Storage can be blocked; there is just nothing to carry over then.
  }
  try {
    await createProfile(uid, name, legacyUserId);
  } catch (error) {
    // The account exists; its profile is created on the next successful login.
    console.error('Error creating profile:', error);
    await logOut().catch(() => {});
    throw new Error(databaseErrorMessage(error));
  }

  return { uid, username: name };
}

// Accepts an email, or a username for older accounts that don't have an email yet.
export async function logIn(emailOrUsername, password) {
  const { auth } = await getFirebase();
  const { signInWithEmailAndPassword } = await loadAuthSdk();
  const entered = emailOrUsername.trim();
  const isEmail = entered.includes('@');
  try {
    const credential = await signInWithEmailAndPassword(auth, isEmail ? entered : usernameToEmail(entered), password);
    return { uid: credential.user.uid, username: credential.user.displayName || entered };
  } catch (error) {
    const message = friendlyAuthError(error);
    if (!isEmail && message.startsWith('Wrong')) {
      throw new Error(`${message} If your account has an email, log in with your email instead.`);
    }
    throw new Error(message);
  }
}

// Asks Firebase to email a link for choosing a new password. Firebase doesn't say
// whether an account uses the email (so strangers can't check), and neither do we.
export async function sendPasswordReset(email) {
  if (isDemoMode) {
    throw new Error("Password reset emails can't be sent in demo mode, because demo accounts live only in this browser. Create a new account instead.");
  }
  const entered = email.trim();
  if (!EMAIL_PATTERN.test(entered)) {
    throw new Error('Enter the email address on your account. Accounts made with only a username need to log in and add an email first.');
  }
  const { auth } = await getFirebase();
  const { sendPasswordResetEmail } = await loadAuthSdk();
  try {
    await sendPasswordResetEmail(auth, entered);
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw new Error(friendlyAuthError(error));
  }
}

// Lets an older username-only account add a real email, so it can reset its password.
// Firebase emails a confirmation link; the account's email changes once it is clicked.
export async function addEmail(email) {
  if (isDemoMode) throw new Error("Emails can't be added in demo mode.");
  const entered = email.trim();
  if (!EMAIL_PATTERN.test(entered)) throw new Error('Please enter a valid email address.');
  const { auth } = await getFirebase();
  const { verifyBeforeUpdateEmail } = await loadAuthSdk();
  const user = auth.currentUser;
  // The username has to be reserved before the placeholder email goes away, because
  // that reservation is what lets the account keep saving its lists afterwards.
  try {
    await claimUsername(user.uid, user.displayName || user.email.split('@')[0]);
  } catch (error) {
    throw new Error(databaseErrorMessage(error));
  }
  try {
    await verifyBeforeUpdateEmail(user, entered);
  } catch (error) {
    throw new Error(friendlyAuthError(error));
  }
}

export async function logOut() {
  const { auth } = await getFirebase();
  const { signOut } = await loadAuthSdk();
  await signOut(auth);
}
