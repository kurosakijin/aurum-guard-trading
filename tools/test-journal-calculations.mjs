import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
function load(file) {
  const source = readFileSync(file, 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function('exports', js)(exports);
  return exports;
}
const { calculateJournal } = load('lib/journal-calculations.ts');
const { journalDateKey, journalDateLabel } = load('lib/journal-date.ts');
const start = Date.parse('2026-09-30T23:50:00Z');
const deal = (ticket, entry, extra = {}) => ({ ticket: String(ticket), position_id: 'p1', symbol: 'XAUUSD',
  time_msc: start + ticket * 1000, deal_type: entry === 0 ? 0 : 1, deal_entry: entry,
  volume: 1, price: entry === 0 ? 100 : 110, profit: entry === 0 ? 0 : 10,
  commission: 0, swap: 0, fee: 0, ...extra });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('opening and closing costs both included', () => {
  const r = calculateJournal([deal(1, 0, { commission: -2, fee: -1 }), deal(2, 1, { commission: -2, swap: -1, fee: -1 })]);
  near(r.summary.net, 3);
  near(r.trades[0].costs, -7);
  assert.equal(r.trades[0].entryPrice, 100);
  assert.equal(r.quality.incompleteTrades, 0);
});
test('scaled entries use volume weighted price and proportional costs on partial exits', () => {
  const r = calculateJournal([deal(1, 0, { commission: -2 }), deal(2, 0, { volume: 3, price: 120, commission: -6 }),
    deal(3, 1, { volume: 1, profit: 5 }), deal(4, 1, { volume: 3, profit: 15 })]);
  for (const t of r.trades) near(t.entryPrice, 115);
  near(r.trades[0].costs, -6);
  near(r.trades[1].costs, -2);
  near(r.summary.net, 12);
});
test('netting reversal closes old volume and carries only new-side costs', () => {
  const r = calculateJournal([deal(1, 0, { volume: 2, commission: -2 }),
    deal(2, 2, { volume: 3, price: 110, profit: 20, commission: -3, swap: -1 }),
    deal(3, 1, { deal_type: 0, volume: 1, price: 105, profit: 5, commission: -1 })]);
  assert.equal(r.trades[1].volume, 2);
  assert.equal(r.trades[0].side, 'SELL');
  assert.equal(r.trades[0].entryPrice, 110);
  near(r.trades[1].net, 15);
  near(r.trades[0].net, 3);
  near(r.summary.net, 18);
});
test('close-by events and independent positions do not share opening data', () => {
  const r = calculateJournal([deal(1, 0), deal(2, 0, { position_id: 'p2', deal_type: 1, price: 200 }),
    deal(3, 3), deal(4, 3, { position_id: 'p2', deal_type: 0 })]);
  assert.equal(r.trades[0].side, 'SELL');
  assert.equal(r.trades[0].entryPrice, 200);
  assert.equal(r.trades[1].entryPrice, 100);
});
test('missing entry is visibly incomplete, never price zero', () => {
  const r = calculateJournal([deal(2, 1)]);
  assert.equal(r.trades[0].entryPrice, null);
  assert.equal(r.quality.incompleteTrades, 1);
});
test('equal timestamps use numeric tickets and duplicate retries are idempotent', () => {
  const open = deal(9, 0, { time_msc: start });
  const close = deal(10, 1, { time_msc: start });
  const r = calculateJournal([close, open, close]);
  assert.equal(r.trades.length, 1);
  assert.equal(r.trades[0].entryPrice, 100);
});
test('full history is not limited to 500 raw events', () => {
  const rows = [];
  for (let i = 0; i < 600; i++) rows.push(deal(i * 2 + 1, 0, { position_id: String(i + 1) }), deal(i * 2 + 2, 1, { position_id: String(i + 1) }));
  assert.equal(calculateJournal(rows).summary.closedTrades, 600);
  assert.doesNotMatch(readFileSync('lib/hosted-journal.ts', 'utf8'), /LIMIT 500/);
});
test('breakevens do not dilute average loss', () => {
  const r = calculateJournal([deal(1, 0), deal(2, 1, { profit: 0 }), deal(3, 0), deal(4, 1, { profit: -10 })]);
  assert.equal(r.summary.averageLoss, -10);
});
test('daily breakdown exposes separate gross profit, loss, net and real trade count', () => {
  const r = calculateJournal([deal(1, 0), deal(2, 1, { profit: 20 }), deal(3, 0), deal(4, 1, { profit: -7 })]);
  const day = r.dailyBreakdown['2026-09-30'];
  assert.deepEqual(day, { net: 13, profit: 20, loss: -7, trades: 2, deposits: 0, withdrawals: 0 });
  near(day.profit + day.loss, day.net);
  near(r.daily['2026-09-30'], day.net);
});
test('calendar and display retain MT5 date across browser timezone and midnight', () => {
  const r = calculateJournal([deal(1, 0), deal(2, 1, { time_msc: Date.parse('2026-09-30T23:59:59Z') })]);
  assert.equal(r.trades[0].dateKey, '2026-09-30');
  assert.equal(journalDateKey(r.trades[0].closed), '2026-09-30');
  assert.match(journalDateLabel(r.trades[0].closed), /30 Sept 2026, 23:59:59/);
  assert.equal(r.daily['2026-10-01'], undefined);
  near(Object.values(r.daily).reduce((a, b) => a + b, 0), r.summary.net);
});
test('cash funding is reported separately and never added to trading P/L', () => {
  const r = calculateJournal([deal(1, 1, { time_msc: 0 }), deal(2, 1, { time_msc: Infinity }),
    deal(3, 1, { deal_type: 2, profit: 10000 }), deal(4, 1, { deal_type: 2, profit: -250 })]);
  assert.equal(r.trades.length, 0);
  assert.equal(r.quality.invalidDeals, 2);
  assert.equal(r.summary.net, 0);
  assert.equal(r.summary.deposits, 10000);
  assert.equal(r.summary.withdrawals, -250);
  assert.equal(r.summary.netFunding, 9750);
  assert.equal(r.cashMovements.length, 2);
  assert.deepEqual(r.dailyBreakdown['2026-09-30'], { net: 0, profit: 0, loss: 0, trades: 0, deposits: 10000, withdrawals: -250 });
});
test('re-import can update corrections and reads retain owner/account scope', () => {
  const source = readFileSync('lib/hosted-journal.ts', 'utf8');
  assert.ok(source.includes('ON CONFLICT (account_key,ticket) DO UPDATE SET'));
  assert.ok(source.includes('WHERE account_key=${account.account_key} AND owner_user_id=${ownerUserId}'));
  assert.ok(source.includes('![0, 1, 2].includes(dealType)'));
});

test('standalone bridge pages oldest-first and advances same-millisecond tickets', () => {
  const source = readFileSync('public/downloads/AsheparteJournalBridge.mq5', 'utf8');
  assert.ok(source.includes('SortJournalHistory(ordered,0,total-1)'));
  assert.ok(source.includes('const int first = 0;'));
  assert.ok(source.includes('if(sent_count>=safe_limit) break;'));
  assert.ok(source.includes('newest_time_msc == last_time_msc && newest_ticket > last_ticket'));
  assert.ok(source.includes('AsheJ102Time_'));
  const rows = Array.from({ length: 1103 }, (_, ticket) => ({ time: 1000 + Math.floor(ticket / 800), ticket: ticket + 1 })).reverse();
  rows.sort((a, b) => a.time - b.time || a.ticket - b.ticket);
  const received = [];
  let cursor = { time: 0, ticket: 0 };
  for (;;) {
    const page = rows.filter(r => r.time > cursor.time || r.time === cursor.time && r.ticket > cursor.ticket).slice(0, 250);
    if (!page.length) break;
    received.push(...page);
    cursor = page.at(-1);
  }
  assert.equal(received.length, 1103);
  assert.equal(new Set(received.map(r => r.ticket)).size, 1103);
});
