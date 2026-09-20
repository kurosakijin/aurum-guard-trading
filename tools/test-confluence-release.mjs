import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
test('v1 only changes product naming, not strategy behavior', () => {
  const prior = read('strategies/xau-a-plus-v2.6.6-volume-fight.pine');
  const expected = prior.replace('XAU A+ Strategy V2.6.6 ALL-IN-ONE + VOLUME FIGHT', 'Asheparte Confluence v1')
    .replace('// XAU A+ V2.6.1 FILL AUDIT', '// Asheparte Confluence v1 — based on the supplied XAU A+ strategy')
    .replaceAll('"XAU V2.6 BUY | ', '"Asheparte Confluence v1 BUY | ')
    .replaceAll('"XAU V2.6 SELL | ', '"Asheparte Confluence v1 SELL | ');
  assert.equal(read('strategies/asheparte-confluence-v1.pine').trimEnd(), expected.trimEnd());
});
test('browser source uses canonical Pine file and preserves legacy tabs', () => {
  const component = read('components/confluence-pine.tsx');
  const page = read('app/page.tsx');
  assert.ok(component.includes("@/strategies/asheparte-confluence-v1.pine?raw"));
  assert.ok(component.includes('navigator.clipboard.writeText(script)'));
  assert.ok(component.includes("download(script, 'asheparte-confluence-v1.pine')"));
  assert.ok(page.includes("pineScriptView === 'confluence' && <ConfluencePine />"));
  for (const name of ['delivery', 'structure', 'volume', 'combined']) assert.ok(page.includes(`pineScriptView === '${name}'`));
});

test('zone captions use synchronized metadata rather than unsupported box.get_text', () => {
  const source = read('strategies/asheparte-confluence-v1.pine');
  assert.doesNotMatch(source, /box\.get_text\s*\(/);
  for (const expression of ['array.push(msbZoneNames, caption)', 'array.shift(msbZoneNames)', 'array.remove(msbZoneNames, zoneIndex)', 'array.get(msbZoneNames, zoneIndex)']) assert.ok(source.includes(expression));
});
