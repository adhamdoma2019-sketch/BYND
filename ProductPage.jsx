import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getProduct } from '../../firebase/products.service';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import { useStorefront } from '../../context/StorefrontContext';
import StorefrontFooter from '../../components/storefront/StorefrontFooter';
import StorefrontHeader from '../../components/storefront/StorefrontHeader';
import CartDrawer from '../../components/storefront/CartDrawer';
import { formatPrice } from '../../utils/format';
import { optimizedImage } from '../../utils/images';
import OptionPicker from '../../components/storefront/OptionPicker';
import WallDesigner from '../../components/storefront/WallDesigner';
import ProductGallery from '../../components/storefront/ProductGallery';
import TrustStrip from '../../components/storefront/TrustStrip';
import { pictureTexts } from '../../utils/pictureText';
import { WALL_MAX } from '../../utils/wallLayout';
import { wallColorOption, wallPalette, colourLimit, hasUnpainted, wallLines } from '../../utils/wallColors';
import { resolveChoice, cleanSelections, textKey, visibleOptions, stripHidden } from '../../utils/productOptions';
import { listStorefrontProducts } from '../../firebase/products.service';
import { usePageMeta } from '../../utils/usePageMeta';
import { MAX_ORDER_QTY, LOW_STOCK_THRESHOLD } from '../../utils/constants';
import { productStatus, isBuyable } from '../../utils/storefront';
import { isOptionCounted, countedOptions, leftForSelections, stockKey } from '../../utils/optionStock';
import {
  SAFETY_MAX_QTY,
  cleanPackage,
  cleanTiers,
  orderLimits,
  packageAddition,
  packageProgress,
  tierFor,
  tierGroupOption,
  unitBasePrice,
  savingPercent,
} from '../../utils/quantityPrices';
import { groupCountInCart, productCountInCart } from '../../utils/cartPricing';
import { applyProductDraft } from '../../utils/preview';
import ProductCard from '../../components/storefront/ProductCard';

