import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import { planRestock, planAdjust, buildMovement } from '../utils/stock';

// Stock history lives inside the shop: tenants/<shop>/stockMovements.
// Lines can be added but never edited or deleted (see firestore.rules).
const movementsOf = (tenantId) => collection(db, 'tenants', tenantId, 'stockMovements');

function coded(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

const today = () => new Date().toISOString().slice(0, 10);

// Add stock to a product (a batch you made or bought).
// input: { quantity, totalCost, note, updateCost, recordExpense, expenseCategory }
// Everything happens in ONE transaction: the new stock, the new average cost, the history
// line and (optionally) the expense are saved together or not at all.
export async function restockProduct(tenantId, productId, input, actor) {
  const productRef = doc(db, 'products', productId);
  const costRef = doc(db, 'productCosts', productId);

  return runTransaction(db, async (tx) => {
    const [productSnap, costSnap] = await Promise.all([tx.get(productRef), tx.get(costRef)]);
    if (!productSnap.exists() || productSnap.data().tenantId !== tenantId) {
      throw coded('NOT_FOUND');
    }
    const product = productSnap.data();
    const cost = costSnap.exists() ? (costSnap.data().costPrice ?? null) : null;

    const plan = planRestock({
      stock: product.stock,
      cost,
      quantity: input.quantity,
      totalCost: input.totalCost,
      updateCost: input.updateCost !== false,
    });
    if (plan.error) throw coded(plan.error);

    // ---- all reads are done; now the writes ----
    tx.update(productRef, { stock: plan.newStock, updatedAt: serverTimestamp() });
    if (plan.costChanged && plan.newCost !== null) {
      tx.set(costRef, { tenantId, costPrice: plan.newCost, updatedAt: serverTimestamp() }, { merge: true });
    }
    tx.set(doc(movementsOf(tenantId)), {
      ...buildMovement({
        tenantId,
        productId,
        productName: product.name,
        type: 'restock',
        delta: plan.quantity,
        stockAfter: plan.newStock,
        unitCost: plan.unitCost,
        totalCost: plan.totalCost,
        note: input.note,
        actor,
      }),
      at: serverTimestamp(),
    });
    if (input.recordExpense && plan.totalCost !== null && plan.totalCost > 0) {
      tx.set(doc(collection(db, 'expenses')), {
        tenantId,
        category: input.expenseCategory || 'manufacturing',
        description: `${product.name?.en || ''} × ${plan.quantity}${input.note ? ` — ${input.note}` : ''}`.slice(0, 200),
        amount: plan.totalCost,
        date: today(),
        deleted: false,
        createdAt: serverTimestamp(),
      });
    }

    return { before: product.stock, after: plan.newStock, costBefore: cost, costAfter: plan.newCost, productName: product.name };
  });
}

// Correct the stock. input: { mode: 'count' | 'remove', value, note }
//   count  = the real number on the shelf (stocktake)
//   remove = damaged or lost units
export async function adjustStock(tenantId, productId, input, actor) {
  const productRef = doc(db, 'products', productId);

  return runTransaction(db, async (tx) => {
    const productSnap = await tx.get(productRef);
    if (!productSnap.exists() || productSnap.data().tenantId !== tenantId) {
      throw coded('NOT_FOUND');
    }
    const product = productSnap.data();
    const plan = planAdjust({ stock: product.stock, mode: input.mode, value: input.value });
    if (plan.error) throw coded(plan.error);

    tx.update(productRef, { stock: plan.newStock, updatedAt: serverTimestamp() });
    tx.set(doc(movementsOf(tenantId)), {
      ...buildMovement({
        tenantId,
        productId,
        productName: product.name,
        type: plan.type,
        delta: plan.delta,
        stockAfter: plan.newStock,
        note: input.note,
        actor,
      }),
      at: serverTimestamp(),
    });
    return { before: product.stock, after: plan.newStock, productName: product.name, type: plan.type, delta: plan.delta };
  });
}

// Newest first.
export async function listMovements(tenantId, max = 500) {
  const snap = await getDocs(query(movementsOf(tenantId), orderBy('at', 'desc'), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
