import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const source = readFileSync(new URL('../lib/delivery-pine.ts', import.meta.url), 'utf8');
// Reference truth-table tests for the shared EA/Pine rules, not a Pine compiler.
function pattern(current, prior, priorMove) {
  const [open, high, low, close] = current;
  const [pOpen, pHigh, pLow, pClose] = prior;
  const body = Math.abs(close - open);
  const bodyOK = body / Math.max(high - low, 0.01) >= 0.55;
  const engulfUp = bodyOK && close > open && pClose < pOpen && open <= pClose && close >= pOpen && body >= Math.max(Math.abs(pClose - pOpen), 0.01);
  const engulfDown = bodyOK && close < open && pClose > pOpen && open >= pClose && close <= pOpen && body >= Math.max(Math.abs(pClose - pOpen), 0.01);
  const shiftUp = bodyOK && close > open && pClose <= pOpen && close > pHigh;
  const shiftDown = bodyOK && close < open && pClose >= pOpen && close < pLow;
  const direction = shiftUp || engulfUp ? 1 : shiftDown || engulfDown ? -1 : 0;
  return { direction, shift: shiftUp || shiftDown, reversal: direction * priorMove < 0, continuation: direction * priorMove > 0 };
}
function sync(gold, silver, chartOpen) {
  return gold && silver && gold.direction !== 0 && gold.direction === silver.direction && gold.open === silver.open && gold.close === silver.close && gold.close === chartOpen;
}
test('bullish engulfing can classify reversal or continuation', () => {
  const current = [98, 105, 97, 104], prior = [103, 106, 97, 99];
  assert.deepEqual(pattern(current, prior, -4), { direction: 1, shift: false, reversal: true, continuation: false });
  assert.equal(pattern(current, prior, 4).continuation, true);
  assert.equal(pattern(current, prior, 0).continuation, false);
});
test('bearish engulfing and extreme-close CISD', () => {
  assert.equal(pattern([105, 106, 98, 99], [100, 107, 98, 104], 4).direction, -1);
  assert.equal(pattern([100, 109, 99, 108], [103, 106, 98, 100], -4).shift, true);
  assert.equal(pattern([104, 105, 94, 95], [100, 106, 98, 103], 4).shift, true);
});
test('wick-only breaks and weak bodies do not confirm', () => {
  assert.equal(pattern([100, 110, 99, 101], [103, 106, 98, 100], -4).direction, 0);
  assert.equal(pattern([100, 120, 90, 105], [104, 106, 98, 101], -4).direction, 0);
});
test('synchronization fails closed on mismatches, absent patterns and stale sessions', () => {
  const gold = { direction: 1, open: 100, close: 200 };
  assert.equal(sync(gold, { ...gold }, 200), true);
  for (const silver of [{ ...gold, direction: -1 }, { ...gold, direction: 0 }, { ...gold, open: 99 }, { ...gold, close: 199 }]) assert.equal(sync(gold, silver, 200), false);
  assert.ok(!sync(gold, null, 200));
  assert.equal(sync(gold, gold, 300), false);
});
test('published source retains closed-data, chart and no-order safeguards', () => {
  assert.match(source, /indicator\(/);
  assert.doesNotMatch(source, /strategy\s*\(|strategy\.(entry|order|exit|close)\s*\(/);
  assert.match(source, /\[direction\[1\], shift\[1\], reversal\[1\], continuation\[1\], time\[1\], time_close\[1\]\]/);
  assert.equal((source.match(/request\.security\(/g) ?? []).length, 2);
  assert.equal((source.match(/ignore_invalid_symbol = true/g) ?? []).length, 2);
  assert.match(source, /chart\.is_standard/);
  assert.match(source, /goldTime == silverTime/);
  assert.match(source, /goldCloseTime == time/);
  assert.doesNotMatch(source, /offset\s*=\s*-/);
});
