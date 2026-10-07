// Vercel "serverless function": the website calls /api/create-order when a
// customer presses "Place order". It runs on Vercel's servers, not in the browser.
//
// It needs ONE secret setting in Vercel called FIREBASE_SERVICE_ACCOUNT
// (a key that lets this server write to Firestore). That key must never be
// placed in the code or sent to anyone.

import { getDb } from './_lib/db.js';
import { waitUntil } from '@vercel/functions';
import { validateInput, placeOrder, OrderError } from './_lib/placeOrder.js';
import { notifyNewOrder } from './_lib/notify.js';

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

    const input = validateInput(body);
    const db = getDb();
    const { _order, ...result } = await placeOrder(db, input);

    // Tell the team on Telegram. waitUntil lets Vercel finish this in the
    // background, so the customer isn't kept waiting.
    waitUntil(
      notifyNewOrder(db, {
        tenantId: input.tenantId,
        orderNumberLabel: result.orderNumberLabel,
        order: _order,
      })
    );

    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof OrderError) {
      return res
        .status(err.status)
        .json({ error: err.message, code: err.code, meta: err.meta });
    }
    console.error('create-order failed:', err);
    return res
      .status(500)
      .json({ error: 'Could not place the order. Please try again.', code: 'SERVER' });
  }
}
