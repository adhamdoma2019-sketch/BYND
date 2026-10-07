import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './config';

// Settings only the shop's own team may read (for example the Telegram chat
// for order alerts). Stored apart from the shop record, which is public.
export async function getTenantPrivate(tenantId) {
  const snap = await getDoc(doc(db, 'tenantPrivate', tenantId));
  return snap.exists() ? snap.data() : {};
}

export async function saveTenantPrivate(tenantId, { telegramChatId, notifyLanguage }) {
  await setDoc(
    doc(db, 'tenantPrivate', tenantId),
    {
      telegramChatId: (telegramChatId || '').trim(),
      notifyLanguage: notifyLanguage === 'ar' ? 'ar' : 'en',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
