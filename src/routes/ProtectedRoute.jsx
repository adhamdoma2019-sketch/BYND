import { Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { can } from '../utils/roles';
import LoadError from '../components/admin/LoadError';

// `area` (optional) = which part of the admin this page is (see utils/roles.js).
// People whose role isn't allowed there see a "no access" message.
export default function ProtectedRoute({ children, area }) {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const { role, blocked, loading: tenantLoading, loadFailed, tenant, member, reloadTenant } = useTenant();

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

  if (loadFailed) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <LoadError onRetry={reloadTenant} />
      </div>
    );
  }

  // Signed in with a shop on record, but the shop itself is missing (for example its
  // record was deleted by mistake): say it clearly instead of an empty, endless page.
  if (member && member.active && member.tenantId && !tenant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <p className="max-w-sm text-ink-soft">{t('admin.shopMissing')}</p>
      </div>
    );
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
