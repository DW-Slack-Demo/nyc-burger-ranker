// A small stand-in for the parts of firebase/auth the app uses. Passwords are
// stored only as salted PBKDF2 hashes, never as plain text.
import { readDb, writeDb } from './storage.js';

const listeners = new Set();
const auth = { currentUser: null };

const authError = (code) => Object.assign(new Error(code), { code });
const toUser = (account) => account && { uid: account.uid, email: account.email, displayName: account.displayName || null };
const toHex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hashPassword(password, saltHex) {
  const salt = Uint8Array.from(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
  return toHex(bits);
}

function setCurrent(account) {
  auth.currentUser = toUser(account);
  listeners.forEach((cb) => cb(auth.currentUser));
}

export function getAuth() {
  const db = readDb();
  auth.currentUser = db.session ? toUser(db.accounts[db.session]) : null;
  return auth;
}

export function onAuthStateChanged(_auth, callback) {
  listeners.add(callback);
  setTimeout(() => callback(auth.currentUser), 0);
  return () => listeners.delete(callback);
}

export async function createUserWithEmailAndPassword(_auth, email, password) {
  const db = readDb();
  if (db.accounts[email]) throw authError('auth/email-already-in-use');
  if (password.length < 6) throw authError('auth/weak-password');
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  db.accounts[email] = {
    uid: `demo-${crypto.randomUUID()}`,
    email,
    salt,
    passwordHash: await hashPassword(password, salt),
  };
  db.session = email;
  writeDb(db);
  setCurrent(db.accounts[email]);
  return { user: auth.currentUser };
}

export async function updateProfile(user, { displayName }) {
  const db = readDb();
  db.accounts[user.email].displayName = displayName;
  writeDb(db);
  user.displayName = displayName;
}

export async function signInWithEmailAndPassword(_auth, email, password) {
  const db = readDb();
  const account = db.accounts[email];
  if (!account || account.passwordHash !== await hashPassword(password, account.salt)) {
    throw authError('auth/invalid-credential');
  }
  db.session = email;
  writeDb(db);
  setCurrent(account);
  return { user: auth.currentUser };
}

export async function signOut() {
  const db = readDb();
  db.session = null;
  writeDb(db);
  setCurrent(null);
}
