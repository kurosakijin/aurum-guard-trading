CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  broker_server TEXT NOT NULL,
  broker_login TEXT NOT NULL,
  company TEXT,
  currency TEXT NOT NULL,
  trade_mode INTEGER NOT NULL,
  balance REAL NOT NULL DEFAULT 0,
  equity REAL NOT NULL DEFAULT 0,
  margin REAL NOT NULL DEFAULT 0,
  free_margin REAL NOT NULL DEFAULT 0,
  floating_profit REAL NOT NULL DEFAULT 0,
  observed_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, provider, broker_server, broker_login)
);

CREATE TABLE bridge_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  token_digest TEXT NOT NULL UNIQUE,
  pairing_expires_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE deals (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  ticket TEXT NOT NULL,
  order_ticket TEXT NOT NULL,
  position_id TEXT NOT NULL,
  time_msc INTEGER NOT NULL,
  type INTEGER NOT NULL,
  entry INTEGER NOT NULL,
  symbol TEXT NOT NULL,
  volume REAL NOT NULL,
  price REAL NOT NULL,
  commission REAL NOT NULL DEFAULT 0,
  swap REAL NOT NULL DEFAULT 0,
  fee REAL NOT NULL DEFAULT 0,
  profit REAL NOT NULL DEFAULT 0,
  comment TEXT,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(account_id, ticket)
);

CREATE INDEX deals_account_time_idx ON deals(account_id, time_msc DESC);
CREATE INDEX deals_account_position_idx ON deals(account_id, position_id);
