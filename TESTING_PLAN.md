# BYND shop: testing and go-live plan (Nov 12, 2026)

Rule: one batch at a time. Send me only what the batch asks for. A batch ends PASS or FAIL.
Honest limit: I cannot open a browser or a phone, and the Firestore rules are not emulator-tested. Everything visual needs your screenshots.

## PART A. Already done by me (Nov 12, 2026)
- npm install + npm test: all 49 test files pass. npm run build: OK (only the known big-file warning).
- English / Arabic texts: 1114 = 1114, none missing, none empty.
- Code: no console.log left, no TODO/FIXME. Server uses only 3 secrets: FIREBASE_SERVICE_ACCOUNT, TELEGRAM_BOT_TOKEN, VERCEL_PROJECT_PRODUCTION_URL.
- firestore.rules read line by line. Good: orders cannot be created or deleted from a browser, products are never deleted, staff are limited to one step forward on an order, rateLimits and counters are closed.
- FINDINGS (none blocks launch, all need your decision):
  1. 22 loose files sit at the top of the repo (the update zips were uploaded flat). 13 of them differ from the real copy in src/ or tests/. The live shop uses src/, so the shop is not affected, but they can confuse a future update. List in Batch 0.
  2. Staff can read the cost snapshot stored in each order (unitCost) if they open the database directly. The screens hide it, the rules do not. Low risk if staff are people you trust. Decision needed (see Batch 5).
  3. npm audit: 22 notices (5 high), all inside the Firebase package and its helpers. Not fixed with "audit fix --force" (that can break the shop). Planned as its own careful update after launch.
  4. scripts/check_i18n.py is missing from the zip (I checked the same thing another way).

## PART B. My steps (I do these, in this order)
B1. Make a clean update-60 zip with the cleanup list (no deletions in it; a zip cannot delete).
B2. Order rehearsal on the server code with the pretend database: every way of selling (counted stock, made to order, stock first), package price, quantity price, promo code, wall, each area. Check quote = order.
B3. Attack tests: edited prices, fake wall, hidden option answers, spam limits, duplicate order, closed signup, coming-soon product.
B4. Check the failure paths: no internet on checkout, Telegram down, Cloudinary refused, admin page read failed.
B5. Write the exact list of manual rule tests for you (Batch 5).
B6. Review the speed (file sizes) and give you the PageSpeed steps.
B7. After each of your batches: fix what you report, new zip, tests green, update PROJECT_NOTES.md.

## PART C. Your steps (small batches, about 10 to 15 minutes each)

### Batch 0: Tidy GitHub (10 min, no risk)
1. Open github.com, your repo BYND, main branch. Make no change yet.
2. Wait for my update-60 zip, then upload it as usual and wait for the green tick on Vercel.
3. Delete the loose files at the top of the repo one by one (open the file > the three dots at the top right > Delete file > Commit changes). Do NOT touch folders. Files to delete (top level only): AnnouncementBar.jsx, CartDrawer.jsx, Checkout.jsx, CheckoutHeader.jsx, Hero.jsx, LanguageSwitch.jsx, OptionPicker.jsx, PictureText.jsx, ProductCard.jsx, ProductGallery.jsx, ProductPage.jsx, StorefrontHeader.jsx, StorefrontMenu.jsx, TrustStrip.jsx, WallDesigner.jsx, alerts.mjs, ar.json, en.json, gallery-trust.mjs, images.js, picture-speed.mjs, product-page.mjs, tap-targets-2.mjs, tap-targets.mjs, trust.js.
   Keep: README.md, PROJECT_NOTES.md, DESIGN_PLAN.md, firebase.json, firestore.rules, index.html, package.json, package-lock.json, postcss.config.js, tailwind.config.js, vercel.json, vite.config.js.
4. Wait for Vercel's green tick, open https://bynd-2026.vercel.app/store/bynd. Send me a screenshot. PASS = the shop opens as before.
(If you prefer, I wait with this batch until you tell me; nothing else depends on it.)

### Batch 1: Phone check, shop, English, light mode (15 min)
Use your phone. Send a screenshot of each screen (or one short screen recording):
1. Home. 2. Menu open. 3. Products page. 4. Hexagon product page (swipe the photos, pick a colour). 5. My PRs product page. 6. Add to cart: do you see the small "Added to cart" note? 7. Cart. 8. Checkout (top and bottom).
Tell me anything that looks cut off, too small to tap, too crowded, or slow.

### Batch 2: Same phone, Arabic and dark mode (15 min)
Repeat the same 8 screens in Arabic (light), then in dark (English). Extra: the Arabic cart with 2, 3 and 11 pieces; the footer line; the arrows (should point the other way in Arabic).

