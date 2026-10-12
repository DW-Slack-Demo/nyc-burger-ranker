import React, { useState } from 'react';
import { CalendarCheck, ChevronDown, ChevronUp, ExternalLink, MapPin, X } from 'lucide-react';
import { databaseErrorMessage } from './firebase.js';
import {
  BOOKING_URL, BOOKING_SITES, platformOf, canLookUp, googleMapsUrl, bookingKey,
  loadBookingLinks, needsLookup, lookUpBookingLink, saveBookingLink,
} from './bookingStore.js';

const linkButton = 'text-xs uppercase tracking-wider font-semibold flex items-center gap-1';
const primary = 'bg-wine text-paper rounded-sm uppercase tracking-wider text-xs font-semibold hover:bg-wine-dark transition-colors px-3 py-2 inline-flex items-center gap-1.5';
const quiet = 'border border-line text-ink-soft rounded-sm uppercase tracking-wider text-xs font-semibold hover:border-ink-soft hover:text-ink transition-colors px-3 py-2 inline-flex items-center gap-1.5';

// The Reserve button on a spot: its Resy/OpenTable/Tock/... page when we know it (looked up
// the first time anyone opens it, then saved for everyone), and always its Google Maps page,
// which has its own Reserve button or the phone number. Anyone signed in can add or fix the link.
export default function Reserve({ item, placeKey, city, cityLabel, userId }) {
  const key = bookingKey(placeKey);
  const [open, setOpen] = useState(false);
  const [entry, setEntry] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | checking | ready
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const toggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (status !== 'idle') return;
    setStatus('checking');
    let found = null;
    try {
      found = (await loadBookingLinks())[key] || null;
    } catch (loadError) {
      console.warn('Could not load booking links:', loadError);
    }
    if (needsLookup(found) && canLookUp) {
      try {
        found = await lookUpBookingLink(item, key, city, userId);
      } catch (lookupError) {
        console.warn('Booking lookup failed:', lookupError);
      }
    }
    setEntry(found);
    setStatus('ready');
  };

  const save = async (e) => {
    e.preventDefault();
    const url = draft.trim();
    if (!BOOKING_URL.test(url)) {
      setError(`That doesn't look like a booking page. Paste a link from ${BOOKING_SITES}, starting with https://.`);
      return;
    }
    setError('');
    try {
      setEntry(await saveBookingLink(key, url, 'manual', userId));
      setEditing(false);
    } catch (saveError) {
      setEntry({ url, source: 'manual' });
      setEditing(false);
      setError(`Saved for you on this visit, but not for everyone: ${databaseErrorMessage(saveError)}`);
    }
  };

  const url = entry?.url;
  return (
    <div>
      <button onClick={toggle} aria-expanded={open} className={`${linkButton} text-wine hover:text-wine-dark`}>
        <CalendarCheck className="w-3.5 h-3.5" />
        Reserve
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          className="relative mt-2 border border-line rounded-sm bg-paper/60 pl-3 pr-10 py-3 space-y-2 text-sm"
        >
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            title="Close"
            className="absolute top-1.5 right-1.5 p-1.5 text-ink-muted hover:text-wine"
          >
            <X className="w-4 h-4" />
          </button>
          {status === 'checking' ? (
            <p className="italic text-ink-muted">Looking for their booking page...</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {url && (
                  <a href={url} target="_blank" rel="noopener noreferrer" className={primary}>
                    Book on {platformOf(url)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <a href={googleMapsUrl(item, cityLabel)} target="_blank" rel="noopener noreferrer" className={quiet}>
                  <MapPin className="w-3 h-3" />
                  Google Maps
                </a>
              </div>
              {!url && (
                <p className="text-ink-muted">
                  {entry
                    ? "We couldn't find an online booking page on their website."
                    : "We haven't found their booking page yet."}{' '}
                  Google Maps shows a Reserve button when the restaurant takes bookings online, or their phone number if not.
                </p>
              )}
              {editing ? (
                <form onSubmit={save} className="flex flex-wrap gap-2">
                  <input
                    type="url"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={420}
                    placeholder="https://resy.com/cities/..."
                    aria-label={`Booking link for ${item.name}`}
                    className="flex-1 min-w-[12rem] px-3 py-2 bg-white/70 border border-line rounded-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-wine focus:border-wine"
                  />
                  <button type="submit" className={primary}>Save</button>
                  <button type="button" onClick={() => { setEditing(false); setError(''); }} className={quiet}>Cancel</button>
                </form>
              ) : (
                <button
                  onClick={() => { setDraft(url || ''); setEditing(true); }}
                  className="text-xs text-wine hover:text-wine-dark underline underline-offset-2"
                >
                  {url ? 'Wrong link? Fix it' : 'Know their booking page? Add the link'}
                </button>
              )}
              {error && <p className="text-xs text-wine">{error}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
