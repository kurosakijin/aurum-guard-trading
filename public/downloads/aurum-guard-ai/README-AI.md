# Aurum Guard AI Approval Layer

This package adds a local BUY / SELL / NO TRADE probability model to the Aurum
Guard MT5 Expert Advisor. It does not bypass the EA's risk controls and it does
not promise profit.

## Safe first run

1. Use a MetaTrader 5 demo account and keep MT5 open.
2. Confirm that Market Watch contains your broker's exact `XAUUSD` and `XAGUSD`
   symbols. Edit the two `.cmd` files if your broker uses suffixes.
3. Run `install_ai.cmd` once.
4. Run `train_ai.cmd`. It trains on the oldest data, tunes on the middle period,
   then reports a locked newest-period test. If either chronological check fails,
   the model is marked `FAILED RESEARCH GATE - SHADOW ONLY` and cannot approve an
   automated entry.
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
