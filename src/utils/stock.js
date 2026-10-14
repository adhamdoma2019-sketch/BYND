// Stock rules in one place: adding stock (restock), correcting it (stocktake, damaged),
// and the cost price that follows. Everything here is plain maths, so it is tested.

export const MOVEMENT_TYPES = ['initial', 'restock', 'sale', 'adjustment', 'damaged', 'return', 'cancel'];
export const MAX_RESTOCK = 100000;

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const isBlank = (v) => v === '' || v === null || v === undefined;

// New cost per unit after adding a batch: the AVERAGE of what is on the shelf and the
// new batch ("weighted average"). If there is no stock or no known cost, the new
// batch's cost is simply the cost.
export function averageCost({ stock, cost, quantity, unitCost }) {
  const oldUnits = Math.max(Number(stock) || 0, 0);
  if (isBlank(cost) || oldUnits === 0) return round2(unitCost);
  return round2((oldUnits * Number(cost) + quantity * unitCost) / (oldUnits + quantity));
}

// Adding stock. `totalCost` = what the whole batch cost (empty = unknown, then the cost
// price and expenses are left alone). Returns { error } or the plan.
export function planRestock({ stock, cost, quantity, totalCost, updateCost = true }) {
  const q = Number(quantity);
  if (!Number.isInteger(q) || q < 1 || q > MAX_RESTOCK) return { error: 'BAD_QUANTITY' };
  let total = null;
  if (!isBlank(totalCost)) {
    total = Number(totalCost);
    if (!Number.isFinite(total) || total < 0) return { error: 'BAD_COST' };
  }
  const current = Math.max(Number(stock) || 0, 0);
  const unitCost = total === null ? null : round2(total / q);
  const knownCost = isBlank(cost) ? null : Number(cost);
  const newCost =
    updateCost && unitCost !== null
      ? averageCost({ stock: current, cost: knownCost, quantity: q, unitCost })
      : knownCost;
  return {
    quantity: q,
    totalCost: total,
    unitCost,
    newStock: current + q,
    newCost,
    costChanged: newCost !== knownCost,
  };
}

// Correcting stock.
//   mode 'count'   value = the REAL number on the shelf now (stocktake)
//   mode 'remove'  value = how many are damaged / lost
export function planAdjust({ stock, mode, value }) {
  const current = Math.max(Number(stock) || 0, 0);
  const v = Number(value);
  if (!Number.isInteger(v) || v < 0 || v > MAX_RESTOCK) return { error: 'BAD_QUANTITY' };
  if (mode === 'count') {
    if (v === current) return { error: 'NO_CHANGE' };
    return { type: 'adjustment', delta: v - current, newStock: v };
  }
  if (mode === 'remove') {
    if (v < 1) return { error: 'BAD_QUANTITY' };
    if (v > current) return { error: 'TOO_MANY' };
    return { type: 'damaged', delta: -v, newStock: current - v };
  }
  return { error: 'BAD_MODE' };
}

// One line of the stock history (the service adds the date).
export function buildMovement({
  tenantId,
  productId,
  productName,
  type,
  delta,
  stockAfter,
  unitCost = null,
  totalCost = null,
  note = '',
  orderId = '',
  orderLabel = '',
  actor,
}) {
  return {
    tenantId,
    productId,
    productName: productName || {},
    type,
    delta,
    stockAfter,
    unitCost,
    totalCost,
    note: String(note || '').slice(0, 200),
    orderId,
    orderLabel,
    actorUid: actor?.uid || '',
    actorName: String(actor?.name || actor?.email || '').slice(0, 80),
  };
}
