import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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

export async function getUserTenantId(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data().tenantId : null;
}