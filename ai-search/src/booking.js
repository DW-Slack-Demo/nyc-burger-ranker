// Finds a restaurant's online booking page (Resy, OpenTable, Tock, SevenRooms or Yelp) so
// the site's Reserve button can go straight to it. Google Maps gives us the restaurant's own
// website; we read that page (and its "Reservations" page, if it has one) for a link to one
// of those booking sites. None of them offer a public API, but restaurants link to their
// booking page from their own site.

// Only links to these sites are ever returned. The site and the database rules accept the
// same list (bookingStore.js, firestore.rules), so a Reserve button can't point anywhere else.
export const BOOKING_URL = /^https:\/\/((www|widgets)\.)?((resy|opentable|exploretock|sevenrooms)\.com|yelp\.com\/reservations)\/[-A-Za-z0-9._~:/?#@!$&()*+,;=%]{0,400}$/;

const PAGE_TIMEOUT_MS = 6000;
const MAX_PAGE_BYTES = 1_500_000;
const MAX_SUBPAGES = 2;

// Paths on the booking sites that are their own pages (sign-in, help, scripts), not a
// restaurant's booking page.
const NOT_A_VENUE = /\.(js|css|png|jpe?g|gif|svg|webp|ico|woff2?)(\?|$)|\/(about|help|login|signin|sign-in|join|privacy|terms|careers|blog|press|static|assets|widget\/reservation\/loader)(\/|\?|$)/i;

// Turns one URL found on a restaurant's site into a booking link, or null if it isn't one.
export function toBookingLink(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  url.protocol = 'https:';
  const host = url.hostname.replace(/^www\./, '');
  const path = url.pathname;

  // OpenTable's booking widget only names the restaurant by number (rid); its booking page
  // for that number is /restref/client.
  if (host === 'opentable.com') {
    const rid = url.searchParams.get('rid') || url.searchParams.get('restref');
    if (rid && /^\d{1,10}$/.test(rid)) return `https://www.opentable.com/restref/client/?rid=${rid}`;
    if (/^\/(r\/[^/]+|restaurant\/profile\/\d+|[a-z0-9-]+-reservations-[a-z-]+)\/?$/i.test(path)) return clean(url);
    return null;
  }
  if (NOT_A_VENUE.test(path)) return null;
  if (host === 'resy.com') {
    return /^\/cities\/[^/]+\/(venues\/)?[^/]+/.test(path) ? clean(url) : null;
  }
  if (host === 'widgets.resy.com') {
    const link = `https://widgets.resy.com/${url.hash}`;
    return /^#\/venues\/[^/]+/.test(url.hash) && BOOKING_URL.test(link) ? link : null;
  }
  if (host === 'exploretock.com') {
    // A restaurant's Tock page is exploretock.com/<restaurant>.
    return /^\/[a-z0-9][a-z0-9-]{1,80}(\/|$)/i.test(path) && !/^\/(tock|business|city|explore|search)(\/|$)/i.test(path)
      ? clean(url) : null;
  }
  if (host === 'sevenrooms.com') {
    return /^\/(reservations|explore)\/[^/]+/.test(path) ? clean(url) : null;
  }
  if (host === 'yelp.com') {
    return /^\/reservations\/[^/]+/.test(path) ? clean(url) : null;
  }
  return null;
}

// Drops tracking codes and fragments, keeping what picks the restaurant.
function clean(url) {
  const kept = new URL(`https://${url.hostname}${url.pathname}`);
  for (const key of ['rid', 'restref', 'venue', 'venueId']) {
    if (url.searchParams.has(key)) kept.searchParams.set(key, url.searchParams.get(key));
  }
  const text = kept.toString().replace(/\/$/, '');
  return BOOKING_URL.test(text) ? text : null;
}

// Every booking link in a page, most mentioned first.
export function findBookingLinks(html) {
  const text = html.replace(/\\\//g, '/').replace(/&amp;/g, '&').replace(/&#x2F;|&#47;/gi, '/');
  const counts = new Map();
  const pattern = /(?:https?:)?\/\/(?:www\.|widgets\.)?(?:resy|opentable|exploretock|sevenrooms|yelp)\.com[^\s"'<>\\`)]*/gi;
  for (const match of text.matchAll(pattern)) {
    const raw = match[0].startsWith('//') ? `https:${match[0]}` : match[0];
    const link = toBookingLink(raw.replace(/[.,;]+$/, ''));
    if (link) counts.set(link, (counts.get(link) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([link]) => link);
}

// Links on the restaurant's own site that look like its reservations page.
export function findReservationPages(html, baseUrl) {
  const base = new URL(baseUrl);
  const pages = [];
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)) {
    const [, href, label] = match;
    if (!/reserv|book/i.test(`${href} ${label.replace(/<[^>]+>/g, '')}`)) continue;
    let url;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(url.protocol) || url.hostname !== base.hostname) continue;
    url.hash = '';
    const page = url.toString();
    if (page !== base.toString() && !pages.includes(page)) pages.push(page);
    if (pages.length >= MAX_SUBPAGES) break;
  }
  return pages;
}

// Reads a page's HTML, giving up on slow or huge pages.
async function fetchPage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 (compatible; TopShelfBot/1.0)' },
    });
    if (!response.ok || !(response.headers.get('Content-Type') || '').includes('html')) return null;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let html = '';
    let bytes = 0;
    while (bytes < MAX_PAGE_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      html += decoder.decode(value, { stream: true });
    }
    reader.cancel().catch(() => {});
    return { html, url: response.url || url };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// The booking link for a restaurant whose website is `website`, or null.
export async function bookingLinkFrom(website) {
  if (!website || !/^https?:\/\//i.test(website)) return null;
  const direct = toBookingLink(website);
  if (direct) return direct;

  const home = await fetchPage(website);
  if (!home) return null;
  const [found] = findBookingLinks(home.html);
  if (found) return found;

  for (const page of findReservationPages(home.html, home.url)) {
    const sub = await fetchPage(page);
    const [link] = sub ? findBookingLinks(sub.html) : [];
    if (link) return link;
  }
  return null;
}
