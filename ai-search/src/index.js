// Backend for Top Shelf. The web app is a static site, so it can't hold API keys; it
// sends searches here and this Worker calls Google Places and Claude with the keys kept as
// Cloudflare secrets.
//   POST /places {query, city}  -> official Google Maps listings for food and drink spots in that city
//   POST /booking {placeId, name, address, city} -> the spot's Resy/OpenTable/Tock/... booking page, if any
//   POST /        {query, city}  -> AI Finder recommendations
// city is "nyc" or "miami"; anything else (including older versions of the site, which
// don't send it) means NYC.
import Anthropic from '@anthropic-ai/sdk';
import { bookingLinkFrom } from './booking.js';

const CATEGORIES = ['burgers', 'martinis', 'pizza', 'other'];
const MAX_QUERY_LENGTH = 300;

// Where each city's searches are limited to, so "Joe's" finds the one on Carmine St and
// not one in New Jersey.
const CITIES = {
  nyc: {
    name: 'New York City',
    // The five boroughs.
    bounds: {
      rectangle: {
        low: { latitude: 40.4774, longitude: -74.2591 },
        high: { latitude: 40.9176, longitude: -73.7004 },
      },
    },
  },
  miami: {
    name: 'Miami',
    // Miami-Dade from Homestead up to Aventura, Miami Beach included.
    bounds: {
      rectangle: {
        low: { latitude: 25.40, longitude: -80.55 },
        high: { latitude: 25.98, longitude: -80.10 },
      },
    },
  },
};

const cityFor = (key) => CITIES[key] || CITIES.nyc;

// Google tags every restaurant, bar and cafe with one of these, so anything else (a
// street, a hotel lobby, a shop) is left out of the results.
const FOOD_AND_DRINK = /^(food|restaurant|bar|pub|cafe|bakery|meal_takeaway|meal_delivery|night_club|steak_house|coffee_shop|.+_(restaurant|bar))$/;

const systemPrompt = (city) => `You recommend places to eat and drink in ${city} for an app where friends rank their top 10 burgers, martinis and pizza spots.

Given a request in plain language, recommend 3 to 5 real places in ${city} that fit it, respecting any neighborhood, vibe, price or dish it mentions. Only recommend places you are confident exist and are open; if you are unsure whether a place is still open, leave it out.

For each place, set category to "burgers", "martinis" or "pizza" when the request is about that food or drink (a martini, cocktail or bar request is "martinis"); otherwise use "other". Keep "why" to one short sentence about what makes it a fit.`;

const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          category: { type: 'string', enum: CATEGORIES },
          neighborhood: { type: 'string' },
          address: { type: 'string' },
          why: { type: 'string' },
        },
        required: ['name', 'category', 'neighborhood', 'address', 'why'],
        additionalProperties: false,
      },
    },
  },
  required: ['results'],
  additionalProperties: false,
};

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
  if (!allowed.includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

async function findPlaces(env, query, city) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const response = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: RESULT_SCHEMA },
    },
    system: systemPrompt(city.name),
    messages: [{ role: 'user', content: query }],
  });

  if (response.stop_reason === 'refusal') return { results: [] };
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text);
}

async function searchPlaces(env, textQuery, pageSize, city) {
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.types,places.location',
    },
    body: JSON.stringify({ textQuery, pageSize, locationRestriction: city.bounds, languageCode: 'en' }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Google Places error:', response.status, JSON.stringify(data.error || data));
    throw new PlacesError(response.status);
  }
  return (data.places || [])
    .filter((p) => (p.types || []).some((t) => FOOD_AND_DRINK.test(t)))
    .map((p) => ({
      id: p.id,
      name: p.displayName?.text || '',
      address: (p.formattedAddress || '').replace(/, (USA|United States)$/, ''),
      location: p.location ? { lat: p.location.latitude, lng: p.location.longitude } : null,
    }));
}

class PlacesError extends Error {
  constructor(status) {
    super(`Google Places returned ${status}`);
    this.status = status;
  }
}

// Swaps each AI suggestion for its official Google listing, so it saves with the same id
// as the same place found through the search bar. Suggestions Google can't find in the
// city are dropped rather than saved under a made-up name.
async function attachListings(env, results, city) {
  const matched = await Promise.all(results.map(async (r) => {
    try {
      const [place] = await searchPlaces(env, `${r.name}, ${r.address}`, 1, city);
      return place ? { ...r, placeId: place.id, address: place.address, location: place.location } : null;
    } catch {
      return null;
    }
  }));
  return matched.filter(Boolean);
}

const SLOW_DOWN = 'Too many searches right now. Try again in a minute.';

// True when a rate limit (see wrangler.toml) says this request is one too many. A missing
// limit or a hiccup checking it lets the search through rather than breaking it.
async function overLimit(limiter, key) {
  if (!limiter) return false;
  try {
    return !(await limiter.limit({ key })).success;
  } catch {
    return false;
  }
}

const visitor = (request) => request.headers.get('CF-Connecting-IP') || 'unknown';

// The search text and city from the request body, or null if it isn't valid JSON.
async function readRequest(request) {
  try {
    const body = await request.json();
    return { query: String(body.query || '').trim(), city: cityFor(body.city) };
  } catch {
    return { query: null, city: CITIES.nyc };
  }
}

