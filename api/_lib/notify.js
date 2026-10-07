// Sends the "new order" alert after an order is saved. It never makes the
// customer's order fail: if the alert can't be sent, the order is still fine.

import { buildOrderMessage, sendTelegram } from './telegram.js';

export async function notifyNewOrder(db, { tenantId, orderNumberLabel, order }) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;

    // Private settings: only the shop's team can edit them; customers can't read them.
    const snap = await db.collection('tenantPrivate').doc(tenantId).get();
    const settings = snap.exists ? snap.data() : null;
    if (!settings?.telegramChatId) return;

    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const text = buildOrderMessage(
      {
        order,
        orderNumberLabel,
        adminUrl: host ? `https://${host}/admin/orders` : '',
      },
      settings.notifyLanguage === 'ar' ? 'ar' : 'en'
    );
    const result = await sendTelegram({ token, chatId: settings.telegramChatId, text });
    if (!result.ok) console.error('order alert not sent:', result.error);
  } catch {
    console.error('order alert failed');
  }
}
