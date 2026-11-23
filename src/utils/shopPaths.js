// Update 61: where a shop's pages live.
// Normal (several shops): /store/<slug>/...   Single-shop mode (VITE_SINGLE_SHOP = the shop's slug in Vercel):
// the shop is the whole site: /, /products, /product/<id>, /checkout, /track ...  (/admin is unchanged).
let override = null;
export const setSingleShopForTests = (v) => { override = v; };

export function singleShop() {
  if (override !== null) return override;
  try {
    const v = import.meta.env && import.meta.env.VITE_SINGLE_SHOP;
    return String(v || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

// The front part of every link of this shop ('' in single-shop mode).
export function shopBase(slug) {
  const only = singleShop();
  return only && only === String(slug || '').toLowerCase() ? '' : `/store/${slug}`;
}

// shopPath('bynd') = home, shopPath('bynd', '/products'), shopPath('bynd', '?preview=1'), shopPath('bynd', '/product/p1?preview=1')
export function shopPath(slug, rest = '') {
  let r = String(rest || '');
  if (r && !r.startsWith('/') && !r.startsWith('?') && !r.startsWith('#')) r = `/${r}`;
  const out = shopBase(slug) + r;
  if (out === '') return '/';
  return out.startsWith('?') || out.startsWith('#') ? `/${out}` : out;
}
