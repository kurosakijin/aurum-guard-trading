// MT5 trade-deal accounting, scoped to one account by the caller.
// One output row per closing deal, not per order or complete position.
export type JournalDealRow = Record<string, unknown>;
export type CalculatedJournalTrade = {
  ticket: string; positionId: string; closed: string; dateKey: string;
  symbol: string; side: 'BUY' | 'SELL'; volume: number;
  entryPrice: number | null; exitPrice: number; costs: number; net: number;
  incompleteHistory: boolean;
};
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const costs = (row: JournalDealRow) => number(row.commission) + number(row.swap) + number(row.fee);
const epsilon = 1e-8;
type Position = { volume: number; entryPrice: number; entryCosts: number; side: 'BUY' | 'SELL' };

export function calculateJournal(input: JournalDealRow[]) {
  // Stable numeric ticket ordering matters for entry/exit fills at the same millisecond.
  const ticketCompare = (a: string, b: string) => /^\d+$/.test(a) && /^\d+$/.test(b)
    ? (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0) : a.localeCompare(b);
  const rows = [...input].sort((a, b) => number(a.time_msc) - number(b.time_msc) || ticketCompare(String(a.ticket), String(b.ticket)));
  const positions = new Map<string, Position>();
  const seen = new Set<string>();
  const trades: CalculatedJournalTrade[] = [];
  const daily: Record<string, number> = {};
  const dailyBreakdown: Record<string, { net: number; profit: number; loss: number; trades: number; deposits: number; withdrawals: number }> = {};
  const cashMovements: Array<{ ticket: string; occurred: string; dateKey: string; type: 'DEPOSIT' | 'WITHDRAWAL'; amount: number }> = [];
  let invalidDeals = 0;
  for (const row of rows) {
    const ticket = String(row.ticket ?? '');
    if (seen.has(ticket)) continue;
    seen.add(ticket);
    const type = Number(row.deal_type), entry = Number(row.deal_entry);
    const volume = number(row.volume), timestamp = Number(row.time_msc);
    const positionId = String(row.position_id ?? '');
    if (!ticket || !Number.isSafeInteger(timestamp) || timestamp <= 0 || !Number.isFinite(new Date(timestamp).getTime())) {
      invalidDeals++;
      continue;
    }
    const occurred = new Date(timestamp).toISOString();
    const movementDateKey = occurred.slice(0, 10);
    // MetaTrader DEAL_TYPE_BALANCE (numeric 2) represents deposits/withdrawals.
    // Keep funding separate from trading returns and performance ratios.
    if (type === 2) {
      const amount = number(row.profit) + costs(row);
      if (Math.abs(amount) > epsilon) {
        cashMovements.push({ ticket, occurred, dateKey: movementDateKey,
          type: amount > 0 ? 'DEPOSIT' : 'WITHDRAWAL', amount });
        const day = dailyBreakdown[movementDateKey] ?? { net: 0, profit: 0, loss: 0, trades: 0, deposits: 0, withdrawals: 0 };
        if (amount > 0) day.deposits += amount;
        else day.withdrawals += amount;
        dailyBreakdown[movementDateKey] = day;
      }
      continue;
    }
    if (![0, 1].includes(type)) continue; // credit, bonus, correction and charges are not deposits.
    if (![0, 1, 2, 3].includes(entry) || !(volume > 0)) {
      invalidDeals++;
      continue;
    }
    const key = `${positionId}|${String(row.symbol)}`;
    const side = type === 0 ? 'BUY' : 'SELL';
    const state = positionId && positionId !== '0' ? positions.get(key) : undefined;
    if (entry === 0) {
      if (!positionId || positionId === '0') { invalidDeals++; continue; }
      if (state && state.side !== side) { invalidDeals++; positions.delete(key); continue; }
      const total = (state?.volume ?? 0) + volume;
      positions.set(key, {
        volume: total, side,
        entryPrice: ((state?.entryPrice ?? 0) * (state?.volume ?? 0) + number(row.price) * volume) / total,
        entryCosts: (state?.entryCosts ?? 0) + costs(row),
      });
      continue;
    }

    // INOUT closes the old side and opens only its remaining excess volume.
    const complete = !!state && state.side !== side && (entry === 2 ? volume + epsilon >= state.volume : volume <= state.volume + epsilon);
    const closingVolume = entry === 2 && complete ? state!.volume : volume;
    const allocatedEntryCosts = complete ? state!.entryCosts * Math.min(1, closingVolume / state!.volume) : 0;
    const exitShare = entry === 2 && complete ? closingVolume / volume : 1;
    // Swap/profit belong to the closed side; commission/fee are split by volume.
    const closingCosts = number(row.swap) + (number(row.commission) + number(row.fee)) * exitShare;
    const totalCosts = allocatedEntryCosts + closingCosts;
    const net = number(row.profit) + totalCosts;
    // Preserve the bridge's MT5-reported clock values. Do not convert to browser
    // local time; the payload contains no historical timezone/DST information.
    const closed = new Date(timestamp).toISOString();
    const dateKey = closed.slice(0, 10);
    trades.push({ ticket, positionId, closed, dateKey, symbol: String(row.symbol),
      side: complete ? state!.side : side === 'BUY' ? 'SELL' : 'BUY', volume: closingVolume,
      entryPrice: complete ? state!.entryPrice : null, exitPrice: number(row.price),
      costs: totalCosts, net, incompleteHistory: !complete });
    daily[dateKey] = (daily[dateKey] ?? 0) + net;
    const day = dailyBreakdown[dateKey] ?? { net: 0, profit: 0, loss: 0, trades: 0, deposits: 0, withdrawals: 0 };
    day.net += net;
    day.profit += net > epsilon ? net : 0;
    day.loss += net < -epsilon ? net : 0;
    day.trades += 1;
    dailyBreakdown[dateKey] = day;

    if (!complete) {
      positions.delete(key); // Missing history: do not fabricate a reversal's remainder.
    } else if (entry === 2) {
      const remaining = volume - closingVolume;
      if (remaining > epsilon) positions.set(key, { volume: remaining, side, entryPrice: number(row.price),
        entryCosts: (number(row.commission) + number(row.fee)) * (1 - exitShare) });
      else positions.delete(key);
    } else {
      state!.volume -= closingVolume;
      state!.entryCosts -= allocatedEntryCosts;
      if (state!.volume <= epsilon) positions.delete(key);
    }
  }
  const net = trades.reduce((sum, trade) => sum + trade.net, 0);
  const winning = trades.filter(trade => trade.net > epsilon);
  const losing = trades.filter(trade => trade.net < -epsilon);
  const grossProfit = winning.reduce((sum, trade) => sum + trade.net, 0);
  const grossLoss = losing.reduce((sum, trade) => sum + trade.net, 0);
  const deposits = cashMovements.filter(item => item.amount > 0).reduce((sum, item) => sum + item.amount, 0);
  const withdrawals = cashMovements.filter(item => item.amount < 0).reduce((sum, item) => sum + item.amount, 0);
  return {
    trades: trades.reverse(), cashMovements: cashMovements.reverse(), daily, dailyBreakdown,
    summary: { net, grossProfit, grossLoss, closedTrades: trades.length,
      winRate: trades.length ? winning.length * 100 / trades.length : 0,
      profitFactor: grossLoss < 0 ? grossProfit / -grossLoss : grossProfit > 0 ? 999 : 0,
      averageWin: winning.length ? grossProfit / winning.length : 0,
      averageLoss: losing.length ? grossLoss / losing.length : 0,
      deposits, withdrawals, netFunding: deposits + withdrawals },
    quality: { incompleteTrades: trades.filter(trade => trade.incompleteHistory).length, invalidDeals,
      timeBasis: 'MT5-reported time', accounting: 'Closing deals including allocated entry costs' },
  };
}
