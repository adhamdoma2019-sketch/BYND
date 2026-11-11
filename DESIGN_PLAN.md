# BYND shop: design plan (written Nov 9, 2026, after web research)
Read THIS file (not the whole PROJECT_NOTES) at the start of a design chat. One step = one chat = one small update.
Honesty rule stays: no fake reviews, no fake urgency, no invented numbers. Free plans only.

## 1. The look we are aiming for ("quiet trophy room")
Dark-first, one accent colour (brass), big calm photos, fewer boxes and lines, lots of breathing room, one headline font + one body font, small touches of motion. A customer should feel: "this is a serious brand for athletes, and ordering is easy".
- Home: a short, strong hero; 4 featured products shown as big photos with a "from" price; one short brand story strip (real photos only); footer calm.
- Product page: photo gallery first (swipe with dots), name + price, colour/distance choices as big tappable chips, ONE clear buy button, details folded away ("Package details" opens on tap), trust strip with real facts.
- Wall designer: feels like a small design studio: sample layouts in one tap, big canvas, colour chips with names, live price, undo.
- Cart/checkout: fewest possible boxes, phone keyboard for the phone box, delivery fee visible early, one calm "Place order" button.
- Thank-you/track: reassuring, with a simple progress line (Received > Confirmed > Shipped > Delivered).

## 2. What the research says (rough; many sources are agency blogs, treat numbers as direction not promise)
- Dark UI is now the default premium look for beauty/fashion/audio/jewellery brands (several 2026 design-trend articles). BYND already has dark mode: make it the default for first-time visitors.
- Checkout (Baymard, the main usability research body): the number of form fields hurts more than the number of steps; guest checkout matters (BYND already has no accounts); surprise extra costs are the biggest reason for abandoning, so show delivery fee early; labels above single-column fields, big tap targets, right keyboard per box.
- Product page: Baymard found most big shops have mediocre product pages; sticky buy button, clear variant selector and thumb-friendly layout are the basics (BYND has most).
- Video as the first gallery item and small motion/feedback are trending (agency claims of gains are unproven; do cheap versions only).
- Egypt/Arabic: mobile is over 80% of sessions in the region; COD is still a big share in Egypt; trust comes from transparent prices/shipping/returns, real Arabic reviews (only real ones!), WhatsApp contact, and truly mirrored RTL with no mixed-up text.

## 3. Steps (do in this order; each = one new chat; owner sends only the screens named)
Each step: assistant reads this file + only the files it touches, builds, runs tests, gives update-N.zip + test list. Owner tests, then next chat.
1. DONE (update 48, Nov 10, 2026; waits for the owner's phone test) CHECKOUT FRICTION (high impact, small): phone box opens the number keyboard; browser auto-fill hints (name, phone, email, address) so fields fill in one tap; promo code hidden behind a "Have a promo code?" link; show the delivery fee / "choose your area to see the fee" near the top total; "Place order" stays one calm button. Ask owner: is email really required? (suggest optional). Send: checkout screenshots EN + AR.
2. (BUILT in update 50, Nov 10, 2026; owner to test on a narrow phone) TAP SIZE + TOP BAR (small): all header buttons at least 44 px; check the narrow-phone top bar. Can join step 1.
3. (BUILT in update 49, Nov 10, 2026; owner to test; trust strip shows only real facts, made-to-order days still need the owner's facts) PRODUCT PAGE: swipeable gallery with dots, "Package details" folded, chips bigger, trust strip (NEEDS owner's real facts: made-to-order days, delivery fee/time, returns, WhatsApp number). Send: hexagon + My PRs product pages EN + AR, light + dark, plus the facts.
4. (BUILT in update 51, Nov 10, 2026; owner to test) PICTURE SPEED (check first): Cloudinary pictures resized and auto-format (f_auto, q_auto, width) in cards/gallery so pages load fast on mobile data. Assistant checks what exists, then fixes. Send: nothing (or a Lighthouse score).
5. (BUILT in update 52, Nov 10, 2026; owner to test) FEEL: add-to-cart confirmation ("Added - View cart"), soft fade-in of photos, cart drawer slide, skeleton loaders everywhere, all respecting reduced-motion. Send: nothing.
6. (BUILT in update 53, Nov 10, 2026; owner to test; save-as-picture NOT built) WALL DESIGNER STUDIO: sample layouts (Starter 7, Flower, Wide row), undo, colour chips with names, a clearer price line, save-as-picture of the design (later). Send: screen recording of the designer on the phone.
7. HOME PAGE: shorter hero, featured products as big photos with "from" price, brand story strip (owner sends 3-4 real photos + 2 lines), category chips on the Products page when there are more products. Send: home EN + AR light + dark.
8. ARABIC POLISH: Egyptian-dialect wording review of the main screens, mirrored icons, remaining mixed English/Arabic bits; owner enters Arabic names for options in Admin. Send: Arabic screens.
9. THANK-YOU / TRACK: progress line, "what happens next" in plain words, WhatsApp button. Send: thank-you + track screens.
10. LATER (ask first): short product video as first gallery item (owner films on a phone, Cloudinary free video); login split to make the shop load ~12% faster (admin login must be re-tested); real customer reviews (only real, moderated); tidy unused folders.

## 4. Quick things the OWNER can do now (no code)
- Settings > Look: set the shop to Dark by default.
- Admin > Products: rename the option "Color" to "Colour" (English) and add Arabic names to every option value; pick a calmer blue for the Blue swatch (for example #2f5fd0).
- Collect the real facts for the trust strip (made-to-order days, delivery fee and time, returns rule).
- Collect 3-4 real BYND photos (athletes with the product, wall on a real wall).

## 5. How to keep chats cheap
- One step per chat. Start message: "Continue the shop platform. Do design plan step N (see DESIGN_PLAN.md)." Upload the fresh repo zip + only the screenshots the step names.
- Do not re-send old screenshots. Do not ask for a re-review of earlier steps.
- End each chat after the zip + test list; the assistant updates PROJECT_NOTES (changelog) and ticks the step here ("DONE").

## 6. Progress
- Steps done: step 6 (update 53, built Nov 10, 2026; examples, undo, named colour chips, price summary; owner still to test); step 5 (update 52, built Nov 10, 2026; added-to-cart note, photo fade-in, drawer slide, skeletons; owner still to test); step 4 (update 51, built Nov 10, 2026; several picture sizes + priority loading; not measured on a real phone); step 2 (update 50, built Nov 10, 2026; owner still to test; all tap targets 44 px, narrow-phone top bar); step 3 (update 49, built Nov 10, 2026; owner still to test; trust strip has cash on delivery / delivery fee / returns link / WhatsApp from shop data; made-to-order days + delivery time wait for the owner's real facts); step 1 (update 48, built Nov 10, 2026; owner still to test; email decision: optional, set in Admin > Settings > Checkout). Updates 43-47 were small fixes before this plan.
