import assert from 'node:assert/strict';
import { averageCost, planRestock, planAdjust, buildMovement, MOVEMENT_TYPES } from '../src/utils/stock.js';

let n = 0; const ok = (l) => console.log('  ok', ++n, l);

// ---- average cost ----
assert.equal(averageCost({ stock: 10, cost: 100, quantity: 10, unitCost: 120 }), 110);
assert.equal(averageCost({ stock: 0, cost: 100, quantity: 5, unitCost: 130 }), 130);      // nothing on the shelf: new batch cost
assert.equal(averageCost({ stock: 4, cost: null, quantity: 4, unitCost: 80 }), 80);       // unknown old cost
assert.equal(averageCost({ stock: 3, cost: 100, quantity: 1, unitCost: 200 }), 125);
assert.equal(averageCost({ stock: 3, cost: 10, quantity: 3, unitCost: 10.333 }), 10.17);   // rounded to 2 decimals
ok('weighted average cost: 10 @100 + 10 @120 = 110; empty shelf takes the new cost; rounded to 2 decimals');

// ---- restock plans ----
let p = planRestock({ stock: 10, cost: 100, quantity: 10, totalCost: 1200 });
assert.deepEqual([p.newStock, p.unitCost, p.newCost, p.costChanged, p.totalCost], [20, 120, 110, true, 1200]);
p = planRestock({ stock: 10, cost: 100, quantity: '5', totalCost: '' });
assert.deepEqual([p.newStock, p.unitCost, p.newCost, p.costChanged], [15, null, 100, false]);     // cost unknown: nothing changes
p = planRestock({ stock: 10, cost: 100, quantity: 10, totalCost: 1200, updateCost: false });
assert.deepEqual([p.newStock, p.newCost, p.costChanged, p.unitCost], [20, 100, false, 120]);
p = planRestock({ stock: 0, cost: null, quantity: 4, totalCost: 600 }); assert.deepEqual([p.newStock, p.newCost, p.unitCost], [4, 150, 150]);
p = planRestock({ stock: -2, cost: 50, quantity: 3, totalCost: 150 }); assert.equal(p.newStock, 3);   // negative stock treated as 0
p = planRestock({ stock: 5, cost: 50, quantity: 5, totalCost: 0 }); assert.deepEqual([p.unitCost, p.newCost], [0, 25]);   // free batch is allowed
for (const bad of [0, -3, 1.5, 'abc', '', null, 100001]) assert.equal(planRestock({ stock: 1, cost: 1, quantity: bad, totalCost: 10 }).error, 'BAD_QUANTITY');
for (const bad of [-5, 'abc']) assert.equal(planRestock({ stock: 1, cost: 1, quantity: 1, totalCost: bad }).error, 'BAD_COST');
ok('restock plan: new stock, cost per unit, new average; cost optional; bad quantity / cost refused');

// ---- adjustments ----
assert.deepEqual(planAdjust({ stock: 10, mode: 'count', value: 7 }), { type: 'adjustment', delta: -3, newStock: 7 });
assert.deepEqual(planAdjust({ stock: 10, mode: 'count', value: 12 }), { type: 'adjustment', delta: 2, newStock: 12 });
assert.deepEqual(planAdjust({ stock: 10, mode: 'count', value: 0 }), { type: 'adjustment', delta: -10, newStock: 0 });
assert.equal(planAdjust({ stock: 10, mode: 'count', value: 10 }).error, 'NO_CHANGE');
assert.deepEqual(planAdjust({ stock: 10, mode: 'remove', value: 4 }), { type: 'damaged', delta: -4, newStock: 6 });
assert.equal(planAdjust({ stock: 3, mode: 'remove', value: 4 }).error, 'TOO_MANY');
assert.equal(planAdjust({ stock: 3, mode: 'remove', value: 0 }).error, 'BAD_QUANTITY');
assert.equal(planAdjust({ stock: 3, mode: 'count', value: -1 }).error, 'BAD_QUANTITY'); assert.equal(planAdjust({ stock: 3, mode: 'count', value: 1.5 }).error, 'BAD_QUANTITY');
assert.equal(planAdjust({ stock: 3, mode: 'fly', value: 1 }).error, 'BAD_MODE');
ok('adjust plan: stocktake sets the real count; damaged/lost removes; stock can never go below zero');

// ---- history lines ----
const m = buildMovement({ tenantId: 'bynd', productId: 'p', productName: { en: 'Board' }, type: 'restock', delta: 10, stockAfter: 20, unitCost: 120, totalCost: 1200, note: 'x'.repeat(300), actor: { uid: 'u1', name: 'Mona' } });
assert.deepEqual([m.tenantId, m.type, m.delta, m.stockAfter, m.actorUid, m.actorName, m.note.length], ['bynd', 'restock', 10, 20, 'u1', 'Mona', 200]);
assert.deepEqual(buildMovement({ tenantId: 't', productId: 'p', type: 'sale', delta: -1, stockAfter: 0, actor: { uid: 'u', email: 'a@b.co' } }).actorName, 'a@b.co');
assert.ok(['initial', 'restock', 'sale', 'adjustment', 'damaged', 'return', 'cancel'].every((t) => MOVEMENT_TYPES.includes(t)));
ok('history line has who / what / how many / stock after (note cut to 200 characters)');
console.log(`\nALL ${n} STOCK CHECK GROUPS PASSED`);
