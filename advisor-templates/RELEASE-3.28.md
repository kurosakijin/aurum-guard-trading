# Advisor 3.28 — local signal journal and decision explanations

The signal journal records immutable original plan levels, direction, strategy route,
setup timeframe, rule/MTF scores, AI opinion and a creation explanation. Subsequent
records track highest target observed and SL, TP3 or UNKNOWN outcomes. These are
analysis observations, never broker trades, realized P/L or verified win probabilities.

Files: MT5 File → Open Data Folder → MQL5 → Files → AsheparteSignals → .jsonl.
The Experts log prints the exact path. Files contain no journal bridge credential.
They are scoped to the local terminal, broker account, symbol and chart. No cloud
upload is added; the existing real-trade bridge continues separately.

Import one or more files in the website's MT5 advisor → Signal performance journal.
Imports replace the current view; duplicate records are ignored, conflicting records
become UNKNOWN, and malformed/orphan records are reported. All parsing is browser-local,
with a 10 MB / 30,000-line limit. Refreshing, clearing the view or changing signed-in
user removes imported state from memory. Nothing is stored in browser storage.

Recording starts with newly published v3.28 plans, not historical v3.27 signals.
A new plan is withheld if its initial snapshot cannot be saved. Pending outcome
writes retry; a finished plan is not cleared or replaced while its outcome is unsaved.
State is retained across ordinary timeframe changes/restarts. Abrupt process/disk
failure can still leave truncated or unresolved records: these are not reconstructed
as wins. Large data gaps remain UNKNOWN. Reached-target counts overlap; SL may follow
TP1/TP2. The viewer does not infer order fills, costs, monetary returns or drawdown.

MT5's panel adds a short explanation, full-detail hover text and local journal status.
Rule behavior remains analysis-only; the AI is a separate opinion, not an execution gate.

Validation: source-body and importer regression tests, personalized-download tests,
MetaEditor compilation and production static build. Component import was checked with
synthetic data in light/dark themes and at mobile width. Full authenticated app preview
remained at its pre-existing loading screen; no live-market forward test was performed.
The existing Clerk colorInputBackground TypeScript error remains outside this change.

Local UI harness (not included in production build): run Vite with
vite.github.config.ts and open /aurum-guard-trading/signal-journal-preview.html.
Use tools/fixtures/synthetic-signals.jsonl for repeatable import tests.
