// Vercel "serverless function": the "Track my order" page calls /api/track.
// Public (no login). It needs the same FIREBASE_SERVICE_ACCOUNT setting as the other
// functions; nothing new to set up. It only READS orders and returns status + dates.

import { getDb } from './_lib/db.js';
import { OrderError } from './_lib/errors.js';
import { trackOrder } from './_lib/track.js';
import { clientIp, hashKey, hasRoom, countUse, LIMITS } from './_lib/rateLimit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.', code: 'METHOD' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        throw new OrderError(400, 'BAD_REQUEST', 'Invalid request.');
      }
    }

    const db = getDb();

    // Every attempt counts against the visitor's connection, right or wrong.
    const ipKey = `track-ip-${hashKey(clientIp(req))}`;
    if (!(await hasRoom(db, ipKey, LIMITS.trackIp))) {
      throw new OrderError(429, 'RATE_LIMITED', 'Too many attempts. Please try again later.');
    }
    await countUse(db, ipKey, LIMITS.trackIp);

    const result = await trackOrder(db, {
      tenantId: body?.tenantId,
      orderNumber: body?.orderNumber,
      phone: body?.phone,
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof OrderError) {
      return res.status(err.status).json({ error: err.message, code: err.code, meta: err.meta });
    }
    console.error('track failed:', err);
    return res.status(500).json({ error: 'Could not check the order. Please try again.', code: 'SERVER' });
  }
}
