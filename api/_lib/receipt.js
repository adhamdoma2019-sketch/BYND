// The receipt the customer gets right after ordering (update 34).
// It is built here, on the SERVER, from the order that was just saved, so the receipt always shows what was really
// recorded (the real prices, the real totals), never what the browser thought. It is sent back only to the customer who
// placed the order (in the answer of /api/create-order); nothing about it is stored or readable by anyone else.
// The browser turns it into a picture, a PDF or an email draft (src/utils/receipt.js).

const text = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const bi = (v) => ({ en: text(v?.en), ar: text(v?.ar) || text(v?.en) });

// what the customer chose on a line: [{ label{en,ar}, type, value ({en,ar} or text), color?, text? }]
function cleanOptions(options) {
  return (Array.isArray(options) ? options : []).slice(0, 12).map((o) => ({
    label: bi(o?.label),
    type: text(o?.type, 20),
    value: o?.value && typeof o.value === 'object' ? bi(o.value) : text(o?.value, 120),
    ...(typeof o?.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(o.color) ? { color: o.color } : {}),
    ...(o?.text ? { text: text(o.text, 120) } : {}),
  }));
}

export function buildReceipt(order) {
  const c = order?.customer || {};
  return {
    orderNumberLabel: text(order?.orderNumberLabel, 40),
    orderType: order?.orderType === 'preorder' ? 'preorder' : 'normal',
    placedAt: text(order?.statusHistory?.[0]?.timestamp, 40),
    customer: {
      name: text(c.name),
      phone: text(c.phone, 40),
      email: text(c.email, 120),
      address: text(c.address, 300),
    },
    items: (Array.isArray(order?.items) ? order.items : []).map((i) => ({
      name: bi(i?.name),
      quantity: num(i?.quantity),
      // the exact money of the line (package-price lines carry lineTotal)
      amount: i?.lineTotal !== undefined && i?.lineTotal !== null ? num(i.lineTotal) : num(i?.subtotal),
      options: cleanOptions(i?.options),
      madeToOrder: i?.isPreorder === true,
    })),
    subtotal: num(order?.subtotal),
    discount: num(order?.discount),
    promoCode: text(order?.promo?.code, 40),
    shippingFee: num(order?.shippingFee),
    zoneName: text(order?.shipping?.zoneName, 80),
    totalAmount: num(order?.totalAmount),
    paymentMethod: 'COD',
  };
}
