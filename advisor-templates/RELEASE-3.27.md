# Advisor 3.27 — analysis-only safety update

Implemented:

- Preserve the structural stop, rejecting wrong-side, too-small or over-1.5-ATR risk instead of moving it. TP3 must exceed TP2's 1.5R.
- Protect active plans from replacement. Track observed TP1/TP2/TP3 and SL, including targets reached before an SL. These are observations, not executed-trade statistics.
- Persist plan state per chart, broker account and symbol across timeframe changes and restarts. Finished plans remain for review without blocking new scans.
- Recover short missed-tick intervals in chronological order. Missing/incomplete history or gaps over 60 seconds retire the plan as UNKNOWN, not a win/loss.
- Apply candle, ADX/directional strength, distance and MTF score checks to POC/continuation/delivery and again at publication. Continuation indicators now use the selected setup timeframe.
- CISD uses an opposing delivery leg's first-open reclaim with a bounded 200-bar replay and 20-bar leg age. This aligns the pattern definition with Pine, not the entire engine: Pine's watch timing and MT5's M1 execution confirmation still differ.
- Require distinct XAU/XAG instrument metadata, matching quote currency and aligned bar timestamps. Brokers with nonstandard metal metadata may be rejected.
- Label rule scores as scores, not win probabilities. The independent AI opinion checks score age, scored-bar freshness and probability validity; it does not veto or execute a rule plan.
- Journal batches upload oldest-unsent deals sorted by timestamp/ticket. Cursor advancement requires HTTP success, including same-millisecond tickets. Versioned cursors replay the configured initial history window (default 30 days), with server-side account/ticket deduplication.
- Reduce HTTP timeout from 15 seconds to 1.5 seconds with bounded exponential retry delay. WebRequest remains synchronous; this is not an asynchronous bridge. Short tick-history recovery covers ordinary event coalescing but cannot guarantee uninterrupted monitoring.
- Fail closed when news event details cannot be retrieved, when configured. The existing Strategy Tester calendar bypass remains; tester results do not validate live news protection.

Validation: MetaEditor compilation, selected production-body logic regressions, private-download tests and production website build. No live-market forward test or claim of improved win rate. Existing installed advisors are not automatically replaced. First upgrade from 3.26 cannot recover its previously unpersisted plan variables.

Never opens, modifies or closes orders. No AI model was retrained or promoted in this update.
