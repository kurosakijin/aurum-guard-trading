# Asheparte AI Analysis Layer

This package adds a local BUY / SELL / WAIT research reading to the Asheparte
MT5 Analysis Advisor. It does not guess on every candle: a causal defended
trend/pullback candidate must exist first, then a regularized Extra Trees
classifier estimates confidence for that candidate. The result is displayed as
context only. Neither this package nor the Analysis Advisor can place, modify,
or close an MT5 order, and the score does not promise profit.

Advisor v3.20 studies a four-stage M15/M30/H1 sequence: tight consolidation and
tick-volume POC, liquidity sweep, directional displacement, then a defended
return to POC. It combines that structure with M15/H1/D1 confirmation, completed
M1 timing, Gold/Silver agreement, spread, news, and shock checks. It draws a
manual plan only; it contains no active order path.

The POC sequence intentionally rejects M1 as an input timeframe. M1 noise can
make consolidation and sweep labels misleading; use M15, M30 or H1 instead.

## What is enhanced

- The current EA caps planned loss in account currency and projects its final
  target at 2.14 times the accepted structural risk.
- 45 causal Gold/Silver, volatility, candle, trend, session and completed
  M5/M15/H1 context features. POC trade decisions use M15, M30 or H1 only.
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

## V8 calibrated equity-aware shadow

`train_ai_v8.py` adds seven explicit chart-regime features: completed
M5/M15/H1 trend agreement, an aggregate alignment score, multi-timeframe trend
strength, wick imbalance, and a volume/range shock score. Its Extra Trees output
is sigmoid-calibrated on a later, disjoint chronological slice before thresholds
are selected on net-R utility. This makes BUY/SELL probabilities estimates of a
defined protected-trade outcome rather than decorative confidence numbers.

Account equity is not used as a chart predictor. A separate controller raises
the entry threshold during drawdown, pauses after consecutive losses, and uses a
4R circuit breaker without martingale or recovery sizing. The live shadow runner
also publishes `EQUITY_GUARD` when session equity falls 2% from its peak.

V8's newest diagnostic produced 16 equity-controlled trades, 62.5% winners,
+7.30R, a 3.81 profit factor, and 2.10R maximum drawdown. It nevertheless lost
two of three earlier walk-forward periods, so `deployment_eligible` remains
false. Run `run_v8_shadow.cmd` only on demo to collect genuinely new evidence.

## Safe first run

1. Use a MetaTrader 5 demo account and keep MT5 open.
2. Confirm that Market Watch contains your broker's exact `XAUUSD` and `XAGUSD`
   symbols. Edit the two `.cmd` files if your broker uses suffixes.
3. Run `install_ai.cmd` once.
4. Run `train_ai.cmd`. It uses the fixed 52.5% protected-outcome threshold chosen
   on older development windows, then reports a newest-period quarantine test. If the gate
   fails, the model is marked `FAILED RESEARCH GATE - SHADOW ONLY` and cannot
   approve an automated entry.
5. Run `backtest_ai.cmd` to reproduce the fixed-threshold expanding walk-forward
   research check. It rejects regime drift and treats ambiguous same-candle
   outcomes conservatively.
6. Run `run_ai_gate.cmd`. It publishes one analysis score after each completed
   M1 candle.
7. Attach Asheparte Analysis Advisor v3.20 with `UseAIAnalysisLayer=true`.
8. Compare its BUY / SELL / WAIT context with your own chart reading. You remain
   responsible for every manual trade decision.

Run `build_learning_dataset.cmd` to create a documented CSV from the frozen
broker snapshot. Read `DATASET-GUIDE.md` before using it: future outcome columns
are clearly marked `LABEL_ONLY` and must never enter a live model. `READING-LIST.md`
contains books and authoritative dataset sources without copying copyrighted text.

There is no execution mode in the Analysis Advisor. The AI layer remains
observation-only regardless of its research status. Sudden moves, gaps, bad data,
and regime changes can make its context wrong.

The September 4 execution-aligned replay improved materially but still failed
promotion. Its newest quarantine had 95 non-overlapping shadow trades, 48.4%
wins, +7.11R and a 1.30 profit factor after estimated costs. However, one of the
four development folds lost, the development profit factor was only 1.04, the
confidence bounds stayed below zero, and drawdown exceeded the strict limit.
The packaged EA therefore remains entry-disabled and the AI remains shadow-only.

The context file is written atomically to MetaTrader's shared Common/Files
folder. If the runner stops or its score becomes stale, the panel changes to a
WAIT/STALE state instead of presenting an old confidence reading.

The first `train_ai.cmd` run freezes the exact Gold/Silver research window in
`aurum_guard_ai_research_snapshot.joblib`. `backtest_ai.cmd` reuses that file,
so a later moving MT5 history window cannot silently change the published test.
Use `train_ai.py --refresh-snapshot` only when you intentionally begin a new,
separately documented experiment.

Only load the included model or one you trained yourself. Joblib model files
are executable Python artifacts and should never be accepted from an untrusted
source.
