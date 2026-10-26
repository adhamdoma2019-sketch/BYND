// Order statuses and the rules about moving between them.
//
//   pending -> confirmed -> processing -> shipped -> delivered      (normal flow)
//   cancelled   the order was stopped before it was delivered
//   returned    the parcel came back (refused / failed delivery / sent back later)

export const STATUS_FLOW = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
export const ALL_STATUSES = [...STATUS_FLOW, 'cancelled', 'returned'];

export function nextStatus(current) {
  const idx = STATUS_FLOW.indexOf(current);
  if (idx === -1 || idx === STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[idx + 1];
}

// A parcel can only come back after it has been shipped.
export const canReturnStatus = (status) => status === 'shipped' || status === 'delivered';
// Cancelling is for orders that haven't been delivered (use "returned" after that).
export const canCancelStatus = (status) =>
  status !== 'delivered' && status !== 'cancelled' && status !== 'returned';

// How many units go back on the shelf when an order is cancelled or returned:
// ONE total per product (an order can hold the same product on several lines, for
// example in different colors), and nothing for preorder lines (they never used stock).
export function stockToRestore(order) {
  const totals = new Map();
  for (const item of order.items || []) {
    if (item.isPreorder) continue;
    totals.set(item.productId, (totals.get(item.productId) || 0) + (Number(item.quantity) || 0));
  }
  return [...totals].map(([productId, quantity]) => ({ productId, quantity }));
}

// Same, but with the detail needed when stock is counted per colour / option:
//   quantity       all units of the product on lines that used stock
//   plainQuantity  units on lines that did NOT record which colour / option numbers they used
//   keys           { "<optionId>.<valueId>": units } taken from each counted number
export function stockToRestoreDetailed(order) {
  const map = new Map();
  for (const item of order.items || []) {
    if (item.isPreorder) continue;
    const q = Number(item.quantity) || 0;
    const entry = map.get(item.productId) || { productId: item.productId, quantity: 0, plainQuantity: 0, keys: {} };
    entry.quantity += q;
    if (Array.isArray(item.stockKeys) && item.stockKeys.length > 0) {
      for (const key of item.stockKeys) entry.keys[key] = (entry.keys[key] || 0) + q;
    } else {
      entry.plainQuantity += q;
    }
    map.set(item.productId, entry);
  }
  return [...map.values()];
}

// Colors of the little status label (same on the Orders page and the dashboard).
export function statusBadgeClass(status) {
  if (status === 'delivered') return 'bg-sage/15 text-sage-dark';
  if (status === 'cancelled' || status === 'returned') return 'bg-rust/15 text-rust';
  if (status === 'shipped') return 'bg-brass/15 text-brass-dark';
  if (status === 'confirmed') return 'bg-sage/10 text-sage-dark';
  return 'bg-paper-dim text-ink-soft';
}

