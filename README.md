# nyc-burger-ranker

Rank your top 10 favorite burgers, martinis and pizza spots in New York City and see how they compare with others.

🍔 **Live app:** https://dw-slack-demo.github.io/nyc-burger-ranker/

## Accounts

People sign up and log in with a username and password. Passwords are handled by
Firebase Authentication, which stores only a salted hash; the app never saves a
password in the database. Each person's top-10 lists (one per category) save
automatically to their account and are there the next time they log in, and they
can follow other people to see their lists.

### Demo mode

Until a Firebase API key is configured, the app runs in demo mode: sign-up, login,
saved lists and following all work, but everything is stored in the current
browser only, so other people and other devices won't see it.

### Setup

1. In the Firebase console, open **Authentication > Sign-in method** and enable **Email/Password**.
   (Usernames are mapped to private placeholder addresses; nobody is asked for an email.)
2. Set the project's web API key as `VITE_FIREBASE_API_KEY`: as a repository secret
   (Settings > Secrets and variables > Actions) for the GitHub Pages build, and in `.env`
   (copy `.env.example`) for local development.
3. Deploy the security rules so people can only change their own lists:
   `npx firebase-tools deploy --only firestore:rules --project burger-rating-app`

## AI Finder

The AI Finder takes a plain-language request ("a dirty martini in downtown Brooklyn")
and suggests spots across all three categories, each with a button to add it to the
right list. It needs an Anthropic API key, and a key can't live in this static site
(anyone could read it from the page), so the search goes through a tiny server in
`ai-search/`, a Cloudflare Worker that keeps the key as a secret. Until it is set up,
the AI Finder says it isn't switched on and the rest of the app works as before.

### Setup

1. Create an API key at https://console.anthropic.com (Settings > API keys). Set a
   monthly spend limit under Settings > Limits so a busy week can't run up a bill.
2. Create a free Cloudflare account at https://dash.cloudflare.com/sign-up.
3. Deploy the Worker (needs Node 20+):
   ```
   cd ai-search
   npm install
   npx wrangler login
   npx wrangler secret put ANTHROPIC_API_KEY   # paste the key when asked
   npx wrangler deploy
   ```
   The last command prints the Worker's address, like
   `https://nyc-top10-ai-search.<your-subdomain>.workers.dev`.
4. In GitHub, open Settings > Secrets and variables > Actions > **Variables**, add
   `VITE_AI_SEARCH_URL` with that address, then re-run the **Deploy to GitHub Pages**
   workflow.

The Worker only answers requests from the sites listed in `ALLOWED_ORIGINS` in
`ai-search/wrangler.toml` (the live site and local dev).
