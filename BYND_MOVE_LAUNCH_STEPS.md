# BYND Move: launch steps (free plan only)  -  Nov 22, 2026
Do the steps IN THIS ORDER. After each one, tell me "done" or send a screenshot if something looks different.

## A. The free address (about 10 minutes)
Why it asked you to pay: that was the "buy a domain" button. You do NOT need it. Vercel lets you add any free name ending in .vercel.app.

A1. Vercel > your project (bynd-2026) > Settings > Environment Variables > Add New.
    Name: VITE_SINGLE_SHOP    Value: bynd    (small letters; this is the shop's inside ID, it stays "bynd" even though the brand is BYND Move)
    Tick all environments > Save.
A2. Settings > Domains > Add Domain. Type: bynd-move.vercel.app > Add.
    - If it says the name is taken, try byndmove.vercel.app.
    - Never click "Buy". If it asks for money, stop and send me a screenshot.
A3. Firebase console > Authentication > Settings > Authorized domains > Add domain > bynd-move.vercel.app (the same name you chose). Without this, login to /admin will fail on the new address.
A4. Upload update-61.zip contents to GitHub (Add file > Upload files > Commit changes). Wait for the green tick on Vercel.
A5. Test on your phone:
    - https://bynd-move.vercel.app  = the shop home page (no /store/bynd).
    - https://bynd-move.vercel.app/products, /track  open.
    - https://bynd-move.vercel.app/admin/login  you can log in.
    - The old link https://bynd-2026.vercel.app/store/bynd  should jump to the shop (it is safe to leave it working).

## B. The new name
B1. Admin > Settings > Look/Content (the shop name boxes): English = BYND Move. Arabic = BYND Move (brand names are normally kept in English letters; if you prefer Arabic letters, write it exactly how you want it).
B2. Order numbers BYNDMOVE-1001: Firebase console > Firestore Database > tenants > bynd > Add field: name orderPrefix, type string, value BYNDMOVE > Save. (Orders placed before this keep their old BYND-xxxx numbers; after the pre-launch reset the numbers restart at 1001.)
B3. Logo: upload the BYND Move logo in Admin > Settings > Look (a transparent PNG; a second one for dark screens if the logo is dark).

## C. The test photos (how to upload)
General rules: use the UPLOAD button next to every picture box (never paste a link from another website). Photos: JPG or PNG, at least 1200 px on the long side, square or nearly square works best (the product gallery crops to a square), one product per photo, plain background. These are test photos: later you replace them the same way, nothing else changes.

HEXAGON (Admin > Products > Hexagon > Save at the end):
 1. First product photo = the photo of the WHOLE wall (all pieces together).
 2. Options > Colour > value Black > picture = the black piece photo.
 3. Options > Colour > value Blue > picture = the blue piece photo.
 4. Press Save, then look at the live preview on the right: tapping Black / Blue must change the photo.

MY PRs (Admin > Products > My PRs):
 1. Main photo = the best full board photo.
 2. Options > Sport > Running / Cycling / Swimming: one picture each.
 3. Extra plate pictures per distance if you have them.
 4. Photos should have an EMPTY spot where the customer's words will be drawn.

## D. What to write (copy and adjust; replace everything in [brackets] with the REAL fact. Never write a number you are not sure of.)

### Product: Hexagon (Description EN)
Plan your own medal wall. Choose your colour, arrange the hexagons exactly the way you like (from [minimum] to 60 pieces) and hang your medals on a wall that tells your story. Made to order for you in [material].
### (AR)
صمّم حائط ميدالياتك بنفسك. اختر اللون ورتّب القطع السداسية بالشكل الذي تحبه (من [الحد الأدنى] إلى 60 قطعة) وعلّق ميدالياتك على حائط يحكي قصتك. يُصنع عند الطلب خصيصًا لك من [الخامة].

### Product: My Running PRs / Cycling / Swimming (EN)
Your personal records, on your wall. Pick your sport, choose your three distances (or write your own), add your name on top if you like. Made to order, one set per athlete.
### (AR)
أرقامك القياسية على حائطك. اختر رياضتك وحدّد مسافاتك الثلاث (أو اكتب مسافتك الخاصة) وأضف اسمك أعلى اللوحة إن أردت. يُصنع عند الطلب، مجموعة لكل رياضي.

### About us (EN)  (add your real story in the [ ] places)
BYND Move was born from [one honest sentence about why you started: e.g. a runner who had nowhere nice to hang medals]. We design and make sports keepsakes: medal displays and personal-record boards for runners, cyclists and swimmers. Every piece is made to order [in Egypt / by hand / 3D-printed: choose what is true]. Questions? Message us on WhatsApp.
### (AR)
وُلدت BYND Move من [جملة صادقة واحدة عن سبب البداية]. نصمّم ونصنع تذكارات رياضية: حوامل ميداليات ولوحات أرقام قياسية للعدّائين وراكبي الدراجات والسبّاحين. كل قطعة تُصنع عند الطلب [في مصر / يدويًا / بالطباعة ثلاثية الأبعاد: اختر ما هو صحيح]. لديك سؤال؟ راسلنا على واتساب.

### Shipping (EN)
We deliver across Egypt. Delivery fee depends on your area and is shown at checkout before you order. Because every item is made to order, preparation takes [X working days] and delivery takes [Y working days] after that. We will contact you by phone to confirm your order and address. You pay in cash when you receive your order.
### (AR)
نوصّل لجميع محافظات مصر. تختلف رسوم التوصيل حسب منطقتك وتظهر لك قبل تأكيد الطلب. لأن كل منتج يُصنع عند الطلب، يستغرق التجهيز [X أيام عمل] ثم التوصيل [Y أيام عمل]. سنتصل بك لتأكيد الطلب والعنوان. الدفع نقدًا عند الاستلام.

### Returns and exchanges (EN)  (YOU decide the rule; the lines below are only a frame)
Because items are made specially for you, [custom items cannot be returned unless they arrive damaged or different from your order]. If something is wrong, message us on WhatsApp within [N days] of receiving it with your order number and a photo, and we will [fix it / replace it / refund it]. 
### (AR)
لأن المنتجات تُصنع خصيصًا لك، [لا يمكن إرجاع المنتجات المخصّصة إلا إذا وصلت تالفة أو مختلفة عن طلبك]. إذا وجدت مشكلة، راسلنا على واتساب خلال [N أيام] من الاستلام مع رقم الطلب وصورة، وسوف [نصلحها / نستبدلها / نردّ المبلغ].
(Check Egypt's consumer-protection rules for online sales before you publish this text; I am not a lawyer.)

### Privacy (EN)
We ask for your name, phone number, address and (optionally) email only to prepare and deliver your order and to contact you about it. Your details are seen only by the BYND Move team and the delivery company that brings your order. We do not sell or share them for advertising. To ask us to correct or delete your details, message us on WhatsApp.
### (AR)
نطلب اسمك ورقم هاتفك وعنوانك (والبريد الإلكتروني اختياريًا) فقط لتجهيز طلبك وتوصيله والتواصل معك بشأنه. لا يطّلع على بياناتك إلا فريق BYND Move وشركة التوصيل التي تحضر طلبك. لا نبيعها ولا نشاركها لأغراض إعلانية. لتصحيح بياناتك أو حذفها راسلنا على واتساب.

### Terms (EN)
By placing an order you confirm that your details are correct. Prices are in Egyptian pounds and shown before you order. Orders are confirmed by phone. Production starts after confirmation. [Add your cancel rule: e.g. orders can be cancelled before production starts.]
### (AR)
بإتمام الطلب تؤكد صحة بياناتك. الأسعار بالجنيه المصري وتظهر قبل إتمام الطلب. يتم تأكيد الطلبات هاتفيًا ويبدأ التصنيع بعد التأكيد. [أضف سياسة الإلغاء: مثلًا يمكن إلغاء الطلب قبل بدء التصنيع.]

### Home page (Settings > Banner / Content)
Banner headline EN: Wear your effort. Hang your pride.   AR: علّق إنجازك، وافخر به.
Banner text EN: Medal displays and personal-record boards, made to order for athletes.   AR: حوامل ميداليات ولوحات أرقام قياسية تُصنع عند الطلب للرياضيين.
Button EN: Shop now   AR: تسوّق الآن
Highlights (only true ones): "Made to order for you" / "يُصنع عند الطلب خصيصًا لك"; "Cash on delivery" / "الدفع عند الاستلام"; "Design your own wall" / "صمّم حائطك بنفسك".
Top-bar message: "Cash on delivery across Egypt" / "الدفع عند الاستلام في جميع أنحاء مصر" (only if true).

### Delivery areas (Admin > Settings > Shipping)
One row per area with its REAL fee (enter only what the courier really charges). Add a free-shipping-above amount only if you decided it.

## E. Then
When A to D are done: send me the screenshots of Batch 1 and Batch 4 from TESTING_PLAN.md (on the NEW address), and I will fix whatever you find in update-62.
