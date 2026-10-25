# Shop platform (first client: BYND) — project notes

Keep this file up to date. At the end of every work session the assistant should update the
CHANGELOG and any section that changed, and give the owner the new file.

## 1. What it is
A multi-tenant online shop + small back office. BYND (sports/lifestyle brand, Egypt) is the first
shop; the platform must stay general (nothing hard-coded per shop). Languages: English + Arabic
(full RTL). Payment: cash on delivery only for now. Free plans only until real sales.
BYND's first products: hexagonal medal displays in several colors (photo changes per color) and a
"My Running PRs" board (standard board + distance plate 10 km / half marathon / marathon; extension
plates can also be bought alone). Reference brand the team likes: medalrise.com (inspiration only).

## 2. The owner
No coding background. Slow, step by step, plain language, exact clicks. Explain decisions
(what / why / alternatives / impact). Never ask for passwords, keys or tokens.
Cannot open a browser from the assistant side: ask for screenshots for anything visual.

## 3. Where things live (names only, no secrets)
- Code: private GitHub repo `adhamdoma2019-sketch/BYND` (branch main) -> Vercel redeploys on every upload.
- Hosting: Vercel (Hobby, free) project `bynd-2026` -> https://bynd-2026.vercel.app
  (shop: /store/bynd, admin: /admin). NOTE: Vercel Hobby is non-commercial by its terms: upgrade or move when real sales start.
- Database/login: Firebase project `erp-website-a2ae1` (free Spark plan): Auth email+password, Firestore.
  No automatic backups on Spark (Settings > Backup downloads a JSON file; the dashboard reminds weekly).
  Firebase Storage needs the paid plan, so pictures use Cloudinary (free) once connected.
- Vercel environment variables (NAMES):
  VITE_FIREBASE_API_KEY, _AUTH_DOMAIN, _PROJECT_ID, _STORAGE_BUCKET, _MESSAGING_SENDER_ID, _APP_ID (public web config);
  FIREBASE_SERVICE_ACCOUNT (SECRET, whole JSON; the server account needs the Google roles
  "Cloud Datastore User" + "Firebase Authentication Admin");
  TELEGRAM_BOT_TOKEN (SECRET, from @BotFather; beware fake BotFathers);
  optional VITE_CLOUDINARY_CLOUD_NAME + VITE_CLOUDINARY_UPLOAD_PRESET (unsigned preset);
  VITE_ALLOW_SIGNUP (unset = new-shop signup closed; also untick "Enable create (sign-up)" in Firebase Auth settings).
- Delivery method: the assistant gives `update-N.zip` with ONLY changed files; the owner unzips and uploads the
  contents via GitHub "Add file > Upload files". Dotfiles (.gitignore, .github) do not upload by drag-and-drop.

## 4. Stack and structure
Vite + React 18 + Tailwind 3 + react-router 6 + i18next + Firebase JS SDK (browser) + firebase-admin (server).
```
api/                 Vercel serverless functions (each file = one URL)
  create-order.js    place an order (public)         quote.js   price preview (public)
  telegram.js        alert setup helper (owner only) team.js    team accounts (owner only)
  _lib/              placeOrder, quote, pricing, options, fields, rateLimit, notify, telegram,
                     team, audit, db, errors   (server logic; imported by the functions)
src/
  components/admin|storefront|shared    UI pieces
  context/           Auth, Tenant (shop + role), Language, Cart, Storefront (shop + light/dark)
  firebase/          *.service.js: ALL database/API calls live here (orders, products, stock, promos, team, tenants, ...)
  pages/admin|storefront|Landing.jsx    screens; routes/AppRoutes.jsx (admin pages lazy-loaded) + ProtectedRoute (role areas)
  utils/             pure logic, all unit-tested: theme, roles, stock, stats, profit, orderRules, productOptions, csv, exports, contact, ...
  i18n/en.json, ar.json                 every text, must stay in parity
tests/               12 test files, `npm test`; `npm run build` runs them first (a broken update fails the build, live site stays on the old version)
firestore.rules      security rules (publish by hand in Firebase console)
```
Rendering helpers in tests use a pretend Firestore (tests/transactions.mjs bundles the real services with esbuild).
Page-render checks (server-side rendering with stubbed services) existed only in the previous assistant's sandbox and are NOT in the repo.

## 5. Data model (Firestore)
- `tenants/{slug}`: PUBLIC shop record: name{en,ar}, slug, ownerUid, isActive, theme{accent}, appearance{mode,font,radius,announcement},
  brand{logoUrl}, hero{slides,intervalSeconds,fade,autoplay}, checkout{fields,customFields}, shipping{zones}, contact{...}, defaultCountryCode, orderPrefix.
  Sub-collections: `auditLogs` (who changed what) and `stockMovements` (every stock change) — add-only.
