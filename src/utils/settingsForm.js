// Turns the Settings form into what the shop stores (and back). These are plain functions with
// no screens in them, so they can be tested (tests/settings-preview.mjs).
// The "Save settings" button AND the live preview both use buildPublicSettings, so what you
// see in the preview is exactly what will be saved.
import { safeBarLink } from './contact';
import { MAX_ANNOUNCEMENTS, MAX_HIGHLIGHTS, POLICY_PAGES } from './storefront';
import { HERO_DEFAULT_SECONDS, HERO_MIN_SECONDS, HERO_MAX_SECONDS } from './constants';

// ----- Banner slides -----
export function slideToForm(s) {
  return {
    imageUrl: s.imageUrl || '',
    headlineEn: s.headline?.en || '',
    headlineAr: s.headline?.ar || '',
    subtextEn: s.subtext?.en || '',
    subtextAr: s.subtext?.ar || '',
    ctaEn: s.cta?.en || '',
    ctaAr: s.cta?.ar || '',
    productId: s.productId || '',
  };
}

export function formToSlide(f) {
  return {
    imageUrl: f.imageUrl.trim(),
    headline: { en: f.headlineEn.trim(), ar: f.headlineAr.trim() || f.headlineEn.trim() },
    subtext: { en: f.subtextEn.trim(), ar: f.subtextAr.trim() || f.subtextEn.trim() },
    cta: { en: f.ctaEn.trim(), ar: f.ctaAr.trim() || f.ctaEn.trim() },
    productId: f.productId || '',
  };
}

// ----- Highlights ("why us" points), policy pages and extra top-bar messages -----
export const highlightToForm = (h) => ({
  titleEn: h.title?.en || '',
  titleAr: h.title?.ar || '',
  textEn: h.text?.en || '',
  textAr: h.text?.ar || '',
});
export const formToHighlight = (f) => ({
  title: { en: f.titleEn.trim() || f.titleAr.trim(), ar: f.titleAr.trim() || f.titleEn.trim() },
  text: { en: f.textEn.trim() || f.textAr.trim(), ar: f.textAr.trim() || f.textEn.trim() },
});

export const pagesToForm = (pages) =>
  Object.fromEntries(
    POLICY_PAGES.map((id) => [id, { en: pages?.[id]?.body?.en || '', ar: pages?.[id]?.body?.ar || '' }])
  );
export const formToPages = (form) =>
  Object.fromEntries(
    POLICY_PAGES.map((id) => {
      const en = (form[id]?.en || '').trim();
      const ar = (form[id]?.ar || '').trim();
      return [id, { body: { en: en || ar, ar: ar || en } }];
    })
  );

export const moreToForm = (m) => ({ textEn: m.text?.en || '', textAr: m.text?.ar || '', link: m.link || '' });
export const formToMore = (f) => ({
  text: { en: f.textEn.trim() || f.textAr.trim(), ar: f.textAr.trim() || f.textEn.trim() },
  link: safeBarLink(f.link),
});

// Slideshow timing is kept inside safe limits.
export const safeHeroSeconds = (seconds) =>
  Math.min(HERO_MAX_SECONDS, Math.max(HERO_MIN_SECONDS, Number(seconds) || HERO_DEFAULT_SECONDS));

// The parts of the shop record that customers see on the home page.
// `f` = the values currently in the Settings form.
export function buildPublicSettings(f) {
  const more = (f.appearance.annMore || [])
    .filter((m) => m.textEn.trim() || m.textAr.trim())
    .slice(0, MAX_ANNOUNCEMENTS - 1)
    .map(formToMore);
  const highlights = (f.highlights || [])
    .filter((h) => h.titleEn.trim() || h.titleAr.trim())
    .slice(0, MAX_HIGHLIGHTS)
    .map(formToHighlight);
  const c = f.contact;
  return {
    theme: { accent: f.accent },
    appearance: {
      mode: f.appearance.mode,
      font: f.appearance.font,
      radius: f.appearance.radius,
      announcement: {
        enabled: f.appearance.annEnabled,
        text: {
          en: f.appearance.annTextEn.trim(),
          ar: f.appearance.annTextAr.trim() || f.appearance.annTextEn.trim(),
        },
        link: safeBarLink(f.appearance.annLink),
        // up to 3 more messages (empty ones are dropped)
        more,
      },
    },
    contact: {
      whatsapp: c.whatsapp.trim(),
      phone: c.phone.trim(),
      email: c.email.trim(),
      instagram: c.instagram.trim(),
      facebook: c.facebook.trim(),
      tiktok: c.tiktok.trim(),
      address: { en: c.addressEn.trim(), ar: c.addressAr.trim() || c.addressEn.trim() },
      floatingWhatsapp: c.floatingWhatsapp,
    },
    brand: { logoUrl: f.logoUrl.trim(), logoDarkUrl: f.logoDarkUrl.trim() },
    hero: {
      slides: f.slides.map(formToSlide),
      intervalSeconds: safeHeroSeconds(f.seconds),
      fade: f.fade,
      autoplay: f.autoplay,
      textStyle: f.heroTextStyle,
    },
    highlights,
    pages: formToPages(f.pages),
  };
}
