import { Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { can } from '../utils/roles';

// `area` (optional) = which part of the admin this page is (see utils/roles.js).
// People whose role isn't allowed there see a "no access" message.
export default function ProtectedRoute({ children, area }) {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const { role, blocked, loading: tenantLoading } = useTenant();

  if (loading || (user && tenantLoading)) {
    return (
      <div className="flex h-screen items-center justify-center text-ink-soft">
        {t('common.loading')}
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (blocked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <p className="max-w-sm text-ink-soft">{t('team.blocked')}</p>
      </div>
    );
  }

  if (area && !can(role, area)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <p className="max-w-sm text-ink-soft">{t('team.noAccess')}</p>
        <Link to="/admin" className="mt-4 text-brass hover:underline">
          {t('admin.backToDashboard')}
        </Link>
      </div>
    );
  }

  return children;
}
