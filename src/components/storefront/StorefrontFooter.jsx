import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { contactLinks } from '../../utils/contact';
import { availablePolicyPages } from '../../utils/storefront';

export default function StorefrontFooter({ tenant }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const shopName = tenant.name?.[language] || tenant.name?.en || tenant.slug;
  const links = contactLinks(tenant.contact, {
    countryCode: tenant.defaultCountryCode || '20',
    message: t('contact.whatsappHello', { shop: shopName }),
  });
  const address = tenant.contact?.address?.[language] || tenant.contact?.address?.en || '';

  // Only the contact details the shop filled in are shown.
  const items = [
    links.whatsapp && { key: 'whatsapp', href: links.whatsapp, label: t('contact.whatsapp') },
    links.phone && { key: 'phone', href: links.phone, label: links.phoneText, ltr: true },
    links.email && { key: 'email', href: links.email, label: links.emailText, ltr: true },
    links.instagram && { key: 'instagram', href: links.instagram, label: 'Instagram' },
    links.facebook && { key: 'facebook', href: links.facebook, label: 'Facebook' },
    links.tiktok && { key: 'tiktok', href: links.tiktok, label: 'TikTok' },
  ].filter(Boolean);

  // Policy pages the shop wrote (privacy, returns, ...). Only pages with text are listed.
  const policies = availablePolicyPages(tenant, language);

  return (
    <footer className="mt-20 border-t border-ink/10 px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row">
          <div>
            <span className="font-display text-lg font-bold uppercase tracking-[0.2em]">{shopName}</span>
            {address && <p className="mt-2 max-w-xs text-sm text-ink-soft">{address}</p>}
          </div>
          {items.length > 0 && (
            <nav aria-label={t('contact.title')} className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {items.map((i) => (
                <a
                  key={i.key}
                  href={i.href}
                  {...(i.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
                  dir={i.ltr ? 'ltr' : undefined}
                  className="text-ink-soft transition hover:text-brass-dark"
                >
                  {i.label}
                </a>
              ))}
            </nav>
          )}
        </div>
        {policies.length > 0 && (
          <nav
            aria-label={t('storefront.infoPages')}
            className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-ink/10 pt-6 text-sm"
          >
            {policies.map((id) => (
              <Link
                key={id}
                to={`/store/${tenant.slug}/page/${id}`}
                className="text-ink-soft underline-offset-4 transition hover:text-brass-dark hover:underline"
              >
                {t(`policies.${id}`)}
              </Link>
            ))}
          </nav>
        )}
        <p className="mt-8 text-sm text-ink-faint">
          {t('storefront.footerNote')} · © {new Date().getFullYear()} {shopName}
        </p>
      </div>
    </footer>
  );
}
