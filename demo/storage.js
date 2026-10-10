// Demo mode keeps everything in this browser's localStorage instead of Firebase.
const KEY = 'nyc-top10-demo-db';

export function readDb() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { accounts: {}, docs: {}, session: null };
  } catch {
    return { accounts: {}, docs: {}, session: null };
  }
}

export function writeDb(db) {
  localStorage.setItem(KEY, JSON.stringify(db));
}
