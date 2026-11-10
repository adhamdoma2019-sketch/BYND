import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { contactLinks } from '../../utils/contact';
import { availablePolicyPages } from '../../utils/storefront';
import { formatPrice } from '../../utils/format';
import { trustItems } from '../../utils/trust';

const ICONS = {
  cash: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  fee: 'M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 18.5a1.5 1.5 0 1 0 0 .01M17 18.5a1.5 1.5 0 1 0 0 .01',
  returns: 'M4 12a8 8 0 1 0 3-6.2M4 4v4h4',
  whatsapp: 'M4 20l1.3-4A8 8 0 1 1 8.2 18.8z',
};

function Icon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mt-0.5 shrink-0 text-brass-dark"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

// Shows only real facts of the shop (see src/utils/trust.js). No numbers are invented.
export default function TrustStrip({ tenant }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const base = `/store/${tenant.slug}`;
  const shopName = tenant.name?.[language] || tenant.name?.en || tenant.slug;
  const links = contactLinks(tenant.contact, {
    countryCode: tenant.defaultCountryCode || '20',
    message: t('contact.whatsappHello', { shop: shopName }),
  });
  const hasReturns = availablePolicyPages(tenant, language).includes('returns');
  const items = trustItems(tenant, { hasReturns, hasWhatsapp: Boolean(links.whatsapp) });

  const text = (it) => {
    if (it.id === 'cash') return t('trust.cash');
    if (it.id === 'feeFree') return t('trust.feeFree');
    if (it.id === 'feeSome') return t('trust.feeSome');
    if (it.id === 'feeFrom') return t('trust.feeFrom', { price: formatPrice(it.price, language) });
    if (it.id === 'returns') return t('trust.returns');
    return t('trust.whatsapp');
  };
  const icon = (it) => (it.id.startsWith('fee') ? 'fee' : it.id);
  const cell = 'flex min-h-[44px] items-start gap-2 rounded px-1 py-2 text-xs text-ink-soft';

  return (
    <ul className="mt-6 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-ink/10 pt-3" data-trust-strip>
      {items.map((it) => (
        <li key={it.id}>
          {it.id === 'returns' ? (
            <Link to={`${base}/page/returns`} className={`${cell} hover:text-ink`}>
              <Icon name={icon(it)} />
              <span className="underline-offset-2 hover:underline">{text(it)}</span>
            </Link>
          ) : it.id === 'whatsapp' ? (
            <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" className={`${cell} hover:text-ink`}>
              <Icon name={icon(it)} />
              <span className="underline-offset-2 hover:underline">{text(it)}</span>
            </a>
          ) : (
            <div className={cell}>
              <Icon name={icon(it)} />
              <span>{text(it)}</span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
