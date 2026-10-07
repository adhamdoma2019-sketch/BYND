import { auth } from './config';

// Talks to /api/telegram (the server checks that you are a signed-in team member).
async function call(body) {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch('/api/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return response.json().catch(() => ({ ok: false, error: 'SERVER' }));
}

// Chats the bot has recently seen -> { ok, chats: [{ id, title, type }] }
export const findTelegramChats = () => call({ action: 'discover' });

// Sends a test message -> { ok, error? }
export const sendTelegramTest = (chatId, language) => call({ action: 'test', chatId, language });
