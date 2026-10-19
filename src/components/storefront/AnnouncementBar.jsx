import { useLanguage } from '../../context/LanguageContext';
import { safeBarLink } from '../../utils/contact';

// A thin bar at the very top of the shop for a message ("Free shipping over 1500 EGP").
// The shop sets it in Admin > Settings > Appearance.
export default function AnnouncementBar({ tenant }) {
  const { language } = useLanguage();
  const bar = tenant?.appearance?.announcement;
  const text = bar?.text?.[language] || bar?.text?.en || '';
  if (!bar?.enabled || !text) return null;

  const link = safeBarLink(bar.link);
  const cls = 'block bg-brass px-4 py-2 text-center text-sm font-medium text-on-brass';
  return link ? (
    <a href={link} className={cls + ' hover:opacity-90'} {...(link.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}>
      {text}
    </a>
  ) : (
    <div className={cls}>{text}</div>
  );
}
