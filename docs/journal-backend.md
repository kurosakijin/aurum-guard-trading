# Asheparte MT5 / ACCM journal backend contract

The public UI and read-only MQL5 bridge are complete. Live pairing requires a
server-side identity provider and durable SQL database. Do not implement this
flow with browser storage or an in-memory serverless cache.

## Security boundary

- A signed-in site user creates a revocable, random 256-bit bridge token.
- Store only a SHA-256/HMAC digest of that token.
- The token is bound on first use to `provider + server + login` and cannot be
  reused for another broker account.
- The bridge sends the token in `X-Asheparte-Bridge-Token` over HTTPS.
- Every journal read filters by the authenticated site's stable user id.
- The bridge is ingestion-only. It exposes no order endpoint and contains no
  MQL5 trading calls.
- Rate-limit failed token attempts and ingestion by token digest and IP.

## Endpoints

### `POST /api/journal/tokens`

Requires site authentication. Creates a token with a short pairing expiry and
returns the plaintext token exactly once.

### `POST /api/mt5/ingest`

Requires `X-Asheparte-Bridge-Token`. Validates body size, provider, account
identity, numeric bounds and deal count. Upserts the account snapshot and deals
in one transaction. Deal uniqueness is `(account_id, ticket)`.

### `GET /api/journal`

Requires site authentication. Returns only accounts owned by that user,
aggregated performance, daily totals and paginated closed positions.

### `DELETE /api/journal/accounts/:id`

Requires site authentication and account ownership. Revokes bridge tokens and
deletes or schedules deletion of the user's imported account data.

## Canonical records

- `users`: stable auth subject, display email, created timestamp.
- `accounts`: owner, provider, broker server, login, currency, latest snapshot.
- `bridge_tokens`: account/owner, token digest, expiry, revoked timestamp.
- `deals`: raw MT5 deal event keyed by account and ticket.
- `positions`: normalized entry/exit aggregation keyed by account and position id.
- `cash_ledger`: deposits, withdrawals, credits, bonuses and corrections kept
  separate from trading P/L.

Net trading P/L is `profit + commission + swap + fee`. Deposits and withdrawals
must never be included in trading returns.

