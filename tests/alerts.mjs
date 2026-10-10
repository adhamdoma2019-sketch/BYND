import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildOrderMessage, buildTestMessage, sendTelegram, parseChats, discoverChats } from '../api/_lib/telegram.js';
import { whatsappLink } from '../src/utils/phone.js';
const tmpImages = path.join(os.tmpdir(), 'bynd-images.tmp.mjs');
fs.writeFileSync(tmpImages, fs.readFileSync(new URL('../src/utils/images.js', import.meta.url), 'utf8').replace(/import\.meta\.env\./g, '({})?.'));
const { optimizedImage } = await import(pathToFileURL(tmpImages).href);
let n = 0; const ok = (l) => console.log('  ok', ++n, l);

// ---- message ----
const order = { orderType: 'preorder', totalAmount: 900, customer: { name: 'Ali <script>', phone: '0100', address: '1 Nile St, Cairo', notes: 'ring & wait' },
  shipping: { zoneName: { en: 'Cairo', ar: 'القاهرة' } }, items: [{ quantity: 2, name: { en: 'Hex Display', ar: 'حامل' } }],
  customFields: [{ label: { en: 'Size', ar: 'المقاس' }, type: 'select', value: { en: 'Large', ar: 'كبير' } }, { label: { en: 'Agree', ar: 'أوافق' }, type: 'checkbox', value: true }] };
let msg = buildOrderMessage({ order, orderNumberLabel: 'BYND-1005', adminUrl: 'https://x.app/admin/orders' }, 'en');
assert.ok(msg.includes('BYND-1005') && msg.includes('Preorder') && msg.includes('900 EGP') && msg.includes('2 × Hex Display') && msg.includes('Cairo') && msg.includes('Size: Large') && msg.includes('Agree: ✓'));
assert.ok(!msg.includes('<script>') && msg.includes('&lt;script&gt;') && msg.includes('ring &amp; wait'));
const ar = buildOrderMessage({ order, orderNumberLabel: 'BYND-1005' }, 'ar');
assert.ok(ar.includes('طلب جديد') && ar.includes('حامل') && ar.includes('المقاس: كبير') && !ar.includes('Open orders'));
assert.ok(buildTestMessage('BYND', 'ar').includes('BYND') && buildTestMessage('BYND').includes('working'));
ok('order message (English/Arabic), HTML-escaped, custom answers included');

// ---- sending ----
let call; const okFetch = async (url, opt) => { call = { url, body: JSON.parse(opt.body) }; return { ok: true, json: async () => ({ ok: true }) }; };
assert.deepEqual(await sendTelegram({ token: 'T', chatId: '-100', text: 'hi', fetchImpl: okFetch }), { ok: true });
assert.equal(call.url, 'https://api.telegram.org/botT/sendMessage'); assert.equal(call.body.chat_id, '-100'); assert.equal(call.body.parse_mode, 'HTML');
assert.equal((await sendTelegram({ token: '', chatId: '1', text: 'x' })).error, 'NOT_CONFIGURED');
assert.equal((await sendTelegram({ token: 'T', chatId: '', text: 'x' })).error, 'NO_CHAT');
const refused = await sendTelegram({ token: 'T', chatId: '1', text: 'x', fetchImpl: async () => ({ ok: false, json: async () => ({ ok: false, description: 'chat not found' }) }) });
assert.equal(refused.error, 'TELEGRAM_REFUSED');
const boom = await sendTelegram({ token: 'SECRET', chatId: '1', text: 'x', fetchImpl: async () => { throw new Error('failed https://api.telegram.org/botSECRET/x'); } });
assert.deepEqual(boom, { ok: false, error: 'NETWORK' }); assert.ok(!JSON.stringify(boom).includes('SECRET'));
const slow = await sendTelegram({ token: 'T', chatId: '1', text: 'x', timeoutMs: 20, fetchImpl: (u, o) => new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(new Error('aborted')))) });
assert.equal(slow.error, 'NETWORK');
ok('sending: success, missing token/chat, refused, network error (token never leaked), timeout');

// ---- find my chat ----
const updates = [
  { update_id: 1, my_chat_member: { chat: { id: -1001, title: 'BYND Orders', type: 'group' } } },
  { update_id: 2, message: { chat: { id: 55, first_name: 'Adham', type: 'private' } } },
  { update_id: 3, message: { chat: { id: -1001, title: 'BYND Orders', type: 'group' } } },
  { update_id: 4, edited_message: { chat: { id: 77, username: 'bob', type: 'private' } } }, { update_id: 5 } ];
const chats = parseChats(updates);
assert.deepEqual(chats.map((c) => c.id).sort(), ['-1001', '55', '77'].sort()); assert.equal(chats.find((c) => c.id === '-1001').title, 'BYND Orders'); assert.equal(chats.find((c) => c.id === '55').title, 'Adham');
const found = await discoverChats({ token: 'T', fetchImpl: async () => ({ ok: true, json: async () => ({ ok: true, result: updates }) }) });
assert.equal(found.chats.length, 3); assert.equal((await discoverChats({ token: '' })).error, 'NOT_CONFIGURED');
ok('find my chat: groups and private chats, no duplicates');

// ---- WhatsApp links ----
assert.equal(whatsappLink('01026409664'), 'https://wa.me/201026409664');
assert.equal(whatsappLink('+20 102 640 9664'), 'https://wa.me/201026409664');
assert.equal(whatsappLink('00201026409664'), 'https://wa.me/201026409664');
assert.equal(whatsappLink('201026409664'), 'https://wa.me/201026409664');
assert.equal(whatsappLink('0501234567', '971'), 'https://wa.me/971501234567'); assert.equal(whatsappLink(''), '');
ok('WhatsApp links for local, +country and 00 formats');

// ---- picture optimizing ----
assert.equal(optimizedImage('https://res.cloudinary.com/demo/image/upload/v123/a.jpg', 700), 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_700/v123/a.jpg');
assert.equal(optimizedImage('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v123/a.jpg', 700), 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v123/a.jpg');
assert.equal(optimizedImage('https://example.com/a.jpg', 700), 'https://example.com/a.jpg'); assert.equal(optimizedImage('', 700), '');
ok('Cloudinary pictures resized/compressed; other links untouched');
console.log(`\nALL ${n} ALERT/HELPER CHECKS PASSED`);
