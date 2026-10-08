// Team accounts: the owner gives each person their own email + password.
//
// People are created with Firebase's own login system, and linked to the shop by
// a record in users/{uid} ({ tenantId, role, name, email, active }). Because only
// the SERVER may create logins and records for other people, this runs here and
// not in the browser. The server checks, with the caller's login token, that the
// caller really is the owner of the shop.
//
// Passwords: nobody ever types or sees someone else's password. The owner gets
// a one-time "set your password" link to send to the new person.

import crypto from 'node:crypto';
import { OrderError } from './errors.js';
import { writeAudit } from './audit.js';

export const ASSIGNABLE_ROLES = ['manager', 'staff'];
export const MAX_MEMBERS = 20;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fail = (status, code, message) => new OrderError(status, code, message);

// Who is calling? Returns { uid, email, tenantId, role, name }.
export async function authenticate({ auth, db, idToken }) {
  if (!idToken) throw fail(401, 'AUTH', 'Please sign in again.');
  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken);
  } catch {
    throw fail(401, 'AUTH', 'Please sign in again.');
  }
  const snap = await db.collection('users').doc(decoded.uid).get();
  const data = snap.exists ? snap.data() : null;
  if (!data || !data.tenantId || data.active === false) {
    throw fail(403, 'FORBIDDEN', 'No access.');
  }
  return {
    uid: decoded.uid,
    email: decoded.email || data.email || '',
    tenantId: data.tenantId,
    role: data.role || 'staff',
    name: data.name || '',
  };
}

export function requireOwner(actor) {
  if (actor.role !== 'owner') throw fail(403, 'FORBIDDEN', 'Only the owner can manage the team.');
}

// A strong random password nobody will ever see; the person sets their own via the link.
const randomPassword = () => crypto.randomBytes(24).toString('base64url');

async function memberOf(db, tenantId, uid) {
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists || snap.data().tenantId !== tenantId) {
    throw fail(404, 'NOT_FOUND', 'Team member not found.');
  }
  return snap.data();
}

export async function listMembers({ auth, db, tenantId }) {
  const snap = await db.collection('users').where('tenantId', '==', tenantId).get();
  const members = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    let record = null;
    try {
      record = await auth.getUser(doc.id);
    } catch {
      // login missing: still list the record
    }
    members.push({
      uid: doc.id,
      email: record?.email || data.email || '',
      name: data.name || record?.displayName || '',
      role: data.role || 'staff',
      active: data.active !== false,
      lastSignIn: record?.metadata?.lastSignInTime || null,
    });
  }
  const order = { owner: 0, manager: 1, staff: 2 };
  return members.sort((a, b) => (order[a.role] ?? 3) - (order[b.role] ?? 3));
}

export async function addMember({ auth, db, actor, email, name, role }) {
  const cleanEmail = String(email || '').trim().toLowerCase().slice(0, 100);
  const cleanName = String(name || '').trim().slice(0, 60);
  if (!EMAIL.test(cleanEmail)) throw fail(400, 'BAD_EMAIL', 'Please enter a valid email address.');
  if (cleanName.length < 2) throw fail(400, 'BAD_NAME', 'Please enter the person\'s name.');
  if (!ASSIGNABLE_ROLES.includes(role)) throw fail(400, 'BAD_ROLE', 'Choose a role.');

  const existing = await db.collection('users').where('tenantId', '==', actor.tenantId).get();
  if (existing.size >= MAX_MEMBERS) throw fail(400, 'LIMIT', 'The team is full.');

  // Is there already a login for this email?
  let record = null;
  try {
    record = await auth.getUserByEmail(cleanEmail);
  } catch (e) {
    if (e?.code !== 'auth/user-not-found') throw e;
  }

  if (record) {
    const owned = await db.collection('users').doc(record.uid).get();
    if (owned.exists) {
      throw fail(
        409,
        owned.data().tenantId === actor.tenantId ? 'ALREADY_MEMBER' : 'EMAIL_TAKEN',
        'This email is already in use.'
      );
    }
    // A login that belongs to no shop yet: reuse it.
    if (record.disabled) await auth.updateUser(record.uid, { disabled: false });
  } else {
    record = await auth.createUser({
      email: cleanEmail,
      displayName: cleanName,
      password: randomPassword(),
      emailVerified: false,
    });
  }

  await db.collection('users').doc(record.uid).set({
    tenantId: actor.tenantId,
    role,
    name: cleanName,
    email: cleanEmail,
    active: true,
    createdBy: actor.uid,
    createdAt: new Date().toISOString(),
  });

  const resetLink = await auth.generatePasswordResetLink(cleanEmail);
  await writeAudit(db, actor.tenantId, actor, {
    action: 'team.add',
    entityType: 'team',
    entityId: record.uid,
    entityLabel: cleanName,
    changes: [{ field: 'role', to: role }],
  });
  return { uid: record.uid, email: cleanEmail, name: cleanName, role, resetLink };
}

export async function updateMember({ auth, db, actor, uid, role, active, name }) {
  if (uid === actor.uid) throw fail(400, 'CANNOT_CHANGE_SELF', 'You can\'t change your own account here.');
  const current = await memberOf(db, actor.tenantId, uid);
  if (current.role === 'owner') throw fail(400, 'CANNOT_CHANGE_OWNER', 'The owner can\'t be changed.');

  const patch = {};
  const entries = [];
  const label = current.name || current.email || uid;

  if (role !== undefined && role !== current.role) {
    if (!ASSIGNABLE_ROLES.includes(role)) throw fail(400, 'BAD_ROLE', 'Choose a role.');
    patch.role = role;
    entries.push({ action: 'team.role', changes: [{ field: 'role', from: current.role, to: role }] });
  }
  if (typeof active === 'boolean' && active !== (current.active !== false)) {
    patch.active = active;
    await auth.updateUser(uid, { disabled: !active });
    if (!active) await auth.revokeRefreshTokens(uid); // signed out everywhere
    entries.push({ action: active ? 'team.activate' : 'team.deactivate', changes: [] });
  }
  if (typeof name === 'string' && name.trim() && name.trim() !== current.name) {
    patch.name = name.trim().slice(0, 60);
  }

  if (Object.keys(patch).length > 0) {
    await db.collection('users').doc(uid).set(patch, { merge: true });
  }
  for (const e of entries) {
    await writeAudit(db, actor.tenantId, actor, {
      ...e,
      entityType: 'team',
      entityId: uid,
      entityLabel: label,
    });
  }
  return { ok: true };
}

export async function makeResetLink({ auth, db, actor, uid }) {
  const current = await memberOf(db, actor.tenantId, uid);
  const email = current.email || (await auth.getUser(uid)).email;
  const resetLink = await auth.generatePasswordResetLink(email);
  await writeAudit(db, actor.tenantId, actor, {
    action: 'team.resetLink',
    entityType: 'team',
    entityId: uid,
    entityLabel: current.name || email,
    changes: [],
  });
  return { resetLink };
}
