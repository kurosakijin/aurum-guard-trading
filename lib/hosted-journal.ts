import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { calculateJournal } from './journal-calculations.js';

type DealInput = {
  ticket?: string | number;
  positionId?: string | number;
  timeMsc?: number;
  type?: number;
  entry?: number;
  symbol?: string;
  volume?: number;
  price?: number;
  commission?: number;
  swap?: number;
  fee?: number;
  profit?: number;
};

export type BridgePayload = {
  provider?: string;
  account?: Record<string, unknown>;
  deals?: DealInput[];
};

function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('journal_storage_unavailable');
  return neon(url);
}

async function initializeJournalSchema() {
  const sql = database();
  await sql`CREATE TABLE IF NOT EXISTS journal_accounts (
    account_key TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL DEFAULT 'legacy-demo',
    provider TEXT NOT NULL,
    broker_server TEXT NOT NULL,
    login_masked TEXT NOT NULL,
    company TEXT NOT NULL,
    currency TEXT NOT NULL,
    balance DOUBLE PRECISION NOT NULL,
    equity DOUBLE PRECISION NOT NULL,
    margin DOUBLE PRECISION NOT NULL,
    free_margin DOUBLE PRECISION NOT NULL,
    floating_profit DOUBLE PRECISION NOT NULL,
    observed_at BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS journal_deals (
    account_key TEXT NOT NULL,
    owner_user_id TEXT NOT NULL DEFAULT 'legacy-demo',
    ticket TEXT NOT NULL,
    position_id TEXT NOT NULL,
    time_msc BIGINT NOT NULL,
    deal_type INTEGER NOT NULL,
    deal_entry INTEGER NOT NULL,
    symbol TEXT NOT NULL,
    volume DOUBLE PRECISION NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    commission DOUBLE PRECISION NOT NULL,
    swap DOUBLE PRECISION NOT NULL,
    fee DOUBLE PRECISION NOT NULL,
    profit DOUBLE PRECISION NOT NULL,
    PRIMARY KEY(account_key, ticket)
  )`;
  await sql`ALTER TABLE journal_accounts ADD COLUMN IF NOT EXISTS owner_user_id TEXT NOT NULL DEFAULT 'legacy-demo'`;
  await sql`ALTER TABLE journal_accounts ADD COLUMN IF NOT EXISTS trade_mode INTEGER`;
  await sql`ALTER TABLE journal_deals ADD COLUMN IF NOT EXISTS owner_user_id TEXT NOT NULL DEFAULT 'legacy-demo'`;
  return sql;
}

let journalSchemaPromise: ReturnType<typeof initializeJournalSchema> | null = null;

function ensureJournalSchema() {
  if (!journalSchemaPromise) {
    journalSchemaPromise = initializeJournalSchema().catch((error) => {
      journalSchemaPromise = null;
      throw error;
    });
  }
  return journalSchemaPromise;
}

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function text(value: unknown, maximum: number) {
  return String(value ?? '').slice(0, maximum);
}

function accountKey(provider: string, server: string, login: string) {
  return createHash('sha256').update(`${provider}|${server}|${login}`).digest('hex').slice(0, 32);
}

function maskLogin(login: string) {
  return login.length <= 3 ? '•••' : `${login.slice(0, 3)}•••`;
}

