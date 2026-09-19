# One-week AI observation review

This update improves diagnostics, not the trained model or trading rules. Keep the
same model, threshold and advisor settings during the observation week. The AI
runner does not submit orders.

Use the updated `run_ai_gate.py` and `forward_diagnostics.py` together in your AI
installation. Restart the runner after updating. `run_v9_shadow.cmd` enables
history logging. MT5 and the runner must stay running while collecting data.

The original `asheparte_ai_v9_forward_log.csv` is preserved. New observations also
write `asheparte_ai_v9_forward_log_diagnostics_v2.csv` in MT5 Common/Files. The
companion records model health before filters, timeframe directions, equity guard,
published direction, probabilities, threshold, symbols and model SHA-256.
Diagnostic write failures are printed and do not change the published decision.
Historical reasons cannot be recovered from the old log.

Read-only review (using the Python environment installed for the AI layer):

```
python forward_diagnostics.py "PATH_TO_FORWARD_LOG.csv"
```

Optional `--start` and `--end` accept inclusive/exclusive UTC epoch seconds.
Repeated observations are deduplicated by model, model hash, symbols, timeframe
and bar time, keeping the first observation. Legacy logs lack some identity fields.
Missing recording periods are not assumed to be market-open time or model failure.

At the weekly review, inspect coverage and filters first. BUY/SELL readings on
adjacent minutes are not independent trades. Evaluate advisor plans separately
using their recorded CREATED/PROGRESS events and immutable entry/SL/TP levels.
Keep UNKNOWN and unresolved outcomes separate. AI attribution requires a reliable
join between a scored prediction and the original plan, which these CSVs alone do
not provide. Account equity changes are not AI performance. Do not calculate an
AI win rate from probabilities or directional counts, or promote the model based
on a small favorable sample.

Baseline inspected September 20, 2026: the existing log covers September 10–18 UTC,
with 6,888 rows, 6,610 unique model/bar observations, 278 duplicates, 77 SELL and
14 BUY readings. Keeping first observations gives 3,463 EQUITY_GUARD readings.
There are no matched trade outcomes in this log and no AI win rate is established.
