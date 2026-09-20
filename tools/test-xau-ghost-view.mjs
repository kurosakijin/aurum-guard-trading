import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = name => readFileSync(new URL(`../strategies/${name}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const baseline = read('xau-a-plus-v2.6.1-fill-audit.pine');
const source = read('xau-a-plus-v2.6.2-ghost-view.pine');
const marker = '// ============================================================================\n// GHOST SCENARIO';
const split = source.indexOf(marker);
const overlay = source.slice(split);

test('all existing trading logic is unchanged', () => {
  assert.ok(split > 0);
  const prefix = source.slice(0, split)
    .replace('XAU A+ Strategy V2.6.2 GHOST VIEW', 'XAU A+ Strategy V2.6.1 FILL AUDIT')
    .replace('     max_lines_count=200,\n', '');
  assert.equal(prefix.trimEnd(), baseline.trimEnd());
  assert.doesNotMatch(overlay, /strategy\.(entry|exit|order|close|cancel)|request\.|alert\(/);
});

test('drawings use confirmed inputs and explicitly disclaim prediction', () => {
  assert.match(overlay, /barstate\.isconfirmed \? 0 : 1/);
  for (const series of ['close', 'ghostVolatility', 'ghostMomentum']) assert.ok(overlay.includes(`${series}[ghostOffset]`));
  assert.ok(overlay.includes('NOT A PREDICTION'));
  assert.ok(overlay.includes('not a statistical confidence interval'));
});

test('old objects are deleted and future horizon is bounded', () => {
  assert.ok(overlay.includes('line.delete(array.pop(ghostDrawings))'));
  assert.ok(overlay.includes('label.delete(ghostCaption)'));
  assert.match(overlay, /minval=2, maxval=30/);
  // At most four lines per future bar, under the declaration limit.
  assert.ok(4 * 30 <= 200);
  assert.ok(overlay.includes('ghostEnabled and correctTimeframe'));
});

test('projection reference math stays finite and well formed', () => {
  for (const momentum of [-100, -0.5, 0, 0.5, 100]) {
    const atr = 5;
    const drift = Math.max(-atr * 0.3, Math.min(atr * 0.3, momentum));
    let price = 4300;
    let previousStep = Infinity;
    for (let step = 1; step <= 30; step++) {
      const close = price + drift * 0.88 ** (step - 1);
      const high = Math.max(price, close) + atr * 0.25;
      const low = Math.min(price, close) - atr * 0.25;
      assert.ok(Number.isFinite(close) && high >= close && low <= close);
      assert.ok(Math.abs(close - price) <= previousStep + 1e-10);
      previousStep = Math.abs(close - price);
      price = close;
    }
  }
});
