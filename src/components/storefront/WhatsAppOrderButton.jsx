import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { contactLinks } from '../../utils/contact';

// Design step 9: "Message us about this order" opens WhatsApp with the order number already typed.
// Shown only when the shop gave a WhatsApp number (nothing is invented).
export default function WhatsAppOrderButton({ tenant, orderNumber, className = '' }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  if (!tenant) return null;
  const shopName = tenant.name?.[language] || tenant.name?.en || tenant.slug || '';
  const links = contactLinks(tenant.contact, {
    countryCode: tenant.defaultCountryCode || '20',
    message: orderNumber
      ? t('contact.whatsappOrder', { shop: shopName, order: orderNumber })
      : t('contact.whatsappHello', { shop: shopName }),
  });
  if (!links.whatsapp) return null;
  return (
    <a
      href={links.whatsapp}
      target="_blank"
      rel="noopener noreferrer"
      data-whatsapp-order
      className={
        'flex min-h-[44px] w-full max-w-md items-center justify-center rounded border border-ink/20 px-4 py-3 text-center text-sm font-semibold text-ink transition hover:border-brass hover:text-brass-dark ' +
        className
      }
    >
      {t('contact.whatsappOrderButton')}
    </a>
  );
}
