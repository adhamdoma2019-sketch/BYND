import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { formatPrice } from '../../utils/format';
import { optimizedImage } from '../../utils/images';

export default function ProductCard({ product, onAddToCart }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { slug } = useParams();

  const name = product.name?.[language] || product.name?.en;
  const isPreorder = product.isPreorder === true;
  const outOfStock = !isPreorder && product.stock <= 0;
  const productUrl = `/store/${slug}/product/${product.id}`;

  return (
    <div className="group flex flex-col overflow-hidden rounded-md border border-ink/10 bg-white p-3 transition hover:border-brass/60">
      <Link to={productUrl} className="relative block overflow-hidden rounded">
        {product.imageUrl ? (
          <img
            src={optimizedImage(product.imageUrl, 700)}
            alt={name}
            loading="lazy"
            className="mb-3 aspect-square w-full rounded object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="mb-3 flex aspect-square w-full items-center justify-center rounded bg-paper-dim text-sm text-ink-faint">
            {name}
          </div>
        )}
        {isPreorder && (
          <span className="absolute start-2 top-2 rounded bg-ink px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-paper">
            {t('storefront.preorder')}
          </span>
        )}
      </Link>

      <h3 className="font-display px-1 text-lg font-semibold">
        <Link to={productUrl} className="hover:text-brass">
          {name}
        </Link>
      </h3>
      <p className="mt-1 px-1 text-ink-soft">{formatPrice(product.price, language)}</p>

      <button
        onClick={() => onAddToCart(product)}
        disabled={outOfStock}
        className="mt-3 rounded bg-ink py-2.5 text-sm font-semibold uppercase tracking-wider text-paper transition hover:bg-brass disabled:cursor-not-allowed disabled:bg-paper-dim disabled:text-ink-faint"
      >
        {outOfStock
          ? t('storefront.outOfStock')
          : isPreorder
            ? t('storefront.preorderNow')
            : t('storefront.addToCart')}
      </button>
    </div>
  );
}
