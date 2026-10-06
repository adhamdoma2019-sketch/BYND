// Opens the Firestore database from the server, using the secret key stored in
// Vercel's settings (FIREBASE_SERVICE_ACCOUNT). Never put that key in code.
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export function getDb() {
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
