import assert from 'node:assert/strict';
import {
  ACCENT_PRESETS, PAPER, FONT_PRESETS, RADIUS_PRESETS, parseHex, toHex, contrast, luminance, deriveAccent,
  accentVars, resolveAccentHex, resolveMode, accentTooFaint, fontHref, DEFAULT_ACCENT,
} from '../src/utils/theme.js';

let n = 0; const ok = (l) => console.log('  ok', ++n, l);

// ---- colour basics ----
assert.deepEqual(parseHex('#d98b4a'), [217, 139, 74]); assert.deepEqual(parseHex('fff'), [255, 255, 255]); assert.deepEqual(parseHex('#ABC'), [170, 187, 204]);
for (const bad of ['', 'red', '#12', '#12345', '#gggggg', null, undefined, 42]) assert.equal(parseHex(bad), null);
assert.equal(toHex([217, 139, 74]), '#D98B4A');
assert.ok(Math.abs(contrast([0, 0, 0], [255, 255, 255]) - 21) < 0.01); assert.equal(contrast([5, 5, 5], [5, 5, 5]), 1);
ok('hex colours parse (3 and 6 digits), bad input refused; contrast maths (black on white = 21)');

// ---- readable text for EVERY preset and for awkward colours, in both modes ----
const awkward = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#808080', '#7F7F7F', '#FFFFFF', '#000000', '#C8F03C', '#E0B341', '#6CB8F5', '#FFD1DC', '#101010', '#8B6CF0'];
const colours = [...Object.keys(ACCENT_PRESETS), ...awkward];
for (const mode of ['dark', 'light']) {
  for (const c of colours) {
    const d = deriveAccent(c, mode);
    assert.ok(contrast(d.onBrass, d.brass) >= 4.5, `text ON ${c} (${mode}) too faint: ${contrast(d.onBrass, d.brass).toFixed(2)}`);
    assert.ok(contrast(d.brassDark, PAPER[mode]) >= 4.5, `${c} as text on the ${mode} page too faint: ${contrast(d.brassDark, PAPER[mode]).toFixed(2)}`);
    for (const v of [...d.brass, ...d.brassDark, ...d.brassLight, ...d.onBrass]) assert.ok(Number.isInteger(v) && v >= 0 && v <= 255);
  }
}
ok(`text on the accent and the accent as text are readable (>= 4.5:1) for ${colours.length} colours x light/dark`);

// ---- monochrome ----
assert.equal(resolveAccentHex('white', 'dark'), '#FFFFFF'); assert.equal(resolveAccentHex('white', 'light'), '#18181B');
assert.ok(accentTooFaint('#F5F4F0', 'light') && !accentTooFaint('#D98B4A', 'light') && !accentTooFaint('white', 'light') && !accentTooFaint('white', 'dark') && accentTooFaint('#0D0D0F', 'dark'));
assert.equal(resolveAccentHex('#abcdef', 'dark'), '#ABCDEF'); assert.equal(resolveAccentHex('nonsense', 'dark'), ACCENT_PRESETS[DEFAULT_ACCENT]); assert.equal(resolveAccentHex(undefined, 'light'), ACCENT_PRESETS[DEFAULT_ACCENT]);
ok('"monochrome" flips with the mode; a colour too close to the page is flagged; unknown values fall back safely');

// ---- CSS variables ----
const v = accentVars('copper', 'dark');
assert.deepEqual(Object.keys(v).sort(), ['--brass', '--brass-dark', '--brass-light', '--on-brass']);
assert.equal(v['--brass'], '217 139 74'); assert.ok(/^\d+ \d+ \d+$/.test(v['--on-brass']));
assert.notEqual(accentVars('lime', 'light')['--brass-dark'], accentVars('lime', 'dark')['--brass-dark']);   // lime text is darkened on a light page
ok('CSS variables are produced as "r g b" triplets; light and dark give different readable tones');

// ---- light / dark choice ----
assert.equal(resolveMode('auto', null, true), 'dark'); assert.equal(resolveMode('auto', null, false), 'light');
assert.equal(resolveMode('light', null, true), 'light'); assert.equal(resolveMode('dark', null, false), 'dark');
assert.equal(resolveMode('dark', 'light', true), 'light'); assert.equal(resolveMode('light', 'dark', false), 'dark');
assert.equal(resolveMode('auto', 'auto', true), 'dark'); assert.equal(resolveMode(undefined, undefined, false), 'light'); assert.equal(resolveMode('weird', 'weird', true), 'dark');
ok('mode: visitor choice > shop default > phone setting ("auto"); junk values behave like auto');

// ---- fonts and corners ----
assert.ok(Object.keys(FONT_PRESETS).length >= 5); for (const [id, f] of Object.entries(FONT_PRESETS)) { assert.ok(f.display.includes(',') && fontHref(id).startsWith('https://fonts.googleapis.com/css2?family=') && fontHref(id).includes('display=swap')); }
assert.equal(fontHref('nope'), null);
assert.deepEqual(Object.keys(RADIUS_PRESETS), ['sharp', 'soft', 'round']); assert.equal(RADIUS_PRESETS.sharp.md, '0px'); assert.ok(parseFloat(RADIUS_PRESETS.round.md) > parseFloat(RADIUS_PRESETS.soft.md));
ok('font and corner presets are complete (fonts load only from Google Fonts, only the chosen one)');
console.log(`\nALL ${n} THEME CHECK GROUPS PASSED`);
