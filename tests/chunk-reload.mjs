// Update 46: a page open during a new publish reloads itself ONCE (never in a loop).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isChunkLoadError, allowAutoReload, reloadIfChunkError } from '../src/utils/chunkReload.js';

const fakeStorage = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; } }; };

// 1) Which errors count
assert.ok(isChunkLoadError(new Error('Failed to fetch dynamically imported module: https://x/assets/TrackOrder-abc.js')));
assert.ok(isChunkLoadError(new Error('Importing a module script failed.')));
assert.ok(isChunkLoadError(new Error('error loading dynamically imported module')));
assert.ok(isChunkLoadError({ name: 'ChunkLoadError', message: 'x' }));
assert.ok(!isChunkLoadError(new Error("Cannot read properties of undefined (reading 'map')")));
assert.ok(!isChunkLoadError(null));
console.log('  ok  only "code piece missing" errors are recognised');

// 2) The guard: one reload, then no more for a minute, then allowed again
const st = fakeStorage();
assert.equal(allowAutoReload(st, 1000), true);
assert.equal(allowAutoReload(st, 2000), false);
assert.equal(allowAutoReload(st, 60000), false);
assert.equal(allowAutoReload(st, 62000), true);
assert.equal(allowAutoReload(null, 1000), false, 'no storage = no reload (cannot stop a loop)');
assert.equal(allowAutoReload({ getItem() { throw new Error('x'); }, setItem() {} }, 1000), false);
console.log('  ok  never reloads in a loop');

// 3) reloadIfChunkError calls reload once, and not for other errors
let reloads = 0;
const win = { sessionStorage: fakeStorage(), location: { reload() { reloads += 1; } } };
assert.equal(reloadIfChunkError(new Error('something else'), win), false);
assert.equal(reloads, 0);
assert.equal(reloadIfChunkError(new Error('Failed to fetch dynamically imported module: a.js'), win), true);
assert.equal(reloads, 1);
assert.equal(reloadIfChunkError(new Error('Failed to fetch dynamically imported module: a.js'), win), false);
assert.equal(reloads, 1);
console.log('  ok  reloads once, then shows the normal error screen');

// 4) Wired in
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
assert.ok(read('src/components/shared/ErrorBoundary.jsx').includes('reloadIfChunkError(error)'));
assert.ok(read('src/main.jsx').includes('installChunkReload()'));
console.log('  ok  the error screen and the app start use it');
console.log('ALL 4 CHUNK-RELOAD CHECKS PASSED');
