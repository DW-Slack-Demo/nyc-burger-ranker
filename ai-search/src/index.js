// Backend for Top Shelf. The web app is a static site, so it can't hold API keys; it
// sends searches here and this Worker calls Google Places and Claude with the keys kept as
// Cloudflare secrets.
//   POST /places {query}  -> official Google Maps listings for NYC food and drink spots
//   POST /        {query}  -> AI Finder recommendations
import Anthropic from '@anthropic-ai/sdk';

const CATEGORIES = ['burgers', 'martinis', 'pizza', 'other'];
const MAX_QUERY_LENGTH = 300;

// The five boroughs, so "Joe's" finds the one on Carmine St and not one in New Jersey.
const NYC_BOUNDS = {
  rectangle: {
    low: { latitude: 40.4774, longitude: -74.2591 },
    high: { latitude: 40.9176, longitude: -73.7004 },
  },
};

// Google tags every restaurant, bar and cafe with one of these, so anything else (a
// street, a hotel lobby, a shop) is left out of the results.
const FOOD_AND_DRINK = /^(food|restaurant|bar|pub|cafe|bakery|meal_takeaway|meal_delivery|night_club|steak_house|coffee_shop|.+_(restaurant|bar))$/;

const SYSTEM_PROMPT = `You recommend places to eat and drink in New York City for an app where friends rank their top 10 burgers, martinis and pizza spots.

Given a request in plain language, recommend 3 to 5 real places in NYC that fit it, respecting any neighborhood, borough, vibe, price or dish it mentions. Only recommend places you are confident exist and are open; if you are unsure whether a place is still open, leave it out.

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

async function findPlaces(env, query) {
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
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: query }],
  });

  if (response.stop_reason === 'refusal') return { results: [] };
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text);
}

async function searchPlaces(env, textQuery, pageSize) {
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.types,places.location',
    },
    body: JSON.stringify({ textQuery, pageSize, locationRestriction: NYC_BOUNDS, languageCode: 'en' }),
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
// as the same place found through the search bar. Suggestions Google can't find in NYC
// are dropped rather than saved under a made-up name.
async function attachListings(env, results) {
  const matched = await Promise.all(results.map(async (r) => {
    try {
      const [place] = await searchPlaces(env, `${r.name}, ${r.address}`, 1);
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

async function readQuery(request) {
  try {
    return String((await request.json()).query || '').trim();
  } catch {
    return null;
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
  const query = await readQuery(request);
  const invalid = checkQuery(query, cors);
  if (invalid) return invalid;

  try {
    return json({ places: await searchPlaces(env, query, 10) }, 200, cors);
  } catch (error) {
    if (error instanceof PlacesError && error.status === 429) {
      return json({ error: SLOW_DOWN }, 429, cors);
    }
    return json({ error: 'Could not reach Google Maps. Try again.' }, 502, cors);
  }
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (!cors) return new Response('Forbidden', { status: 403 });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405, cors);

    if (new URL(request.url).pathname.replace(/\/+$/, '') === '/places') {
      return handlePlaces(request, env, cors);
    }

    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: 'The AI search server is missing its Anthropic API key.' }, 500, cors);
    }

    if (await overLimit(env.AI_LIMIT_PER_VISITOR, visitor(request))
      || await overLimit(env.AI_LIMIT_TOTAL, 'everyone')) {
      return json({ error: SLOW_DOWN }, 429, cors);
    }
    const query = await readQuery(request);
    const invalid = checkQuery(query, cors);
    if (invalid) return invalid;

    try {
      const found = await findPlaces(env, query);
      if (env.GOOGLE_PLACES_API_KEY) found.results = await attachListings(env, found.results || []);
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
