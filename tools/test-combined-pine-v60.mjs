import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('app/page.tsx', 'utf8');
const pine = page.split('const pineScript = String.raw`')[1].split('`;')[0];
// Source safeguards and independent boundary examples, NOT Pine execution/backtesting.
test('health display switch only gates labels, never protection state', () => {
  assert.ok(!pine.includes('if not showTradeHealth'));
  assert.ok(!pine.includes('= showTradeHealth and'));
  const lines = pine.split(/\r?\n/);
  const references = lines.flatMap((line, i) => line.includes('showTradeHealth') ? [i] : []);
  assert.equal(references.length, 3);
  for (const i of references.slice(1)) {
    assert.equal(lines[i].trim(), 'if showTradeHealth');
    assert.ok(lines[i + 1].trim().startsWith('label.new('));
  }
});
test('structural validation occurs before cycle consumption and order prioritization', () => {
  assert.ok(pine.indexOf('trendLongSetup := trendLongSetup and trendLongStopValid') < pine.indexOf('cycleLongEntryConfirmed ='));
  assert.ok(pine.indexOf('trendShortSetup := trendShortSetup and trendShortStopValid') < pine.indexOf('primarySetupStarted ='));
  assert.ok(pine.includes('trendStopPrice := trendLongStopCandidate'));
  assert.ok(pine.includes('trendStopPrice := trendShortStopCandidate'));
  assert.ok(pine.includes('lowerTFLongStopEstimate = trendLongStopCandidate'));
  assert.ok(pine.includes('lowerTFShortStopEstimate = trendShortStopCandidate'));
  assert.ok(!pine.includes('math.max(trendLongStructureStop'));
  assert.ok(!pine.includes('math.min(trendShortStructureStop'));
});
test('structural risk rejects oversized, inverted, missing and one-tick stops symmetrically', () => {
  const valid = (side, close, stop, atr, multiple, tick) => Number.isFinite(stop) && (close-stop)*side > tick && (close-stop)*side <= atr*multiple;
  for (const side of [1,-1]) {
    assert.ok(valid(side,100,100-side*3,2,1.5,.01));
    assert.ok(!valid(side,100,100-side*3.01,2,1.5,.01));
    assert.ok(!valid(side,100,100+side,2,1.5,.01));
    assert.ok(!valid(side,100,100,2,1.5,.01));
    assert.ok(!valid(side,100,NaN,2,1.5,.01));
  }
});
test('revision preserves sizing, costs, targets and marks the new build', () => {
  assert.ok(pine.includes('Combined v60:'));
  for (const setting of ['default_qty_value = 0.5','commission_value = 0.05','input.float(2.14','input.float(1.5, "Maximum structural stop distance']) assert.ok(pine.includes(setting));
  assert.ok(!page.includes('Build v59'));
});
