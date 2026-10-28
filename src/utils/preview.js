// Live preview: how the Settings page and the shop (shown in a frame beside it) talk.
// Plain functions with no screens in them, so they can be tested (tests/settings-preview.mjs).
//
// Safety: the shop only listens to drafts when it is (a) opened with ?preview, (b) inside a frame,
// and (c) the message comes from the page around it on the SAME site. A draft only changes what
// is shown in that one frame: nothing is saved and nothing is written anywhere.

export const PREVIEW_DRAFT = 'shop-preview-draft';
export const PREVIEW_READY = 'shop-preview-ready';

// Only these parts of the shop record can be replaced by a draft.
export const DRAFT_KEYS = ['theme', 'appearance', 'contact', 'brand', 'hero', 'highlights', 'pages'];

// Is this shop page the preview frame? (opened with ?preview AND inside another page)
export function isPreviewMode(search, inFrame) {
  if (!inFrame) return false;
  try {
    return new URLSearchParams(search || '').has('preview');
  } catch {
    return false;
  }
}

// A message from the Settings page to the shop frame. Returns the draft or null.
export function acceptDraftMessage(event, { origin, parent }) {
  if (!event || event.origin !== origin || event.source !== parent) return null;
  const d = event.data;
  if (!d || d.type !== PREVIEW_DRAFT || typeof d.draft !== 'object' || !d.draft) return null;
  return {
    draft: cleanDraft(d.draft),
    mode: d.mode === 'light' || d.mode === 'dark' ? d.mode : null, // null = what the shop setting says
    language: d.language === 'ar' ? 'ar' : d.language === 'en' ? 'en' : null,
  };
}

// A message from the shop frame saying "I am ready, send me the draft". Returns true/false.
export function acceptReadyMessage(event, { origin, frameWindow }) {
  return Boolean(
    event && event.origin === origin && event.source === frameWindow && event.data?.type === PREVIEW_READY
  );
}

const isHttps = (u) => /^https:\/\//i.test(String(u || '').trim());

// Keeps only the allowed parts, and drops picture links that are not https yet
// (while someone is still typing a link, nothing broken is shown).
export function cleanDraft(draft) {
  const out = {};
  DRAFT_KEYS.forEach((k) => {
    if (draft[k] !== undefined) out[k] = draft[k];
  });
  if (out.brand) {
    out.brand = {
      logoUrl: isHttps(out.brand.logoUrl) ? out.brand.logoUrl : '',
      logoDarkUrl: isHttps(out.brand.logoDarkUrl) ? out.brand.logoDarkUrl : '',
    };
  }
  if (out.hero && Array.isArray(out.hero.slides)) {
    out.hero = {
      ...out.hero,
      slides: out.hero.slides.map((s) => ({ ...s, imageUrl: isHttps(s.imageUrl) ? s.imageUrl : '' })),
    };
  }
  return out;
}

// The saved shop record with the draft on top. The saved record itself is never changed.
export function applyDraft(tenant, draft) {
  if (!tenant || !draft) return tenant;
  return { ...tenant, ...cleanDraft(draft) };
}
