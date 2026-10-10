// A small stand-in for the parts of firebase/firestore the app uses.
import { readDb, writeDb } from './storage.js';

export const getFirestore = () => ({});
export const doc = (_db, collectionName, id) => ({ collectionName, id, path: `${collectionName}/${id}` });
export const collection = (_db, collectionName) => ({ collectionName });
export const where = (field, op, value) => ({ field, op, value });
export const query = (ref, ...filters) => ({ collectionName: ref.collectionName, filters });
export const arrayUnion = (...values) => ({ __op: 'arrayUnion', values });
export const arrayRemove = (...values) => ({ __op: 'arrayRemove', values });

const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

const snapshot = (id, data) => ({ id, exists: () => data !== undefined, data: () => clone(data) });

function applyUpdate(current, changes, deepMerge) {
  const next = { ...(current || {}) };
  for (const [key, value] of Object.entries(changes)) {
    if (value?.__op === 'arrayUnion') {
      next[key] = [...new Set([...(next[key] || []), ...value.values])];
    } else if (value?.__op === 'arrayRemove') {
      next[key] = (next[key] || []).filter((item) => !value.values.includes(item));
    } else if (deepMerge && value && typeof value === 'object' && !Array.isArray(value) && next[key] && typeof next[key] === 'object') {
      next[key] = applyUpdate(next[key], value, true);
    } else {
      next[key] = clone(value);
    }
  }
  return next;
}

export async function getDoc(ref) {
  return snapshot(ref.id, readDb().docs[ref.path]);
}

export async function setDoc(ref, data, options) {
  const db = readDb();
  db.docs[ref.path] = applyUpdate(options?.merge ? db.docs[ref.path] : null, data, !!options?.merge);
  writeDb(db);
}

export async function updateDoc(ref, data) {
  const db = readDb();
  if (!db.docs[ref.path]) throw new Error(`No document to update: ${ref.path}`);
  db.docs[ref.path] = applyUpdate(db.docs[ref.path], data, false);
  writeDb(db);
}

export async function addDoc(ref, data) {
  const db = readDb();
  db.docs[`${ref.collectionName}/${crypto.randomUUID()}`] = clone(data);
  writeDb(db);
}

const matches = (data, { field, op, value }) =>
  op === 'array-contains' ? (data[field] || []).includes(value) : data[field] === value;

export async function getDocs(ref) {
  const prefix = `${ref.collectionName}/`;
  const docs = Object.entries(readDb().docs)
    .filter(([path, data]) => path.startsWith(prefix) && (ref.filters || []).every((f) => matches(data, f)))
    .map(([path, data]) => snapshot(path.slice(prefix.length), data));
  return { docs, empty: docs.length === 0, size: docs.length, forEach: (fn) => docs.forEach(fn) };
}

export async function deleteDoc(ref) {
  const db = readDb();
  delete db.docs[ref.path];
  writeDb(db);
}

// Applies queued writes together, like Firestore's batched writes.
export function writeBatch() {
  const steps = [];
  return {
    set(ref, data, options) { steps.push(() => setDoc(ref, data, options)); },
    delete(ref) { steps.push(() => deleteDoc(ref)); },
    async commit() {
      const before = localStorage.getItem('nyc-top10-demo-db');
      try {
        for (const step of steps) await step();
      } catch (error) {
        if (before !== null) localStorage.setItem('nyc-top10-demo-db', before);
        throw error;
      }
    },
  };
}
