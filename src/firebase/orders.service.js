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

// The browser never calculates prices, discounts or shipping itself. It asks the
// secure server functions (api/quote.js, api/create-order.js), which look up
// the real prices, the shop's rules and the promo code.
async function callApi(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    // ignore: handled below
  }
  if (!response.ok) {
    // `code` and `meta` let the screen show the message in Arabic or English.
    const error = new Error(data.error || 'Request failed');
    error.code = data.code;
    error.meta = data.meta;
    throw error;
  }
  return data;
}

const cartLines = (items) =>
  items.map((i) => ({
    productId: i.productId,
    quantity: i.quantity,
    selections: i.selections || {},
  }));

// Place the order. Returns { orderId, orderNumber, orderNumberLabel, totalAmount, orderType }.
export function createOrder({ tenantId, customer, custom, items, zoneId, promoCode }) {
  return callApi('/api/create-order', {
    tenantId,
    customer,
    custom: custom || {},
    items: cartLines(items),
    zoneId: zoneId || '',
    promoCode: promoCode || '',
  });
}

// Price preview for the checkout page. Returns
// { subtotal, discount, shippingFee, total, promo, promoError, zoneProblem }.
export function getQuote({ tenantId, items, zoneId, promoCode }) {
  return callApi('/api/quote', {
    tenantId,
    items: cartLines(items),
    zoneId: zoneId || '',
    promoCode: promoCode || '',
  });
}

// Errors with a `code` so the screen can translate them.
function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
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
    if (!orderSnap.exists()) throw codedError('NOT_FOUND', 'Order not found.');

    const order = orderSnap.data();
    if (order.status === 'cancelled')
      throw codedError('ALREADY_CANCELLED', 'This order is already cancelled.');
    if (order.status === 'delivered') {
      throw codedError(
        'ALREADY_DELIVERED',
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

// Only the four editable details are changed; the rest of the customer record
// (email, floor, landmark, ...) is kept.
export async function updateOrderCustomer(orderId, customer) {
  await updateDoc(doc(db, 'orders', orderId), {
    'customer.name': customer.name,
    'customer.phone': customer.phone,
    'customer.address': customer.address,
    'customer.notes': customer.notes,
    updatedAt: serverTimestamp(),
  });
}
