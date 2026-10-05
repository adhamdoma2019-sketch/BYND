# The Workshop — Storefront + Partners Dashboard

Foundation layer: Firebase connection, bilingual Arabic/English system with
real RTL layout switching, Tailwind design tokens, and the routing shell for
both the public storefront and the password-protected partners dashboard.

This is stage 1 of the build. Nothing here talks to real product/order data
yet — it exists to prove the plumbing works before we build the actual
features on top of it.

## What you need installed on your computer

1. **Node.js** (version 18 or newer). Download from https://nodejs.org —
   choose the "LTS" version. This also installs `npm`, which you'll use to
   run commands below.
2. A free **Google account** (for Firebase).

## Step 1 — Install project dependencies

Open a terminal in this folder and run:

```bash
npm install
```

This downloads React, Firebase, Tailwind, and everything else listed in
`package.json`. It only needs to be done once (and again any time we add a
new dependency later).

## Step 2 — Create your Firebase project

1. Go to https://console.firebase.google.com and click **Add project**.
2. Name it (e.g. `my-workshop-shop`) and finish the wizard (Google
   Analytics is optional — you can skip it).
3. Inside your new project, click the **</> (Web)** icon to register a web
   app. Give it any nickname. You do **not** need Firebase Hosting checked
   yet.
4. Firebase will show you a `firebaseConfig` object with keys like
   `apiKey`, `authDomain`, etc. Keep this tab open — you'll need it in
   Step 3.

## Step 3 — Connect the app to your Firebase project

1. In this project folder, copy `.env.example` to a new file named
   `.env.local`.
2. Fill in each value from the `firebaseConfig` object you saw in Step 2.
   For example, if Firebase showed:
   ```js
   apiKey: "AIzaSyD...",
   authDomain: "my-workshop-shop.firebaseapp.com",
   ```
   then in `.env.local` you'd write:
   ```
   VITE_FIREBASE_API_KEY=AIzaSyD...
   VITE_FIREBASE_AUTH_DOMAIN=my-workshop-shop.firebaseapp.com
   ```
3. Save the file. `.env.local` is already git-ignored, so these values
   never get committed or shared publicly.

## Step 4 — Turn on Firestore and Auth in the Firebase console

1. In the left sidebar of the Firebase console, click **Build → Firestore
   Database → Create database**. Choose a location close to Egypt (e.g.
   `eur3 (europe-west)`), and start in **production mode**.
2. Once created, go to the **Rules** tab and replace the contents withn
   the file `firestore.rules` from this project (copy-paste it in, then
   click **Publish**). This is what keeps orders and expenses private to
   you while still letting customers place orders.
3. Click **Build → Authentication → Get started**. Under **Sign-in
   method**, enable **Email/Password**.
4. Go to the **Users** tab and click **Add user** — this is how you
   create your own partner login (e.g. your email + a password you
   choose). Add one row per partner.

## Step 5 — Run it locally

```bash
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`). You should see:

- **`/`** — the storefront placeholder, with a language toggle in the top
  right that switches between English and Arabic and flips the whole page
  to right-to-left.
- **`/admin/login`** — sign in with the email/password you created in
  Step 4. It should redirect you to `/admin`, a placeholder dashboard with
  a sign-out button.

If both of those work, the foundation is solid and we can move on to
building the real storefront (product grid, cart, checkout) next.

## What's already decided in this foundation

- **Bilingual, not just translated**: switching language also flips the
  page direction (`dir="rtl"`) and swaps the font family, so Arabic reads
  as a native right-to-left layout, not a mirrored afterthought.
- **Design tokens**: colors and fonts live in `tailwind.config.js` under
  names like `paper`, `ink`, `brass` — a warm-stone/near-black/brass
  palette chosen for a handmade-goods shop, not a generic template look.
  When we build the product grid next, it'll use these same tokens.
- **Security model**: customers can create orders but never read anyone
  else's; only signed-in partners can read orders, manage products, or
  touch expenses. This is enforced server-side by `firestore.rules`, not
  just hidden in the UI.

## Next step

Once you've confirmed the app runs and both pages work, tell me and we'll
build:
1. The real `products` collection + storefront product grid and detail page
2. Cart + checkout (with the inventory-deduction transaction)
3. The admin Orders, Products, and Expenses screens + the P&L dashboard
