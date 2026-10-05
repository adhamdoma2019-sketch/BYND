// Profit maths in one place (used by the P&L screen and the Orders screen).
//
//   Revenue            = money from DELIVERED orders
//   - Cost of goods    = what the sold products cost us (snapshotted in each order)
//   = Gross profit
//   - Expenses         = packaging, marketing, shipping we paid, tools, ...
//   = Net profit

// Cost of one order. `complete` is false if any item has no cost recorded
// (for example orders placed before cost prices were set up).
export function orderCost(order) {
  let cogs = 0;
  let complete = true;
  for (const item of order.items || []) {
    if (item.unitCost === null || item.unitCost === undefined) {
      complete = false;
      continue;
    }
    cogs += Number(item.unitCost) * Number(item.quantity);
  }
  return { cogs, complete };
}

// When an order was delivered (from its status history), else when it was created.
export function deliveredDate(order) {
  const entry = [...(order.statusHistory || [])]
    .reverse()
    .find((h) => h.status === 'delivered');
  if (entry?.timestamp) return new Date(entry.timestamp);
  if (order.createdAt?.seconds) return new Date(order.createdAt.seconds * 1000);
  return null;
}

export function monthKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// period: 'all' | 'thisMonth' | 'lastMonth'
function inPeriod(key, period, now = new Date()) {
  if (period === 'all') return true;
  if (!key) return false;
  const current = monthKey(now);
  if (period === 'thisMonth') return key === current;
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return key === monthKey(last);
}

export function calcProfit(orders, expenses, period = 'all', now = new Date()) {
  const delivered = orders.filter((o) => {
    if (o.status !== 'delivered') return false;
    const d = deliveredDate(o);
    return inPeriod(d ? monthKey(d) : null, period, now);
  });

  let revenue = 0;
  let cogs = 0;
  let ordersMissingCost = 0;
  for (const o of delivered) {
    revenue += Number(o.totalAmount) || 0;
    const c = orderCost(o);
    cogs += c.cogs;
    if (!c.complete) ordersMissingCost += 1;
  }

  const expensesTotal = expenses
    .filter((e) => inPeriod((e.date || '').slice(0, 7), period, now))
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Orders still on their way: not profit yet, shown for information only.
  const expectedRevenue = orders
    .filter((o) => o.status !== 'delivered' && o.status !== 'cancelled')
    .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

  const grossProfit = revenue - cogs;
  return {
    revenue,
    cogs,
    grossProfit,
    expensesTotal,
    netProfit: grossProfit - expensesTotal,
    expectedRevenue,
    ordersMissingCost,
    deliveredCount: delivered.length,
  };
}
