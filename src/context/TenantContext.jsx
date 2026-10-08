import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { getTenant, getUserProfile } from '../firebase/tenants.service';

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const { user } = useAuth();
  const [tenant, setTenant] = useState(null);
  const [member, setMember] = useState(null); // this person: { role, active, name }
  const [loading, setLoading] = useState(true);
  // Bumping this number makes the shop reload (used right after signup).
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadTenant() {
      if (!user) {
        setTenant(null);
        setMember(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const profile = await getUserProfile(user.uid);
      // A switched-off team member gets no access at all.
      const allowed = profile && profile.tenantId && profile.active;
      const tenantData = allowed ? await getTenant(profile.tenantId) : null;
      if (!cancelled) {
        setTenant(tenantData);
        setMember(profile);
        setLoading(false);
      }
    }

    loadTenant();
    return () => {
      cancelled = true;
    };
  }, [user, reloadKey]);

  function reloadTenant() {
    setReloadKey((n) => n + 1);
  }

  return (
    <TenantContext.Provider value={{
        tenant,
        member,
        role: member?.role || null,
        blocked: Boolean(member && !member.active),
        loading,
        setTenant,
        reloadTenant,
      }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within a TenantProvider');
  return ctx;
}