# XAU A+ controlled comparison

## Website release: Asheparte Confluence v1

Latest layout: the most recent PSAR plan's side, entry, SL, TP1–TP3 and risk appear in a fixed bottom-right table, not a floating price label. The panel clears when PSAR/plans are disabled and stays empty until a valid plan exists. Target labels remain anchored to their prices and staggered horizontally (8 bars by default). Only one recent plan is retained by default; historical plans can be enabled in settings. Zone names and Market Structure Break labels use full English wording; VF reads Volume Fight and PSAR direction labels read BUY/SELL. These layout changes do not widen tight PSAR stops or modify targets.

PSAR labels now attach visual three-target position plans on the same confirmed signal candle, with no additional SMA/MSB/volume prerequisites. Entry is signal close; one shared stop is that candle's PSAR value; TP1, TP2 and TP3 are entry ± 1R, 2R and 3R, rounded to the symbol tick. Each target has its own line and price label. Invalid zero-risk/nonpositive-target plans are skipped. Levels stay fixed and are not trailed. Boxes extend 12 bars by default; this is drawing width, not a timed exit. The latest three plans are retained (configurable 1–12). These drawings are not executed trades or win/loss measurements and do not change Strategy Tester orders or results; no partial-close allocation has been added. Existing PSAR dots and state-fill defaults remain off.

`asheparte-confluence-v1.pine` is the named v1 release of the V2.6.6 combination. Only the title/header and alert branding changed; trading logic and settings remain identical. The website's default Pine tab imports this exact file, with copy/download actions and a separate Volume Fight pane download. Older tabs remain available. Credits and validation limitations are visible in the UI. Local website integration does not constitute Vercel publication or TradingView compilation.

## Volume Fight integration

Latest combined file: `xau-a-plus-v2.6.6-volume-fight.pine`. Adds VF UP/DOWN markers, optional background zones and normalized volume values in the Data Window. Everything from V2.6.5 remains unchanged: strategy, forecast, structure zones, Fib 0.273, white SMA 200, PSAR labels and disabled PSAR dots/state filling. Volume Fight is not a new entry filter or an order trigger.

The volume area graph is available in `volume-fight-pane-v6.pine`, a separate lower-pane indicator. The combined strategy is overlay=true; plotting normalized volume there would distort the price scale. Add the companion separately only if you want that graph.

Credits: adapted from the community script titled **Volume fight**, supplied by the user. The original author, source URL and license were not supplied and have not been verified. Do not attribute original authorship to this project. Obtain the original source/author and check its terms before public redistribution. No publishing was performed.

The Russian descriptions are replaced with plain-English tooltips. Lookback defaults to 24; neutral threshold to 15%. The original "Show each setup in zone" switch actually resets the counters after neutral periods; it is now labeled "Allow a new signal after a neutral zone." Defaults remain off for that switch, backgrounds and alerts.

The supplied bullish/bearish volume estimates and VWMA weighting are preserved. They are candle-derived estimates, not measured buyer/seller aggressor volume and not complementary fractions that necessarily sum to volume. Guards split flat candles evenly, suppress missing/zero-volume data, and require a valid 2×lookback−1-bar warm-up. Threshold values of 50% or more suppress directional zones under the original formula. Signals are closed-bar only; no profitability claim is made.

Checks: `node --test tools/test-xau-volume-fight.mjs`. Source/reference-model checks are not Pine compilation. Compile both files in TradingView and verify rendering before use. Strategy optional alert() events share the existing alert channel; the pane has separate UP/DOWN alert conditions with its alert toggle enabled.

## PSAR overlay

Latest: `xau-a-plus-v2.6.5-psar-forecast.pine`. Adds the supplied Parabolic SAR dots, start points, labeled reversals and state shading to V2.6.4. Calculation defaults are Start 0.02, Increment 0.02, Maximum 0.2. Inputs > PSAR controls visibility and styling. The forecast remains independently available; turn off Show color forecast to view PSAR without projected candles. Fib factor stays 0.273.

