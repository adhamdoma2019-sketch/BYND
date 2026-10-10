import assert from 'node:assert/strict';
import { authenticate, requireOwner, listMembers, addMember, updateMember, makeResetLink } from '../api/_lib/team.js';
import { OrderError } from '../api/_lib/errors.js';
import { can, canSeeCosts, canCancelOrders, ACCESS } from '../src/utils/roles.js';

// ---- fakes ----
function makeEnv() {
  const users = new Map(); const logs = []; const authUsers = new Map(); let uid = 0; const calls = [];
  users.set('owner1', { tenantId: 'bynd', role: 'owner', createdAt: 'x' });
  authUsers.set('owner1', { uid: 'owner1', email: 'boss@x.com', displayName: 'Boss', disabled: false, metadata: { lastSignInTime: 'today' } });
  users.set('other1', { tenantId: 'other', role: 'owner' }); authUsers.set('other1', { uid: 'other1', email: 'o@other.com' });
  const db = {
    collection(name) {
      if (name === 'users') return {
        doc: (id) => ({ get: async () => ({ exists: users.has(id), data: () => structuredClone(users.get(id)) }),
          set: async (d, o) => users.set(id, o?.merge ? { ...(users.get(id) || {}), ...d } : d) }),
        where: (f, op, v) => ({ get: async () => { const docs = [...users].filter(([, d]) => d[f] === v).map(([id, d]) => ({ id, data: () => structuredClone(d) })); return { size: docs.length, docs }; } }),
      };
      if (name === 'tenants') return { doc: () => ({ collection: () => ({ add: async (e) => logs.push(e) }) }) };
      throw new Error('unexpected collection ' + name);
    } };
  const auth = {
    verifyIdToken: async (t) => { if (!t.startsWith('tok-')) throw new Error('bad'); return { uid: t.slice(4), email: authUsers.get(t.slice(4))?.email }; },
    getUser: async (id) => { if (!authUsers.has(id)) throw new Error('no'); return authUsers.get(id); },
    getUserByEmail: async (email) => { const u = [...authUsers.values()].find((x) => x.email === email); if (!u) throw Object.assign(new Error('nf'), { code: 'auth/user-not-found' }); return u; },
    createUser: async ({ email, displayName, password }) => { assert.ok(password.length >= 24); const u = { uid: 'u' + ++uid, email, displayName, disabled: false }; authUsers.set(u.uid, u); calls.push(['create', email]); return u; },
    updateUser: async (id, patch) => { Object.assign(authUsers.get(id), patch); calls.push(['update', id, patch]); },
    revokeRefreshTokens: async (id) => calls.push(['revoke', id]),
    generatePasswordResetLink: async (email) => `https://reset.example/?e=${email}`,
  };
  return { db, auth, users, logs, authUsers, calls };
}
const rejects = async (p, code) => { try { await p; assert.fail('should reject ' + code); } catch (e) { assert.ok(e instanceof OrderError, e.stack); assert.equal(e.code, code); } };
let n = 0; const ok = (l) => console.log('  ok', ++n, l);

const env = makeEnv(); const { db, auth } = env;
const owner = await authenticate({ auth, db, idToken: 'tok-owner1' });
assert.deepEqual([owner.tenantId, owner.role], ['bynd', 'owner']); requireOwner(owner);
await rejects(authenticate({ auth, db, idToken: '' }), 'AUTH'); await rejects(authenticate({ auth, db, idToken: 'garbage' }), 'AUTH');
ok('caller identified from the login token; missing/invalid token refused');

// add a manager and a staff member
const m = await addMember({ auth, db, actor: owner, email: ' Mona@Example.com ', name: 'Mona', role: 'manager' });
const s = await addMember({ auth, db, actor: owner, email: 'sami@example.com', name: 'Sami', role: 'staff' });
assert.equal(env.users.get(m.uid).role, 'manager'); assert.equal(env.users.get(m.uid).tenantId, 'bynd'); assert.equal(env.users.get(m.uid).email, 'mona@example.com');
assert.ok(m.resetLink.includes('mona@example.com')); assert.ok(!JSON.stringify(m).includes('password'));
assert.equal(env.logs.length, 2); assert.equal(env.logs[0].action, 'team.add'); assert.equal(env.logs[0].actorUid, 'owner1'); assert.equal(env.logs[0].tenantId, 'bynd');
ok('owner adds team members (email normalised), gets a one-time link (no password), actions logged');

// validation
await rejects(addMember({ auth, db, actor: owner, email: 'bad', name: 'X Y', role: 'staff' }), 'BAD_EMAIL');
await rejects(addMember({ auth, db, actor: owner, email: 'a@b.co', name: 'X', role: 'staff' }), 'BAD_NAME');
await rejects(addMember({ auth, db, actor: owner, email: 'a@b.co', name: 'Xy', role: 'admin' }), 'BAD_ROLE');
await rejects(addMember({ auth, db, actor: owner, email: 'sami@example.com', name: 'Sami', role: 'staff' }), 'ALREADY_MEMBER');
await rejects(addMember({ auth, db, actor: owner, email: 'o@other.com', name: 'Oz', role: 'staff' }), 'EMAIL_TAKEN');
ok('bad email/name/role, existing member and another shop\'s person all refused (unknown roles refused)');

