import assert from 'node:assert/strict';
import { diffFields, fieldsOnly, stable } from '../src/utils/audit.js';
assert.deepEqual(diffFields({ price: 850, stock: 5, name: 'A' }, { price: 900, stock: 5, name: 'A' }), [{ field: 'price', from: '850', to: '900' }]);
assert.deepEqual(diffFields({}, { active: true }), [{ field: 'active', from: '', to: 'true' }]);
assert.deepEqual(diffFields({ cost: null }, { cost: '' }), []);          // empty is empty
assert.deepEqual(diffFields({ a: 1 }, { a: '1' }), []);                   // 1 vs "1" is not a change
assert.deepEqual(fieldsOnly(['accent', 'logo']), [{ field: 'accent' }, { field: 'logo' }]);
assert.equal(stable({ b: 1, a: { d: [{ y: 1, x: 2 }], c: 3 } }), stable({ a: { c: 3, d: [{ x: 2, y: 1 }] }, b: 1 }));
assert.notEqual(stable([{ id: 1 }, { id: 2 }]), stable([{ id: 2 }, { id: 1 }]));
assert.equal(stable(undefined), 'null');
console.log('ok: activity-log helpers (what changed, order-insensitive comparison)');
