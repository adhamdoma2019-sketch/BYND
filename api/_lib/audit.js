// Writes one line of the activity log from the SERVER (used for team changes).
// The shop's screens write their own lines from the browser (see
// src/firebase/audit.service.js). Entries are never edited or deleted.

import { FieldValue } from 'firebase-admin/firestore';

const cut = (v, n) => String(v ?? '').slice(0, n);

export async function writeAudit(db, tenantId, actor, entry) {
  try {
    await db
      .collection('tenants')
      .doc(tenantId)
      .collection('auditLogs')
      .add({
        tenantId,
        at: FieldValue.serverTimestamp(),
        actorUid: actor.uid,
        actorEmail: cut(actor.email, 120),
        actorName: cut(actor.name, 80),
        action: cut(entry.action, 40),
        entityType: cut(entry.entityType, 20),
        entityId: cut(entry.entityId, 100),
        entityLabel: cut(entry.entityLabel, 120),
        changes: (entry.changes || []).slice(0, 30).map((c) => ({
          field: cut(c.field, 40),
          from: c.from === undefined ? null : cut(c.from, 120),
          to: c.to === undefined ? null : cut(c.to, 120),
        })),
      });
  } catch {
    // The activity log must never break the action itself.
    console.error('activity log entry not written');
  }
}