// an existing login with no shop is reused
env.authUsers.set('lonely', { uid: 'lonely', email: 'lonely@x.com', disabled: true });
const lone = await addMember({ auth, db, actor: owner, email: 'lonely@x.com', name: 'Lone', role: 'staff' });
assert.equal(lone.uid, 'lonely'); assert.equal(env.authUsers.get('lonely').disabled, false);
ok('a login that belongs to no shop is reused and switched on');

// list
const list = await listMembers({ auth, db, tenantId: 'bynd' });
assert.deepEqual(list.map((x) => x.role), ['owner', 'manager', 'staff', 'staff']); assert.equal(list[0].email, 'boss@x.com'); assert.equal(list[0].lastSignIn, 'today');
assert.ok(!list.some((x) => x.email === 'o@other.com'));
ok('team list: owner first, only this shop, includes last sign-in');

// update
await updateMember({ auth, db, actor: owner, uid: s.uid, role: 'manager' }); assert.equal(env.users.get(s.uid).role, 'manager');
await updateMember({ auth, db, actor: owner, uid: s.uid, active: false });
assert.equal(env.users.get(s.uid).active, false); assert.equal(env.authUsers.get(s.uid).disabled, true); assert.ok(env.calls.some((c) => c[0] === 'revoke' && c[1] === s.uid));
await updateMember({ auth, db, actor: owner, uid: s.uid, active: true }); assert.equal(env.authUsers.get(s.uid).disabled, false);
assert.deepEqual(env.logs.filter((l) => l.entityId === s.uid).map((l) => l.action), ['team.add', 'team.role', 'team.deactivate', 'team.activate']);
ok('role change, switch off (signs them out everywhere) and back on, each logged');
await rejects(updateMember({ auth, db, actor: owner, uid: 'owner1', role: 'staff' }), 'CANNOT_CHANGE_SELF');
await rejects(updateMember({ auth, db, actor: owner, uid: 'owner1', active: false }), 'CANNOT_CHANGE_SELF');
await rejects(updateMember({ auth, db, actor: owner, uid: 'other1', active: false }), 'NOT_FOUND');
await rejects(updateMember({ auth, db, actor: owner, uid: m.uid, role: 'admin' }), 'BAD_ROLE');
ok('nobody can change their own account; other shops\' people untouchable; unknown roles refused');

// ---- several owners (partners) ----
const partner = await addMember({ auth, db, actor: owner, email: 'partner@example.com', name: 'Partner Two', role: 'owner' });
assert.equal(env.users.get(partner.uid).role, 'owner'); assert.equal(env.logs.at(-1).changes[0].to, 'owner');
const owner2 = await authenticate({ auth, db, idToken: 'tok-' + partner.uid });
requireOwner(owner2);   // the second owner has the same powers
const third = await addMember({ auth, db, actor: owner2, email: 'third@example.com', name: 'Third Partner', role: 'owner' });
assert.equal(env.users.get(third.uid).role, 'owner');
assert.equal((await listMembers({ auth, db, tenantId: 'bynd' })).filter((x) => x.role === 'owner').length, 3);
ok('an owner can add another owner; the new owner can manage the team too (partners are equal)');
await updateMember({ auth, db, actor: owner2, uid: 'owner1', role: 'manager' });      // partner B demotes partner A
assert.equal(env.users.get('owner1').role, 'manager');
await updateMember({ auth, db, actor: owner2, uid: 'owner1', role: 'owner' });
await updateMember({ auth, db, actor: owner, uid: partner.uid, active: false });      // and the other way round
assert.equal(env.users.get(partner.uid).active, false);
await rejects(authenticate({ auth, db, idToken: 'tok-' + partner.uid }), 'FORBIDDEN');
await updateMember({ auth, db, actor: owner, uid: partner.uid, active: true });
assert.ok(env.logs.some((l) => l.actorUid === partner.uid && l.action === 'team.role' && l.entityId === 'owner1'));
ok('owners can change each other (not themselves), always recorded in the log; at least one owner always remains');

// non-owners are refused
const mgr = await authenticate({ auth, db, idToken: 'tok-' + m.uid });
assert.throws(() => requireOwner(mgr), (e) => e.code === 'FORBIDDEN');
await updateMember({ auth, db, actor: owner, uid: m.uid, active: false });
await rejects(authenticate({ auth, db, idToken: 'tok-' + m.uid }), 'FORBIDDEN');
ok('managers/staff can\'t manage the team; switched-off people are locked out');

// reset link
const link = await makeResetLink({ auth, db, actor: owner, uid: lone.uid }); assert.ok(link.resetLink.includes('lonely@x.com'));
await rejects(makeResetLink({ auth, db, actor: owner, uid: 'other1' }), 'NOT_FOUND');
ok('password link for a member of the shop only');

// ---- roles in the admin screens ----
assert.ok(can('owner', 'team') && !can('manager', 'team') && !can('staff', 'team'));
assert.ok(can('manager', 'products') && !can('staff', 'products') && can('staff', 'orders'));
assert.ok(!can('manager', 'settings') && can('owner', 'settings') && !can('staff', 'pnl') && can('manager', 'pnl'));
assert.ok(canSeeCosts('manager') && !canSeeCosts('staff') && canCancelOrders('manager') && !canCancelOrders('staff'));
assert.ok(!can(null, 'orders') && !can('hacker', 'orders'));
ok('roles: staff = orders only; manager = everything but team and settings; owner = all');
console.log(`\nALL ${n} TEAM CHECK GROUPS PASSED`);
