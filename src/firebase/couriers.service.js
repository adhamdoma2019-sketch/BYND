import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';

// All couriers calls live here (like the other *.service.js files).
// Collections: `couriers` (the people / companies) and `courierSettlements`
// (add-only ledger of cash handed over / fees paid). Orders keep their own courier snapshot.

export async function listCouriers(tenantId) {
  const snap = await getDocs(query(collection(db, 'couriers'), where('tenantId', '==', tenantId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

// `value` comes from cleanCourierForm(...).value. Returns the courier id.
export async function saveCourier(tenantId, courierId, value) {
  if (courierId) {
    await updateDoc(doc(db, 'couriers', courierId), { ...value, updatedAt: serverTimestamp() });
    return courierId;
  }
  const ref = await addDoc(collection(db, 'couriers'), {
    ...value,
    tenantId,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listSettlements(tenantId) {
  const snap = await getDocs(
    query(collection(db, 'courierSettlements'), where('tenantId', '==', tenantId))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) ||
      (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

// amount: signed (+ courier gave cash to the shop, - the shop paid the courier).
export async function addSettlement(tenantId, actor, { courierId, courierName, amount, note, date }) {
  await addDoc(collection(db, 'courierSettlements'), {
    tenantId,
    courierId,
    courierName: String(courierName || '').slice(0, 80),
    amount,
    note: note || '',
    date,
    createdByUid: actor.uid,
    createdByName: String(actor.name || actor.email || '').slice(0, 80),
    createdAt: serverTimestamp(),
  });
}

// Puts a courier on an order (snapshot from courierSnapshot) or removes it (null).
export async function setOrderCourier(orderId, snapshot) {
  await updateDoc(doc(db, 'orders', orderId), {
    courier: snapshot,
    updatedAt: serverTimestamp(),
  });
}
