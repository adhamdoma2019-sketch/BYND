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

export async function createOrder({
  tenantId,
  customer,
  items,
  paymentMethod,
}) {
  const counterRef = doc(db, 'counters', tenantId);
  const orderRef = doc(collection(db, 'orders'));

  await runTransaction(db, async (transaction) => {
    const productRefs = items.map((item) =>
      doc(db, 'products', item.productId)
    );
    const productSnaps = await Promise.all(
      productRefs.map((ref) => transaction.get(ref))
    );
    const counterSnap = await transaction.get(counterRef);

    productSnaps.forEach((snap, index) => {
      const item = items[index];
      if (!snap.exists()) {
        throw new Error(
          `Product ${item.name?.en || item.productId} no longer exists.`
        );
      }
      const currentStock = snap.data().stock;
      if (currentStock < item.quantity) {
        throw new Error(
          `Sorry, only ${currentStock} of "${item.name?.en}" left in stock.`
        );
      }
    });

    const nextOrderNumber = counterSnap.exists()
      ? counterSnap.data().current + 1
      : 1;

    productSnaps.forEach((snap, index) => {
      const item = items[index];
      transaction.update(productRefs[index], {
        stock: snap.data().stock - item.quantity,
      });
    });

    const totalAmount = items.reduce(
      (sum, i) => sum + i.unitPrice * i.quantity,
      0
    );

    transaction.set(orderRef, {
      tenantId,
      orderNumber: nextOrderNumber,
      customer,
      items: items.map((i) => ({
        productId: i.productId,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        subtotal: i.unitPrice * i.quantity,
      })),
      totalAmount,
      paymentMethod,
      status: 'pending',
      statusHistory: [
        {
          status: 'pending',
          timestamp: new Date().toISOString(),
          updatedBy: 'system',
        },
      ],
      deleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    transaction.set(counterRef, { current: nextOrderNumber }, { merge: true });
  });

  return orderRef.id;
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
