# Journal calculation and date correction

Confirmed code defects corrected:

- A latest-500-deal database query truncated performance/history and discarded earlier opening fills. The selected account's full imported history is now read, with owner/account predicates retained.
- Opening costs were dropped and scaled entries overwrote one another. The calculator now tracks weighted-average entry prices, remaining position volume and unallocated entry costs. Each partial close receives its proportional opening costs. Reversals split closing/opening volume and commission/fees; swap/profit stay with the closed side. Close-by events are supported.
- Breakeven deals were counted as losses when calculating average loss. Only negative results enter that denominator now.
- Trade counts/date labels used browser-local conversion while daily totals used the raw timestamp date. All journal dates now preserve the MT5-reported clock fields consistently. The bridge does not declare a historical timezone/DST offset; the UI must not imply conversion to Philippine/local time. No historical timestamps are rewritten.
- Re-imported corrected deals were ignored. Scoped idempotent upserts now update the raw fields of an existing ticket. Invalid trade timestamps/fields are rejected before writes.
- Standalone bridge v1.00 started with the newest batch and advanced past older history. v1.01 sorts by (time, ticket), sends oldest unsent deals first, and updates the cursor even when a batch shares a timestamp. A versioned cursor replays the configured initial lookback once. Server/provider/endpoint identity contributes to cursor scope. Rebuilt public .ex5 accompanies .mq5.

Accounting contract: one row per closing MT5 deal (not one row per order or full position). Net = reported closing profit + closing swap/fees/commission + allocated entry costs. Entry costs are recognized on the closing date for this performance view. Deposits, withdrawals, standalone account charges and costs for still-open volume are not part of these realized closing-deal totals. Gross win/loss metrics retain their existing meaning: sums of positive/negative net closing results. Do not compare them directly to a cash-ledger balance change.

Incomplete opening history is explicitly flagged and entry price shown as Unknown; missing fees are not invented. Existing imports before the configured bridge lookback cannot be recovered by the website alone. No user history was deleted, no account pairing reset, and no production database mutation or deployment was performed by this change.

Validation: `node --test tools/test-journal-calculations.mjs`; TypeScript check; production website build; MetaEditor compile for standalone bridge. Tests use fixtures, not the user's actual account. Before claiming exact reconciliation, compare an MT5 deal ticket and its reported timestamp, entry/exit price, volume, commission, swap, fee and profit against the matching journal row. Confirm the user's intended basis (MT5 History Positions vs Deals vs cash ledger).

Deployment follow-up: publish backend/UI together. Standalone bridge users must install v1.01 and set InitialDays sufficiently far back before it first runs. Embedded advisor users already have oldest-first batching but may still need an explicitly approved backfill for older omitted data; do not reset their trading account or journal. Broker-side late corrections require a replay to reach the idempotent upsert; the current cursor remains incremental.

Reference: https://www.mql5.com/en/docs/constants/tradingconstants/dealproperties
