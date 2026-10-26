// Phone + email checks (update 17): rules, server/browser copies, and the order rules that use them.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as server from '../api/_lib/contactChecks.js';
import * as browser from '../src/utils/contactChecks.js';
import { applyCustomerRules, applyCustomFields } from '../api/_lib/fields.js';

let n = 0; const ok = (l) => console.log('  ok', ++n, l);
const { checkPhone, checkEmail } = server;

// ---- Egyptian phones: any way of writing -> 01XXXXXXXXX
for (const typed of [
  '01012345678', '010 1234 5678', '010-1234-5678', '+201012345678', '+20 10 1234 5678', '0020 101 234 5678',
  '201012345678', '1012345678', '+20 (0)10 1234 5678', '٠١٠١٢٣٤٥٦٧٨', '۰۱۰۱۲۳۴۵۶۷۸', ' 01012345678 ',
]) {
  assert.deepEqual(checkPhone(typed, '20'), { ok: true, value: '01012345678' }, typed);
}
for (const prefix of ['010', '011', '012', '015']) assert.equal(checkPhone(`${prefix}12345678`).ok, true, prefix);
ok('Egyptian mobile numbers are accepted in every common spelling (also Arabic digits) and saved as 01XXXXXXXXX');

for (const bad of ['', '12345', '0131234567', '01412345678', '0101234567', '010123456789', '02 2345 6789', '010+1234567', 'abc', '+44 7700 900123'])
  assert.equal(checkPhone(bad, '20').ok, false, bad);
assert.equal(checkPhone('01012345678').ok, true); // country code defaults to Egypt
ok('wrong lengths, wrong prefixes, landlines, letters and foreign numbers are refused for an Egyptian shop');

// other countries keep the simple rule and the number as typed
assert.deepEqual(checkPhone('+44 7700 900123', '44'), { ok: true, value: '+44 7700 900123' });
assert.equal(checkPhone('12345', '44').ok, false);
assert.equal(checkPhone('(555) 123-4567', 1).ok, true);
ok('shops in other countries only get the simple check (nothing Egypt-specific is forced on them)');

// ---- email shape + typo hints
for (const good of ['ali@gmail.com', 'Sara.Ahmed+shop@Hotmail.COM', ' a_b-c@sub.example.co.uk ', 'ali@outlook.com'])
  assert.equal(checkEmail(good).ok, true, good);
assert.equal(checkEmail(' Sara@Hotmail.COM ').value, 'sara@hotmail.com');
for (const bad of ['', 'ali', 'ali@', '@gmail.com', 'ali@gmail', 'ali@gmail.c', 'a b@gmail.com', 'a..b@gmail.com', '.a@gmail.com', 'ali@-x.com', 'ali@@gmail.com', `${'a'.repeat(100)}@x.com`])
  assert.equal(checkEmail(bad).ok, false, bad);
ok('email shape: good addresses pass (lower-cased), broken ones are refused');

assert.equal(checkEmail('ali@gmial.com').suggestion, 'ali@gmail.com');
assert.equal(checkEmail('ali@gmail.con').suggestion, 'ali@gmail.com');
assert.equal(checkEmail('ali@hotmial.com').suggestion, 'ali@hotmail.com');
assert.equal(checkEmail('ali@yahoo.con').suggestion, 'ali@yahoo.com');
assert.equal(checkEmail('ali@mycompany.con').suggestion, 'ali@mycompany.com');
assert.equal(checkEmail('ali@gmail.com').suggestion, '');
assert.equal(checkEmail('ali@mail.com').suggestion, ''); // a real provider is never "corrected"
assert.equal(checkEmail('ali@gmial.com').ok, true); // a typo hint never blocks
ok('typo hints for common mistakes; real addresses are left alone and hints never block');

// ---- server and browser copies are the same code
const marker = '// ---- shared rules';
const shared = (file) => fs.readFileSync(file, 'utf8').split(marker)[1];
assert.ok(shared('api/_lib/contactChecks.js') && shared('api/_lib/contactChecks.js') === shared('src/utils/contactChecks.js'));
for (const [p, c] of [['0101234567', '20'], ['+20 10 1234 5678', '20'], ['(555) 123-4567', '1'], ['', '20']])
  assert.deepEqual(browser.checkPhone(p, c), server.checkPhone(p, c));
for (const e of ['ali@gmial.com', 'bad', 'OK@x.com'])
  assert.deepEqual(browser.checkEmail(e), server.checkEmail(e));
ok('browser copy is identical to the server copy (text and behaviour)');

// ---- the order rules use them
const tenant = { checkout: { fields: { email: { show: true, required: false } } } };
const base = { name: 'Ali Hassan', phone: '+20 10 1234 5678', email: 'Ali@Gmail.com', street: 'x', building: '', area: '', city: 'Cairo', country: '', notes: '' };
const out = applyCustomerRules(base, tenant);
assert.equal(out.phone, '01012345678'); assert.equal(out.email, 'ali@gmail.com');
assert.throws(() => applyCustomerRules({ ...base, phone: '12345' }, tenant), (e) => e.code === 'BAD_PHONE');
assert.throws(() => applyCustomerRules({ ...base, email: 'nope' }, tenant), (e) => e.code === 'BAD_EMAIL');
const uk = applyCustomerRules({ ...base, phone: '+44 7700 900123' }, { ...tenant, defaultCountryCode: '44' });
assert.equal(uk.phone, '+44 7700 900123');
ok('placing an order saves the phone in standard form and the email lower-cased; bad ones are refused; other countries unchanged');

const shop = { checkout: { customFields: [
  { id: 'f1', type: 'phone', label: { en: 'Second phone', ar: 'رقم آخر' }, required: false },
  { id: 'f2', type: 'email', label: { en: 'Gift email', ar: 'بريد' }, required: false },
] } };
const saved = applyCustomFields({ f1: '٠١٠١٢٣٤٥٦٧٨', f2: 'Mo@Gmail.com' }, shop);
assert.equal(saved[0].value, '01012345678'); assert.equal(saved[1].value, 'mo@gmail.com');
assert.throws(() => applyCustomFields({ f1: '123' }, shop), (e) => e.code === 'BAD_FIELD');
assert.throws(() => applyCustomFields({ f2: 'x@y' }, shop), (e) => e.code === 'BAD_FIELD');
ok('the shop\'s own phone and email questions follow the same rules');

console.log(`\nALL ${n} CONTACT-CHECK GROUPS PASSED`);