export default function ProductPage() {
  const { slug, productId } = useParams();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { addItem, items: cartItems } = useCart();
  const { tenant, preview, previewProduct } = useStorefront();

  const [product, setProduct] = useState(null);
  const [status, setStatus] = useState('loading');
  const [quantity, setQuantity] = useState(1);
  const [qtyDraft, setQtyDraft] = useState(null); // what the customer is typing in the quantity box
  const [cartOpen, setCartOpen] = useState(false);
  const [selections, setSelections] = useState({});
  const [mainImage, setMainImage] = useState(''); // the picture shown big
  const [related, setRelated] = useState([]); // linked products (e.g. extensions)
  // Update 40: the bottom buy bar on phones shows only while the normal buy button is out of view.
  const [buyBtnEl, setBuyBtnEl] = useState(null);
  const [buyBtnInView, setBuyBtnInView] = useState(false);
  useEffect(() => {
    if (!buyBtnEl || typeof IntersectionObserver === 'undefined') {
      setBuyBtnInView(false); // cannot tell: keep the bar (old behaviour)
      return undefined;
    }
    const io = new IntersectionObserver(([entry]) => setBuyBtnInView(entry.isIntersecting), {
      threshold: 0.6,
    });
    io.observe(buyBtnEl);
    return () => io.disconnect();
  }, [buyBtnEl]);
  const [showMissing, setShowMissing] = useState(false);
  const [wallCells, setWallCells] = useState([]); // the pieces (with colours) the customer has planned
  // Live preview (Admin > Products): the saved product (or none for a new one) + the unsaved form on top.
  const [base, setBase] = useState(null);
  const [baseReady, setBaseReady] = useState(false);
  const [shopList, setShopList] = useState([]); // other products, for the "card in the shop list" view

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus('loading');
      try {
        if (preview) {
          // The saved product keeps its stock numbers; the unsaved form is put on top of it below.
          const saved = productId === 'new' ? null : await getProduct(productId);
          if (cancelled) return;
          setBase(saved && saved.tenantId === tenant.id ? saved : null);
          setBaseReady(true);
          return; // the page stays on "Loading..." until the form's values arrive
        }
        const productData = await getProduct(productId);
        if (cancelled) return;
        const valid =
          productData &&
          productData.tenantId === tenant.id &&
          productData.isActive === true &&
          productData.deleted !== true;
        setProduct(valid ? productData : null);
        setStatus(valid ? 'found' : 'not-found');
      } catch {
        if (!cancelled) setStatus('not-found');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [tenant.id, productId, preview]);

  // Preview: show the form's values as soon as they arrive, and again after every change.
  useEffect(() => {
    if (!preview || !baseReady || !previewProduct) return;
    setProduct(applyProductDraft(base, previewProduct.product, tenant.id));
    setStatus('found');
  }, [preview, baseReady, base, previewProduct, tenant.id]);
  // A new main photo in the form replaces a picture picked earlier (e.g. from a colour).
  useEffect(() => {
    if (preview) setMainImage('');
  }, [preview, product?.imageUrl]);

  const name = product ? product.name?.[language] || product.name?.en : '';
  const description = product
    ? product.description?.[language] || product.description?.en || ''
    : '';
  const shopName = tenant.name?.[language] || tenant.name?.en || tenant.slug;

  // Browser tab title + search-engine description.
  // Linked products ("Extensions and accessories") for this product.
  const relatedKey = (product?.relatedIds || []).join(',');
  useEffect(() => {
    if (!relatedKey && !(preview && previewProduct?.view === 'card')) {
      setRelated([]);
      setShopList([]);
      return;
    }
    let cancelled = false;
    listStorefrontProducts(tenant.id)
      .then((all) => {
        if (cancelled) return;
        const ids = relatedKey ? relatedKey.split(',') : [];
        setRelated(all.filter((p) => ids.includes(p.id)));
        setShopList(all.filter((p) => p.id !== productId));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [relatedKey, tenant.id, preview, previewProduct?.view, productId]);

  usePageMeta(
    name ? `${name} — ${shopName}` : undefined,
    description ? description.slice(0, 155) : undefined
  );

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-soft">
        {t('common.loading')}
      </div>
    );
  }

  if (status === 'not-found') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display text-2xl font-semibold">
          {t('storefront.productNotFound')}
        </h1>
        <Link to={`/store/${slug}`} className="mt-4 text-brass-dark hover:underline">
          {t('storefront.backToShop')}
        </Link>
      </div>
    );
  }

  // Preview only: how the product looks as a card in the shop's product list.
  if (preview && previewProduct?.view === 'card') {
    return (
      <div className="flex min-h-screen flex-col">
        <StorefrontHeader tenant={tenant} onCartClick={() => {}} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          <div className="grid grid-cols-2 gap-3">
            <ProductCard product={product} onAddToCart={() => {}} />
            {shopList.slice(0, 3).map((p) => (
              <ProductCard key={p.id} product={p} onAddToCart={() => {}} />
            ))}
          </div>
        </main>
        <StorefrontFooter tenant={tenant} />
      </div>
    );
  }

  const isPreorder = product.isPreorder === true; // preorder AND made-to-order: no stock needed
  const stock = Number(product.stock) || 0;
  const availability = productStatus(product); // comingSoon / preorder / madeToOrder / soldOut / inStock

  // Stock counted per colour / option: how many of the CHOSEN combination are left (null = not chosen yet).
  const counted = !isPreorder && isOptionCounted(product);
  const backorder = product.backorder === true && !isPreorder; // stock first, then made to order
  const wallOn = product.wallDesigner === true; // the customer plans a wall: the number of pieces = the quantity
  // With colours: the wall's colour option, and how many pieces in all can be ordered from the stock of its colours.
  const wallColorOpt = wallOn ? wallColorOption(product) : null;
  const wallCap =
    wallColorOpt && counted && !backorder
      ? Math.min(
          MAX_ORDER_QTY,
          wallColorOpt.values.reduce(
            (sum, v) => sum + Math.min(colourLimit(product, selections, wallColorOpt, v.id), MAX_ORDER_QTY),
            0
          )
        )
      : null;
  const left = counted ? leftForSelections(product, selections) : stock;
  const countedIds = counted ? countedOptions(product).map((o) => o.id) : [];
  const leftOfValue = (option) =>
    countedIds.includes(option.id)
      ? (valueId) => Math.max(Number(product.optionStock?.[stockKey(option.id, valueId)]) || 0, 0)
      : null;
  // This colour / combination is sold out (and cannot be made to order).
  const comboSoldOut =
    !isPreorder && !backorder && counted && (wallCap !== null ? wallCap <= 0 : left !== null && left <= 0);
  // The customer would get a made-to-order item (nothing, or not enough, on the shelf).
  const madeNow =
    isPreorder || (backorder && (left === null ? stock <= 0 : left <= 0));
  const madeStyle = product.preorderStyle === 'madeToOrder' ? 'madeToOrder' : 'preorder';
  // The shop's minimum / maximum per order and quantity prices count ALL lines of this product in the cart.
  const limits = orderLimits(product);
  const inCart = productCountInCart(cartItems, product.id);
  const minAdd = Math.max(1, limits.min - inCart); // fewest pieces to add now
  const baseMax = isPreorder || backorder ? MAX_ORDER_QTY : (wallCap ?? Math.min(left ?? stock, MAX_ORDER_QTY));
  const maxQty = Math.min(baseMax, Math.max(limits.max - inCart, 1), wallOn ? WALL_MAX : Infinity);
  const qty = Math.max(minAdd, Math.min(quantity, Math.max(maxQty, 1)));
  // Counted stock is too low for the shop's minimum order: can't be bought right now.
  const belowMinStock = !isPreorder && !backorder && baseMax > 0 && maxQty < minAdd;
  const partlyMade = !wallColorOpt && backorder && left !== null && left > 0 && qty > left;

  // (these three need comboSoldOut from above, so they come AFTER it)
  const soldOut = availability === 'soldOut' || comboSoldOut;
  const comingSoon = availability === 'comingSoon';
  const canBuy = isBuyable(availability) && !comboSoldOut && !belowMinStock;
  const preorderMessage =
    product.preorderMessage?.[language] || product.preorderMessage?.en || '';

  // The customer's choices (color, activity, extension...) and what they add to the price.
  const choice = resolveChoice(product, selections);
  // Pictures: the product's own, and the big one follows what the customer picks
  // (a color or choice can have its own picture).
  const pictures = [...new Set([product.imageUrl, ...(product.images || [])].filter(Boolean))];
  const shownImage = mainImage || pictures[0] || '';
  // A picture that belongs to a picked colour/choice but is not one of the product photos is shown as one extra slide.
  const galleryPictures = shownImage && !pictures.includes(shownImage) ? [...pictures, shownImage] : pictures;
  // Quantity price: the price of one piece depends on the total of this product (in the cart + now).
  // Package price ("every 3 pieces cost 500"): a product uses it OR price steps.
  const pkg = cleanPackage(product);
  const tiers = pkg ? [] : cleanTiers(product.priceTiers, product.price);
  // (a product can count each colour / choice of one option separately: then only pieces of the
  // SAME colour count together for the price step)
  const groupOption = tierGroupOption(product);
  const groupLabel =
    (product.options || []).find((o) => o.id === groupOption)?.label?.[language] ||
    (product.options || []).find((o) => o.id === groupOption)?.label?.en ||
    '';
  const groupInCart = groupOption ? groupCountInCart(cartItems, product.id, groupOption, selections) : inCart;
  const totalNow = groupInCart + qty;
  const activeTier = pkg ? null : tierFor(product, totalNow);
  const unitPrice = (pkg ? Number(product.price) || 0 : unitBasePrice(product, totalNow)) + choice.priceDelta;
  // What adding these pieces costs with the package price (exact), and where the customer stands.
  const pkgShare = pkg
    ? packageAddition(
        pkg,
        Number(product.price) || 0,
        groupOption,
        cartItems.filter((i) => i.productId === product.id).map((i) => ({ selections: i.selections, quantity: i.quantity })),
        [{ selections, quantity: qty }]
      )[0]
    : null;
  const pkgTotal = pkg ? Math.round((pkgShare.baseTotal + choice.priceDelta * qty) * 100) / 100 : null;
  const pkgProg = pkg ? packageProgress(pkg, totalNow) : null;
  const normalUnitPrice = (Number(product.price) || 0) + choice.priceDelta;
  // (the wall's colour is asked at the wall itself, so it is not listed with the other options)
  const otherMissing = choice.missing.filter((o) => !(wallColorOpt && o.id === wallColorOpt.id));
  const missingIds = new Set(otherMissing.map((o) => o.id));
  // only the options whose "show only when" rule is met (a hidden option is not asked, not charged, not sent)
  const productOptions = visibleOptions(product, selections).filter((o) => !(wallColorOpt && o.id === wallColorOpt.id));

  // Wall with colours: the colour of every piece -> one cart line per colour, each with its own price.
  const palette = wallColorOpt ? wallPalette(product, language) : null;
  const paintId = wallColorOpt ? selections[wallColorOpt.id] || '' : '';
  // (update 33: no colour is pre-selected; pieces without a colour stay unpainted until one is picked)
  const wallNow =
    wallCells.length === qty ? wallCells : Array.from({ length: qty }, (_, i) => ({ q: i, r: 0, c: paintId }));
  const wallUnpainted = !!wallColorOpt && hasUnpainted(wallNow);
  // For the price shown: unpainted pieces are priced like the first colour. Adding to the cart is blocked until all are painted.
  const wallPriced = wallUnpainted
    ? wallNow.map((c) => (c.c ? c : { ...c, c: paintId || wallColorOpt.values[0].id }))
    : wallNow;
  const wall = wallColorOpt
    ? wallLines({ product, selections, cells: wallPriced, cartItems, colorOpt: wallColorOpt })
    : null;
  const wallTotal = wall ? wall.subtotal : pkg ? pkgTotal : unitPrice * qty;
  // Package price on a coloured wall: each colour is counted by itself, so say what each colour still needs.
  const pkgColourHints =
    pkg && wall && groupOption && groupOption === wallColorOpt?.id
      ? wall.lines
          .map((ln) => {
            const col = (ln.choice.labels || []).find((o) => o.type === 'color');
            const name = col ? (typeof col.value === 'object' ? col.value[language] || col.value.en : col.value) : '';
            const missing = packageProgress(
              pkg,
              groupCountInCart(cartItems, product.id, groupOption, ln.selections) + ln.quantity
            ).missing;
            return { name, missing };
          })
          .filter((h) => h.missing > 0)
      : null;

  const buttonLabel = comingSoon
    ? t('storefront.comingSoon')
    : soldOut
      ? t('storefront.outOfStock')
      : madeNow
        ? t(madeStyle === 'madeToOrder' ? 'storefront.madeToOrderNow' : 'storefront.preorderNow')
        : t('storefront.addToCart');

  // One place for every option change (the options list and the wall's colour box use it).
  function pickOption(option, v) {
    setSelections((prev) => {
      const next = { ...prev, [option.id]: v };
      if (option.type === 'addon' && v !== true) delete next[textKey(option.id)];
      return next;
    });
    // The big picture changes to the picture of the choice (if it has one).
    const picked = (option.values || []).find((x) => x.id === v);
    if (picked?.imageUrl) setMainImage(picked.imageUrl);
    setShowMissing(false);
  }

  function handleAdd() {
    if (!canBuy) return;
    // A wall needs a colour for every piece: ask for it right at the wall.
    if (wallUnpainted) {
      setShowMissing(true);
      document.getElementById('wall-paint')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const missingNow = wall ? wall.missing : choice.missing;
    if (missingNow.length > 0) {
      setShowMissing(true);
      // On a phone the options may be out of sight (the buy bar is always visible): scroll to them.
      document.getElementById('product-options')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (wall) {
      // one cart line per colour; they belong together (wallId) and the first one keeps the picture of the wall
      const wallId = `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const picture = wallNow.map(({ q, r, c }) => ({
        q,
        r,
        c,
        h: wallColorOpt.values.find((v) => v.id === c)?.color || '',
      }));
      wall.lines.forEach((ln, idx) => {
        const lineLeft = counted ? leftForSelections(product, ln.selections) : stock;
        const limit = colourLimit(product, selections, wallColorOpt, ln.colorId);
        addItem(product, ln.quantity, {
          maxQty: isPreorder ? undefined : Number.isFinite(limit) ? limit : MAX_ORDER_QTY,
          madeToOrder: backorder && (lineLeft === null ? stock <= 0 : ln.quantity > lineLeft),
          selections: cleanSelections(stripHidden(product, ln.selections)),
          labels: ln.choice.labels,
          unitPrice: ln.unitPrice,
          priceDelta: ln.choice.priceDelta,
          imageUrl: ln.choice.imageUrl || pictures[0] || '',
          wallId,
          wallCells: idx === 0 ? picture : undefined,
        });
      });
      setCartOpen(true);
      return;
    }
    addItem(product, qty, {
      maxQty: isPreorder ? undefined : maxQty,
      madeToOrder: backorder && (madeNow || partlyMade),
      selections: cleanSelections(stripHidden(product, selections)),
      labels: choice.labels,
      unitPrice,
      priceDelta: choice.priceDelta,
      imageUrl: choice.imageUrl || pictures[0] || '',
    });
    setCartOpen(true);
  }

  return (
    <div className="min-h-screen">
      <StorefrontHeader tenant={tenant} onCartClick={() => setCartOpen(true)} />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 md:pb-12">
        <Link
          to={`/store/${slug}`}
          className="text-sm text-brass-dark hover:underline"
        >
          {t('storefront.backToShop')}
        </Link>

        <div className="mt-6 grid gap-8 md:grid-cols-2">
          <div>
            {shownImage ? (
              <ProductGallery
                pictures={galleryPictures}
                shown={shownImage}
                onShow={setMainImage}
                name={name}
                texts={pictureTexts(product, selections)}
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-md bg-paper-dim text-ink-faint">
                {name}
              </div>
            )}
          </div>

          <div>
            <h1 className="font-display text-3xl font-semibold">{name}</h1>
            <p className="mt-2 text-2xl text-ink">
              {formatPrice(unitPrice, language)}
              {activeTier && (
                <span className="ms-2 text-base text-ink-faint line-through">
                  {formatPrice(normalUnitPrice, language)}
                </span>
              )}
            </p>

            {pkg && (
              <details className="group mt-4 rounded-md border border-ink/10 px-3 pb-3" data-package>
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{t('storefront.pkgTitle')}</span>
                    <span className="block text-xs text-ink-soft">
                      {groupOption
                        ? t('storefront.pkgLineSame', { n: pkg.qty, option: groupLabel.toLowerCase(), price: formatPrice(pkg.price, language) })
                        : t('storefront.pkgLine', { n: pkg.qty, price: formatPrice(pkg.price, language) })}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-ink-faint transition group-open:rotate-180">⌄</span>
                </summary>
                <button
                  type="button"
                  disabled={!canBuy || pkg.qty - (groupInCart % pkg.qty) > maxQty}
                  onClick={() => {
                    setQtyDraft(null);
                    setQuantity(Math.max(pkg.qty - (groupInCart % pkg.qty), minAdd, 1));
                  }}
                  className={
                    'mt-2 flex w-full items-center justify-between gap-3 px-2 py-2 text-start text-sm disabled:cursor-default ' +
                    (pkgProg.packages > 0 ? 'bg-brass/10 font-medium' : 'hover:bg-paper-soft')
                  }
                >
                  <span>
                    {groupOption
                      ? t('storefront.pkgLineSame', { n: pkg.qty, option: groupLabel.toLowerCase(), price: formatPrice(pkg.price, language) })
                      : t('storefront.pkgLine', { n: pkg.qty, price: formatPrice(pkg.price, language) })}
                  </span>
                  {pkg.qty * (Number(product.price) || 0) > pkg.price && (
                    <span className="rounded bg-sage/20 px-1.5 py-0.5 text-xs text-sage-dark">
                      {t('storefront.pkgSave', { price: formatPrice(pkg.qty * (Number(product.price) || 0) - pkg.price, language) })}
                    </span>
                  )}
                </button>
                <p className="mt-2 text-sm">{t(qty === 1 ? 'storefront.pkgNowOne' : 'storefront.pkgNow', { n: qty, price: formatPrice(wall ? wallTotal : pkgTotal, language) })}</p>
                {pkgColourHints &&
                  pkgColourHints.map((h) => (
                    <p key={h.name} className="mt-1 text-xs text-brass-dark" data-package-hint>
                      {t('storefront.pkgMoreColour', { n: h.missing, name: h.name, pkg: pkg.qty, price: formatPrice(pkg.price, language) })}
                    </p>
                  ))}
                {!pkgColourHints && pkgProg.missing > 0 && (
                  <p className="mt-1 text-xs text-brass-dark" data-package-hint>
                    {groupOption
                      ? t('storefront.pkgMoreSame', { n: pkgProg.missing, option: groupLabel.toLowerCase(), pkg: pkg.qty, price: formatPrice(pkg.price, language) })
                      : t('storefront.pkgMore', { n: pkgProg.missing, pkg: pkg.qty, price: formatPrice(pkg.price, language) })}
                  </p>
                )}
                <p className="mt-1 text-xs text-ink-faint">
                  {groupOption
                    ? t('storefront.pkgHintSame', { option: groupLabel.toLowerCase() })
                    : t('storefront.pkgHint')}
                </p>
                {groupInCart > 0 && (
                  <p className="mt-1 text-xs text-ink-soft">
                    {groupOption
                      ? t('storefront.qtyInCartSame', { n: groupInCart, option: groupLabel.toLowerCase() })
                      : t('storefront.qtyInCart', { n: groupInCart })}
                  </p>
                )}
              </details>
            )}

            {tiers.length > 0 && (
              <details className="group mt-4 rounded-md border border-ink/10 px-3 pb-3" data-qty-prices>
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                  <span className="text-sm font-medium">{t('storefront.qtyPricesTitle')}</span>
                  <span aria-hidden="true" className="text-ink-faint transition group-open:rotate-180">⌄</span>
                </summary>
                <div className="mt-2 divide-y divide-ink/10 text-sm">
                  {[{ minQty: 1, price: Number(product.price) || 0 }, ...tiers].map((step) => {
                    const active = (activeTier?.minQty || 1) === step.minQty;
                    const saving = savingPercent(product.price, step.price);
                    const pick = Math.max(step.minQty - groupInCart, minAdd, 1);
                    return (
                      <button
                        key={step.minQty}
                        type="button"
                        disabled={!canBuy || pick > maxQty}
                        onClick={() => {
                          setQtyDraft(null);
                          setQuantity(pick);
                        }}
                        className={
                          'flex w-full items-center justify-between gap-3 px-2 py-2 text-start disabled:cursor-default ' +
                          (active ? 'bg-brass/10 font-medium' : 'hover:bg-paper-soft')
                        }
                        aria-pressed={active}
                      >
                        <span>
                          {groupOption
                            ? t('storefront.fromQtySame', { n: step.minQty, option: groupLabel.toLowerCase() })
                            : t('storefront.fromQty', { n: step.minQty })}
                        </span>
                        <span>
                          {formatPrice(step.price, language)} {t('storefront.each')}
                          {saving > 0 && (
                            <span className="ms-2 rounded bg-sage/20 px-1.5 py-0.5 text-xs text-sage-dark">
                              {t('storefront.savePercent', { n: saving })}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-ink-faint">
                  {groupOption
                    ? t('storefront.qtyPricesHintSame', { option: groupLabel.toLowerCase() })
                    : t('storefront.qtyPricesHint')}
                </p>
                {groupInCart > 0 && (
                  <p className="mt-1 text-xs text-ink-soft">
                    {groupOption
                      ? t('storefront.qtyInCartSame', { n: groupInCart, option: groupLabel.toLowerCase() })
                      : t('storefront.qtyInCart', { n: groupInCart })}
                  </p>
                )}
              </details>
            )}

            <div className="mt-4">
              {comingSoon ? (
                <>
                  <span className="rounded border border-ink/25 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-ink-soft">
                    {t('storefront.comingSoon')}
                  </span>
                  <p className="mt-3 rounded border border-brass/30 bg-brass/10 px-3 py-2 text-sm text-brass-dark">
                    {t('storefront.comingSoonNote')}
                  </p>
                </>
              ) : madeNow ? (
                <>
                  <span className="rounded border border-ink/25 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-ink-soft">
                    {t(`storefront.${madeStyle}`)}
                  </span>
                  {preorderMessage && (
                    <p className="mt-3 rounded border border-brass/30 bg-brass/10 px-3 py-2 text-sm text-brass-dark">
                      {preorderMessage}
                    </p>
                  )}
                </>
              ) : soldOut ? (
                <span className="rounded bg-rust/15 px-2.5 py-1 text-sm text-rust">
                  {t('storefront.outOfStock')}
                </span>
              ) : (left ?? stock) <= LOW_STOCK_THRESHOLD ? (
                <span className="rounded bg-brass/15 px-2.5 py-1 text-sm text-brass-dark">
                  {t('storefront.onlyLeft', { n: left ?? stock })}
                </span>
              ) : (
                <span className="rounded bg-sage/15 px-2.5 py-1 text-sm text-sage-dark">
                  {t('storefront.inStock')}
                </span>
              )}
            </div>

            {belowMinStock && (
              <p className="mt-3 rounded border border-rust/30 bg-rust/10 px-3 py-2 text-sm text-rust">
                {t('storefront.minNotInStock', { n: limits.min })}
              </p>
            )}

            {description && (
              <p className="mt-6 whitespace-pre-line leading-relaxed text-ink-soft">
                {description}
              </p>
            )}

            {productOptions.length > 0 && (
              <div id="product-options" className="mt-6 scroll-mt-24 space-y-5">
                {productOptions.map((option) => (
                  <div key={option.id}>
                  <OptionPicker
                    option={option}
                    value={selections[option.id]}
                    onChange={(v) => pickOption(option, v)}
                    leftOf={leftOfValue(option)}
                    backorder={backorder}
                    textValue={selections[textKey(option.id)] || ''}
                    onTextChange={(v) =>
                      setSelections((prev) => ({ ...prev, [textKey(option.id)]: v }))
                    }
                    highlight={showMissing && missingIds.has(option.id)}
                  />
                  </div>
                ))}
                {showMissing && otherMissing.length > 0 && (
                  <p className="text-sm text-rust">
                    {t('storefront.chooseOptions', {
                      names: otherMissing
                        .map((o) => `\u2068${o.label?.[language] || o.label?.en || ''}\u2069`)
                        .join(', '),
                    })}
                  </p>
                )}
              </div>
            )}

            {canBuy && (
              <div className="mt-8">
                {wallOn ? (
                  <WallDesigner
                    quantity={qty}
                    min={minAdd}
                    max={maxQty}
                    onQuantity={(n) => {
                      setQtyDraft(null);
                      setQuantity(n);
                    }}
                    onCells={setWallCells}
                    palette={palette}
                    paint={paintId}
                    limitOf={(id) => (wallColorOpt ? colourLimit(product, selections, wallColorOpt, id) : Infinity)}
                    totalText={formatPrice(wallTotal, language)}
                    needColour={showMissing && wallUnpainted}
                    paintBox={
                      wallColorOpt ? (
                        <OptionPicker
                          option={{ ...wallColorOpt, required: true }}
                          value={selections[wallColorOpt.id]}
                          onChange={(v) => pickOption(wallColorOpt, v)}
                          leftOf={leftOfValue(wallColorOpt)}
                          backorder={backorder}
                          highlight={showMissing && wallUnpainted}
                        />
                      ) : null
                    }
                  />
                ) : (
                  <>
                <p className="text-sm text-ink-soft">
                  {t('storefront.quantity')}
                </p>
                <div className="mt-1 flex items-center gap-3">
                  <button
                    onClick={() => {
                      setQtyDraft(null);
                      setQuantity(Math.max(minAdd, qty - 1));
                    }}
                    disabled={qty <= minAdd}
                    className="h-11 w-11 rounded border border-ink/15 text-lg hover:border-brass disabled:opacity-40"
                    aria-label="-"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={minAdd}
                    max={maxQty}
                    value={qtyDraft ?? qty}
                    onChange={(e) => {
                      setQtyDraft(e.target.value);
                      const n = parseInt(e.target.value, 10);
                      if (Number.isInteger(n) && n >= 1) setQuantity(n);
                    }}
                    onBlur={() => setQtyDraft(null)}
                    aria-label={t('storefront.quantity')}
                    className="h-11 w-20 rounded border border-ink/15 bg-transparent text-center text-lg outline-none focus-visible:border-brass"
                  />
                  <button
                    onClick={() => {
                      setQtyDraft(null);
                      setQuantity(Math.min(maxQty, qty + 1));
                    }}
                    disabled={qty >= maxQty}
                    className="h-11 w-11 rounded border border-ink/15 text-lg hover:border-brass disabled:opacity-40"
                    aria-label="+"
                  >
                    +
                  </button>
                </div>
                  </>
                )}
                {limits.min > 1 && (
                  <p className="mt-2 text-xs text-ink-soft">{t('storefront.minOrderNote', { n: limits.min })}</p>
                )}
                {limits.max < SAFETY_MAX_QTY && (
                  <p className="mt-1 text-xs text-ink-soft">{t('storefront.maxOrderNote', { n: limits.max })}</p>
                )}
                {partlyMade && (
                  <p className="mt-2 rounded border border-brass/30 bg-brass/10 px-3 py-2 text-sm text-brass-dark">
                    {t('storefront.partlyMadeToOrder', { n: left })}
                  </p>
                )}
              </div>
            )}

            <button
              ref={setBuyBtnEl}
              onClick={handleAdd}
              disabled={!canBuy}
              className="mt-6 w-full rounded bg-ink py-3 text-paper transition hover:bg-brass hover:text-on-brass disabled:cursor-not-allowed disabled:bg-paper-dim disabled:text-ink-faint"
            >
              {buttonLabel}
            </button>

            <TrustStrip tenant={tenant} />
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-16 border-t border-ink/10 pt-10">
            <h2 className="font-display text-2xl font-semibold">{t('storefront.related')}</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <Link
                  key={p.id}
                  to={`/store/${slug}/product/${p.id}`}
                  className="flex items-center gap-4 rounded-md border border-ink/10 bg-white p-3 transition hover:border-brass/60"
                >
                  {p.imageUrl && (
                    <img
                      src={optimizedImage(p.imageUrl, 200)}
                      alt=""
                      loading="lazy"
                      className="h-20 w-20 rounded object-cover"
                    />
                  )}
                  <div>
                    <p className="font-display font-semibold">{p.name?.[language] || p.name?.en}</p>
                    <p className="text-sm text-ink-soft">{formatPrice(p.price, language)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <StorefrontFooter tenant={tenant} />
      {/* Room at the very bottom so the fixed buy bar never covers the footer (phones only). */}
      {canBuy && <div className="h-24 md:hidden" aria-hidden="true" />}

      {/* Buy bar on phones: shown only while the normal buy button is out of view (hidden on bigger screens). */}
      {canBuy && !buyBtnInView && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-paper px-4 pt-3 md:hidden"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs text-ink-soft">{name}</p>
              <p className="text-lg font-semibold">{formatPrice(pkg ? wallTotal : unitPrice, language)}</p>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              className="ms-auto shrink-0 rounded bg-brass px-6 py-3 text-sm font-semibold uppercase tracking-wider text-on-brass transition hover:opacity-90"
            >
              {buttonLabel}
            </button>
          </div>
        </div>
      )}
      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} />}
    </div>
  );
}
