import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';

// The activity log lives inside the shop: tenants/<shop>/auditLogs.
// Entries can be added but never edited or deleted (see firestore.rules).
const logs = (tenantId) => collection(db, 'tenants', tenantId, 'auditLogs');

// entry: { action, entityType, entityId, entityLabel, changes: [{ field, from?, to? }] }
export async function writeAudit(tenantId, actor, entry) {
  await addDoc(logs(tenantId), {
    tenantId,
    at: serverTimestamp(),
    actorUid: actor.uid,
    actorEmail: String(actor.email || '').slice(0, 120),
    actorName: String(actor.name || '').slice(0, 80),
    action: entry.action,
    entityType: entry.entityType || '',
    entityId: String(entry.entityId || '').slice(0, 100),
    entityLabel: String(entry.entityLabel || '').slice(0, 120),
    changes: (entry.changes || []).slice(0, 30),
  });
}

// Newest first.
export async function listAudit(tenantId, max = 300) {
  const snap = await getDocs(query(logs(tenantId), orderBy('at', 'desc'), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
