// Update 32: the name / address boxes must look real, and a wrong promo code must never block an order.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as server from '../api/_lib/contactChecks.js';
import * as browser from '../src/utils/contactChecks.js';
import { applyCustomerRules } from '../api/_lib/fields.js';

let n = 0;
const ok = (m) => { n += 1; console.log(`ok ${n} - ${m}`); };

const good = [['name','Ahmed Ali'],['name','أحمد علي'],['name',"O'Brien-Smith"],['city','Cairo'],['city','القاهرة'],
  ['area','Nasr City 5'],['street','15 Tahrir St.'],['street','شارع التحرير 15'],['building','12'],['building','4B'],
  ['floor','٣'],['apartment','3/2'],['landmark','Next to the mosque'],['notes','anything <ok> here'],['country','']];
const bad = [['name','12345'],['name','a'],['name','aaaa bbb'],['name','Ali@x'],['name','<b>x</b>'],['city','x'],['city','123'],
  ['city','Cairo$$'],['street','12'],['street','!!!'],['street','xxxx xxxx'],['building','--'],['area','..'],['landmark','1']];
for (const [k, v] of good) assert.equal(server.checkField(k, v).ok, true, `${k} "${v}" should be fine`);
for (const [k, v] of bad) assert.equal(server.checkField(k, v).ok, false, `${k} "${v}" should be refused`);
ok('real-looking names, cities, streets and numbers pass; digits-only names, symbols, "aaaa" and too-short text are refused');

assert.equal(server.checkField('name', '  Ali    Hassan ').value, 'Ali Hassan');
assert.equal(server.checkField('name', '').ok, true);
ok('extra spaces are tidied; an empty box is left to the shop\'s "required" rule');

for (const [k, v] of [...good, ...bad]) assert.deepEqual(browser.checkField(k, v), server.checkField(k, v));
const marker = '// ---- shared rules';
const shared = (f) => fs.readFileSync(f, 'utf8').split(marker)[1];
assert.ok(shared('api/_lib/contactChecks.js') === shared('src/utils/contactChecks.js'));
ok('browser and server copies are identical');

const tenant = { checkout: { fields: { area: { show: true, required: false }, landmark: { show: true, required: false } } } };
const base = { name: 'Ali Hassan', phone: '01012345678', email: '', street: '12 Tahrir Street', building: '5', area: '', city: 'Cairo', country: '', notes: '', floor: '', apartment: '', landmark: '' };
assert.equal(applyCustomerRules(base, tenant).city, 'Cairo');
assert.throws(() => applyCustomerRules({ ...base, name: '12345' }, tenant), (e) => e.code === 'BAD_NAME');
assert.throws(() => applyCustomerRules({ ...base, city: 'x' }, tenant), (e) => e.code === 'BAD_FIELD_FORMAT' && e.meta.field === 'city');
assert.throws(() => applyCustomerRules({ ...base, street: '$$$$' }, tenant), (e) => e.code === 'BAD_FIELD_FORMAT' && e.meta.field === 'street');
assert.throws(() => applyCustomerRules({ ...base, area: 'aaaaa' }, tenant), (e) => e.code === 'BAD_FIELD_FORMAT');
// a hidden box is never checked
assert.equal(applyCustomerRules({ ...base, floor: '@@@' }, tenant).floor, undefined);
ok('the server refuses an order with a fake name / city / street (BAD_NAME / BAD_FIELD_FORMAT); hidden boxes are ignored');

// ---- promo box: the page forgets a tried code as soon as the text changes
const page = fs.readFileSync('src/pages/storefront/Checkout.jsx', 'utf8');
assert.ok(page.includes('function changePromo') && page.includes("setAppliedCode('')"));
assert.ok(page.includes('promoShapeBad') && page.includes('quoteFailed'));
ok('checkout page: changing the promo text clears the old code; odd characters and failed checks show a message');

// ---- both languages have the new texts
for (const lang of ['en', 'ar']) {
  const j = JSON.parse(fs.readFileSync(`src/i18n/${lang}.json`, 'utf8'));
  for (const k of ['promoShapeBad', 'promoChecking', 'promoCheckFailed']) assert.ok(j.checkout[k], `${lang} checkout.${k}`);
  assert.ok(j.errors.BAD_FIELD_FORMAT, `${lang} errors.BAD_FIELD_FORMAT`);
}
ok('English and Arabic texts exist');

console.log(`\nALL ${n} FIELD-CHECK GROUPS PASSED`);
