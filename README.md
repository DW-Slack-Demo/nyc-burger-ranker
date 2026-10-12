# Top Shelf

Rank your top 10 favorite burgers, martinis and pizza spots in New York City and Miami and see how they compare with others.

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
   `npx firebase-tools deploy --only firestore:rules --project nyc-top-10`

## Finding spots

The **Find a spot** search looks places up on Google Maps (restaurants, bars and cafes in
the five boroughs) and only lets people add a real listing, never whatever they typed. Each
spot is saved with its Google place id, so "4 Charles" and "4 Charles Prime" are the same
place on everyone's list and on the leaderboard. Searching for one of the recommended spots
finds the recommended entry, so it counts together with people who added it from the list.

The Google key lives in the same Cloudflare helper as the AI Finder (see below), so it
never appears in the site. Until it is set up, search only covers the recommended spots.

Spots saved before this were typed in by hand. They show a "Match it to the official
listing" link in your list; picking the listing keeps the spot's rank, stars and notes.
Until they are matched, the leaderboard counts hand-typed spots with the same name together.

### Setup

1. Open https://console.cloud.google.com and pick the **nyc-top-10** project (the
   Firebase project is also a Google Cloud project).
2. Google requires a billing account for Maps, even within the free monthly allowance:
   **Billing** > link a billing account.
3. **APIs & Services** > **Library**, search **Places API (New)** and click **Enable**.
4. **APIs & Services** > **Credentials** > **Create credentials** > **API key**. Click
   **Edit API key**, under **API restrictions** choose **Restrict key** and tick only
   **Places API (New)**, then **Save**. Copy the key.
5. Optional but recommended: **APIs & Services** > **Places API (New)** > **Quotas**, and
   lower the daily limit for Text Search requests (for example to 150) so usage stays in the free
   allowance.
6. In GitHub, Settings > Secrets and variables > Actions > **New repository secret**:
   name `GOOGLE_PLACES_API_KEY`, value the key.
7. Actions > **Deploy AI search helper** > **Run workflow**. The search bar uses the
   helper at `VITE_AI_SEARCH_URL` (its `/places` address), so nothing else needs changing.

## Reserving a table

Every spot has a **Reserve** button. It always offers the spot's Google Maps page, which
shows Google's own "Reserve a table" button for restaurants on OpenTable, Resy and similar
sites, or their phone number if they don't take bookings online. Maps links are free.

When the restaurant's booking page is known, the button also offers **Book on Resy** (or
OpenTable, Tock, SevenRooms, Yelp). The first time anyone opens Reserve for a spot, the
Cloudflare helper (its `/booking` address) gets the restaurant's website from Google Maps
and reads it for a link to one of those sites. The answer is saved in Firestore
(`bookingLinks`) for everyone, so each spot is only looked up once. Anyone signed in can
add or fix a link by hand; only links to those booking sites are accepted.

The booking sites don't let other apps make bookings for them (their APIs are only for
approved partners), so the button opens their page, where people pick a time.

The lookup uses Google's Place Details with the website field, which Google bills
separately from Text Search; it has its own free monthly allowance. It needs the
`bookingLinks` rules from firestore.rules to be published (Firebase console > Firestore >
Rules); until then each lookup still works but isn't saved for everyone.

## AI Finder

The AI Finder takes a plain-language request ("a dirty martini in downtown Brooklyn")
and suggests spots across all three categories, each with a button to add it to the
right list. With the Google key set up, each suggestion is matched to its official Google
Maps listing, and ones Google can't find in NYC are left out. It needs an Anthropic API key, and a key can't live in this static site
(anyone could read it from the page), so the search goes through a tiny server in
`ai-search/`, a Cloudflare Worker that keeps the key as a secret. Until it is set up,
the AI Finder says it isn't switched on and the rest of the app works as before.

### Setup

1. Create an API key at https://console.anthropic.com (Settings > API keys). Set a
   monthly spend limit under Settings > Limits so a busy week can't run up a bill.
2. Create a free Cloudflare account at https://dash.cloudflare.com/sign-up.
3. In Cloudflare, open **Workers & Pages** once so it sets up your free `workers.dev`
   address. Then create an API token (My Profile > API Tokens > Create Token > **Edit
   Cloudflare Workers** template), and copy your **Account ID** (shown on the Workers &
   Pages overview).
4. In GitHub, open Settings > Secrets and variables > Actions and add three repository
   **secrets**: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `ANTHROPIC_API_KEY`.
5. Open Actions > **Deploy AI search helper** > Run workflow. It publishes `ai-search/`
   and stores the Anthropic key as a Cloudflare secret. The helper's address appears in
   the run's log and in Cloudflare under Workers & Pages, like
   `https://nyc-top10-ai-search.<your-subdomain>.workers.dev`. The workflow also runs
   by itself whenever `ai-search/` changes on main.
6. Back in Settings > Secrets and variables > Actions, open the **Variables** tab, add
   `VITE_AI_SEARCH_URL` with that address, then re-run the **Deploy to GitHub Pages**
   workflow.

To run the helper from your own computer instead (needs Node 22+): `cd ai-search && npm
install && npx wrangler login && npx wrangler secret put ANTHROPIC_API_KEY && npx wrangler
deploy`.

The Worker only answers requests from the sites listed in `ALLOWED_ORIGINS` in
`ai-search/wrangler.toml` (the live site and local dev).
