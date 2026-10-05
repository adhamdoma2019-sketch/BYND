import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';

export default function ProductCard({ product, onAddToCart }) {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const name = product.name?.[language] || product.name?.en;
  const outOfStock = product.stock <= 0;

  return (
    <div className="flex flex-col rounded-md border border-ink/10 bg-white p-4">
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={name}
          className="mb-3 h-48 w-full rounded object-cover"
        />
      ) : (
        <div className="mb-3 flex h-48 w-full items-center justify-center rounded bg-paper-dim text-sm text-ink-faint">
          {name}
        </div>
      )}

      <h3 className="font-display text-lg font-medium">{name}</h3>
      <p className="mt-1 text-ink-soft">{product.price} EGP</p>

      <button
        onClick={() => onAddToCart(product)}
        disabled={outOfStock}
        className="mt-3 rounded bg-ink py-2 text-sm text-paper transition hover:bg-brass disabled:cursor-not-allowed disabled:bg-paper-dim disabled:text-ink-faint"
      >
        {outOfStock ? t('storefront.outOfStock') : t('storefront.addToCart')}
      </button>
    </div>
  );
}
