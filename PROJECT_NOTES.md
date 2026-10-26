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
  track.js           "Track my order" (public, read-only: status + dates only)
  _lib/              placeOrder, quote, pricing, options, fields, contactChecks, track, rateLimit, notify, telegram,
                     team, audit, db, errors   (server logic; imported by the functions)
src/
  components/admin|storefront|shared    UI pieces
  context/           Auth, Tenant (shop + role), Language, Cart, Storefront (shop + light/dark)
  firebase/          *.service.js: ALL database/API calls live here (orders, products, stock, promos, team, tenants, ...)
  pages/admin|storefront|Landing.jsx    screens; routes/AppRoutes.jsx (admin pages lazy-loaded) + ProtectedRoute (role areas)
  utils/             pure logic, all unit-tested: contactChecks (mirror of api/_lib/contactChecks.js), theme, roles, stock, stats, profit, orderRules, productOptions, csv, exports, contact, storefront (logo choice, top-bar messages, highlights, text pages, product status), ...
  i18n/en.json, ar.json                 every text, must stay in parity
tests/               15 test files, `npm test`; `npm run build` runs them first (a broken update fails the build, live site stays on the old version)
firestore.rules      security rules (publish by hand in Firebase console)
```
Rendering helpers in tests use a pretend Firestore (tests/transactions.mjs bundles the real services with esbuild).
Page-render checks (server-side rendering with stubbed services) existed only in the previous assistant's sandbox and are NOT in the repo.

## 5. Data model (Firestore)
- `tenants/{slug}`: PUBLIC shop record: name{en,ar}, slug, ownerUid, isActive, theme{accent}, appearance{mode,font,radius,announcement{enabled,text,link,more[]}} (up to 4 top-bar messages in total),
  brand{logoUrl,logoDarkUrl}, hero{slides,intervalSeconds,fade,autoplay,textStyle card|plain}, highlights[{title{en,ar},text{en,ar}}] (max 4), pages{privacy|returns|shipping|terms:{body{en,ar}}}, checkout{fields,customFields}, shipping{zones}, contact{...}, defaultCountryCode, orderPrefix.
  Sub-collections: `auditLogs` (who changed what) and `stockMovements` (every stock change) — add-only.
- `users/{uid}`: tenantId, role owner|manager|staff, name, email, active. Created at signup (owner) or by /api/team.
- `products`: tenantId, name/description {en,ar}, price, stock, sku, imageUrl, images[], isActive, deleted, isPreorder, preorderStyle preorder|madeToOrder (wording only), comingSoon (visible, not orderable; the server refuses it), preorderMessage,
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

9. "Coming soon" products are refused by the server (placeOrder + quote), not only hidden in the screen. Shop text pages (privacy etc.) are shown as plain text, never as HTML.
10. Nothing is invented for a shop: highlights, text pages and top-bar messages show only what the shop wrote (no fake ratings/reviews).
11. Phone + email checks live in api/_lib/contactChecks.js (server = real gate) and src/utils/contactChecks.js (browser copy, a test fails if they differ). Egyptian shops (defaultCountryCode 20): mobile only (010/011/012/015), any spelling incl. +20 / 0020 / Arabic digits, SAVED as 01XXXXXXXXX; other countries: simple 7-30 chars check, saved as typed. Email = shape only (saved lower-case) + "did you mean gmail.com?" hints that never block.
12. Order tracking (/api/track) returns ONLY status + dates (never name, address, items, prices, staff ids); every mismatch = same "not found" answer; phone compared by its last 10 digits (old orders keep the phone as typed); limits: 15 attempts/hour/connection + 10 WRONG tries/hour/order number (fails open).

## 7. Known limits / gotchas
- Safari on iPhone once showed "A problem repeatedly occurred" (memory); mitigated (lighter hero, no blur header, ErrorBoundary). Cloudinary-resized images help.
- Stock is per product, not per color/variant. A cancelled/returned order does not give back a promo use.
- Dashboard reads all orders on each open (fine for thousands, later use stored totals).
- Customer-side history lines and audit lines are written by the browser (cannot be edited/deleted, but a technical user with a login could forge a new one).
- Old stock/orders before update 14 have no stock-history lines.
- Update 15: the owner's iPhone screenshots show light/dark and language switch working (home + product page). Contact tab / settings not seen.
- Update 16 (top bar with arrows, hero text card + ticks, highlight cards, light/dark logo, text pages, coming soon / made to order, fixed buy bar on phones) is tested by unit tests and a server-side render check only, NOT seen in a real browser yet: ask for phone screenshots (light + dark, English + Arabic).
- BYND's logo has a black square background: it looks like a black box on the light shop. Fix = transparent PNG, or a second logo for dark screens (Settings > Look).
- Photos: hero looked blurry on the owner's phone (Cloudinary not connected yet). The test product uses a picture from another seller's listing: replace with BYND's own photos before launch.
- Home page "How it works" (3 steps) only shows when the shop has written no highlights. Footer shows social links as text (no icons yet).
- Update 17 (phone/email checks, Track my order page + footer link + link on the thank-you page) is tested by unit tests and a successful build only, NOT seen in a real browser yet: ask for phone screenshots (checkout errors + email hint, track page, EN + AR). Email check = written correctly only, not proven to exist (real verification = paid codes). Anyone who fails 10 times on one order number locks that number's tracking for an hour (also the real customer). Per-phone order limit now uses the last 10 digits (counters restarted once). Orders placed before update 17 keep the phone as typed.
- WhatsApp floating button is lifted above the buy bar on product pages (mobile).
- Main storefront file is ~822 kB (build warning): split it when the shop feels slow.

## 8. Roadmap (ask the owner before starting)
BYND team wish list (Oct 2026) and the agreed order. BYND's products are NOT final: mostly 3D-printed, new products/ideas later, so keep everything generic.
17. DONE (see changelog). Still open from it: automatic emails to customers (needs own domain); SMS/WhatsApp status messages are paid; real email/phone verification codes are paid.
18. Stock per colour/option (today stock is per product: can oversell a colour). May be replaced by "made to order" for 3D-printed items: ASK the owner which products are stock vs made to order first. Own chat, most careful testing; existing products stay per-product.
19. Quantity packages: price tiers by quantity on one product (like medalrise "1+ / 10+"), colours of the same product count together; decide how it works with promo codes; computed only on the server (pricing.js) + mirrored in the browser.
20. Shipping companies / delivery persons: assign orders, count orders per courier, what they owe the team (ASK first: courier collects COD cash and keeps a fee? shop pays a fee?). Touches profit and firestore.rules.
Before launch: go-live list: backup, delete test data (orders, rateLimits, counters/bynd, tenant sub-collections, test users), real products + photos + starting stock, Cloudinary, one rehearsal order, real domain, Vercel Pro when sales start.
Later: wall-designer (hexagon layout planner, client-only), real reviews section (only real reviews, moderated), rules tests with Firebase emulator on GitHub Actions, free uptime check, accessibility (cart drawer focus, contrast), custom domain per shop, shop signup/onboarding, weight-based shipping, courier integration, official WhatsApp alerts (paid), social icons in footer.

## 9. CHANGELOG
1 server order function + new rules (orders BYND-1001) · 2 product page, preorder, private cost, profit report · 3 dark storefront, banner, Settings ·
4 Arabic everywhere, slideshow timing · 5 shipping zones, address fields, promo codes, configurable checkout · 6 delivery-area dropdown, custom checkout fields ·
7 Telegram alerts, WhatsApp/Call buttons, forgot password, signup closed, Cloudinary upload · 8 product options, slideshow arrows, phone hardening ·
9 team accounts, roles, activity log · 10 several owners · 11 option pictures, tick box with text, gallery, linked products · 12 spam protection, tests in repo, build guard, lazy admin ·
13 real dashboard, returned status, Excel exports, backup · 14 restock, stock history · 15 light/dark, any accent color, fonts, corners, top bar, contact/social, Settings tabs, character counters · 16 storefront look: rotating top bar (up to 4 messages), hero text card + tick points (or plain), highlight cards, light/dark logo, text pages (privacy/returns/shipping/terms) in footer, "Coming soon" + "Made to order" wording, fixed buy bar on phones, WhatsApp button lifted; server refuses coming-soon orders; 13th test file. ·
17 Egyptian phone check (server + browser, saved as 01XXXXXXXXX, Arabic digits ok) + email shape check with typo hints (never blocks), same rules for the shop's own phone/email questions, per-phone order limit now by last 10 digits, free "Track my order" page (/store/<shop>/track, new /api/track: order number + phone, status + dates only, guess limits), footer link + link on thank-you page; 14th and 15th test files.
