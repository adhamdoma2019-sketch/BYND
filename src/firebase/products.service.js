import {
  collection,
  doc,
  updateDoc,
  writeBatch,
  getDocs,
  getDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import { formToOptions, formToOptionCosts } from '../utils/productOptionsForm';
import { buildMovement } from '../utils/stock';

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

// Fields shared by "create" and "update".
function productFields(data) {
  const isPreorder = data.isPreorder === true;
  return {
    name: { en: data.nameEn, ar: data.nameAr || data.nameEn },
    description: {
      en: data.descriptionEn || '',
      ar: data.descriptionAr || data.descriptionEn || '',
    },
    price: Number(data.price),
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
    options: formToOptions(data.options), // colors, activity, extension... (public)
    preorderMessage: {
      en: isPreorder ? data.preorderMessageEn || '' : '',
      ar: isPreorder ? data.preorderMessageAr || data.preorderMessageEn || '' : '',
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
  batch.set(productRef, {
    tenantId,
    ...fields,
    isActive: true,
    deleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(costRef, costFields(tenantId, data));
  // The starting stock is the first line of the stock history.
  if (!fields.isPreorder && fields.stock > 0) {
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

export async function updateProduct(tenantId, productId, data) {
  const productRef = doc(db, PRODUCTS, productId);
  const costRef = doc(db, 'productCosts', productId);
  const batch = writeBatch(db);
  // Stock is NOT written here: it only changes through "Add stock", "Adjust" and orders
  // (editing it here could overwrite sales that arrived in the meantime).
  const { stock: _ignored, ...fields } = productFields(data);
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