function checkQuery(query, cors) {
  if (query === null) return json({ error: 'Send JSON like {"query": "..."}.' }, 400, cors);
  if (!query) return json({ error: 'Type what you are looking for.' }, 400, cors);
  if (query.length > MAX_QUERY_LENGTH) {
    return json({ error: `Keep it under ${MAX_QUERY_LENGTH} characters.` }, 400, cors);
  }
  return null;
}

async function handlePlaces(request, env, cors) {
  if (!env.GOOGLE_PLACES_API_KEY) {
    return json({ error: "Official restaurant search isn't switched on yet." }, 503, cors);
  }
  if (await overLimit(env.PLACES_LIMIT_PER_VISITOR, visitor(request))) {
    return json({ error: SLOW_DOWN }, 429, cors);
  }
  const { query, city } = await readRequest(request);
  const invalid = checkQuery(query, cors);
  if (invalid) return invalid;

  try {
    return json({ places: await searchPlaces(env, query, 10, city) }, 200, cors);
  } catch (error) {
    if (error instanceof PlacesError && error.status === 429) {
      return json({ error: SLOW_DOWN }, 429, cors);
    }
    return json({ error: 'Could not reach Google Maps. Try again.' }, 502, cors);
  }
}

// Google place ids are long and mixed-case ("ChIJ..."); the app's recommended spots use
// short made-up ids ("raouls", "miami-lucali") that Google doesn't know.
const isGooglePlaceId = (id) => /^[A-Za-z0-9_-]{20,200}$/.test(id) && /[A-Z]/.test(id);

// The restaurant's own website from Google Maps: by its id when it has one, otherwise by
// looking its name and address up in the city.
async function websiteFor(env, { placeId, name, address }, city) {
  const headers = { 'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY };
  let response;
  if (isGooglePlaceId(placeId)) {
    response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: { ...headers, 'X-Goog-FieldMask': 'websiteUri' },
    });
  } else {
    const textQuery = address && address !== 'Multiple Locations' ? `${name}, ${address}` : name;
    response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', 'X-Goog-FieldMask': 'places.websiteUri' },
      body: JSON.stringify({ textQuery, pageSize: 1, locationRestriction: city.bounds, languageCode: 'en' }),
    });
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Google Places error:', response.status, JSON.stringify(data.error || data));
    throw new PlacesError(response.status);
  }
  return isGooglePlaceId(placeId) ? data.websiteUri : data.places?.[0]?.websiteUri;
}

async function handleBooking(request, env, cors) {
  if (!env.GOOGLE_PLACES_API_KEY) {
    return json({ error: "Booking lookups aren't switched on yet." }, 503, cors);
  }
  if (await overLimit(env.BOOKING_LIMIT_PER_VISITOR, visitor(request))
    || await overLimit(env.BOOKING_LIMIT_TOTAL, 'everyone')) {
    return json({ error: SLOW_DOWN }, 429, cors);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Send JSON like {"placeId": "...", "name": "..."}.' }, 400, cors);
  }
  const spot = {
    placeId: String(body.placeId || ''),
    name: String(body.name || '').trim(),
    address: String(body.address || '').trim(),
  };
  if (!spot.name || spot.name.length > 200 || spot.address.length > 300 || spot.placeId.length > 200) {
    return json({ error: 'Send the spot\'s name (and address).' }, 400, cors);
  }

  try {
    const website = await websiteFor(env, spot, cityFor(body.city));
    return json({ url: await bookingLinkFrom(website) }, 200, cors);
  } catch (error) {
    if (error instanceof PlacesError && error.status === 429) {
      return json({ error: SLOW_DOWN }, 429, cors);
    }
    console.error('Booking lookup failed:', error);
    return json({ error: 'Could not look up a booking page. Try again.' }, 502, cors);
  }
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (!cors) return new Response('Forbidden', { status: 403 });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405, cors);

    const path = new URL(request.url).pathname.replace(/\/+$/, '');
    if (path === '/places') return handlePlaces(request, env, cors);
    if (path === '/booking') return handleBooking(request, env, cors);

    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: 'The AI search server is missing its Anthropic API key.' }, 500, cors);
    }

    if (await overLimit(env.AI_LIMIT_PER_VISITOR, visitor(request))
      || await overLimit(env.AI_LIMIT_TOTAL, 'everyone')) {
      return json({ error: SLOW_DOWN }, 429, cors);
    }
    const { query, city } = await readRequest(request);
    const invalid = checkQuery(query, cors);
    if (invalid) return invalid;

    try {
      const found = await findPlaces(env, query, city);
      if (env.GOOGLE_PLACES_API_KEY) found.results = await attachListings(env, found.results || [], city);
      return json(found, 200, cors);
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        return json({ error: SLOW_DOWN }, 429, cors);
      }
      if (error instanceof Anthropic.AuthenticationError) {
        console.error('Anthropic rejected the API key');
        return json({ error: 'The AI search server has an invalid Anthropic API key.' }, 500, cors);
      }
      console.error('AI search failed:', error);
      return json({ error: 'Could not get recommendations. Try again.' }, 502, cors);
    }
  },
};
