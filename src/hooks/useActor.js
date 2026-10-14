import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';

// Who is signed in right now: { uid, email, name } (written into stock history lines).
export function useActor() {
  const { user } = useAuth();
  const { member } = useTenant();
  return useMemo(
    () => ({ uid: user?.uid || '', email: user?.email || '', name: member?.name || '' }),
    [user, member]
  );
}
