// Vercel "serverless function": the checkout page calls /api/quote to show the
// customer subtotal, discount, shipping and total BEFORE they place the order.
// Nothing is saved here.

import { getDb } from './_lib/db.js';
import { validateInput, OrderError } from './_lib/placeOrder.js';
import { getQuote } from './_lib/quote.js';

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

    // Same checks as a real order, except the customer's details (not needed yet).
    const input = validateInput({ ...body, customer: {} });
    const result = await getQuote(getDb(), input);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof OrderError) {
      return res
        .status(err.status)
        .json({ error: err.message, code: err.code, meta: err.meta });
    }
    console.error('quote failed:', err);
    return res.status(500).json({ error: 'Could not calculate the total.', code: 'SERVER' });
  }
}
