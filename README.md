# Top Shelf

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
