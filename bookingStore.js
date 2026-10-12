// Booking pages for the Reserve button. Each spot's link is looked up once (by the helper's
// /booking address, which reads the restaurant's website) and saved for everyone in
//   bookingLinks/{place id}  { url, source: 'auto' | 'manual', checkedAt, updatedBy }
// url is '' when the restaurant's site had no booking link. People can paste or fix a link
// by hand ('manual'), and an automatic lookup never replaces one of those.
import { getFirebase, loadFirestoreSdk, withTimeout } from './firebase.js';
import { photoPlaceId } from './photoStore.js';

// Only links to the big booking sites are accepted, here and in firestore.rules, so nobody
// can point a Reserve button at a harmful page. Keep this in step with ai-search/src/booking.js.
export const BOOKING_URL = /^https:\/\/((www|widgets)\.)?((resy|opentable|exploretock|sevenrooms)\.com|yelp\.com\/reservations)\/[-A-Za-z0-9._~:/?#@!$&()*+,;=%]{0,400}$/;
export const BOOKING_SITES = 'Resy, OpenTable, Tock, SevenRooms or Yelp';

const PLATFORMS = { resy: 'Resy', opentable: 'OpenTable', exploretock: 'Tock', sevenrooms: 'SevenRooms', yelp: 'Yelp' };
export const platformOf = (url) => PLATFORMS[(url.match(/^https:\/\/(?:www\.|widgets\.)?([a-z]+)\./) || [])[1]] || 'the booking site';

// A spot whose site had no booking link is looked up again after this long, in case it
// has added one.
const RECHECK_EMPTY_MS = 60 * 24 * 60 * 60 * 1000;

const LOOKUP_URL = import.meta.env.VITE_AI_SEARCH_URL && `${import.meta.env.VITE_AI_SEARCH_URL.replace(/\/+$/, '')}/booking`;
export const canLookUp = !!LOOKUP_URL;

// Google place ids are long and mixed-case ("ChIJ..."); the recommended spots use short
// made-up ids ("raouls", "miami-lucali").
export const isGooglePlaceId = (id) => /^[A-Za-z0-9_-]{20,200}$/.test(id || '') && /[A-Z]/.test(id);

// The spot on Google Maps, which shows its own "Reserve a table" button for most
// restaurants, and the phone number for the rest. Maps links are free and need no key.
export function googleMapsUrl(item, cityLabel) {
  const where = item.address && item.address !== 'Multiple Locations' ? item.address : cityLabel;
  const params = new URLSearchParams({ api: '1', query: [item.name, where].filter(Boolean).join(', ') });
  if (isGooglePlaceId(item.place_id)) params.set('query_place_id', item.place_id);
  return `https://www.google.com/maps/search/?${params}`;
}

export const bookingKey = (placeKey) => photoPlaceId(placeKey);

// Everyone's saved links, as { key: { url, source, checkedAt } }, read once per visit.
let linksPromise = null;
export function loadBookingLinks() {
  if (!linksPromise) {
    linksPromise = (async () => {
      const { db } = await getFirebase();
      const { collection, getDocs } = await loadFirestoreSdk();
      const snapshot = await withTimeout(getDocs(collection(db, 'bookingLinks')));
      return Object.fromEntries(snapshot.docs.map((d) => [d.id, d.data()]));
    })();
    linksPromise.catch(() => { linksPromise = null; });
  }
  return linksPromise;
}

// Keeps what this visit has learned, so every Reserve button for a spot agrees.
function remember(key, entry) {
  linksPromise = (linksPromise || Promise.resolve({})).catch(() => ({})).then((links) => ({ ...links, [key]: entry }));
}

export const needsLookup = (entry) => !entry
  || (entry.source === 'auto' && !entry.url && Date.now() - Date.parse(entry.checkedAt || 0) > RECHECK_EMPTY_MS);

export async function saveBookingLink(key, url, source, uid) {
  if (url && !BOOKING_URL.test(url)) throw new Error(`Paste a link from ${BOOKING_SITES}.`);
  const entry = { url, source, checkedAt: new Date().toISOString(), updatedBy: uid };
  remember(key, entry);
  const { db } = await getFirebase();
  const { doc, setDoc } = await loadFirestoreSdk();
  await withTimeout(setDoc(doc(db, 'bookingLinks', key), entry));
  return entry;
}

// Asks the helper for the spot's booking page and saves the answer for everyone. Returns
// the saved entry; the link still shows this visit if saving fails.
export async function lookUpBookingLink(item, key, city, uid) {
  const response = await fetch(LOOKUP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placeId: item.place_id || '', name: item.name, address: item.address || '', city }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Couldn't look up a booking page.");
  const url = data.url && BOOKING_URL.test(data.url) ? data.url : '';
  try {
    return await saveBookingLink(key, url, 'auto', uid);
  } catch (error) {
    console.warn('Could not save the booking link for everyone:', error);
    return { url, source: 'auto', checkedAt: new Date().toISOString() };
  }
}
