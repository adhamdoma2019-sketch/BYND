import { createContext, useContext } from 'react';

// Gives every shop page the shop (tenant) record, loaded once by StorefrontLayout.
export const StorefrontContext = createContext(null);

export function useStorefront() {
  const ctx = useContext(StorefrontContext);
  if (!ctx) throw new Error('useStorefront must be used inside StorefrontLayout');
  return ctx;
}
