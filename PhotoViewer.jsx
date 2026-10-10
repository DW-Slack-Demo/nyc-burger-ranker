import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react';
import { loadFullImage } from './photoStore.js';

// Full-screen view of a spot's photos. Shows the thumbnail straight away and swaps in the
// larger picture once it has loaded. People can delete only their own photos.
export default function PhotoViewer({ title, photos, startIndex = 0, currentUserId, onDelete, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const [fullImages, setFullImages] = useState({});
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const photo = photos[Math.min(index, photos.length - 1)];

  useEffect(() => {
    if (!photo || fullImages[photo.id] !== undefined) return;
    let cancelled = false;
    loadFullImage(photo.id)
      .then((image) => { if (!cancelled) setFullImages((prev) => ({ ...prev, [photo.id]: image })); })
      .catch(() => { if (!cancelled) setFullImages((prev) => ({ ...prev, [photo.id]: null })); });
    return () => { cancelled = true; };
  }, [photo?.id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(photos.length - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photos.length, onClose]);

  useEffect(() => {
    if (photos.length === 0) onClose();
  }, [photos.length]);

  if (!photo) return null;

  const handleDelete = async () => {
    if (!window.confirm('Delete this photo?')) return;
    setDeleting(true);
    setError('');
    try {
      await onDelete(photo.id);
      setIndex((i) => Math.max(0, Math.min(i, photos.length - 2)));
    } catch (err) {
      setError(err?.message || "Couldn't delete the photo. Please try again.");
    }
    setDeleting(false);
  };

  const navButton = 'absolute top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70 disabled:opacity-0';

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/85 flex flex-col items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Photos of ${title}`}
      onClick={onClose}
    >
      <div className="w-full max-w-3xl flex items-center justify-between text-white mb-3" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <div className="font-display text-xl truncate">{title}</div>
          <div className="text-sm text-white/70">
            {photo.username ? `Photo by @${photo.username}` : 'Photo'} · {index + 1} of {photos.length}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {photo.userId === currentUserId && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1 text-xs uppercase tracking-wider border border-white/40 rounded-sm px-3 py-2 hover:bg-white/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
          <button onClick={onClose} aria-label="Close photos" className="p-2 hover:bg-white/10 rounded-sm">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="relative w-full max-w-3xl flex justify-center" onClick={(e) => e.stopPropagation()}>
        <img
          src={fullImages[photo.id] || photo.thumb}
          alt={`${title}${photo.username ? `, photo by @${photo.username}` : ''}`}
          className="max-h-[75vh] max-w-full object-contain rounded-sm"
        />
        {photos.length > 1 && (
          <>
            <button onClick={() => setIndex(index - 1)} disabled={index === 0} aria-label="Previous photo" className={`${navButton} left-2`}>
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={() => setIndex(index + 1)} disabled={index === photos.length - 1} aria-label="Next photo" className={`${navButton} right-2`}>
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-white" onClick={(e) => e.stopPropagation()}>{error}</p>}
    </div>
  );
}
