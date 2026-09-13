import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const source = readFileSync(new URL('../lib/delivery-pine-v2.ts', import.meta.url), 'utf8');
// Executable reference cases + source safeguards. NOT TradingView compilation/backtesting.
function sequence(candles) {
  let dir = 0, origin, bullRun, bearRun, prior;
  return candles.map(([open, close]) => {
    if (close > open && (!prior || prior[1] <= prior[0])) bullRun = open;
    if (close < open && (!prior || prior[1] >= prior[0])) bearRun = open;
    let shift = 0;
    if (!dir) { dir = Math.sign(close - open); origin = open; }
    else if (dir === -1 && close > open && close > origin && prior[1] <= origin) {
      shift = dir = 1; origin = bullRun;
    } else if (dir === 1 && close < open && close < origin && prior[1] >= origin) {
      shift = dir = -1; origin = bearRun;
    }
    prior = [open, close];
    return shift;
  });
}
function pair(gold, silver) {
  return gold.symbol !== silver.symbol && gold.base === 'XAU' && silver.base === 'XAG' && gold.quote === silver.quote && gold.open === silver.open && gold.end === silver.end && gold.end === gold.chartOpen;
}
function retire(w, b) {
  if (w.dir === 1 ? b.low <= w.low : b.high >= w.high) return 'invalidated';
  if (w.dir === 1 ? b.high > w.anchor + w.atr * 0.75 : b.low < w.anchor - w.atr * 0.75) return 'chased';
  if (b.index - w.start >= 3 || b.time - w.time >= 3 * 60000) return 'expired';
  if (!b.aligned) return 'alignment';
  if (b.shock || b.news) return 'pause';
  return 'active';
}
test('CISD reclaims leg origin, not merely the latest small candle', () => {
  assert.deepEqual(sequence([[120, 115], [115, 108], [108, 104], [104, 109], [109, 113], [113, 121], [121, 123]]), [0, 0, 0, 0, 0, 1, 0]);
});
test('bearish CISD is symmetric and does not repeat after reclaim', () => {
  assert.deepEqual(sequence([[100, 105], [105, 111], [111, 108], [108, 103], [103, 99], [99, 97]]), [0, 0, 0, 0, -1, 0]);
});
test('partial retracement followed by another opposing candle retains origin', () => {
  assert.deepEqual(sequence([[120, 110], [110, 114], [114, 108], [108, 116], [116, 121]]), [0, 0, 0, 0, 1]);
});
const gold = { symbol: 'OANDA:XAUUSD', base: 'XAU', quote: 'USD', open: 100, end: 200, chartOpen: 200 };
const silver = { ...gold, symbol: 'OANDA:XAGUSD', base: 'XAG' };
test('distinct metal identities and matching intervals required', () => {
  assert.equal(pair(gold, silver), true);
  for (const wrong of [gold, { ...silver, base: 'XAU' }, { ...silver, quote: 'EUR' }, { ...silver, end: 199 }, { ...silver, open: 99 }]) assert.equal(pair(gold, wrong), false);
  assert.equal(pair({ ...gold, chartOpen: 300 }, silver), false);
});
const watch = { dir: 1, low: 95, high: 108, anchor: 105, atr: 10, start: 10, time: 600000 };
const bar = { low: 100, high: 108, index: 11, time: 660000, aligned: true, shock: false, news: false };
test('touching lower bound cancels bullish watch even if close bounces back', () => {
  assert.equal(retire(watch, { ...bar, low: 95, close: 106 }), 'invalidated');
  assert.equal(retire(watch, bar), 'active');
});
test('bearish upper-bound cancellation', () => {
  assert.equal(retire({ ...watch, dir: -1 }, { ...bar, high: 108 }), 'invalidated');
});
test('no-chase cancels both directions', () => {
  assert.equal(retire(watch, { ...bar, high: 113 }), 'chased');
  assert.equal(retire({ ...watch, dir: -1 }, { ...bar, high: 107, low: 97 }), 'chased');
});
test('bar-count and elapsed-time expiry prevent stale watches', () => {
  assert.equal(retire(watch, { ...bar, index: 13 }), 'expired');
  assert.equal(retire(watch, { ...bar, time: 900000 }), 'expired');
});
test('alignment loss, news pause and shock retire watches', () => {
  assert.equal(retire(watch, { ...bar, aligned: false }), 'alignment');
  assert.equal(retire(watch, { ...bar, news: true }), 'pause');
  assert.equal(retire(watch, { ...bar, shock: true }), 'pause');
});
test('quality thresholds reject tiny or oversized patterns', () => {
  const quality = (body, range, atr) => atr > 0 && body / range >= .55 && body >= atr * .25 && range <= atr * 1.8;
  assert.equal(quality(6, 8, 10), true);
  assert.equal(quality(.6, 1, 10), false);
  assert.equal(quality(19, 20, 10), false);
  assert.equal(quality(6, 8, 0), false);
});
test('production source contains confirmation/retirement guards and no order labels', () => {
  assert.match(source, /indicator\(/);
  assert.doesNotMatch(source, /strategy\s*\(|strategy\.(entry|order|exit|close)\s*\(/);
  assert.doesNotMatch(source, /text = "(?:BUY|SELL)/);
  assert.match(source, /close > legOrigin and close\[1\] <= legOrigin/);
  assert.match(source, /\[direction\[1\], isShift\[1\], priorTrend\[1\], time\[1\], time_close\[1\]/);
  assert.match(source, /\[direction\[1\], time_close\[1\]\]/);
  assert.equal((source.match(/request\.security\(/g) ?? []).length, 4);
  assert.equal((source.match(/ignore_invalid_symbol = true/g) ?? []).length, 4);
  assert.match(source, /hourTrend == gDir and dayTrend == gDir/);
  assert.match(source, /if barstate\.isconfirmed and not na\(gTime\)/);
  assert.match(source, /not hadWatch and watchDirection == 0 and candidate/);
  assert.match(source, /low <= watchLow/);
  assert.match(source, /watchDirection := 0/);
  assert.match(source, /Once Per Bar Close/);
  assert.doesNotMatch(source, /offset\s*=\s*-/);
});