export async function ingestJournal(payload: BridgePayload, ownerUserId: string) {
  const account = payload.account;
  const provider = text(payload.provider || 'MT5', 24) || 'MT5';
  if (!account || typeof account !== 'object') throw new Error('account_required');
  const login = text(account.login, 64);
  const server = text(account.server, 160);
  const tradeMode = account.tradeMode;
  if (!login || !server) throw new Error('account_identity_required');
  if (typeof tradeMode !== 'number' || ![0, 1, 2].includes(tradeMode)) throw new Error('invalid_account_trade_mode');
  if (ownerUserId === 'legacy-demo' && tradeMode !== 0) throw new Error('personal_bridge_token_required');
  if (!Array.isArray(payload.deals) || payload.deals.length > 1000) throw new Error('invalid_deals');

  // Reject malformed trade events before changing either snapshot or history.
  for (const deal of payload.deals) {
    if (!deal || !Number.isInteger(Number(deal.type))) throw new Error('invalid_trade_deal');
    if (![0, 1].includes(Number(deal.type))) continue;
    if (!String(deal.ticket ?? '') || !Number.isSafeInteger(Number(deal.timeMsc)) ||
        Number(deal.timeMsc) < 946684800000 || Number(deal.timeMsc) > 4133980800000 ||
        ![0, 1, 2, 3].includes(Number(deal.entry)) || !(Number(deal.volume) > 0) ||
        !['volume', 'price', 'profit', 'commission', 'swap', 'fee'].every(field =>
          Number.isFinite(Number(deal[field as keyof DealInput] ?? 0)))) {
      throw new Error('invalid_trade_deal');
    }
  }
  const sql = await ensureJournalSchema();

  const key = accountKey(ownerUserId, `${provider}|${server}`, login);
  await sql`INSERT INTO journal_accounts
    (account_key,owner_user_id,provider,broker_server,login_masked,company,currency,trade_mode,balance,equity,margin,free_margin,floating_profit,observed_at,updated_at)
    VALUES (${key},${ownerUserId},${provider},${server},${maskLogin(login)},${text(account.company, 160)},${text(account.currency, 16)},${tradeMode},
      ${finiteNumber(account.balance)},${finiteNumber(account.equity)},${finiteNumber(account.margin)},
      ${finiteNumber(account.freeMargin)},${finiteNumber(account.floatingProfit)},${Math.trunc(finiteNumber(account.observedAt))},NOW())
    ON CONFLICT (account_key) DO UPDATE SET
      provider=EXCLUDED.provider,broker_server=EXCLUDED.broker_server,login_masked=EXCLUDED.login_masked,
      company=EXCLUDED.company,currency=EXCLUDED.currency,trade_mode=EXCLUDED.trade_mode,balance=EXCLUDED.balance,equity=EXCLUDED.equity,
      margin=EXCLUDED.margin,free_margin=EXCLUDED.free_margin,floating_profit=EXCLUDED.floating_profit,
      observed_at=EXCLUDED.observed_at,updated_at=NOW()`;

  let accepted = 0;
  for (const deal of payload.deals) {
    const ticket = text(deal.ticket, 64);
    const dealType = Math.trunc(finiteNumber(deal.type));
    if (!ticket || (dealType !== 0 && dealType !== 1)) continue;
    const inserted = await sql`INSERT INTO journal_deals
      (account_key,owner_user_id,ticket,position_id,time_msc,deal_type,deal_entry,symbol,volume,price,commission,swap,fee,profit)
      VALUES (${key},${ownerUserId},${ticket},${text(deal.positionId, 64)},${Math.trunc(finiteNumber(deal.timeMsc))},
        ${dealType},${Math.trunc(finiteNumber(deal.entry))},${text(deal.symbol, 64)},${finiteNumber(deal.volume)},
        ${finiteNumber(deal.price)},${finiteNumber(deal.commission)},${finiteNumber(deal.swap)},
        ${finiteNumber(deal.fee)},${finiteNumber(deal.profit)})
      ON CONFLICT (account_key,ticket) DO UPDATE SET
        position_id=EXCLUDED.position_id,time_msc=EXCLUDED.time_msc,deal_type=EXCLUDED.deal_type,
        deal_entry=EXCLUDED.deal_entry,symbol=EXCLUDED.symbol,volume=EXCLUDED.volume,
        price=EXCLUDED.price,commission=EXCLUDED.commission,swap=EXCLUDED.swap,
        fee=EXCLUDED.fee,profit=EXCLUDED.profit
      RETURNING ticket`;
    accepted += inserted.length;
  }
  return { accepted };
}

export async function readJournal(ownerUserId: string, selectedAccountKey?: string | null) {
  const sql = database();
  const accounts = await sql`SELECT * FROM journal_accounts WHERE owner_user_id=${ownerUserId} ORDER BY account_key`;
  if (!accounts.length) return { connected: false };
  const account = selectedAccountKey ? accounts.find(row => row.account_key === selectedAccountKey) : accounts[0];
  if (!account) throw new Error('account_not_found');
  const accountList = accounts.map(row => ({ id: String(row.account_key), provider: String(row.provider), server: String(row.broker_server), loginMasked: String(row.login_masked), updatedAt: row.updated_at, mode: row.trade_mode === 2 ? 'live' : row.trade_mode === 0 ? 'demo' : row.trade_mode === 1 ? 'contest' : 'unknown' }));
  // Reconstruct positions from all imported fills, not just the last 500 events.
  const rows = await sql`SELECT * FROM journal_deals WHERE account_key=${account.account_key} AND owner_user_id=${ownerUserId}
    ORDER BY time_msc ASC, ticket ASC`;
  const { trades, daily, dailyBreakdown, summary, quality } = calculateJournal(rows);
  return {
    connected: true,
    accounts: accountList,
    selectedAccountId: String(account.account_key),
    mode: account.trade_mode === 2 ? 'live' : account.trade_mode === 0 ? 'demo' : account.trade_mode === 1 ? 'contest' : 'unknown',
    account: {
      provider: account.provider,
      brokerServer: account.broker_server,
      loginMasked: account.login_masked,
      company: account.company,
      currency: account.currency,
      balance: finiteNumber(account.balance),
      equity: finiteNumber(account.equity),
      freeMargin: finiteNumber(account.free_margin),
      floatingProfit: finiteNumber(account.floating_profit),
      updatedAt: account.updated_at,
    },
    summary,
    quality,
    trades,
    daily,
    dailyBreakdown,
  };
}
