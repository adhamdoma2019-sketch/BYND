// New-order alerts through Telegram (free, instant, works for a whole team).
//
// One bot (created with Telegram's @BotFather) serves the platform; its secret
// token lives ONLY in Vercel's settings as TELEGRAM_BOT_TOKEN. Each shop saves
// the id of its own Telegram chat/group in Admin > Settings.

const LABELS = {
  en: {
    newOrder: 'New order',
    preorder: 'Preorder',
    total: 'Total',
    customer: 'Customer',
    phone: 'Phone',
    address: 'Address',
    items: 'Items',
    notes: 'Notes',
    open: 'Open orders',
    test: 'Test message: order alerts from {shop} are working.',
  },
  ar: {
    newOrder: 'طلب جديد',
    preorder: 'حجز مسبق',
    total: 'الإجمالي',
    customer: 'العميل',
    phone: 'الهاتف',
    address: 'العنوان',
    items: 'المنتجات',
    notes: 'ملاحظات',
    open: 'فتح الطلبات',
    test: 'رسالة تجريبية: تنبيهات الطلبات من {shop} تعمل بنجاح.',
  },
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const pick = (obj, lang) => (obj && (obj[lang] || obj.en)) || '';

export function buildTestMessage(shopName, lang = 'en') {
  const labels = LABELS[lang] || LABELS.en;
  return `✅ ${escapeHtml(labels.test.replace('{shop}', shopName))}`;
}

// order = the saved order document; returns the text sent to Telegram (HTML).
export function buildOrderMessage({ order, orderNumberLabel, adminUrl }, lang = 'en') {
  const L = LABELS[lang] || LABELS.en;
  const c = order.customer || {};
  const lines = [];

  lines.push(
    `🛒 <b>${escapeHtml(L.newOrder)} ${escapeHtml(orderNumberLabel)}</b>` +
      (order.orderType === 'preorder' ? ` · ${escapeHtml(L.preorder)}` : '')
  );
  lines.push(`${escapeHtml(L.total)}: <b>${escapeHtml(order.totalAmount)} EGP</b>`);
  lines.push('');
  lines.push(`${escapeHtml(L.customer)}: ${escapeHtml(c.name)}`);
  lines.push(`${escapeHtml(L.phone)}: ${escapeHtml(c.phone)}`);
  if (c.address) lines.push(`${escapeHtml(L.address)}: ${escapeHtml(c.address)}`);
  if (order.shipping?.zoneName) {
    lines.push(`📍 ${escapeHtml(pick(order.shipping.zoneName, lang))}`);
  }
  lines.push('');
  lines.push(`${escapeHtml(L.items)}:`);
  for (const item of order.items || []) {
    lines.push(`• ${escapeHtml(item.quantity)} × ${escapeHtml(pick(item.name, lang))}`);
  }
  for (const f of order.customFields || []) {
    const value =
      f.type === 'checkbox' ? '✓' : typeof f.value === 'object' ? pick(f.value, lang) : f.value;
    lines.push(`${escapeHtml(pick(f.label, lang))}: ${escapeHtml(value)}`);
  }
  if (c.notes) lines.push(`${escapeHtml(L.notes)}: ${escapeHtml(c.notes)}`);
  if (adminUrl) lines.push('', `${escapeHtml(L.open)}: ${escapeHtml(adminUrl)}`);

  return lines.join('\n');
}

// Sends one message. Never throws: returns { ok, error }.
export async function sendTelegram({ token, chatId, text, fetchImpl = fetch, timeoutMs = 4000 }) {
  if (!token) return { ok: false, error: 'NOT_CONFIGURED' };
  if (!chatId) return { ok: false, error: 'NO_CHAT' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      return { ok: false, error: 'TELEGRAM_REFUSED', detail: data.description || '' };
    }
    return { ok: true };
  } catch {
    // Careful: the error text could contain the URL (and the token), so it is never logged.
    return { ok: false, error: 'NETWORK' };
  } finally {
    clearTimeout(timer);
  }
}

// Chats the bot has recently seen (it was added to a group, or someone wrote to it).
// Used by the "Find my chat" button so nobody has to dig for a chat id.
export function parseChats(updates) {
  const seen = new Map();
  for (const update of [...updates].reverse()) {
    const chat =
      update.message?.chat ||
      update.my_chat_member?.chat ||
      update.channel_post?.chat ||
      update.edited_message?.chat;
    if (!chat || seen.has(chat.id)) continue;
    const title =
      chat.title ||
      [chat.first_name, chat.last_name].filter(Boolean).join(' ') ||
      chat.username ||
      String(chat.id);
    seen.set(chat.id, { id: String(chat.id), title, type: chat.type });
  }
  return [...seen.values()];
}

export async function discoverChats({ token, fetchImpl = fetch, timeoutMs = 5000 }) {
  if (!token) return { ok: false, error: 'NOT_CONFIGURED', chats: [] };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`https://api.telegram.org/bot${token}/getUpdates?limit=100`, {
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      return { ok: false, error: 'TELEGRAM_REFUSED', chats: [] };
    }
    return { ok: true, chats: parseChats(data.result || []) };
  } catch {
    return { ok: false, error: 'NETWORK', chats: [] };
  } finally {
    clearTimeout(timer);
  }
}
