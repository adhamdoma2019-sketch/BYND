// Runs every test in this folder. Used by `npm test` and by the build, so a
// broken update fails here and the live shop keeps running its previous version.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.mjs') && f !== 'run-all.mjs').sort();

let failed = 0;
for (const file of files) {
  const run = spawnSync(process.execPath, ['--no-warnings', path.join(dir, file)], { encoding: 'utf8' });
  const passed = run.status === 0;
  const last = (run.stdout || '').trim().split('\n').filter(Boolean).pop() || '';
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${file}${passed ? '  - ' + last : ''}`);
  if (!passed) {
    failed += 1;
    console.log((run.stdout || '') + (run.stderr || ''));
  }
}
console.log(failed === 0 ? `\nAll ${files.length} test files passed.` : `\n${failed} of ${files.length} test files FAILED.`);
process.exit(failed === 0 ? 0 : 1);
