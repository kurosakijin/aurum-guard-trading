import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const read = name => readFileSync(new URL(`../strategies/${name}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const base = read('xau-a-plus-v2.6.4-color-forecast.pine');
const source = read('xau-a-plus-v2.6.5-psar-forecast.pine');
const boundary = source.indexOf('// ============================================================================\n// PARABOLIC SAR');
const overlay = source.slice(boundary);
test('strategy, forecast, structure and 0.273 default preserved', () => {
  assert.ok(boundary > 0);
  assert.equal(source.slice(0, boundary).replace('V2.6.5 PSAR + COLOR FORECAST', 'V2.6.4 ASHE COLOR FORECAST').trimEnd(), base.trimEnd());
  assert.match(source, /msbFactor = input.float\(0.273,/);
});
test('PSAR settings and plots use independent names', () => {
  assert.match(overlay, /psarStart = input.float\(0.02,/);
  assert.match(overlay, /psarIncrement = input.float\(0.02,/);
  assert.match(overlay, /psarMaximum = input.float\(0.2,/);
  assert.match(overlay, /ta.sar\(psarStart, psarIncrement, psarMaximum\)/);
  assert.doesNotMatch(overlay, /(?:^|\n)(?:buySignal|sellSignal|dir|start|increment|maximum)\s*[:=]/);
  assert.doesNotMatch(overlay, /strategy\.(entry|exit|order|close)\(/);
  assert.ok(overlay.includes('style=plot.style_circles'));
  assert.ok(overlay.includes('text="PSAR Buy"'));
  assert.ok(overlay.includes('text="PSAR Sell"'));
});
test('closed-bar signals, optional alerts and independent visibility', () => {
  assert.ok(overlay.includes('input.bool(false, "Show PSAR dots"'));
  assert.ok(overlay.includes('input.bool(false, "Highlight State"'));
  assert.ok(overlay.includes('input.int(200, "Length"'));
  assert.ok(overlay.includes('input.color(color.white, "Color"'));
  assert.ok(overlay.includes('ta.sma(close, maLength)'));
  for (const name of ['psarBuy', 'psarSell']) assert.ok(overlay.includes(`bool ${name} = barstate.isconfirmed and not na(psarValue[1])`));
  assert.ok(overlay.includes('input.bool(false, "PSAR reversal alerts"'));
  assert.ok(overlay.includes('psarEnabled ? psarValue : na'));
  assert.ok(overlay.includes('psarEnabled and psarHighlightState'));
  assert.ok(overlay.includes('alert.freq_once_per_bar_close'));
});
