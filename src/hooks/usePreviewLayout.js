import { useEffect, useState } from 'react';

// Wide screens (computer): the preview sits beside the form. Narrow screens (phone/tablet):
// the preview opens full-screen from a button.
export const WIDE_QUERY = '(min-width: 1280px)';

export function usePreviewLayout() {
  const [wide, setWide] = useState(() => window.matchMedia?.(WIDE_QUERY).matches ?? false);
  useEffect(() => {
    const query = window.matchMedia?.(WIDE_QUERY);
    if (!query) return undefined;
    const onChange = (e) => setWide(e.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);
  return wide;
}
