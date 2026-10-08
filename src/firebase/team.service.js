import { auth } from './config';

// Talks to /api/team. The server checks that you are the OWNER of the shop.
async function call(body) {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch('/api/team', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return response.json().catch(() => ({ ok: false, error: 'SERVER' }));
}

export const listTeam = () => call({ action: 'list' });
export const addTeamMember = (member) => call({ action: 'add', ...member }); // { email, name, role }
export const updateTeamMember = (uid, patch) => call({ action: 'update', uid, ...patch }); // { role?, active? }
export const getResetLink = (uid) => call({ action: 'resetLink', uid });
