import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { contactLinks } from '../../utils/contact';

// A round WhatsApp button in the corner (the shop switches it on in Admin > Settings > Contact).
export default function FloatingWhatsApp({ tenant }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { pathname } = useLocation();
  if (!tenant?.contact?.floatingWhatsapp) return null;

  // On a product page phones show a buy bar at the bottom: lift the button above it.
  const aboveBuyBar = pathname.includes('/product/');

  const shopName = tenant.name?.[language] || tenant.name?.en || '';
  const { whatsapp } = contactLinks(tenant.contact, {
    countryCode: tenant.defaultCountryCode || '20',
    message: t('contact.whatsappHello', { shop: shopName }),
  });
  if (!whatsapp) return null;

  return (
    <a
      href={whatsapp}
      target="_blank"
      rel="noreferrer"
      aria-label={t('contact.whatsappLabel')}
      className={
        'fixed end-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-[#fff] shadow-lg transition hover:scale-105 ' +
        (aboveBuyBar ? 'bottom-24 md:bottom-4' : 'bottom-4')
      }
    >
      <svg viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor" aria-hidden="true">
        <path d="M16.04 3C9.4 3 4 8.4 4 15.04c0 2.35.68 4.64 1.96 6.6L4 29l7.54-1.92a12 12 0 0 0 4.5 .88C22.68 27.96 28 22.6 28 15.96 28 9.32 22.68 3 16.04 3Zm0 21.86c-1.4 0-2.78-.37-3.98-1.07l-.29-.17-4.47 1.14 1.2-4.34-.19-.3a9.06 9.06 0 0 1-1.4-4.82c0-5.03 4.1-9.12 9.13-9.12 5.04 0 9.13 4.1 9.13 9.12 0 5.03-4.1 9.56-9.13 9.56Zm5-6.84c-.27-.14-1.62-.8-1.87-.9-.25-.09-.43-.14-.62.14-.18.27-.7.9-.86 1.08-.16.18-.32.2-.6.07-.27-.14-1.15-.42-2.2-1.35-.8-.72-1.35-1.6-1.5-1.88-.16-.27-.02-.42.12-.56.12-.12.27-.32.4-.48.14-.16.18-.27.27-.46.09-.18.05-.34-.02-.48-.07-.14-.62-1.5-.85-2.05-.22-.54-.45-.46-.62-.47h-.53c-.18 0-.48.07-.73.34-.25.27-.96.94-.96 2.3s.99 2.67 1.12 2.85c.14.18 1.94 2.97 4.7 4.16.66.28 1.17.45 1.57.58.66.2 1.26.18 1.73.1.53-.08 1.62-.66 1.85-1.3.23-.64.23-1.19.16-1.3-.07-.11-.25-.18-.52-.32Z" />
      </svg>
    </a>
  );
}
