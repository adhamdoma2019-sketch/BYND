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
import { stockToRestore, canReturnStatus } from '../utils/orderRules';
import { buildMovement } from '../utils/stock';

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
export function createOrder({ tenantId, customer, custom, items, zoneId, promoCode, website }) {
  return callApi('/api/create-order', {
    website: website || '', // hidden trap field: real customers never fill it in
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

// Puts the order's items back on the shelf (one total per product, never for preorder
// lines). Must be called inside a transaction, BEFORE any write of that transaction.
async function readStockToRestore(transaction, order) {
  const restore = stockToRestore(order);
  const refs = restore.map((r) => doc(db, 'products', r.productId));
  const snaps = await Promise.all(refs.map((ref) => transaction.get(ref)));
  return restore.map((r, i) => ({
    productId: r.productId,
    ref: refs[i],
    snap: snaps[i],
    quantity: r.quantity,
    name: (order.items || []).find((it) => it.productId === r.productId)?.name,
  }));
}

// ctx = { type: 'cancel' | 'return', tenantId, orderId, orderLabel, actor }
// Besides the stock itself, a line is added to the stock history.
function writeStockBack(transaction, plan, ctx) {
  plan.forEach(({ productId, ref, snap, quantity, name }) => {
    if (!snap.exists()) return;
    const stockAfter = (Number(snap.data().stock) || 0) + quantity;
    transaction.update(ref, { stock: stockAfter });
    transaction.set(doc(collection(db, 'tenants', ctx.tenantId, 'stockMovements')), {
      ...buildMovement({
        tenantId: ctx.tenantId,
        productId,
        productName: name,
        type: ctx.type,
        delta: quantity,
        stockAfter,
        orderId: ctx.orderId,
        orderLabel: ctx.orderLabel,
        actor: ctx.actor,
      }),
      at: serverTimestamp(),
    });
  });
}

const labelOf = (order) => order.orderNumberLabel || `#${order.orderNumber}`;

// Cancel an order that has not been delivered yet. Its items go back in stock.
export async function cancelOrder(orderId, actor) {
  const orderRef = doc(db, 'orders', orderId);

  await runTransaction(db, async (transaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists()) throw codedError('NOT_FOUND', 'Order not found.');

    const order = orderSnap.data();
    if (order.status === 'cancelled')
      throw codedError('ALREADY_CANCELLED', 'This order is already cancelled.');
    if (order.status === 'returned')
      throw codedError('ALREADY_RETURNED', 'This order was already returned.');
    if (order.status === 'delivered') {
      throw codedError(
        'ALREADY_DELIVERED',
        'This order was already delivered and cannot be cancelled.'
      );
    }

    const plan = await readStockToRestore(transaction, order);
    writeStockBack(transaction, plan, {
      type: 'cancel',
      tenantId: order.tenantId,
      orderId,
      orderLabel: labelOf(order),
      actor,
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

// The parcel came back (refused, failed delivery, or sent back after delivery).
// `restock` = put the items back in stock (false if they are damaged or lost).
export async function returnOrder(orderId, { restock, actor }) {
  const orderRef = doc(db, 'orders', orderId);

  await runTransaction(db, async (transaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists()) throw codedError('NOT_FOUND', 'Order not found.');

    const order = orderSnap.data();
    if (order.status === 'returned')
      throw codedError('ALREADY_RETURNED', 'This order was already returned.');
    if (!canReturnStatus(order.status))
      throw codedError('NOT_RETURNABLE', 'Only a shipped or delivered order can be returned.');

    const plan = restock ? await readStockToRestore(transaction, order) : [];
    writeStockBack(transaction, plan, {
      type: 'return',
      tenantId: order.tenantId,
      orderId,
      orderLabel: labelOf(order),
      actor,
    });

    transaction.update(orderRef, {
      status: 'returned',
      statusHistory: arrayUnion({
        status: 'returned',
        timestamp: new Date().toISOString(),
        updatedBy: 'partner',
        restocked: Boolean(restock),
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
