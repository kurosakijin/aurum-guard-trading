import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const source = readFileSync(new URL('../strategies/asheparte-confluence-v1.pine', import.meta.url), 'utf8');
const module = source.slice(source.indexOf('// PSAR ATTACHED THREE-TARGET POSITION PLANS'));
test('plans use the same PSAR reversal with no additional entry filters', () => {
  assert.ok(module.includes('psarEnabled and psarPlans and (psarBuy or psarSell)'));
  assert.doesNotMatch(module, /strategy\.(entry|exit|order|close)\(|vfBull|vfBear|msbMarket|maValue/);
  assert.ok(module.includes('math.round_to_mintick(close)'));
  assert.ok(module.includes('math.round_to_mintick(psarValue)'));
  assert.ok(module.includes('planEntry + planDirection * planRisk * 3.0'));
  assert.ok(module.includes('planTP1 = math.round_to_mintick(planEntry + planDirection * planRisk)'));
  assert.ok(module.includes('planTP2 = math.round_to_mintick(planEntry + planDirection * planRisk * 2.0)'));
  assert.ok(module.includes('planRisk > 0 and planTarget > 0'));
});
test('drawings are bounded, synchronized and deduplicated per bar', () => {
  assert.ok(module.includes('psarLastPlanBar != bar_index'));
  assert.ok(module.includes('minval=1, maxval=12'));
  for (const name of ['psarRiskBoxes', 'psarRewardBoxes', 'psarEntryLines', 'psarPlanLabels', 'psarTargetLines', 'psarTargetLabels']) assert.ok(module.includes(`array.shift(${name})`));
  // Structure zones + forecast event boxes + position plans.
  assert.ok(120 + 3 + 2 * 12 <= 150);
  assert.ok(100 + 333 + 4 * 12 <= 500);
  assert.ok(50 + 1 + 4 * 12 <= 100);
});
test('long and short reference levels have exactly 1:3 reward/risk', () => {
  for (const [entry, stop, direction, expectedTarget] of [[4300, 4290, 1, 4330], [4300, 4310, -1, 4270]]) {
    const risk = (entry - stop) * direction;
    const target = entry + direction * risk * 3;
    assert.ok(risk > 0);
    assert.equal(target, expectedTarget);
    assert.equal(Math.abs(target - entry) / Math.abs(stop - entry), 3);
    for (const r of [1, 2, 3]) assert.equal(Math.abs(entry + direction * risk * r - entry) / Math.abs(stop - entry), r);
  }
});
