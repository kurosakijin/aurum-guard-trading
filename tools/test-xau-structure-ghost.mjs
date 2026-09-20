import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const read = file => readFileSync(new URL(`../strategies/${file}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const base = read('xau-a-plus-v2.6.2-ghost-view.pine');
const source = read('xau-a-plus-v2.6.3-structure-ghost.pine');
const boundary = source.indexOf('// ============================================================================\n// MARKET STRUCTURE & ORDER BLOCKS');
const overlay = source.slice(boundary);

test('original strategy and ghost calculations are unchanged', () => {
  assert.ok(boundary > 0);
  const prefix = source.slice(0, boundary)
    .replace('V2.6.3 STRUCTURE GHOST', 'V2.6.2 GHOST VIEW')
    .replace('     max_lines_count=400,\n     max_boxes_count=150,\n     max_labels_count=100,\n     max_bars_back=5000,', '     max_lines_count=200,');
  assert.equal(prefix.trimEnd(), base.trimEnd());
  assert.equal((source.match(/^strategy\(/gm) ?? []).length, 1);
  assert.doesNotMatch(source, /^indicator\(/m);
  assert.doesNotMatch(overlay, /strategy\.(entry|exit|order|close)|request\./);
});

test('drawing and scan histories have explicit limits', () => {
  for (const guard of ['array.size(msbLines) > 100', 'array.size(msbLabels) > 50', 'array.size(msbArchived) > 60', 'array.size(msbHighs) > 5', 'array.size(msbLows) > 5', 'array.size(msbZones) > msbZoneLimit', 'math.min(500,', 'startBar <= endBar', 'endBar <= bar_index']) assert.ok(overlay.includes(guard), guard);
  assert.ok(100 + 4 * 30 < 400);
  assert.ok(60 + 60 < 150);
});

test('exact zone is removed backwards and no alerts for broken zones', () => {
  assert.ok(overlay.includes('while zoneIndex >= 0'));
  for (const array of ['msbZones', 'msbZoneSides', 'msbInside']) assert.ok(overlay.includes(`array.remove(${array}, zoneIndex)`));
  assert.ok(overlay.includes('zoneIndex -= 1'));
  assert.ok(overlay.includes('inside and not array.get(msbInside, zoneIndex)'));
  assert.ok(overlay.includes('input.bool(false, "Structure / zone alerts"'));
});

test('confirmation and label timing avoid presenting past origins as live signals', () => {
  assert.ok(overlay.includes('if barstate.isconfirmed and msbReady'));
  assert.ok(overlay.includes('label.new(bar_index, level'));
  assert.ok(overlay.includes('msbEnabled and barstate.isconfirmed'));
});

test('reference removal preserves an unrelated zone, including adjacent removals', () => {
  const zones = [{ id: 'keep', side: 1, bottom: 90, top: 110 }, { id: 'remove1', side: 1, bottom: 105, top: 115 }, { id: 'remove2', side: -1, bottom: 80, top: 95 }];
  const close = 100;
  for (let i = zones.length - 1; i >= 0; i--) {
    if (zones[i].side === 1 ? close < zones[i].bottom : close > zones[i].top) zones.splice(i, 1);
  }
  assert.deepEqual(zones.map(z => z.id), ['keep']);
});
