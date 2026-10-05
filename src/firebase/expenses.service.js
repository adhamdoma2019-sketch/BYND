import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';

const EXPENSES = 'expenses';

export async function listExpenses(tenantId) {
  const q = query(
    collection(db, EXPENSES),
    where('tenantId', '==', tenantId),
    where('deleted', '==', false)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export async function createExpense(tenantId, data) {
  await addDoc(collection(db, EXPENSES), {
    tenantId,
    category: data.category,
    description: data.description || '',
    amount: Number(data.amount),
    date: data.date,
    deleted: false,
    createdAt: serverTimestamp(),
  });
}

export async function deleteExpense(expenseId) {
  await updateDoc(doc(db, EXPENSES, expenseId), { deleted: true });
}
