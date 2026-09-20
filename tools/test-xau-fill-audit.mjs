import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (name) => readFileSync(new URL(`../strategies/${name}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const original = read('xau-a-plus-v2.6-original.pine');
const source = read('xau-a-plus-v2.6.1-fill-audit.pine');

// Reference model, not a Pine interpreter or TradingView broker emulator.
function processFills(state, ledger, positionSize, allowRetry = true) {
  const next = { ...state };
  const fills = ledger.slice(state.processed);
  const side = state.direction === 1 ? 'LONG' : 'SHORT';
  for (const fill of fills) {
    if (state.direction !== 0 && fill.entry === side && fill.exit === `${side} TP1` && fill.reason === 'TP1 PROFIT') next.tp1 = true;
  }
  next.processed = ledger.length;
  next.justClosed = fills.length > 0 && positionSize === 0 && state.direction !== 0;
  if (next.justClosed) {
    next.retry = allowRetry && !next.tp1 && !state.wasRetry;
    next.direction = 0;
    next.tp1 = false;
  }
  return next;
}
const initial = { direction: 1, processed: 0, tp1: false, wasRetry: false, retry: false };
const fill = (side, leg, reason) => ({ entry: side, exit: `${side} ${leg}`, reason });

test('entry filters and risk inputs remain identical', () => {
  const start = '// INPUTS';
  const end = '// SETUP STATE';
  assert.ok(original.includes(start));
  assert.equal(source.slice(source.indexOf(start), source.indexOf(end)), original.slice(original.indexOf(start), original.indexOf(end)));
  assert.match(source, /timeframe\.period == "5"/);
  assert.match(source, /calc_on_order_fills=false/);
});

test('Pine uses tagged fills, not candle touches or quantity inference', () => {
  assert.equal((source.match(/comment_profit="TP1 PROFIT"/g) ?? []).length, 2);
  assert.match(source, /strategy\.closedtrades\.exit_comment\(tradeIndex\)/);
  assert.match(source, /fillReason == "TP1 PROFIT"/);
  assert.doesNotMatch(source, /high >= activeTP1|low <= activeTP1|strategy\.position_size\[1\]|activeTotalQty - qtyStep/);
  assert.ok(source.indexOf('// CLOSED POSITION / RETRY') < source.indexOf('// REGISTER NEW SETUP'));
  assert.match(source, /bool canRegister =\n     not positionJustClosed/);
  for (const side of ['long', 'short']) assert.ok(source.includes(`correctTimeframe and not positionJustClosed and not ${side}RetryBlocked`));
});

test('stopped TP1 bracket does not count as TP1; full round trip arms retry', () => {
  const result = processFills(initial, [fill('LONG', 'TP1', 'INITIAL STOP'), fill('LONG', 'RUNNER', 'STOP')], 0);
  assert.equal(result.justClosed, true);
  assert.equal(result.retry, true);
  assert.equal(result.direction, 0);
});

test('partial stop fill does not activate breakeven', () => {
  assert.equal(processFills(initial, [fill('LONG', 'TP1', 'INITIAL STOP')], 0.5).tp1, false);
});

test('actual TP1 fill activates breakeven for both directions', () => {
  for (const [direction, side] of [[1, 'LONG'], [-1, 'SHORT']]) {
    const result = processFills({ ...initial, direction }, [fill(side, 'TP1', 'TP1 PROFIT')], direction * 0.5);
    assert.equal(result.tp1, true);
    assert.equal(result.justClosed, false);
  }
});

test('TP1 and runner closed in same calculation do not arm retry', () => {
  const result = processFills(initial, [fill('LONG', 'TP1', 'TP1 PROFIT'), fill('LONG', 'RUNNER', 'STOP')], 0);
  assert.equal(result.retry, false);
});

test('previous TP1 remains remembered when runner closes later', () => {
  const ledger = [fill('LONG', 'TP1', 'TP1 PROFIT')];
  const partial = processFills(initial, ledger, 0.5);
  const closed = processFills(partial, [...ledger, fill('LONG', 'RUNNER', 'STOP')], 0);
  assert.equal(closed.retry, false);
  assert.equal(processFills(closed, [...ledger, fill('LONG', 'RUNNER', 'STOP')], 0).justClosed, false);
});

test('retry loss cannot chain retries; disabled retry stays disabled', () => {
  const ledger = [fill('LONG', 'TP1', 'INITIAL STOP')];
  assert.equal(processFills({ ...initial, wasRetry: true }, ledger, 0).retry, false);
  assert.equal(processFills(initial, ledger, 0, false).retry, false);
});

test('opposite-side and unrelated profit legs cannot claim TP1', () => {
  const ledger = [fill('SHORT', 'TP1', 'TP1 PROFIT'), fill('LONG', 'RUNNER', 'TP1 PROFIT')];
  assert.equal(processFills(initial, ledger, 0.5).tp1, false);
});
