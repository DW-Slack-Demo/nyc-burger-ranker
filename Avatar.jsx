import React from 'react';

// A round profile photo, or the first letter of the username when there isn't one.
export default function Avatar({ src, username, size = 40, className = '' }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.45) };
  return src ? (
    <img src={src} alt={`@${username}`} style={style} className={`rounded-full object-cover shrink-0 border border-line ${className}`} />
  ) : (
    <span
      aria-hidden="true"
      style={style}
      className={`rounded-full shrink-0 inline-flex items-center justify-center bg-brass-light border border-brass/40 text-wine font-display italic ${className}`}
    >
      {(username || '?').charAt(0).toUpperCase()}
    </span>
  );
}
