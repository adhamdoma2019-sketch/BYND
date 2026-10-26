import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { safeBarLink } from '../../utils/contact';
import { announcementMessages } from '../../utils/storefront';

const SECONDS_PER_MESSAGE = 5;

// A thin bar at the very top of the shop for messages ("Free shipping over 1500 EGP").
// One message stays still; several messages change by themselves every few seconds and
// can also be changed with the arrows. The shop sets them in Admin > Settings > Look.
export default function AnnouncementBar({ tenant }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const messages = announcementMessages(tenant?.appearance, language);
  const count = messages.length;

  const [index, setIndex] = useState(0);
  const current = index < count ? index : 0;

  // Changes by itself (restarts after every change). Not for people who asked their
  // phone to reduce motion.
  useEffect(() => {
    if (count < 2) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = setTimeout(() => setIndex((current + 1) % count), SECONDS_PER_MESSAGE * 1000);
    return () => clearTimeout(timer);
  }, [count, current]);

  if (count === 0) return null;

  const message = messages[current];
  const link = safeBarLink(message.link);
  const textClass = 'block px-10 py-2 text-center text-sm font-medium text-on-brass';
  const text = link ? (
    <a
      href={link}
      className={textClass + ' hover:opacity-90'}
      {...(link.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      {message.text}
    </a>
  ) : (
    <div className={textClass}>{message.text}</div>
  );

  const arrow =
    'absolute top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-on-brass hover:bg-black/10';
  const chevron = (d) => (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 rtl:rotate-180"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );

  return (
    <div className="relative bg-brass" aria-live="polite">
      {text}
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => setIndex((current - 1 + count) % count)}
            aria-label={t('storefront.prevMessage')}
            className={arrow + ' start-1'}
          >
            {chevron('M15 5l-7 7 7 7')}
          </button>
          <button
            type="button"
            onClick={() => setIndex((current + 1) % count)}
            aria-label={t('storefront.nextMessage')}
            className={arrow + ' end-1'}
          >
            {chevron('M9 5l7 7-7 7')}
          </button>
        </>
      )}
    </div>
  );
}
