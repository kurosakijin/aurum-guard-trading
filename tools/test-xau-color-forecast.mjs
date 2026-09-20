import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const read = file => readFileSync(new URL(`../strategies/${file}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const base = read('xau-a-plus-v2.6.3-structure-ghost.pine');
const source = read('xau-a-plus-v2.6.4-color-forecast.pine');
const heading = name => `// ============================================================================\n// ${name}`;
const overlay = source.slice(source.indexOf(heading('PRICE ACTION COLOR FORECAST')), source.indexOf(heading('MARKET STRUCTURE & ORDER BLOCKS')));

test('trading and market-structure code preserved, fib remains 0.273', () => {
  const prefix = source.slice(0, source.indexOf(heading('PRICE ACTION COLOR FORECAST')))
    .replace('V2.6.4 ASHE COLOR FORECAST', 'V2.6.3 STRUCTURE GHOST').replace('max_lines_count=500', 'max_lines_count=400');
  assert.equal(prefix.trimEnd(), base.slice(0, base.indexOf(heading('GHOST SCENARIO'))).trimEnd());
  assert.equal(source.slice(source.indexOf(heading('MARKET STRUCTURE & ORDER BLOCKS'))).trimEnd(), base.slice(base.indexOf(heading('MARKET STRUCTURE & ORDER BLOCKS'))).trimEnd());
  assert.match(source, /msbFactor = input.float\(0.273,/);
  assert.doesNotMatch(source, /ghostEnabled|ghostMomentum|ghostDrawings/);
  assert.doesNotMatch(overlay, /strategy\.(entry|exit|order|close)|runtime.error|request\./);
});

test('closed-bar bounded storage and drawing cleanup', () => {
  assert.match(overlay, /barstate.isconfirmed and \(na\(pfLastStored\)/);
  for (const a of ['pfBars', 'pfDirections', 'pfOpens', 'pfHighs', 'pfLows', 'pfCloses']) assert.ok(overlay.includes(`array.pop(${a})`));
  assert.ok(overlay.includes('array.size(pfBars) > 3000'));
  assert.ok(overlay.includes('line.delete(array.pop(pfLines))'));
  assert.ok(overlay.includes('box.delete(array.pop(pfBoxes))'));
  assert.ok(2 * 166 + 1 + 100 < 500);
});

// Reference matching logic; not a Pine interpreter.
function match(colors, series, forecast) {
  for (let i = forecast + series; i <= colors.length - series; i++) {
    if (colors.slice(i, i + series).every((color, k) => color === colors[k])) return i;
  }
  return null;
}
test('insufficient history and no match are normal outcomes', () => {
  assert.equal(match([1, -1], 7, 100), null);
  assert.equal(match([1, 1, -1, -1, -1, -1], 2, 2), null);
  assert.ok(overlay.includes('No complete historical color match'));
});
test('nearest eligible exact pattern excludes current-pattern overlap', () => {
  const colors = [1, -1, 1, -1, 1, -1, 0, 0];
  const found = match(colors, 2, 2);
  assert.equal(found, 4); // Candidate 2 overlaps the current pattern's continuation.
  assert.ok(found - 2 >= 2);
  assert.equal(match([0, 1, -1, -1, 0, 1], 2, 2), 4); // Doji participates in match.
});
test('forward replay uses chronological continuation, full horizon and valid slices', () => {
  assert.ok(overlay.includes('int sourceIndex = pfMatch - step'));
  assert.ok(overlay.includes('int pfFirstCandidate = pfForecast + pfSeries'));
  assert.ok(overlay.includes('int pfLastCandidate = pfCount - pfSeries'));
  for (const series of [1, 7, 20]) for (const forecast of [1, 100, 166]) {
    const found = match(Array(3000).fill(1), series, forecast);
    assert.equal(found, forecast + series);
    for (let step = 1; step <= forecast; step++) assert.ok(found - step >= series);
    assert.ok(found + series <= 3000);
  }
});