### Batch 3: Wall designer on the phone (10 min)
Screen recording of the hexagon page: tap "Starter 7", Arrange 3 times, Undo, Random, Delete all, pick a colour, pinch-zoom with two fingers, "Save this wall as a picture" (open the saved file). Tell me if one finger still scrolls the page and a tap still adds a piece.

### Batch 4: One real test order (15 min)
1. Place an order on your phone: a hexagon wall (3 black + 3 blue), a promo code, one delivery area.
2. Do you see the receipt? Try Save as picture, Save as PDF, Email it to myself. Open the files.
3. Tap "Track this order" and the WhatsApp button. Does WhatsApp open with the order number?
4. Is the Telegram alert on your phone? Screenshot.
5. In /admin > Orders: open the order. Do you see the wall picture and the colours? Download the picture.
6. Check the stock of the colours went down.
Send me the order number and the screenshots.

### Batch 5: Team logins and database rules (20 min)
1. In /admin > Team add a test manager and a test staff (use two emails you own). Tell me the roles only, never a password.
2. As staff: move an order ONE step (should work), try to cancel or return (no button), look for costs or profit (should be hidden).
3. As manager: can you open Orders, Products, Couriers, Expenses? Can you open Settings and Team (should not)?
4. Firebase > Firestore > Rules: check the text contains the blocks "couriers" and "courierSettlements" and the line "staffMayUpdateOrder" (the notes say this was published in update 37; tell me the date shown above the Publish button).
5. Decide: are your staff people you fully trust? If not, I will remove costs from the order record in a small update.

### Batch 6: Admin screens and failures (15 min)
1. Open every admin page once (Dashboard, Orders, Products, Expenses, P&L, Promo codes, Team, Activity, Stock history, Couriers, Settings). Send a screenshot of any that look wrong.
2. Switch the phone to airplane mode and open Expenses: do you see the "Try again" box? Turn the internet back on and tap Try again.
3. Settings > Backup: download the backup file and keep it safe.
4. In Settings, change the accent colour in the live preview but do NOT save. Does the preview change?

### Batch 7: Feel test with real people (30 min)
Give your phone (or send the link) to 2 or 3 friends who do not know the shop. Say only: "Buy a 6-piece hexagon wall in Arabic." Do not help. Write down: where they stopped, what they asked, how long it took, whether they said it looked good. Send me the notes.
Target: a stranger finishes an order in under 3 minutes without help.

### Batch 8: Speed (10 min)
1. On your phone open pagespeed.web.dev, paste the shop link, choose "Mobile", run.
2. Send me the 4 scores and the 3 biggest problems it lists.

### Batch 9: Facts and content the shop needs (your time, no code)
1. The real facts for the trust strip: made-to-order days, delivery time, returns rule.
2. 3 or 4 real photos (athletes, wall on a real wall) + 2 lines of text for the brand story.
3. Product photos without a printed number (for the words-on-picture feature).
4. In Admin > Products: Arabic names for every option and value, "Color" renamed "Colour", calmer blue (#2f5fd0), "مسافات أخرى" with the hamza.
5. Film one short video per product (under 40 MB, 1080p).
6. Enter the My PRs product (prices are in the notes) and the real hexagon product.

## PART D. Go-live gate (all must be ticked)
- [ ] Batches 0 to 8 PASS, all my fixes uploaded and green.
- [ ] Batch 9 content entered.
- [ ] Backup downloaded (Settings > Backup).
- [ ] RESET (you, by hand, as written in the notes): delete orders, counters, rateLimits, test products, expenses, courierSettlements, auditLogs, stockMovements, test team accounts. KEEP tenants/bynd, tenantPrivate, your login and users/<your id>. NEVER delete tenants/ or users/.
- [ ] Real starting stock entered with Add stock; one last rehearsal order; then the smaller second reset.
- [ ] Decide: Vercel Hobby is non-commercial, so upgrade (or move) when real sales start. Decide on the real domain.
- [ ] Telegram alert works on the real phone. Cloudinary connected (it is).

## PART E. After launch (each needs your yes first)
1. Login split (about 12% faster), test admin login right after.
2. Real customer reviews (approved by you, no fake ones).
3. Dependency upgrades (the audit notices), in their own careful update.
4. Firestore rules tests with the emulator on GitHub.
5. Own domain, then automatic emails; courier logins; weight-based shipping; official WhatsApp alerts (paid).
6. Remove the two unused folders (dataconnect, src/dataconnect-generated).
