// The numbers on the dashboard, worked out from the shop's orders, products and expenses.

import { calcProfit, inPeriod, monthKey } from './profit.js';
import { tracksStock } from './storefront.js';
import { LOW_STOCK_THRESHOLD } from './constants.js';

const createdAt = (o) => (o.createdAt?.seconds ? o.createdAt.seconds * 1000 : 0);

export function calcDashboard({
  orders,
  products,
  costs = {},
  expenses = [],
  period = 'thisMonth',
  now = new Date(),
}) {
  // How many orders are in each situation right now.
  const counts = { pending: 0, inProgress: 0, delivered: 0, cancelled: 0, returned: 0, total: orders.length };
  for (const o of orders) {
    if (o.status === 'pending') counts.pending += 1;
    else if (['confirmed', 'processing', 'shipped'].includes(o.status)) counts.inProgress += 1;
    else if (o.status === 'delivered') counts.delivered += 1;
    else if (o.status === 'cancelled') counts.cancelled += 1;
    else if (o.status === 'returned') counts.returned += 1;
  }

  // Money for the chosen period (delivered orders only; see profit.js).
  const sales = calcProfit(orders, expenses, period, now);
  const ordersInPeriod = orders.filter((o) =>
    inPeriod(createdAt(o) ? monthKey(new Date(createdAt(o))) : null, period, now)
  ).length;

  // Stock on the shelf (preorder products don't use stock).
  const shelf = products.filter(tracksStock);
  let valueAtCost = 0;
  let valueKnown = true;
  for (const p of shelf) {
    const stock = Math.max(Number(p.stock) || 0, 0);
    if (costs[p.id] === null || costs[p.id] === undefined) {
      if (stock > 0) valueKnown = false;
    } else {
      valueAtCost += stock * Number(costs[p.id]);
    }
  }
  const lowStock = shelf
    .filter((p) => (Number(p.stock) || 0) <= LOW_STOCK_THRESHOLD)
    .sort((a, b) => (Number(a.stock) || 0) - (Number(b.stock) || 0));

  const inventory = {
    units: shelf.reduce((sum, p) => sum + Math.max(Number(p.stock) || 0, 0), 0),
    valueAtCost,
    valueKnown, // false when some products with stock have no cost price yet
    lowStock,
  };

  const recent = [...orders].sort((a, b) => createdAt(b) - createdAt(a)).slice(0, 8);
  return { counts, sales, ordersInPeriod, inventory, recent };
}

// Days since the last backup was downloaded (null = never).
export function daysSince(isoString, now = new Date()) {
  if (!isoString) return null;
  const then = new Date(isoString).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.floor((now.getTime() - then) / 86400000);
}
