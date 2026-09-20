import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const read = file => readFileSync(new URL(`../strategies/${file}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const base = read('xau-a-plus-v2.6.5-psar-forecast.pine');
const source = read('xau-a-plus-v2.6.6-volume-fight.pine');
const pane = read('volume-fight-pane-v6.pine');
const marker = '// ============================================================================\n// VOLUME FIGHT';
const offset = source.indexOf(marker);
const module = source.slice(offset);
test('all existing strategy and overlay code is preserved', () => {
  assert.ok(offset > 0);
  assert.equal(source.slice(0, offset).replace('V2.6.6 ALL-IN-ONE + VOLUME FIGHT', 'V2.6.5 PSAR + COLOR FORECAST').trimEnd(), base.trimEnd());
  assert.doesNotMatch(module, /strategy\.(entry|exit|order|close)\(/);
  assert.ok(module.includes('display=display.data_window'));
  assert.ok(pane.includes('overlay=false'));
  assert.ok(pane.includes('style=plot.style_area'));
});
test('English explanations and honest attribution included', () => {
  assert.doesNotMatch(module, /[\u0400-\u04ff]/);
  assert.ok(module.includes('Original author, source URL and license were not provided'));
  assert.ok(module.includes('This does not signal on every candle'));
  assert.ok(module.includes('input.int(24,'));
  assert.ok(module.includes('input.float(15.0,'));
});
test('shared calculations identical in companion pane', () => {
  const common = module.slice(0, module.indexOf('\nplotshape(')).trimEnd();
  assert.equal(pane.slice(pane.indexOf(marker), pane.indexOf('\nplotshape(')).trimEnd(), common);
  assert.ok(common.includes('vfWindowValid == 1'));
  assert.ok(common.includes('barstate.isconfirmed'));
});
test('reference candle decomposition handles zero range and unavailable volume', () => {
  const calculate = (o, h, l, c, v) => {
    if (!(v > 0)) return null;
    const span = h - l;
    return [c > o ? v : span > 0 ? v * (h - o) / span : v * 0.5,
      o > c ? v : span > 0 ? v * (o - l) / span : v * 0.5];
  };
  assert.deepEqual(calculate(10, 10, 10, 10, 100), [50, 50]);
  assert.equal(calculate(10, 11, 9, 11, 0), null);
  assert.equal(calculate(10, 11, 9, 11, NaN), null);
  assert.deepEqual(calculate(10, 12, 8, 11, 100), [100, 50]);
  assert.deepEqual(calculate(10, 12, 8, 9, 100), [50, 100]);
});
test('reference neutral reset agrees with documented signal behavior', () => {
  function signals(reset) {
    let up = 0, down = 0;
    return [1, 1, 0, 1, -1].map(zone => {
      if (zone === 1) { up++; down = 0; }
      else if (zone === -1) { down++; up = 0; }
      else if (reset) { up = 0; down = 0; }
      return zone === 1 && up === 1 ? 'UP' : zone === -1 && down === 1 ? 'DOWN' : null;
    });
  }
  assert.deepEqual(signals(false), ['UP', null, null, null, 'DOWN']);
  assert.deepEqual(signals(true), ['UP', null, null, 'UP', 'DOWN']);
});
