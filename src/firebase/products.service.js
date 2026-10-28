import {
  collection,
  doc,
  updateDoc,
  writeBatch,
  runTransaction,
  getDocs,
  getDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import { formToOptionCosts } from '../utils/productOptionsForm';
import { buildMovement } from '../utils/stock';
import { derivedStock } from '../utils/optionStock';
import { productFields } from '../utils/productForm';

const PRODUCTS = 'products';

export async function listProducts(tenantId) {
  const q = query(
    collection(db, PRODUCTS),
    where('tenantId', '==', tenantId),
    where('deleted', '==', false)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listStorefrontProducts(tenantId) {
  const q = query(
    collection(db, PRODUCTS),
    where('tenantId', '==', tenantId),
    where('deleted', '==', false),
    where('isActive', '==', true)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getProduct(productId) {
  const snap = await getDoc(doc(db, PRODUCTS, productId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// What the product costs us. Stored in a SEPARATE private collection
// (productCosts/{productId}) because products are readable by customers.
function costFields(tenantId, data) {
  const hasCost = data.costPrice !== '' && data.costPrice !== undefined && data.costPrice !== null;
  return {
    tenantId,
    costPrice: hasCost ? Number(data.costPrice) : null,
    optionCosts: formToOptionCosts(data.options), // private extra cost of each choice
    updatedAt: serverTimestamp(),
  };
}

// Returns { [productId]: costPrice } for the admin screens.
export async function listProductCosts(tenantId) {
  const q = query(collection(db, 'productCosts'), where('tenantId', '==', tenantId));
  const snap = await getDocs(q);
  const costs = {};
  snap.docs.forEach((d) => {
    costs[d.id] = d.data().costPrice;
  });
  return costs;
}

// { [productId]: { costPrice, optionCosts } } for the admin screens.
export async function listProductCostDetails(tenantId) {
  const q = query(collection(db, 'productCosts'), where('tenantId', '==', tenantId));
  const snap = await getDocs(q);
  const details = {};
  snap.docs.forEach((d) => {
    details[d.id] = { costPrice: d.data().costPrice, optionCosts: d.data().optionCosts || {} };
  });
  return details;
}

export async function createProduct(tenantId, data, actor) {
  const productRef = doc(collection(db, PRODUCTS));
  const costRef = doc(db, 'productCosts', productRef.id);
  const batch = writeBatch(db); // all saved together, or none
  const fields = productFields(data);
  // Counted per colour / option: every number starts at 0 (use "Add stock" for each).
  const counted = fields.countedOptions.length > 0;
  if (counted) fields.stock = 0;
  batch.set(productRef, {
    tenantId,
    ...fields,
    ...(counted ? { optionStock: {} } : {}),
    isActive: true,
    deleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(costRef, costFields(tenantId, data));
  // The starting stock is the first line of the stock history.
  if (!fields.isPreorder && !counted && fields.stock > 0) {
    batch.set(doc(collection(db, 'tenants', tenantId, 'stockMovements')), {
      ...buildMovement({
        tenantId,
        productId: productRef.id,
        productName: fields.name,
        type: 'initial',
        delta: fields.stock,
        stockAfter: fields.stock,
        actor,
      }),
      at: serverTimestamp(),
    });
  }
  await batch.commit();
  return productRef.id;
}

export async function updateProduct(tenantId, productId, data, actor) {
  const productRef = doc(db, PRODUCTS, productId);
  const costRef = doc(db, 'productCosts', productId);
  // Stock is NOT written here: it only changes through "Add stock", "Adjust" and orders
  // (editing it here could overwrite sales that arrived in the meantime).
  const { stock: _ignored, ...fields } = productFields(data);

  // Counted per colour / option: the product's own stock number is recalculated from the
  // colour numbers (a colour may have been added or removed). Done in a transaction so a sale
  // that arrives at the same moment is never overwritten.
  if (fields.countedOptions.length > 0) {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(productRef);
      const old = snap.exists() ? snap.data() : {};
      const optionStock = old.optionStock || {};
      const newStock = derivedStock({ ...old, ...fields, optionStock }, optionStock);
      const oldStock = Number(old.stock) || 0;

      tx.update(productRef, {
        ...fields,
        optionStock,
        stock: newStock,
        isActive: data.isActive,
        updatedAt: serverTimestamp(),
      });
      tx.set(costRef, costFields(tenantId, data));
      // The number changed because of this edit (e.g. counting was just switched on): keep a history line.
      if (newStock !== oldStock && actor?.uid) {
        tx.set(doc(collection(db, 'tenants', tenantId, 'stockMovements')), {
          ...buildMovement({
            tenantId,
            productId,
            productName: fields.name,
            type: 'adjustment',
            delta: newStock - oldStock,
            stockAfter: newStock,
            note: 'Product edited: stock is now counted per option',
            actor,
          }),
          at: serverTimestamp(),
        });
      }
    });
    return;
  }

  const batch = writeBatch(db);
  batch.update(productRef, {
    ...fields,
    isActive: data.isActive,
    updatedAt: serverTimestamp(),
  });
  batch.set(costRef, costFields(tenantId, data));
  await batch.commit();
}

export async function deleteProduct(productId) {
  await updateDoc(doc(db, PRODUCTS, productId), {
    deleted: true,
    updatedAt: serverTimestamp(),
  });
}
