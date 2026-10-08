import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { writeAudit } from '../firebase/audit.service';

// Returns log(entry): records "who did what" in the activity log.
// It never gets in the way: if writing the log fails, the action itself still counts.
export function useAudit() {
  const { user } = useAuth();
  const { tenant, member } = useTenant();

  return useCallback(
    (entry) => {
      if (!user || !tenant) return Promise.resolve();
      return writeAudit(
        tenant.id,
        { uid: user.uid, email: user.email, name: member?.name || '' },
        entry
      ).catch(() => {});
    },
    [user, tenant, member]
  );
}
