// Small rules for how the shop front looks and behaves. Plain functions with no
// screens in them, so they are easy to test (tests/storefront.mjs).

export const MAX_ANNOUNCEMENTS = 4; // top-bar messages (the first one + up to 3 more)
export const MAX_HIGHLIGHTS = 4; // "why buy from us" points
export const POLICY_PAGES = ['privacy', 'returns', 'shipping', 'terms'];
export const MAX_PAGE_CHARS = 8000;

const pick = (obj, language) => String(obj?.[language] || obj?.en || obj?.ar || '').trim();

// Which logo to show. `logoUrl` is the main logo; `logoDarkUrl` (optional) replaces it
// when the shop is dark. If one is missing the other is used, so a logo always shows.
export function pickLogo(brand, mode) {
  const main = String(brand?.logoUrl || '').trim();
  const dark = String(brand?.logoDarkUrl || '').trim();
  if (mode === 'dark') return dark || main;
  return main || dark;
}

// The messages of the top bar, in order. The first one is the original single
// message (so shops that set it up before keep working); up to 3 more can follow.
// Empty messages are skipped.
export function announcementMessages(appearance, language) {
  const bar = appearance?.announcement;
  if (!bar || bar.enabled !== true) return [];
  const more = Array.isArray(bar.more) ? bar.more : [];
  return [{ text: bar.text, link: bar.link }, ...more]
    .map((m) => ({ text: pick(m?.text, language), link: String(m?.link || '') }))
    .filter((m) => m.text) // empty messages don't use up a place
    .slice(0, MAX_ANNOUNCEMENTS);
}

// The shop's own "highlights" (e.g. quality, free returns, real support).
// Each has a title and an optional short text. Nothing is invented: no title = skipped.
export function highlightsOf(tenant, language) {
  const list = Array.isArray(tenant?.highlights) ? tenant.highlights : [];
  return list
    .slice(0, MAX_HIGHLIGHTS)
    .map((h) => ({ title: pick(h?.title, language), text: pick(h?.text, language) }))
    .filter((h) => h.title);
}

// Policy pages (privacy, returns, ...). A page exists only when the shop wrote text for it.
export function policyBody(tenant, pageId, language) {
  if (!POLICY_PAGES.includes(pageId)) return '';
  return pick(tenant?.pages?.[pageId]?.body, language).slice(0, MAX_PAGE_CHARS);
}

export function availablePolicyPages(tenant, language) {
  return POLICY_PAGES.filter((id) => policyBody(tenant, id, language));
}

// What a customer can do with a product:
//   comingSoon   shown in the shop, can't be ordered yet
//   preorder     can be ordered without stock ("ships from...")
//   madeToOrder  same as preorder, but labelled "made to order" (3D-printed on request)
//   soldOut      has no stock left
//   inStock      normal
export function productStatus(product) {
  if (product?.comingSoon === true) return 'comingSoon';
  if (product?.isPreorder === true) {
    return product.preorderStyle === 'madeToOrder' ? 'madeToOrder' : 'preorder';
  }
  return (Number(product?.stock) || 0) <= 0 ? 'soldOut' : 'inStock';
}

export const isBuyable = (status) => status !== 'comingSoon' && status !== 'soldOut';

// Products that count in the stock reports and low-stock warnings: not preorders,
// and not products that are only announced.
export const tracksStock = (product) => product?.isPreorder !== true && product?.comingSoon !== true;
