// What goes into each exported spreadsheet (orders for the courier and accountant,
// products, expenses). `t` is the translate function, so headers follow the language.

import { toCsv } from './csv.js';
import { expectedCash } from './couriers.js';

const pick = (obj, language) => (obj && (obj[language] || obj.en)) || '';

function when(ts) {
  const seconds = ts?.seconds;
  if (!seconds) return '';
  const d = new Date(seconds * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function optionText(o, language, yes) {
  const label = pick(o.label, language);
  if (o.type === 'addon') return o.text ? `${label}: ${yes} "${o.text}"` : `${label}: ${yes}`;
  return `${label}: ${typeof o.value === 'object' ? pick(o.value, language) : o.value}`;
}

// includeCourierFee: only owners / managers (the courier's fee is money information).
export function ordersToCsv(orders, { language, t, includeCourierFee = false }) {
  const itemsText = (order) =>
    (order.items || [])
      .map((i) => {
        const opts = (i.options || []).map((o) => optionText(o, language, t('orders.yes'))).join(', ');
        return `${i.quantity} × ${pick(i.name, language)}${opts ? ` (${opts})` : ''}`;
      })
      .join(' | ');
  const extras = (order) =>
    (order.customFields || [])
      .map((f) => `${pick(f.label, language)}: ${typeof f.value === 'object' ? pick(f.value, language) : f.value === true ? t('orders.yes') : f.value}`)
      .join(' | ');

  const courierColumns = [
    { header: t('exports.courier'), value: (o) => o.courier?.name || '' },
    { header: t('exports.courierCash'), value: (o) => (o.courier ? expectedCash(o) : '') },
  ];
  if (includeCourierFee) {
    courierColumns.push({ header: t('exports.courierFee'), value: (o) => (o.courier ? o.courier.fee ?? 0 : '') });
  }

  return toCsv(
    [
      { header: t('exports.orderNo'), value: (o) => o.orderNumberLabel || o.orderNumber },
      { header: t('exports.date'), value: (o) => when(o.createdAt) },
      { header: t('exports.status'), value: (o) => t(`admin.status.${o.status}`, { defaultValue: o.status }) },
      { header: t('exports.type'), value: (o) => (o.orderType === 'preorder' ? t('orders.preorder') : '') },
      { header: t('exports.customer'), value: (o) => o.customer?.name },
      { header: t('exports.phone'), value: (o) => o.customer?.phone },
      { header: t('exports.city'), value: (o) => o.customer?.city || '' },
      { header: t('exports.address'), value: (o) => o.customer?.address },
      { header: t('exports.items'), value: itemsText },
      { header: t('exports.subtotal'), value: (o) => o.subtotal ?? '' },
      { header: t('exports.discount'), value: (o) => o.discount || 0 },
      { header: t('exports.promo'), value: (o) => o.promo?.code || '' },
      { header: t('exports.zone'), value: (o) => pick(o.shipping?.zoneName, language) },
      { header: t('exports.shipping'), value: (o) => o.shippingFee || 0 },
      { header: t('exports.total'), value: (o) => o.totalAmount ?? '' },
      ...courierColumns,
      { header: t('exports.extra'), value: extras },
      { header: t('exports.notes'), value: (o) => o.customer?.notes || '' },
    ],
    orders
  );
}

export function productsToCsv(products, costs, { language, t, includeCost }) {
  const columns = [
    { header: t('exports.sku'), value: (p) => p.sku || '' },
    { header: t('exports.name'), value: (p) => pick(p.name, language) },
    { header: t('exports.price'), value: (p) => p.price },
  ];
  if (includeCost) columns.push({ header: t('exports.cost'), value: (p) => costs?.[p.id] ?? '' });
  columns.push(
    { header: t('exports.stock'), value: (p) => (p.isPreorder ? '' : p.stock) },
    { header: t('exports.preorder'), value: (p) => (p.isPreorder ? t('orders.yes') : '') },
    { header: t('exports.active'), value: (p) => (p.isActive ? t('orders.yes') : '') }
  );
  return toCsv(columns, products);
}

export function expensesToCsv(expenses, { t }) {
  return toCsv(
    [
      { header: t('exports.date'), value: (e) => e.date },
      { header: t('exports.category'), value: (e) => t(`expenses.cat.${e.category}`, { defaultValue: e.category }) },
      { header: t('exports.description'), value: (e) => e.description || '' },
      { header: t('exports.amount'), value: (e) => e.amount },
    ],
    expenses
  );
}

// The daily courier report as a spreadsheet: one line per delivered / returned order.
// `report` comes from courierDayReport(...). Only owners / managers open this page.
export function courierDayToCsv(report, { language, t }) {
  const lines = [];
  for (const r of report) for (const x of r.orders) lines.push({ courier: r.name, ...x });
  return toCsv(
    [
      { header: t('exports.courier'), value: (l) => l.courier },
      { header: t('exports.orderNo'), value: (l) => l.order.orderNumberLabel || l.order.orderNumber },
      { header: t('exports.status'), value: (l) => t(`admin.status.${l.status}`, { defaultValue: l.status }) },
      { header: t('exports.zone'), value: (l) => pick(l.order.shipping?.zoneName, language) },
      { header: t('exports.cashCollected'), value: (l) => l.cash },
      { header: t('exports.courierFee'), value: (l) => l.fee },
    ],
    lines
  );
}