- `users/{uid}`: tenantId, role owner|manager|staff, name, email, active. Created at signup (owner) or by /api/team.
- `products`: tenantId, name/description {en,ar}, price, stock, sku, imageUrl, images[], isActive, deleted, isPreorder, preorderMessage,
  shippingExtra, relatedIds[], options[] (color / choice / addon (optionally asks for text) / text; values can have priceDelta and imageUrl).
- `productCosts/{productId}` PRIVATE (owner/manager): costPrice, optionCosts{"optionId.valueId": cost}.
- `orders` (server-created only): orderNumber/Label (BYND-1001...), orderType normal|preorder, customer{...}, customFields[], items[] (name snapshot,
  unitPrice, unitCost, options snapshot, imageUrl), subtotal, discount, promo, shipping{zoneId,zoneName,fee}, shippingFee, totalAmount, status, statusHistory[].
- `expenses`, `promoCodes/{tenantId__CODE}`, `tenantPrivate/{tenantId}` (Telegram chat; owner only), `counters` + `rateLimits` (server only).
Queries use only equality filters (+ `orderBy` only on single fields in sub-collections) so no composite indexes are needed.

## 6. Rules that must not be broken
1. Money is computed ONLY on the server: /api/create-order and /api/quote use api/_lib/pricing.js + options.js + fields.js.
   The browser (src/utils/productOptions.js, checkoutFields.js) mirrors the rules for display; tests compare both.
2. Stock changes in one place each: sale (server transaction, writes a history line), Add stock / Adjust (client transaction), cancel/return (client transaction),
   new product (initial line). The product edit form never writes stock. In a Firestore client transaction ALL reads must come before writes.
3. Roles: owner (several allowed) = everything; manager = all but team + shop settings; staff = orders only (cannot see costs, cannot cancel/return).
   Enforced in firestore.rules and hidden in screens (src/utils/roles.js). Rules are NOT emulator-tested.
4. Statuses: pending > confirmed > processing > shipped > delivered; cancelled; returned (from shipped/delivered, optional restock).
   Revenue = delivered orders only; COGS comes from the cost snapshot in each order; Net = Gross - expenses.
5. Order alerts: Telegram (free). WhatsApp automation would need the paid official API.
6. Spam: per-phone (5/day) and per-connection (40/hour) limits stored hashed in `rateLimits` (fails open), hidden trap field; promo guessing limited.
7. Look: light/dark/auto + any accent color with guaranteed readable text (src/utils/theme.js, tested), fonts, corners; storefront colors are CSS variables, never hard-coded.
8. Texts: add to BOTH languages; use logical CSS (ms-/me-/start/end) for RTL. Settings the shop controls live in its tenant record.

## 7. Known limits / gotchas
- Safari on iPhone once showed "A problem repeatedly occurred" (memory); mitigated (lighter hero, no blur header, ErrorBoundary). Cloudinary-resized images help.
- Stock is per product, not per color/variant. A cancelled/returned order does not give back a promo use.
- Dashboard reads all orders on each open (fine for thousands, later use stored totals).
- Customer-side history lines and audit lines are written by the browser (cannot be edited/deleted, but a technical user with a login could forge a new one).
- Old stock/orders before update 14 have no stock-history lines.
- Update 15 (light/dark, look settings, contact tab) not yet seen in a real browser by the assistant.

## 8. Roadmap (ask the owner before starting)
1. Go-live: backup, delete test data (orders, rateLimits, counters/bynd, tenant sub-collections, test users), real products + starting stock,
   Cloudinary, one rehearsal order, real domain, Vercel Pro when sales start.
2. Update 16: storefront layout options (hero style, product card style, grid columns, sticky add-to-cart on mobile, editable home sections,
   brand story, policy pages) — needs screenshots of the reference brand.
3. Rules tests with the Firebase emulator on GitHub Actions; free uptime check; accessibility (cart drawer focus, contrast).
4. Later: custom domain per shop, shop signup/onboarding, weight-based shipping, order tracking page, per-color stock, courier integration, official WhatsApp alerts (paid).

## 9. CHANGELOG
1 server order function + new rules (orders BYND-1001) · 2 product page, preorder, private cost, profit report · 3 dark storefront, banner, Settings ·
4 Arabic everywhere, slideshow timing · 5 shipping zones, address fields, promo codes, configurable checkout · 6 delivery-area dropdown, custom checkout fields ·
7 Telegram alerts, WhatsApp/Call buttons, forgot password, signup closed, Cloudinary upload · 8 product options, slideshow arrows, phone hardening ·
9 team accounts, roles, activity log · 10 several owners · 11 option pictures, tick box with text, gallery, linked products · 12 spam protection, tests in repo, build guard, lazy admin ·
13 real dashboard, returned status, Excel exports, backup · 14 restock, stock history · 15 light/dark, any accent color, fonts, corners, top bar, contact/social, Settings tabs, character counters.
