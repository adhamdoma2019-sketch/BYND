// The customer's receipt (update 34): what the thank-you page shows and what "Save as picture", "Save as PDF" and
// "Email it to myself" produce. The receipt itself comes from the server (api/_lib/receipt.js, built from the saved order).
// Everything here is pure (no browser needed) so it can be tested; the drawing is in receiptImage.js.
import { formatPrice } from './format.js';

const pick = (v, language) => (v && typeof v === 'object' ? v[language] || v.en || '' : v || '');
const two = (n) => String(n).padStart(2, '0');

// "2026-11-05 14:32" in the customer's own clock (same digits in both languages)
export function receiptDate(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

// "Colour: Black" / "Name on top: Adham" / "Gold finish: Yes — “text”"
export function optionLine(o, language, t) {
  const label = pick(o.label, language);
  if (o.type === 'addon') return `${label}: ${o.text ? `${t('orders.yes')} — “${o.text}”` : t('orders.yes')}`;
  return `${label}: ${pick(o.value, language)}`;
}

// The receipt as a list of rows. Row kinds: title, subtitle, rule, gap, pair {label,value}, item {name, amount, details[], tag},
// total {label,value}, note {text}. `t` = the i18next function, `siteUrl` = where "Track my order" lives.
export function receiptModel(receipt, { language = 'en', shopName = '', t, trackUrl = '' }) {
  const money = (n) => formatPrice(n, language);
  const rows = [];
  if (shopName) rows.push({ kind: 'title', text: shopName });
  rows.push({ kind: 'subtitle', text: t('receipt.title') });
  rows.push({ kind: 'rule' });
  rows.push({ kind: 'pair', label: t('checkout.orderNumber'), value: receipt.orderNumberLabel, strong: true });
  const date = receiptDate(receipt.placedAt);
  if (date) rows.push({ kind: 'pair', label: t('receipt.date'), value: date });
  const c = receipt.customer || {};
  if (c.name) rows.push({ kind: 'pair', label: t('checkoutFields.name'), value: c.name });
  if (c.phone) rows.push({ kind: 'pair', label: t('checkoutFields.phone'), value: c.phone });
  if (c.address) rows.push({ kind: 'pair', label: t('checkout.address'), value: c.address });
  rows.push({ kind: 'rule' });
  for (const i of receipt.items || []) {
    rows.push({
      kind: 'item',
      name: `${pick(i.name, language)} × ${i.quantity}`,
      amount: money(i.amount),
      details: (i.options || []).map((o) => optionLine(o, language, t)),
      tag: i.madeToOrder ? t('receipt.madeToOrder') : '',
    });
  }
  rows.push({ kind: 'rule' });
  rows.push({ kind: 'pair', label: t('storefront.subtotal'), value: money(receipt.subtotal) });
  if (receipt.discount > 0) {
    rows.push({
      kind: 'pair',
      label: receipt.promoCode ? `${t('checkout.discount')} (${receipt.promoCode})` : t('checkout.discount'),
      value: `− ${money(receipt.discount)}`,
    });
  }
  rows.push({
    kind: 'pair',
    label: receipt.zoneName ? `${t('checkout.shipping')} (${receipt.zoneName})` : t('checkout.shipping'),
    value: receipt.shippingFee > 0 ? money(receipt.shippingFee) : t('checkout.free'),
  });
  rows.push({ kind: 'total', label: t('checkout.total'), value: money(receipt.totalAmount) });
  rows.push({ kind: 'pair', label: t('checkout.paymentMethod'), value: t('checkout.cod') });
  rows.push({ kind: 'rule' });
  rows.push({ kind: 'note', text: t('receipt.trackNote', { url: trackUrl || '' }) });
  return rows;
}

// The same receipt as plain text (the email body). `compact` leaves out the option lines of every item.
export function receiptText(rows, { compact = false } = {}) {
  const out = [];
  for (const r of rows) {
    if (r.kind === 'title' || r.kind === 'subtitle') out.push(r.text);
    else if (r.kind === 'rule') out.push('--------------------');
    else if (r.kind === 'pair' || r.kind === 'total') out.push(`${r.label}: ${r.value}`);
    else if (r.kind === 'item') {
      out.push(`${r.name} — ${r.amount}${r.tag ? ` (${r.tag})` : ''}`);
      if (!compact) for (const d of r.details) out.push(`   ${d}`);
    } else if (r.kind === 'note') out.push(r.text);
  }
  return out.join('\n');
}

// A link that opens the customer's OWN email app with the receipt typed in (nothing is sent by the shop).
// Long receipts are shortened so the link stays small enough for every email app.
export function mailtoLink({ to = '', subject, rows }) {
  const make = (compact) =>
    `mailto:${to ? encodeURIComponent(to) : ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
      receiptText(rows, { compact }).replace(/\n/g, '\r\n')
    )}`;
  const full = make(false);
  return full.length <= 1900 ? full : make(true);
}

// ----- PDF: one page holding the receipt picture (works for Arabic too, no fonts needed) -----
const A4_W = 595.28;
const A4_H = 841.89;
const ascii = (s) => Uint8Array.from(s, (ch) => ch.charCodeAt(0) & 0xff);

// jpeg = Uint8Array of a JPEG file, width/height in pixels. Returns the bytes of a valid PDF.
export function pdfFromJpeg(jpeg, width, height) {
  const imgH = +((A4_W * height) / width).toFixed(2);
  const pageH = Math.max(A4_H, imgH);
  const y = +(pageH - imgH).toFixed(2); // the picture sits at the top of the page
  const content = `q ${A4_W} 0 0 ${imgH} 0 ${y} cm /Im0 Do Q`;
  const chunks = [];
  const offsets = [];
  let length = 0;
  const push = (bytes) => {
    chunks.push(bytes);
    length += bytes.length;
  };
  const obj = (n, head, stream) => {
    offsets[n] = length;
    push(ascii(`${n} 0 obj\n${head}\n`));
    if (stream) {
      push(ascii('stream\n'));
      push(stream);
      push(ascii('\nendstream\n'));
    }
    push(ascii('endobj\n'));
  };
  push(ascii('%PDF-1.4\n'));
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_W} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`
  );
  obj(
    4,
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`,
    jpeg
  );
  obj(5, `<< /Length ${content.length} >>`, ascii(content));
  const xref = length;
  let table = `xref\n0 6\n0000000000 65535 f \n`;
  for (let n = 1; n <= 5; n += 1) table += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  push(ascii(`${table}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

// "data:image/jpeg;base64,...." -> bytes
export function dataUrlToBytes(dataUrl) {
  const b64 = String(dataUrl).split(',')[1] || '';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
