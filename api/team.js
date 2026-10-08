// Admin-only: manage the team (list, add, change role, switch off, password link).
// Only the shop's OWNER may call this; the server checks the caller's login token.
//
// One-time setup: the server's Google account needs the role
// "Firebase Authentication Admin" so it can create logins (see the setup steps).

import { getAuth } from 'firebase-admin/auth';
import { getDb } from './_lib/db.js';
import { OrderError } from './_lib/errors.js';
import {
  authenticate,
  requireOwner,
  listMembers,
  addMember,
  updateMember,
  makeResetLink,
} from './_lib/team.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'METHOD' });
  }

  try {
    const db = getDb();
    const auth = getAuth();

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const header = req.headers.authorization || '';
    const idToken = header.startsWith('Bearer ') ? header.slice(7) : '';
    const actor = await authenticate({ auth, db, idToken });
    requireOwner(actor);

    let result;
    switch (body?.action) {
      case 'list':
        result = { members: await listMembers({ auth, db, tenantId: actor.tenantId }) };
        break;
      case 'add':
        result = await addMember({ auth, db, actor, ...body });
        break;
      case 'update':
        result = await updateMember({ auth, db, actor, ...body });
        break;
      case 'resetLink':
        result = await makeResetLink({ auth, db, actor, uid: body.uid });
        break;
      default:
        throw new OrderError(400, 'BAD_ACTION', 'Unknown action.');
    }
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof OrderError) {
      return res.status(err.status).json({ ok: false, error: err.code, message: err.message });
    }
    // The server's Google account may still lack permission to manage logins.
    const code = String(err?.code || '') + String(err?.errorInfo?.code || '');
    if (code.includes('insufficient-permission') || code.includes('permission')) {
      return res.status(500).json({ ok: false, error: 'AUTH_PERMISSION' });
    }
    console.error('team function failed');
    return res.status(500).json({ ok: false, error: 'SERVER' });
  }
}
