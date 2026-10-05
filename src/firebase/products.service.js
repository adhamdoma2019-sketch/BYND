import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';

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

export async function createProduct(tenantId, data) {
  const ref = await addDoc(collection(db, PRODUCTS), {
    tenantId,
    name: { en: data.nameEn, ar: data.nameAr || data.nameEn },
    description: {
      en: data.descriptionEn || '',
      ar: data.descriptionAr || data.descriptionEn || '',
    },
    price: Number(data.price),
    stock: Number(data.stock),
    sku: data.sku || '',
    imageUrl: data.imageUrl || '',
    isActive: true,
    deleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProduct(productId, data) {
  await updateDoc(doc(db, PRODUCTS, productId), {
    name: { en: data.nameEn, ar: data.nameAr || data.nameEn },
    description: {
      en: data.descriptionEn || '',
      ar: data.descriptionAr || data.descriptionEn || '',
    },
    price: Number(data.price),
    stock: Number(data.stock),
    sku: data.sku || '',
    imageUrl: data.imageUrl || '',
    isActive: data.isActive,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProduct(productId) {
  await updateDoc(doc(db, PRODUCTS, productId), {
    deleted: true,
    updatedAt: serverTimestamp(),
  });
}
