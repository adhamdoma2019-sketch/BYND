// Admin-only helper for setting up Telegram alerts:
//   { action: 'discover' }                -> chats the bot has recently seen
//   { action: 'test', chatId?, language? } -> sends a test message
// The caller must be a signed-in member of a shop (checked with their login token).

import { getAuth } from 'firebase-admin/auth';
import { getDb } from './_lib/db.js';
import { discoverChats, sendTelegram, buildTestMessage } from './_lib/telegram.js';

function send(res, status, body) {
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { ok: false, error: 'METHOD' });
  }

  try {
    const db = getDb();

    // 1) Who is calling? Verify their login token.
    const header = req.headers.authorization || '';
    const idToken = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!idToken) return send(res, 401, { ok: false, error: 'AUTH' });
    let uid;
    try {
      uid = (await getAuth().verifyIdToken(idToken)).uid;
    } catch {
      return send(res, 401, { ok: false, error: 'AUTH' });
    }

    // 2) Which shop do they belong to?
    const userSnap = await db.collection('users').doc(uid).get();
    const tenantId = userSnap.exists ? userSnap.data().tenantId : null;
    if (!tenantId) return send(res, 403, { ok: false, error: 'AUTH' });

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (body?.action === 'discover') {
      return send(res, 200, await discoverChats({ token }));
    }

    if (body?.action === 'test') {
      const tenantSnap = await db.collection('tenants').doc(tenantId).get();
      const shop = tenantSnap.data()?.name || {};
      const privateSnap = await db.collection('tenantPrivate').doc(tenantId).get();
      const saved = privateSnap.exists ? privateSnap.data() : {};
      const chatId = String(body.chatId || saved.telegramChatId || '').trim();
      const lang = (body.language || saved.notifyLanguage) === 'ar' ? 'ar' : 'en';
      const result = await sendTelegram({
        token,
        chatId,
        text: buildTestMessage(shop[lang] || shop.en || 'your shop', lang),
      });
      return send(res, result.ok ? 200 : 400, result);
    }

    return send(res, 400, { ok: false, error: 'BAD_ACTION' });
  } catch (err) {
    console.error('telegram helper failed');
    return send(res, 500, { ok: false, error: 'SERVER' });
  }
}
