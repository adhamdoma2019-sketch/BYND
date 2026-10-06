import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitch from '../shared/LanguageSwitch';

// Slim bar at the top of every admin page: way back to the dashboard +
// language switch. (The arrow direction flips in Arabic through the text itself.)
export default function AdminTopBar() {
  const { t } = useTranslation();
  return (
    <div className="mb-6 flex items-center justify-between">
      <Link to="/admin" className="text-sm text-brass hover:underline">
        {t('admin.backToDashboard')}
      </Link>
      <LanguageSwitch />
    </div>
  );
}
