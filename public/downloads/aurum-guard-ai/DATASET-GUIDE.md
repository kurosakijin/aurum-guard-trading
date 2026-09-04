# Aurum Guard dataset and candle guide

This guide explains the data; it does not turn any candle pattern into a guarantee.

## Read one candle

- **Open / close:** the candle body shows the net move during that interval.
- **High / low:** the full range shows how far price explored.
- **Upper wick:** rejection from higher prices; context decides whether it matters.
- **Lower wick:** rejection from lower prices; context decides whether it matters.
- **Large body:** strong movement, or dangerous late chasing when already extended.
- **Small body / long wicks:** disagreement. Wait for a completed confirmation candle.

Never read one candle alone. Compare it with trend, nearby swing/liquidity levels,
volatility, spread, news risk, and the next higher timeframe.

## The four-timeframe decision

| Layer | Question | Aurum Guard use |
| --- | --- | --- |
| H1 | Which regime dominates? | EMA gap, EMA slope, RSI bias, completed-bar range |
| M15 | Is the setup safe or shocked? | Trend context and abnormal-range risk |
| M5 | Is a pullback/retest being defended? | Shorter context before the trigger |
| M1 | Did the trigger candle close? | Candidate direction, entry score, spread check |

Higher-timeframe features are built only from candles that were already closed at
the M1 decision time. An unfinished H1 candle is never allowed to leak its later
high, low, or close into an earlier decision.

## Join and close rules

A candidate is scored only after the rule engine finds a defended pullback. The
AI is an extra veto, not permission to ignore the EA. A new trade still needs:

1. Completed M1 trigger candle.
2. Acceptable higher-timeframe context.
3. Gold/Silver agreement, normal spread, no news/shock lock, and no open trade.
4. A score above the frozen threshold and no feature-drift warning.
5. A broker-valid hard SL before the order is accepted.

Close logic is mechanical: hard SL, final target, stepped protection, time expiry,
or EA invalidation. Do not widen the SL, average down, martingale, or instantly
reverse after a loss. A losing trade is normal model error, not proof that the
next direction must win.

## Build your broker-specific learning table

1. Run `install_ai.cmd`.
2. Run `train_ai.cmd --refresh-snapshot` from a Command Prompt if you intentionally
   want to capture a new MT5 M1 window; ordinary `train_ai.cmd` reuses the frozen one.
3. Run `build_learning_dataset.cmd`.
4. Open `aurum_guard_learning_dataset.csv`.

The CSV has 45 causal model inputs plus timestamp, split and direction. Columns
ending in `LABEL_ONLY` describe what happened later. They are permitted only for
offline training/evaluation and are forbidden inputs in live decisions.

The chronological split has an older development set, a 60-bar leakage gap, and
an untouched newest quarantine set. Never random-shuffle this time series before
testing. Keep a separate forward demo after all design choices are frozen.

## Risk language

`R` is the loss planned at entry. If the planned loss is $7.50, +2R means about
$15 before fill differences and costs, while -1R means about -$7.50. Actual loss
can exceed the plan because of gaps, slippage, broker stops, commissions, or
connection failure. Fixed 0.01 lot does not mean fixed dollar risk because symbol
contract sizes and stop distances vary by broker.

Primary references:

- MQL5 `copy_rates_range` bar fields and UTC handling: https://www.mql5.com/en/docs/python_metatrader5/mt5copyratesrange_py
- MQL5 Strategy Tester: https://www.mql5.com/en/docs/runtime/testing
- CFTC warning on AI trading claims: https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/AITradingBots.html
- CFTC historical Commitments of Traders data: https://www.cftc.gov/MarketReports/CommitmentsofTraders/HistoricalCompressed/index.htm
- CME real-time and historical market data: https://www.cmegroup.com/market-data/browse-data.html
