# Aurum Guard AI Approval Layer

This package adds a local BUY / SELL / NO TRADE meta-label model to the Aurum
Guard MT5 Expert Advisor. It does not guess on every candle: a causal defended
trend/pullback candidate must exist first, then a nonlinear gradient-boosted
model estimates whether that candidate deserves approval. It does not bypass
the EA's risk controls and it does not promise profit.

## What is enhanced

- Side-specific TP-before-SL labels instead of a blanket next-direction guess.
- 33 causal Gold/Silver, volatility, candle, trend and session features.
- Nonlinear gradient boosting with regularization instead of a linear classifier.
- Four expanding walk-forward checks with a 15-bar leakage gap.
- A newest-period research test that includes an estimated 0.10 ATR round-trip cost.
- Automatic fail-closed promotion: a model must show positive conservative
  utility in at least three walk-forward folds and in the newest test.
- A live regime-drift lock blocks candidates when too many inputs fall outside
  the development period's 1st-to-99th-percentile feature ranges.

## Safe first run

1. Use a MetaTrader 5 demo account and keep MT5 open.
2. Confirm that Market Watch contains your broker's exact `XAUUSD` and `XAGUSD`
   symbols. Edit the two `.cmd` files if your broker uses suffixes.
3. Run `install_ai.cmd` once.
4. Run `train_ai.cmd`. It selects its probability threshold only from expanding
   walk-forward checks, then reports a newest-period research test. If the gate
   fails, the model is marked `FAILED RESEARCH GATE - SHADOW ONLY` and cannot
   approve an automated entry.
5. Run `run_ai_gate.cmd`. It publishes one score after each completed M1 candle.
6. Attach the latest Aurum Guard EA with `UseAIApprovalGate=true`,
   `AIShadowMode=true`, and `EnableNewEntries=false` first.
7. Compare at least several weeks of shadow decisions with your demo feed.

Only after acceptable out-of-sample and forward-demo evidence should you set
`AIShadowMode=false`. A model that is not marked deployment-eligible remains
fail-closed even if strict mode is selected. Keep `AllowLiveTrading=false`; the AI gate is research
software and sudden moves, slippage, gaps, bad data, and regime changes remain.

The signal file is written atomically to MetaTrader's shared Common/Files
folder. If the runner stops or its score becomes stale, strict mode blocks new
entries rather than trading without AI approval.

Only load the included model or one you trained yourself. Joblib model files
are executable Python artifacts and should never be accepted from an untrusted
source.
