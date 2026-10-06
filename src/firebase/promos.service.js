import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';

const PROMOS = 'promoCodes';

// Codes are stored as  <shopId>__<CODE>  so each shop has its own codes.
export const promoDocId = (tenantId, code) => `${tenantId}__${code}`;

export async function listPromoCodes(tenantId) {
  const q = query(collection(db, PROMOS), where('tenantId', '==', tenantId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

// `data`: { code, type: 'percent'|'fixed', value, minOrder, expiresAt, usageLimit }
export async function createPromoCode(tenantId, data) {
  const code = data.code.trim().toUpperCase();
  await setDoc(doc(db, PROMOS, promoDocId(tenantId, code)), {
    tenantId,
    code,
    type: data.type,
    value: Number(data.value),
    minOrder: data.minOrder === '' ? 0 : Number(data.minOrder),
    expiresAt: data.expiresAt || null, // 'YYYY-MM-DD', last valid day
    usageLimit: data.usageLimit === '' ? null : Number(data.usageLimit),
    usedCount: 0,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function setPromoActive(promoId, isActive) {
  await updateDoc(doc(db, PROMOS, promoId), { isActive, updatedAt: serverTimestamp() });
}