PSAR labels explicitly say PSAR Buy/Sell, not strategy entries. Variables are namespaced to avoid overwriting the strategy's existing buySignal/sellSignal. No entry filter or trailing stop has been added. Reversal labels require a confirmed bar and initialized previous SAR. As a bar-close strategy, this overlay updates on strategy calculations rather than every live tick as a standalone indicator would.

Optional PSAR alerts default off. Enable them and create a strategy alert including alert() calls; existing strategy/zone alerts share this alert channel and once-per-bar-close frequency, so simultaneous events can be coalesced. The standalone indicator's alertcondition calls were adapted to alert() for strategy compatibility. Local tests: `node --test tools/test-xau-psar.mjs`; TradingView compilation and visual checking still required. PSAR is not evidence of improved profitability. No publication performed.

## Ashe color forecast replaces ghost view

Latest: `xau-a-plus-v2.6.4-color-forecast.pine`. Replaces the momentum ghost module with the supplied Price Action Color Forecast (Ashe), adapted to Pine v6. Strategy and structure/zone code are unchanged, including Fib factor 0.273. Original indicator preserved in `price-action-color-forecast-original-v5.pine`.

Inputs > Price action forecast: Candle Series defaults to 7, Forecast Candles to 100 (up to 166), with event highlights and divider enabled. It matches bullish/bearish/doji colors, selects the nearest eligible past example, and rescales its subsequent OHLC by current close / historical match close. This is a historical analogue, not an accuracy-tested prediction; matching colors does not establish comparable market conditions.

Intentional safety/rendering differences from the supplied indicator:

- Uses at most 3,000 confirmed candles, stored once each. Full historical continuation must end before the current matched pattern begins. No partially available forecast or overlapping current-pattern examples.
- No-match/insufficient-history results display a message rather than halting the entire strategy. Reduce pattern length or forecast horizon if necessary. Old objects are deleted before each redraw.
- One projected candle per future chart bar, using thick-line bodies and thin wicks instead of the original three-bar-wide spacing. Divider is a dashed vertical line. Current/past patterns and the actual historical continuation have optional boxes. More right-hand chart space is required for 100 future candles.
- Drawing counts stay within supported limits; the supplied 5,000-box declaration is not carried over. A new full-history reload displays only the latest match; forecasts are not archived for accuracy measurement.

Verification: `node --test tools/test-xau-color-forecast.mjs` checks preserved strategy/structure source, matching boundaries, storage and object limits with a reference model. TradingView compilation, rendering and backtesting still require verification. Use the full combined file on the 5-minute chart; previous versions remain available. No publication performed.

## Combined market structure / order blocks

`xau-a-plus-v2.6.3-structure-ghost.pine` combines the strategy, ghost view and a Pine v6 adaptation of the supplied Market Structure Break & Order Block / Jin Kurosaki indicator. The supplied v5 file is preserved in `market-structure-order-block-original-v5.pine`.

This integration is visual only: no order-block requirement has been added to entries and no exits, risk, sessions or ghost formulas changed. Inputs > Structure & order blocks controls the overlay, zigzag, colors, confirmation factor, retained zones and optional alerts (off by default). Bu/Be mean bullish/bearish; OB means order block, BB breaker block and MB mitigation block, following the supplied indicator's classifications. These classifications do not establish predictive value.

Porting safeguards and intentional differences:

- Uses confirmed-bar swing changes and the supplied swing/factor market-direction conditions. Structure labels are placed on the recognition bar. Zigzags and zones extend back to their historical origins, but were not known at those origins.
- Zone candle searches inspect only valid ordered intervals in the latest 500 bars, select the most recent qualifying candle and skip missing candidates rather than reusing stale ones. Zones can therefore differ from the original's unbounded, persistent searches. Swing windows are capped at 4,900 bars.
- Removes the exact broken zone while iterating backwards. Zone-entry checks require a close within both bounds; broken zones cannot also produce entry alerts. Optional alerts are once per bar close, not every bar spent inside a zone; concurrent events can be coalesced by TradingView's alert frequency.
- Caps active zones at the selected limit (40 default, 60 maximum), retained broken zones at 60, structure lines at 100 and structure labels at 50. Broken zones retained with the delete option off are frozen/faded; oldest drawings are eventually removed.
- Theme-aware zone text and structure labels; independent overlay controls. Input changes cause TradingView to recalculate and remove disabled drawings.

