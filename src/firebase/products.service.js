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
import { formToOptions, formToOptionCosts } from '../utils/productOptionsForm';
import { buildMovement } from '../utils/stock';
import { COUNTABLE_TYPES, MAX_COUNTED, derivedStock } from '../utils/optionStock';
import { cleanTiers, SAFETY_MAX_QTY } from '../utils/quantityPrices';

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

// Which options count their own stock: only a colour list or a choice list that has values,
// never on a made-to-order product (it uses no stock), at most MAX_COUNTED.
function countedIdsOf(data, options) {
  if (data.isPreorder === true) return [];
  const ids = Array.isArray(data.countedOptions) ? data.countedOptions : [];
  return options
    .filter((o) => ids.includes(o.id) && COUNTABLE_TYPES.includes(o.type) && (o.values || []).length > 0)
    .slice(0, MAX_COUNTED)
    .map((o) => o.id);
}

// A whole number between min and max, or 0 when the box is empty / not valid.
function wholeNumber(value, min, max) {
  const n = Number(value);
  return value !== '' && value !== null && value !== undefined && Number.isInteger(n) && n >= min
    ? Math.min(n, max)
    : 0;
}

// Fields shared by "create" and "update".
function productFields(data) {
  const isPreorder = data.isPreorder === true;
  // "Stock first, then made to order": sells from stock, and when it is gone customers can still order.
  const backorder = !isPreorder && data.backorder === true;
  const usesMessage = isPreorder || backorder;
  const savedOptions = formToOptions(data.options);
  const countedOptions = countedIdsOf(data, savedOptions);
  // A customer must choose every counted option (we need to know which number to reduce).
  const options = savedOptions.map((o) => (countedOptions.includes(o.id) ? { ...o, required: true } : o));
  return {
    name: { en: data.nameEn, ar: data.nameAr || data.nameEn },
    description: {
      en: data.descriptionEn || '',
      ar: data.descriptionAr || data.descriptionEn || '',
    },
    price: Number(data.price),
    // Quantity prices: [{ minQty, price }] "from X pieces each costs Y" (only valid, cheaper-and-bigger steps are kept).
    priceTiers: cleanTiers(data.priceTiers, data.price),
    // Optional limits per order for the whole product (0 = no limit of the shop's own).
    minQty: wholeNumber(data.minQty, 2, SAFETY_MAX_QTY),
    maxQty: wholeNumber(data.maxQty, 1, SAFETY_MAX_QTY),
    // Preorder products don't need stock.
    stock: data.stock === '' || data.stock === undefined ? 0 : Number(data.stock),
    sku: data.sku || '',
    // Extra shipping per unit (for big/heavy items). Added to the zone price.
    shippingExtra:
      data.shippingExtra === '' || data.shippingExtra === undefined
        ? 0
        : Number(data.shippingExtra),
    imageUrl: data.imageUrl || '',
    // More pictures of the product (shown as thumbnails on the product page).
    images: (data.images || [])
      .map((u) => String(u || '').trim())
      .filter(Boolean)
      .slice(0, 8),
    // Other products offered on this product's page (e.g. extension plates).
    relatedIds: (data.relatedIds || []).slice(0, 6),
    isPreorder,
    backorder,
    countedOptions,
    // How a no-stock product is labelled for customers: 'preorder' or 'madeToOrder'.
    // Same behaviour either way (orderable without stock); only the wording differs.
    preorderStyle: usesMessage && data.preorderStyle === 'madeToOrder' ? 'madeToOrder' : 'preorder',
    // Shown in the shop but can't be ordered yet (the server refuses orders for it too).
    comingSoon: data.comingSoon === true,
    options, // colors, activity, extension... (public)
    preorderMessage: {
      en: usesMessage ? data.preorderMessageEn || '' : '',
      ar: usesMessage ? data.preorderMessageAr || data.preorderMessageEn || '' : '',
    },
  };
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
