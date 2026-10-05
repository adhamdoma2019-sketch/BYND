// Vercel "serverless function": the website calls /api/create-order when a
// customer presses "Place order". It runs on Vercel's servers, not in the browser.
//
// It needs ONE secret setting in Vercel called FIREBASE_SERVICE_ACCOUNT
// (a key that lets this server write to Firestore). That key must never be
// placed in the code or sent to anyone.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { validateInput, placeOrder, OrderError } from './_lib/placeOrder.js';

function getDb() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
    const account = JSON.parse(raw);
    // Keys pasted into settings sometimes have "\n" as text; turn them back into line breaks.
    account.private_key = account.private_key.replace(/\\n/g, '\n');
    initializeApp({ credential: cert(account) });
  }
  return getFirestore();
}

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
    const result = await placeOrder(getDb(), input);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof OrderError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    console.error('create-order failed:', err);
    return res
      .status(500)
      .json({ error: 'Could not place the order. Please try again.', code: 'SERVER' });
  }
}
