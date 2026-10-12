import React from 'react';

// A small square picture of a spot: a photo someone in the app took of it, or, until
// someone adds one, the spot's first letter. Tapping a photo opens it full screen.
export default function Thumbnail({ name, src, onOpen, size = 56 }) {
  const style = { width: size, height: size };
  if (!src) {
    return (
      <span
        aria-hidden="true"
        style={{ ...style, fontSize: Math.round(size * 0.48) }}
        className="rounded-sm shrink-0 inline-flex items-center justify-center bg-brass-light border border-brass/40 text-wine font-display italic select-none"
      >
        {(name || '?').trim().charAt(0).toUpperCase() || '?'}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open photos of ${name}`}
      style={style}
      className="rounded-sm shrink-0 overflow-hidden border border-line hover:border-wine"
    >
      <img src={src} alt="" draggable={false} className="w-full h-full object-cover" />
    </button>
  );
}
