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
import { resolveChoice, cleanSelections } from '../../utils/productOptions';
import { usePageMeta } from '../../utils/usePageMeta';
import { MAX_ORDER_QTY, LOW_STOCK_THRESHOLD } from '../../utils/constants';

export default function ProductPage() {
  const { slug, productId } = useParams();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { addItem } = useCart();
  const { tenant } = useStorefront();

  const [product, setProduct] = useState(null);
  const [status, setStatus] = useState('loading');
  const [quantity, setQuantity] = useState(1);
  const [cartOpen, setCartOpen] = useState(false);
  const [selections, setSelections] = useState({});
  const [showMissing, setShowMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus('loading');
      try {
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
  }, [tenant.id, productId]);

  const name = product ? product.name?.[language] || product.name?.en : '';
  const description = product
    ? product.description?.[language] || product.description?.en || ''
    : '';
  const shopName = tenant.name?.[language] || tenant.name?.en || tenant.slug;

  // Browser tab title + search-engine description.
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
        <Link to={`/store/${slug}`} className="mt-4 text-brass hover:underline">
          {t('storefront.backToShop')}
        </Link>
      </div>
    );
  }

  const isPreorder = product.isPreorder === true;
  const stock = Number(product.stock) || 0;
  const soldOut = !isPreorder && stock <= 0;
  const maxQty = isPreorder ? MAX_ORDER_QTY : Math.min(stock, MAX_ORDER_QTY);
  const preorderMessage =
    product.preorderMessage?.[language] || product.preorderMessage?.en || '';

  // The customer's choices (color, activity, extension...) and what they add to the price.
  const choice = resolveChoice(product, selections);
  const unitPrice = (Number(product.price) || 0) + choice.priceDelta;
  const missingIds = new Set(choice.missing.map((o) => o.id));
  const productOptions = (product.options || []).filter((o) => o && o.type);

  function handleAdd() {
    if (choice.missing.length > 0) {
      setShowMissing(true);
      return;
    }
    addItem(product, quantity, {
      selections: cleanSelections(selections),
      labels: choice.labels,
      unitPrice,
    });
    setCartOpen(true);
  }

  return (
    <div className="min-h-screen">
      <StorefrontHeader tenant={tenant} onCartClick={() => setCartOpen(true)} />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <Link
          to={`/store/${slug}`}
          className="text-sm text-brass hover:underline"
        >
          {t('storefront.backToShop')}
        </Link>

        <div className="mt-6 grid gap-8 md:grid-cols-2">
          <div>
            {product.imageUrl ? (
              <img
                src={optimizedImage(product.imageUrl, 1000)}
                alt={name}
                className="w-full rounded-md object-cover"
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
            </p>

            <div className="mt-4">
              {isPreorder ? (
                <>
                  <span className="rounded bg-ink px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-paper">
                    {t('storefront.preorder')}
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
              ) : stock <= LOW_STOCK_THRESHOLD ? (
                <span className="rounded bg-brass/15 px-2.5 py-1 text-sm text-brass-dark">
                  {t('storefront.onlyLeft', { n: stock })}
                </span>
              ) : (
                <span className="rounded bg-sage/15 px-2.5 py-1 text-sm text-sage-dark">
                  {t('storefront.inStock')}
                </span>
              )}
            </div>

            {description && (
              <p className="mt-6 whitespace-pre-line leading-relaxed text-ink-soft">
                {description}
              </p>
            )}

            {productOptions.length > 0 && (
              <div className="mt-6 space-y-5">
                {productOptions.map((option) => (
                  <OptionPicker
                    key={option.id}
                    option={option}
                    value={selections[option.id]}
                    onChange={(v) => {
                      setSelections((prev) => ({ ...prev, [option.id]: v }));
                      setShowMissing(false);
                    }}
                    highlight={showMissing && missingIds.has(option.id)}
                  />
                ))}
                {showMissing && choice.missing.length > 0 && (
                  <p className="text-sm text-rust">
                    {t('storefront.chooseOptions', {
                      names: choice.missing
                        .map((o) => o.label?.[language] || o.label?.en)
                        .join(', '),
                    })}
                  </p>
                )}
              </div>
            )}

            {!soldOut && (
              <div className="mt-8">
                <p className="text-sm text-ink-soft">
                  {t('storefront.quantity')}
                </p>
                <div className="mt-1 flex items-center gap-3">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="h-10 w-10 rounded border border-ink/15 text-lg hover:border-brass disabled:opacity-40"
                    aria-label="-"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-lg">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                    disabled={quantity >= maxQty}
                    className="h-10 w-10 rounded border border-ink/15 text-lg hover:border-brass disabled:opacity-40"
                    aria-label="+"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleAdd}
              disabled={soldOut}
              className="mt-6 w-full rounded bg-ink py-3 text-paper transition hover:bg-brass disabled:cursor-not-allowed disabled:bg-paper-dim disabled:text-ink-faint"
            >
              {soldOut
                ? t('storefront.outOfStock')
                : isPreorder
                  ? t('storefront.preorderNow')
                  : t('storefront.addToCart')}
            </button>
          </div>
        </div>
      </main>

      <StorefrontFooter tenant={tenant} />
      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} />}
    </div>
  );
}
