# Aurum Guard AI Approval Layer

This package adds a local BUY / SELL / NO TRADE meta-label model to the Aurum
Guard MT5 Expert Advisor. It does not guess on every candle: a causal defended
trend/pullback candidate must exist first, then a regularized Extra Trees
classifier estimates whether that candidate deserves approval. It does not bypass
the EA's risk controls and it does not promise profit.

EA v1.80 also adds one-way profit protection for a qualifying demo position:
near break-even at $3 open profit, an intended $1.50 lock at $6, and a $3
give-back trail after $10. These are defaults for a 0.01-lot setup, not a
guarantee; broker stop distance, gaps, slippage, commissions and latency can
produce a different result.

## What is enhanced

- Execution-aligned labels approximate the EA's $7.50 planned loss, $20 final
  target, break-even, profit lock and trailing give-back instead of scoring a
  different generic ATR trade.
- 45 causal Gold/Silver, volatility, candle, trend, session and completed
  M5/M15/H1 context features. M1 remains the decision/trigger timeframe.
- A shallow, regularized 300-tree Extra Trees classifier instead of the former
  gradient-boosted model.
- Four expanding walk-forward checks with a 60-bar leakage gap.
- A newest-period quarantine check with an estimated 0.10R round-trip cost.
- Automatic fail-closed promotion: a model must show positive conservative
  utility in at least three walk-forward folds and in the newest test.
- A live regime-drift lock blocks candidates when too many inputs fall outside
  the development period's 1st-to-99th-percentile feature ranges.

The 45-feature M5/M15/H1 challenger is included for transparent research but was
**rejected**, not promoted: its development replay lost 34.43R with a 0.80 profit
factor, and its quarantine profit factor was only 1.04. The active packaged v5
shadow model remains the less-bad 33-feature champion. You can reproduce the
challenger with `train_ai.py --multitimeframe-challenger --model challenger.joblib
--report challenger.json`; never overwrite a champion merely because a model has
more inputs.

## V7 forward-shadow challenger

A broader 1,824-experiment chronological search selected a 33-feature Random
Forest at a fixed 55% threshold. Its first three selection folds totalled
+21.42R, but the untouched confirmation fold lost 7.28R with a 0.74 profit
factor. The previously observed newest diagnostic window showed +8.31R and a
1.42 profit factor, which cannot erase the confirmation failure. It is therefore
packaged as `aurum_guard_ai_v7_shadow.joblib` with `deployment_eligible=false`.

`run_v7_shadow.cmd` records fresh closed-bar probabilities in a separate file;
it does not replace the EA signal and cannot authorize an order. Use that forward
log to gather new evidence without changing the v5 champion or risking money.

## Safe first run

1. Use a MetaTrader 5 demo account and keep MT5 open.
2. Confirm that Market Watch contains your broker's exact `XAUUSD` and `XAGUSD`
   symbols. Edit the two `.cmd` files if your broker uses suffixes.
3. Run `install_ai.cmd` once.
4. Run `train_ai.cmd`. It uses the fixed 52.5% protected-outcome threshold chosen
   on older development windows, then reports a newest-period quarantine test. If the gate
   fails, the model is marked `FAILED RESEARCH GATE - SHADOW ONLY` and cannot
   approve an automated entry.
5. Run `backtest_ai.cmd` to reproduce a fixed-threshold expanding walk-forward
   shadow backtest. It rejects regime drift, prevents overlapping positions and
   counts an ambiguous same-candle TP/SL as an SL.
6. Run `run_ai_gate.cmd`. It publishes one score after each completed M1 candle.
7. Attach the latest Aurum Guard EA with `UseAIApprovalGate=true`,
   `AIShadowMode=true`, and `EnableNewEntries=false` first.
8. Compare at least several weeks of shadow decisions with your demo feed.

Run `build_learning_dataset.cmd` to create a documented CSV from the frozen
broker snapshot. Read `DATASET-GUIDE.md` before using it: future outcome columns
are clearly marked `LABEL_ONLY` and must never enter a live model. `READING-LIST.md`
contains books and authoritative dataset sources without copying copyrighted text.

Only after acceptable out-of-sample and forward-demo evidence should you set
`AIShadowMode=false`. A model that is not marked deployment-eligible remains
fail-closed even if strict mode is selected. Keep `AllowLiveTrading=false`; the AI gate is research
software and sudden moves, slippage, gaps, bad data, and regime changes remain.

The September 4 execution-aligned replay improved materially but still failed
promotion. Its newest quarantine had 95 non-overlapping shadow trades, 48.4%
wins, +7.11R and a 1.30 profit factor after estimated costs. However, one of the
four development folds lost, the development profit factor was only 1.04, the
confidence bounds stayed below zero, and drawdown exceeded the strict limit.
The packaged EA therefore remains entry-disabled and the AI remains shadow-only.

The signal file is written atomically to MetaTrader's shared Common/Files
folder. If the runner stops or its score becomes stale, strict mode blocks new
entries rather than trading without AI approval.

The first `train_ai.cmd` run freezes the exact Gold/Silver research window in
`aurum_guard_ai_research_snapshot.joblib`. `backtest_ai.cmd` reuses that file,
so a later moving MT5 history window cannot silently change the published test.
Use `train_ai.py --refresh-snapshot` only when you intentionally begin a new,
separately documented experiment.

Only load the included model or one you trained yourself. Joblib model files
are executable Python artifacts and should never be accepted from an untrusted
source.
