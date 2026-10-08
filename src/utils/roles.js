// Who may open which part of the admin.
//   owner    everything, including the team and the shop settings (a shop can have several)
//   manager  everything except the team and the shop settings
//   staff    orders only (move them along, fix the customer's details)
//
// The database rules (firestore.rules) enforce the same limits, so hiding a
// button here is a convenience, never the only protection.
export const ROLES = ['owner', 'manager', 'staff'];
export const ASSIGNABLE_ROLES = ['owner', 'manager', 'staff']; // a shop can have several owners (partners)

export const ACCESS = {
  orders: ['owner', 'manager', 'staff'],
  products: ['owner', 'manager'],
  expenses: ['owner', 'manager'],
  pnl: ['owner', 'manager'],
  promos: ['owner', 'manager'],
  activity: ['owner', 'manager'],
  settings: ['owner'],
  team: ['owner'],
};

export const can = (role, area) => (ACCESS[area] || []).includes(role);
export const canSeeCosts = (role) => role === 'owner' || role === 'manager';
export const canCancelOrders = (role) => role === 'owner' || role === 'manager';
