import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './config';

export async function getTenant(slug) {
  const snap = await getDoc(doc(db, 'tenants', slug));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function isSlugAvailable(slug) {
  const snap = await getDoc(doc(db, 'tenants', slug));
  return !snap.exists();
}

export async function createTenant({ slug, shopName, ownerUid }) {
  const tenantRef = doc(db, 'tenants', slug);
  await setDoc(tenantRef, {
    name: { en: shopName, ar: shopName },
    slug,
    ownerUid,
    currency: 'EGP',
    isActive: true,
    createdAt: serverTimestamp(),
  });

  await setDoc(doc(db, 'users', ownerUid), {
    tenantId: slug,
    role: 'owner',
    createdAt: serverTimestamp(),
  });

  return { id: slug, slug };
}

// The signed-in person's record: { tenantId, role, active, name } (or null).
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    tenantId: d.tenantId || null,
    role: d.role || 'staff',
    active: d.active !== false,
    name: d.name || '',
  };
}

export async function getUserTenantId(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data().tenantId : null;
}

// Look & feel settings edited in Admin > Settings:
//   theme: { accent }                 colour choice
//   brand: { logoUrl, logoDarkUrl }   optional logo (+ another one for dark screens)
//   hero:  { slides: [...], intervalSeconds, fade, textStyle }   home page banner
//   highlights: [{ title:{en,ar}, text:{en,ar} }]   the shop's own "why us" points
//   pages: { privacy|returns|shipping|terms: { body:{en,ar} } }   text pages shown in the footer
//   checkout: { fields }              which customer details are asked
//   shipping: { zones }               delivery areas and their prices
export async function updateTenantSettings(
  tenantId,
  { theme, brand, hero, checkout, shipping, defaultCountryCode, appearance, contact, highlights, pages }
) {
  await updateDoc(doc(db, 'tenants', tenantId), {
    defaultCountryCode, // for WhatsApp links, e.g. '20' for Egypt
    appearance, // { mode, font, radius, announcement:{ enabled, text:{en,ar}, link, more:[{ text:{en,ar}, link }] } }
    contact, // { whatsapp, phone, email, instagram, facebook, tiktok, address:{en,ar}, floatingWhatsapp }
    theme,
    brand,
    hero,
    highlights,
    pages,
    checkout, // { fields: { <field>: { show, required } } }
    shipping, // { zones: [{ id, name:{en,ar}, price, freeAbove, active }] }
    updatedAt: serverTimestamp(),
  });
}
