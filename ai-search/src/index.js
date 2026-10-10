// AI Finder backend for NYC Top 10. The web app is a static site, so it can't hold an
// Anthropic API key; it sends the search here and this Worker calls Claude with the key
// kept as a Cloudflare secret.
import Anthropic from '@anthropic-ai/sdk';

const CATEGORIES = ['burgers', 'martinis', 'pizza', 'other'];
const MAX_QUERY_LENGTH = 300;

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

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (!cors) return new Response('Forbidden', { status: 403 });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405, cors);

    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: 'The AI search server is missing its Anthropic API key.' }, 500, cors);
    }

    let query;
    try {
      query = String((await request.json()).query || '').trim();
    } catch {
      return json({ error: 'Send JSON like {"query": "..."}.' }, 400, cors);
    }
    if (!query) return json({ error: 'Type what you are looking for.' }, 400, cors);
    if (query.length > MAX_QUERY_LENGTH) {
      return json({ error: `Keep it under ${MAX_QUERY_LENGTH} characters.` }, 400, cors);
    }

    try {
      return json(await findPlaces(env, query), 200, cors);
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        return json({ error: 'Too many searches right now. Try again in a minute.' }, 429, cors);
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
