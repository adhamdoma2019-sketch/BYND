import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { getTenant, getUserTenantId } from '../firebase/tenants.service';

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const { user } = useAuth();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadTenant() {
      if (!user) {
        setTenant(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const tenantId = await getUserTenantId(user.uid);
      const tenantData = tenantId ? await getTenant(tenantId) : null;
      if (!cancelled) {
        setTenant(tenantData);
        setLoading(false);
      }
    }

    loadTenant();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <TenantContext.Provider value={{ tenant, loading, setTenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within a TenantProvider');
  return ctx;
}