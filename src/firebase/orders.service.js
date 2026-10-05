import {
  doc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  arrayUnion,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';

// Orders are created by a secure server function (api/create-order.js),
// NOT directly from the browser. We only send product ids and quantities;
// the server looks up the real prices and stock itself.
export async function createOrder({ tenantId, customer, items }) {
  const response = await fetch('/api/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId,
      customer,
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
    }),
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    // ignore: handled below
  }
  if (!response.ok) {
    throw new Error(
      data.error || 'Something went wrong placing your order. Please try again.'
    );
  }
  return data; // { orderId, orderNumber, orderNumberLabel, totalAmount }
}

export async function listOrders(tenantId) {
  const q = query(
    collection(db, 'orders'),
    where('tenantId', '==', tenantId),
    where('deleted', '==', false)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.orderNumber || 0) - (a.orderNumber || 0));
}

export async function updateOrderStatus(orderId, newStatus) {
  await updateDoc(doc(db, 'orders', orderId), {
    status: newStatus,
    statusHistory: arrayUnion({
      status: newStatus,
      timestamp: new Date().toISOString(),
      updatedBy: 'partner',
    }),
    updatedAt: serverTimestamp(),
  });
}

export async function cancelOrder(orderId) {
  const orderRef = doc(db, 'orders', orderId);

  await runTransaction(db, async (transaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists()) throw new Error('Order not found.');

    const order = orderSnap.data();
    if (order.status === 'cancelled')
      throw new Error('This order is already cancelled.');
    if (order.status === 'delivered') {
      throw new Error(
        'This order was already delivered and cannot be cancelled.'
      );
    }

    const productRefs = order.items.map((item) =>
      doc(db, 'products', item.productId)
    );
    const productSnaps = await Promise.all(
      productRefs.map((ref) => transaction.get(ref))
    );

    productSnaps.forEach((snap, index) => {
      if (!snap.exists()) return;
      const item = order.items[index];
      // Preorder lines never reduced stock, so there is nothing to give back.
      if (item.isPreorder) return;
      transaction.update(productRefs[index], {
        stock: snap.data().stock + item.quantity,
      });
    });

    transaction.update(orderRef, {
      status: 'cancelled',
      statusHistory: arrayUnion({
        status: 'cancelled',
        timestamp: new Date().toISOString(),
        updatedBy: 'partner',
      }),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function updateOrderCustomer(orderId, customer) {
  await updateDoc(doc(db, 'orders', orderId), {
    customer,
    updatedAt: serverTimestamp(),
  });
}
