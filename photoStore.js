// Photos people add to spots on their rankings. They are shrunk in the browser and saved
// in Firestore (free on the Spark plan; Firebase Storage needs the paid Blaze plan):
//   photos/{uid}_{n}      who posted it, which spot, and a small thumbnail
//   photoFiles/{uid}_{n}  the larger picture, loaded only when someone opens it
// n runs from 1 to MAX_PHOTOS_PER_USER, which the security rules enforce, so each
// account can keep at most that many photos.
import { getFirebase, loadFirestoreSdk, withTimeout } from './firebase.js';

export const MAX_PHOTOS_PER_USER = 30;
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const FULL = { edge: 1280, maxChars: 380000 };
const THUMB = { edge: 320, maxChars: 55000 };

// Firestore document ids can't hold every character a place key can, so photos are
// filed under a cleaned-up version of it.
export const photoPlaceId = (key) => key.replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 150);

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file couldn't be opened as a picture. Try a JPEG or PNG."));
    };
    img.src = url;
  });
}

// Redraws the picture at most `edge` pixels on its longest side as a JPEG, lowering the
// quality (then the size) until it fits. Redrawing also drops the original's metadata,
// such as the GPS location phones store in photos.
function toJpeg(img, { edge, maxChars }) {
  let scale = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff'; // transparent PNGs would otherwise turn black
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.7, 0.55]) {
      const data = canvas.toDataURL('image/jpeg', quality);
      if (data.length <= maxChars) return data;
    }
    scale *= 0.75;
  }
  throw new Error("That picture couldn't be made small enough to save.");
}

export async function preparePhoto(file) {
  if (!file.type.startsWith('image/')) throw new Error('Please pick a picture file.');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('That picture is over 20 MB. Please pick a smaller one.');
  const img = await loadImage(file);
  return { image: toJpeg(img, FULL), thumb: toJpeg(img, THUMB) };
}

const toPhoto = (d) => ({ id: d.id, ...d.data() });

export async function loadMyPhotos(uid) {
  const { db } = await getFirebase();
  const { collection, query, where, getDocs } = await loadFirestoreSdk();
  const snapshot = await withTimeout(getDocs(query(collection(db, 'photos'), where('userId', '==', uid))));
  return snapshot.docs.map(toPhoto);
}

// Everyone's photos for one category, for the leaderboard.
export async function loadCategoryPhotos(category) {
  const { db } = await getFirebase();
  const { collection, query, where, getDocs } = await loadFirestoreSdk();
  const snapshot = await withTimeout(getDocs(query(collection(db, 'photos'), where('category', '==', category))));
  return snapshot.docs.map(toPhoto);
}

export async function loadFullImage(photoId) {
  const { db } = await getFirebase();
  const { doc, getDoc } = await loadFirestoreSdk();
  const snapshot = await withTimeout(getDoc(doc(db, 'photoFiles', photoId)));
  return snapshot.exists() ? snapshot.data().image : null;
}

// Saves a prepared photo in the first free slot. `myPhotos` is the user's current photos.
export async function addPhoto({ uid, username, category, placeKey, placeName, prepared, myPhotos }) {
  const used = new Set(myPhotos.map((p) => p.id));
  let slot = 1;
  while (slot <= MAX_PHOTOS_PER_USER && used.has(`${uid}_${slot}`)) slot += 1;
  if (slot > MAX_PHOTOS_PER_USER) {
    throw new Error(`You can keep up to ${MAX_PHOTOS_PER_USER} photos. Delete one to add another.`);
  }

  const id = `${uid}_${slot}`;
  const photo = {
    userId: uid,
    username,
    category,
    placeId: photoPlaceId(placeKey),
    placeName: placeName.slice(0, 200),
    thumb: prepared.thumb,
    createdAt: new Date().toISOString(),
  };
  const { db } = await getFirebase();
  const { doc, writeBatch } = await loadFirestoreSdk();
  // Both documents are written together, so a photo never shows up without its picture.
  const batch = writeBatch(db);
  batch.set(doc(db, 'photoFiles', id), { userId: uid, image: prepared.image });
  batch.set(doc(db, 'photos', id), photo);
  await withTimeout(batch.commit());
  return { id, ...photo };
}

export async function deletePhoto(photoId) {
  const { db } = await getFirebase();
  const { doc, writeBatch } = await loadFirestoreSdk();
  const batch = writeBatch(db);
  batch.delete(doc(db, 'photos', photoId));
  batch.delete(doc(db, 'photoFiles', photoId));
  await withTimeout(batch.commit());
}