Checks: `node --test tools/test-xau-fill-audit.mjs tools/test-xau-ghost-view.mjs tools/test-xau-structure-ghost.mjs`. These are local source/reference-model checks, not Pine compilation or visual verification. Paste the entire V2.6.3 file into TradingView on a 5-minute chart and confirm compilation, rendering and identical strategy results with matching Properties. No publication has been performed.

## Optional ghost view

`xau-a-plus-v2.6.2-ghost-view.pine` adds a display-only overlay to V2.6.1. Paste the complete file into Pine Editor and add it to a standard 5-minute chart. In Inputs > Ghost scenario, enable ghost candles and choose 2–30 bars (default 8). Leave enough empty space on the right of the chart to see them.

Ghost bodies extrapolate smoothed close-to-close momentum, capped at 0.30 ATR per bar and decayed by 0.88 each step. Wicks are illustrative quarter-ATR extensions. The optional dashed range grows by ATR times the square root of bars ahead; it is not a calibrated probability or confidence interval. These are synthetic scenario candles, not predicted future prices, entry signals, or evidence of profitability.

Calculations use closed bars, refresh at strategy calculation times, and replace the old drawing. A historical reload shows only the latest scenario; this does not archive forecasts or measure forecast accuracy. Trading rules and calculation settings are unchanged. Theme-aware caption/range colors support dark and light charts. Disable the overlay to remove its drawings. Local checks: `node --test tools/test-xau-ghost-view.mjs`; TradingView compilation/rendering remains to be verified.

- `xau-a-plus-v2.6-original.pine`: supplied user baseline, preserved except line-ending normalization.
- `xau-a-plus-v2.6.1-fill-audit.pine`: experimental 5-minute lifecycle correction. Not a validated profitability upgrade and not a replacement for the website's combined v60 script.

## Changes

TP1 is recognized only when TradingView records the TP1 bracket's profit leg, using `comment_profit` and `strategy.closedtrades.exit_comment`. A stop fill in that same bracket, a smaller position, or an exit candle crossing the target is not evidence of TP1 execution.

New closed legs are processed before setup registration and entry. Full round trips between calculations now trigger cleanup. The closing calculation cannot register or open another setup. Retry cooldown is checked at entry too, and every accepted entry consumes the prior retry opportunity so it cannot leak across trades.

Entry filters, input defaults, sizing formulas, stop/target formulas, sessions, daily limit and 5-minute restriction are unchanged. No forced entries or additional timeframe variants have been added.

## Limits and comparison procedure

1. Add each script separately to the same standard-candle OANDA:XAUUSD 5-minute chart, over identical dates. Preserve the original results before changing anything.
2. Match every input and Strategy Properties setting: capital, margins, commissions, slippage and calculation settings. Neither script declares costs: set realistic broker costs explicitly. For the earlier v60 cost assumption, commission was 0.05% per transaction; that is a comparison assumption, not a verified broker fee.
3. Keep on-every-tick and on-order-fill recalculation disabled and orders-on-close enabled for this comparison. The corrected script makes these defaults explicit. The breakeven order updates only at the next bar-close calculation after a recorded TP1 fill; it does not retroactively protect the rest of the TP1 candle. Market-on-close assumptions and simulated intrabar paths remain backtest limitations.
4. Inspect examples where one candle touches both stop and target. The correction follows the broker emulator's recorded fills, not independently verified tick chronology. The existing SL plot still displays the original stop, not the runner's adjusted stop.
5. Record net profit after costs, profit factor, max drawdown, trade count, win rate and average win/loss for both versions. Exit legs may appear as multiple closed trades; do not confuse them with the daily entry counter.
6. Reserve a later date range for validation without tuning to it, then forward-test on demo. Do not call this an improvement until those results support it.

Local verification: `node --test tools/test-xau-fill-audit.mjs`. These are source checks and a JavaScript lifecycle reference model, not a Pine compiler or a backtest. TradingView compilation and performance validation are still required.

Reference: https://www.tradingview.com/pine-script-docs/concepts/strategies/
