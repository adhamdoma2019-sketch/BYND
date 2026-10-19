import assert from 'node:assert/strict';
import { instagramUrl, facebookUrl, tiktokUrl, contactLinks, safeBarLink } from '../src/utils/contact.js';

let n = 0; const ok = (l) => console.log('  ok', ++n, l);

assert.equal(instagramUrl('@bynd.eg'), 'https://instagram.com/bynd.eg'); assert.equal(instagramUrl('bynd'), 'https://instagram.com/bynd');
assert.equal(instagramUrl('https://www.instagram.com/bynd/'), 'https://www.instagram.com/bynd/'); assert.equal(facebookUrl('bynd'), 'https://facebook.com/bynd');
assert.equal(tiktokUrl('@bynd'), 'https://www.tiktok.com/@bynd'); assert.equal(tiktokUrl(''), '');
ok('social pages: handles and https links accepted');

for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'http://evil.com', 'data:text/html,x', 'mailto:a@b.co', 'ftp://x', 'https://', 'https://exa mple.com']) {
  assert.equal(instagramUrl(bad), '', bad); assert.equal(safeBarLink(bad), '', bad);
}
assert.equal(instagramUrl('bad handle!!'), 'https://instagram.com/badhandle');
ok('unsafe links (javascript:, http:, data:, other schemes) are refused; odd characters stripped from handles');

const l = contactLinks({ whatsapp: '01026409664', phone: '+20 2 1234 5678', email: 'hi@bynd.com', instagram: '@bynd' }, { countryCode: '20', message: 'Hello BYND & co' });
assert.equal(l.whatsapp, 'https://wa.me/201026409664?text=Hello%20BYND%20%26%20co'); assert.equal(l.phone, 'tel:+20212345678'); assert.equal(l.phoneText, '+20 2 1234 5678');
assert.equal(l.email, 'mailto:hi@bynd.com'); assert.equal(l.instagram, 'https://instagram.com/bynd'); assert.equal(l.facebook, '');
const empty = contactLinks(undefined); assert.deepEqual([empty.whatsapp, empty.phone, empty.email, empty.instagram], ['', '', '', '']);
assert.equal(contactLinks({ email: 'not an email' }).email, ''); assert.equal(contactLinks({ whatsapp: '0501234567' }, { countryCode: '971' }).whatsapp, 'https://wa.me/971501234567');
ok('contact links: WhatsApp (with the country code and a ready message), phone, email; empty and invalid values give nothing');

assert.equal(safeBarLink('#products'), '#products'); assert.equal(safeBarLink('https://bynd.com/sale'), 'https://bynd.com/sale'); assert.equal(safeBarLink('#a b'), ''); assert.equal(safeBarLink(''), '');
ok('announcement bar link: only https addresses or a place on the page');
console.log(`\nALL ${n} CONTACT CHECK GROUPS PASSED`);
