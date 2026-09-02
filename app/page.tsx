'use client';

import { useState } from 'react';
import {
  ArrowUpRight,
  Bot,
  BookOpenCheck,
  Calculator,
  CandlestickChart,
  Check,
  ChevronDown,
  Clipboard,
  Clock3,
  Code2,
  Crosshair,
  ExternalLink,
  Landmark,
  LineChart,
  LockKeyhole,
  Newspaper,
  RadioTower,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TradingViewChart } from '@/components/tradingview-chart';
import {
  TradingViewSymbolInfo,
  TradingViewTechnicalAnalysis,
} from '@/components/tradingview-insights';

const liveMarkets = [
  { key: 'gold', label: 'Gold', short: 'XAU / USD', symbol: 'OANDA:XAUUSD' },
  { key: 'silver', label: 'Silver', short: 'XAG / USD', symbol: 'OANDA:XAGUSD' },
] as const;

const timeframes = [
  { label: '1m', value: '1' },
  { label: '5m', value: '5' },
  { label: '15m', value: '15' },
  { label: '1h', value: '60' },
  { label: '4h', value: '240' },
  { label: '1D', value: 'D' },
  { label: '1W', value: 'W' },
] as const;

type LiveMarketKey = (typeof liveMarkets)[number]['key'];
const pineScript = String.raw`//@version=6
strategy("Aurum Guard Combined: Trend + Reversal", overlay = true, pyramiding = 0,
     initial_capital = 10000,
     default_qty_type = strategy.percent_of_equity,
     default_qty_value = 0.5,
     commission_type = strategy.commission.percent,
     commission_value = 0.05,
     calc_on_every_tick = true,
     process_orders_on_close = true,
     max_labels_count = 300)

// One strategy slot, two independently switchable engines.
enableTrend = input.bool(true, "Enable confirmed trend setups", group = "Engines")
enableReversal = input.bool(true, "Enable reversal scout", group = "Engines")
autoConfirmationTimeframe = input.bool(true, "Auto confirmation timeframe", group = "Shared filters")
manualConfirmationTimeframe = input.timeframe("15", "Manual confirmation timeframe", group = "Shared filters")
rsiLength = input.int(14, "RSI length", minval = 2, group = "Shared filters")
atrLength = input.int(14, "ATR length", minval = 2, group = "Shared filters")
rewardRisk = input.float(2.14, "Reward / risk", minval = 1.0, maxval = 10.0, step = 0.01, group = "Shared filters")

fastLength = input.int(20, "Fast EMA", minval = 2, group = "Confirmed trend engine")
slowLength = input.int(50, "Slow EMA", minval = 3, group = "Confirmed trend engine")
trendAtrMultiple = input.float(1.5, "ATR stop multiple", minval = 0.5, step = 0.1, group = "Confirmed trend engine")
slopeBars = input.int(3, "EMA slope lookback", minval = 1, group = "Confirmed trend engine")
cooldownBars = input.int(10, "Bars between trend setups", minval = 1, group = "Confirmed trend engine")

minimumWickBody = input.float(1.5, "Minimum wick / body", minval = 0.5, step = 0.1, group = "Reversal scout")
expiryBars = input.int(3, "Entry expiry bars", minval = 1, maxval = 10, group = "Reversal scout")
tradeSession = input.session("0700-1700", "Active session in UTC", group = "Reversal scout")

enableReentry = input.bool(true, "Enable one controlled re-entry after SL", group = "Controlled re-entry")
reentryWaitBars = input.int(1, "Closed candles to wait after SL", minval = 1, maxval = 10, group = "Controlled re-entry")
reentryExpiryBars = input.int(2, "Re-entry trigger expiry bars", minval = 1, maxval = 10, group = "Controlled re-entry")
reentrySizeMultiplier = input.float(0.50, "Re-entry size multiplier", minval = 0.10, maxval = 1.00, step = 0.05, group = "Controlled re-entry")

showBadEntryGuard = input.bool(true, "Show bad-entry warnings", group = "Bad Entry Guard")
chaseDistanceATR = input.float(1.35, "No-chase distance from fast EMA in ATR", minval = 0.50, maxval = 5.00, step = 0.05, group = "Bad Entry Guard")
badEntryCooldownBars = input.int(4, "Bars between warning labels", minval = 1, maxval = 50, group = "Bad Entry Guard")

enableShockGuard = input.bool(true, "Enable volatility shock pause", group = "Volatility Shock Guard")
shockRangeATR = input.float(2.00, "Shock candle range in ATR", minval = 1.00, maxval = 10.00, step = 0.10, group = "Volatility Shock Guard")
shockGapATR = input.float(0.75, "Shock opening gap in ATR", minval = 0.25, maxval = 5.00, step = 0.05, group = "Volatility Shock Guard")
shockPauseBars = input.int(3, "Closed candles to pause after shock", minval = 1, maxval = 20, group = "Volatility Shock Guard")
maxDailyLossPercent = input.float(2.00, "Strategy daily-loss lock (%)", minval = 0.10, maxval = 100.00, step = 0.10, group = "Volatility Shock Guard")

requireMetalSync = input.bool(true, "Require Gold / Silver sync for entries", group = "Gold / Silver Sync")
showMetalSyncMarks = input.bool(true, "Show sync state-change marks", group = "Gold / Silver Sync")
goldSyncSymbol = input.symbol("OANDA:XAUUSD", "Gold symbol", group = "Gold / Silver Sync")
silverSyncSymbol = input.symbol("OANDA:XAGUSD", "Silver symbol", group = "Gold / Silver Sync")
syncLookbackBars = input.int(5, "Direction lookback bars", minval = 2, maxval = 50, group = "Gold / Silver Sync")
syncCorrelationLength = input.int(20, "Correlation length", minval = 5, maxval = 100, group = "Gold / Silver Sync")
syncMinimumCorrelation = input.float(0.25, "Minimum correlation", minval = -1.00, maxval = 1.00, step = 0.05, group = "Gold / Silver Sync")

// TradingView's strategy-wide circuit breaker cancels pending orders, closes an
// open simulated position and blocks additional orders for the session at this loss.
strategy.risk.max_intraday_loss(maxDailyLossPercent, strategy.percent_of_equity, "Aurum Guard daily-loss lock")

pivotLength = input.int(5, "Liquidity / structure swing length", minval = 2, maxval = 30, group = "Automatic chart map")
showLiquidity = input.bool(true, "Show confirmed liquidity levels", group = "Automatic chart map")
showStructure = input.bool(true, "Show HH / HL / LH / LL", group = "Automatic chart map")
showTradePlan = input.bool(true, "Show Entry / TP / SL zones", group = "Automatic chart map")
showTimeframeSync = input.bool(true, "Show timeframe sync panel", group = "Automatic chart map")
showPriorityMarks = input.bool(true, "Show P1 / P2 / Watch marks", group = "Automatic chart map")
structureStopLookback = input.int(7, "Trend structural stop lookback", minval = 2, maxval = 50, group = "Automatic chart map")
planBars = input.int(25, "Keep projected plan for bars", minval = 5, maxval = 200, group = "Automatic chart map")

fastEMA = ta.ema(close, fastLength)
slowEMA = ta.ema(close, slowLength)
rsiValue = ta.rsi(close, rsiLength)
atrValue = ta.atr(atrLength)
atrBaseline = ta.sma(atrValue, 50)
trendVolatilityOK = atrValue > atrBaseline * 0.65
reversalVolatilityOK = atrValue > atrBaseline * 0.70
fastCrossUp = ta.crossover(fastEMA, slowEMA)
fastCrossDown = ta.crossunder(fastEMA, slowEMA)
slowSlopeUp = slowEMA > slowEMA[slopeBars]
slowSlopeDown = slowEMA < slowEMA[slopeBars]

// The chart timeframe is the decision clock. For example, a 1m chart confirms
// a new decision once every completed 1-minute candle; 3m confirms every 3 minutes.
decisionBarReady = barstate.isconfirmed

// Automatically scale the non-repainting trend filter with the chart timeframe.
getAutoConfirmationTimeframe() =>
    chartSeconds = timeframe.in_seconds()
    if chartSeconds <= 60
        "15"
    else if chartSeconds <= 180
        "30"
    else if chartSeconds <= 300
        "60"
    else if chartSeconds <= 900
        "240"
    else if chartSeconds <= 3600
        "D"
    else if chartSeconds <= 14400
        "W"
    else if chartSeconds <= 86400
        "W"
    else
        "M"

confirmationTimeframe = autoConfirmationTimeframe ? getAutoConfirmationTimeframe() : manualConfirmationTimeframe

// Previous completed higher-timeframe values avoid using its still-forming candle.
confirmedHTFClose = request.security(syminfo.tickerid, confirmationTimeframe, close[1], lookahead = barmerge.lookahead_on)
confirmedHTFEMA = request.security(syminfo.tickerid, confirmationTimeframe, ta.ema(close, slowLength)[1], lookahead = barmerge.lookahead_on)
higherTrendUp = confirmedHTFClose > confirmedHTFEMA
higherTrendDown = confirmedHTFClose < confirmedHTFEMA

// Compare Gold and Silver on the current chart timeframe. Actionable decisions
// still wait for the chart candle to close, so the two feeds share one clock.
goldSyncClose = request.security(goldSyncSymbol, timeframe.period, close)
silverSyncClose = request.security(silverSyncSymbol, timeframe.period, close)
goldSyncMove = goldSyncClose - goldSyncClose[syncLookbackBars]
silverSyncMove = silverSyncClose - silverSyncClose[syncLookbackBars]
metalsCorrelation = ta.correlation(ta.change(goldSyncClose), ta.change(silverSyncClose), syncCorrelationLength)
rawMetalsBullishSync = goldSyncMove > 0 and silverSyncMove > 0 and metalsCorrelation >= syncMinimumCorrelation
rawMetalsBearishSync = goldSyncMove < 0 and silverSyncMove < 0 and metalsCorrelation >= syncMinimumCorrelation
var bool metalsBullishSync = false
var bool metalsBearishSync = false
if decisionBarReady
    metalsBullishSync := rawMetalsBullishSync
    metalsBearishSync := rawMetalsBearishSync
metalsInSync = metalsBullishSync or metalsBearishSync
metalSyncLongOK = not requireMetalSync or metalsBullishSync
metalSyncShortOK = not requireMetalSync or metalsBearishSync
metalSyncBullishChanged = decisionBarReady and metalsBullishSync and not metalsBullishSync[1]
metalSyncBearishChanged = decisionBarReady and metalsBearishSync and not metalsBearishSync[1]
metalSyncLost = decisionBarReady and not metalsInSync and metalsInSync[1]

// Price-only shock detector. It reacts to abnormal range or opening gaps; it
// cannot predict the first tick of a news spike, so its purpose is to stop follow-on entries.
var int lastShockBar = na
shockRangeDetected = high - low >= atrValue * shockRangeATR
shockGapDetected = math.abs(open - close[1]) >= atrValue * shockGapATR
volatilityShock = enableShockGuard and decisionBarReady and (shockRangeDetected or shockGapDetected)
if volatilityShock
    lastShockBar := bar_index
shockPauseActive = enableShockGuard and not na(lastShockBar) and bar_index - lastShockBar <= shockPauseBars
shockReset = enableShockGuard and decisionBarReady and not shockPauseActive and shockPauseActive[1]

closedTradeThisBar = ta.change(strategy.closedtrades) > 0
lastClosedTradeNumber = strategy.closedtrades - 1
lastExitComment = strategy.closedtrades > 0 ? strategy.closedtrades.exit_comment(lastClosedTradeNumber) : ""
stopClosedThisBar = closedTradeThisBar and lastExitComment == "SL"

// Confirmed trend engine.
var int lastTrendBar = na
trendCooldownOK = na(lastTrendBar) or bar_index - lastTrendBar > cooldownBars
trendLongSetup = enableTrend and decisionBarReady and not shockPauseActive and not stopClosedThisBar and strategy.position_size == 0 and trendCooldownOK and fastCrossUp and slowSlopeUp and rsiValue > 55 and trendVolatilityOK and higherTrendUp and metalSyncLongOK
trendShortSetup = enableTrend and decisionBarReady and not shockPauseActive and not stopClosedThisBar and strategy.position_size == 0 and trendCooldownOK and fastCrossDown and slowSlopeDown and rsiValue < 45 and trendVolatilityOK and higherTrendDown and metalSyncShortOK

// Reversal scout engine. It automatically stays inactive when the chart timeframe
// is not below the confirmation timeframe, while the trend engine keeps working.
reversalTimeframeOK = timeframe.in_seconds() < timeframe.in_seconds(confirmationTimeframe)
sessionOK = not na(time(timeframe.period, tradeSession, "Etc/UTC"))

body = math.max(math.abs(close - open), syminfo.mintick)
lowerWick = math.min(open, close) - low
upperWick = high - math.max(open, close)

pivotLow = ta.pivotlow(low, pivotLength, pivotLength)
pivotHigh = ta.pivothigh(high, pivotLength, pivotLength)
priorSwingLow = ta.valuewhen(not na(pivotLow), pivotLow, 0)
priorSwingHigh = ta.valuewhen(not na(pivotHigh), pivotHigh, 0)
recentStructureLow = ta.lowest(low, structureStopLookback)
recentStructureHigh = ta.highest(high, structureStopLookback)

// Confirmed market structure. Pivot labels appear only after pivotLength bars,
// so they do not pretend the turning point was known in advance.
var float previousPivotHigh = na
var float previousPivotLow = na

if not na(pivotHigh)
    if showStructure and not na(previousPivotHigh)
        highStructureText = pivotHigh > previousPivotHigh ? "HH" : "LH"
        highStructureColor = pivotHigh > previousPivotHigh ? color.lime : color.orange
        label.new(bar_index - pivotLength, pivotHigh, highStructureText, style = label.style_label_down, color = color.new(highStructureColor, 12), textcolor = color.black, size = size.tiny)
    previousPivotHigh := pivotHigh

if not na(pivotLow)
    if showStructure and not na(previousPivotLow)
        lowStructureText = pivotLow > previousPivotLow ? "HL" : "LL"
        lowStructureColor = pivotLow > previousPivotLow ? color.aqua : color.red
        label.new(bar_index - pivotLength, pivotLow, lowStructureText, style = label.style_label_up, color = color.new(lowStructureColor, 12), textcolor = color.black, size = size.tiny)
    previousPivotLow := pivotLow

rsiRecentLow = ta.lowest(rsiValue, 4)
rsiRecentHigh = ta.highest(rsiValue, 4)
sweptLow = not na(priorSwingLow) and low < priorSwingLow and close > priorSwingLow
sweptHigh = not na(priorSwingHigh) and high > priorSwingHigh and close < priorSwingHigh

longWatch = enableReversal and reversalTimeframeOK and decisionBarReady and not shockPauseActive and not stopClosedThisBar and strategy.position_size == 0 and not trendLongSetup and not trendShortSetup and sessionOK and reversalVolatilityOK and higherTrendUp and sweptLow and close > open and lowerWick / body >= minimumWickBody and rsiRecentLow < 35 and rsiValue > 35 and rsiValue > rsiValue[1] and metalSyncLongOK
shortWatch = enableReversal and reversalTimeframeOK and decisionBarReady and not shockPauseActive and not stopClosedThisBar and strategy.position_size == 0 and not trendLongSetup and not trendShortSetup and sessionOK and reversalVolatilityOK and higherTrendDown and sweptHigh and close < open and upperWick / body >= minimumWickBody and rsiRecentHigh > 65 and rsiValue < 65 and rsiValue < rsiValue[1] and metalSyncShortOK

// Bad Entry Guard. These are warnings, never entry signals. They highlight the
// two common mistakes shown in the sample: fading a protected trend pullback
// after liquidity is swept, or chasing after price is already ATR-extended.
var int lastBadEntryBar = na
bullishGuardTrend = higherTrendUp and fastEMA > slowEMA and slowSlopeUp and close > slowEMA and rsiValue >= 50
bearishGuardTrend = higherTrendDown and fastEMA < slowEMA and slowSlopeDown and close < slowEMA and rsiValue <= 50
sellSideSweepTrap = bullishGuardTrend and sweptLow and close > priorSwingLow
buySideSweepTrap = bearishGuardTrend and sweptHigh and close < priorSwingHigh
bullishPullbackTrap = bullishGuardTrend and close < open and low <= fastEMA and close > slowEMA
bearishRallyTrap = bearishGuardTrend and close > open and high >= fastEMA and close < slowEMA
rawAvoidShort = sellSideSweepTrap or bullishPullbackTrap
rawAvoidLong = buySideSweepTrap or bearishRallyTrap
rawNoChaseLong = bullishGuardTrend and close > open and close - fastEMA > atrValue * chaseDistanceATR
rawNoChaseShort = bearishGuardTrend and close < open and fastEMA - close > atrValue * chaseDistanceATR
badEntryCooldownOK = na(lastBadEntryBar) or bar_index - lastBadEntryBar > badEntryCooldownBars
avoidShort = showBadEntryGuard and decisionBarReady and not shockPauseActive and strategy.position_size == 0 and badEntryCooldownOK and rawAvoidShort
avoidLong = showBadEntryGuard and decisionBarReady and not shockPauseActive and strategy.position_size == 0 and badEntryCooldownOK and not avoidShort and rawAvoidLong
noChaseLong = showBadEntryGuard and decisionBarReady and not shockPauseActive and strategy.position_size == 0 and badEntryCooldownOK and not avoidShort and not avoidLong and rawNoChaseLong
noChaseShort = showBadEntryGuard and decisionBarReady and not shockPauseActive and strategy.position_size == 0 and badEntryCooldownOK and not avoidShort and not avoidLong and not noChaseLong and rawNoChaseShort

if avoidShort
    label.new(bar_index, high, "AVOID SHORT\n" + (sellSideSweepTrap ? "SELL-SIDE SWEEP" : "BULLISH PULLBACK"), style = label.style_label_down, color = color.new(color.orange, 6), textcolor = color.black, size = size.small)
    lastBadEntryBar := bar_index

if avoidLong
    label.new(bar_index, low, "AVOID LONG\n" + (buySideSweepTrap ? "BUY-SIDE SWEEP" : "BEARISH RALLY"), style = label.style_label_up, color = color.new(color.red, 6), textcolor = color.white, size = size.small)
    lastBadEntryBar := bar_index

if noChaseLong
    label.new(bar_index, high, "NO CHASE LONG\nWAIT PULLBACK", style = label.style_label_down, color = color.new(color.yellow, 5), textcolor = color.black, size = size.tiny)
    lastBadEntryBar := bar_index

if noChaseShort
    label.new(bar_index, low, "NO CHASE SHORT\nWAIT RALLY", style = label.style_label_up, color = color.new(color.yellow, 5), textcolor = color.black, size = size.tiny)
    lastBadEntryBar := bar_index

var float trendStopPrice = na
var float trendTargetPrice = na
var float pendingLongEntry = na
var float pendingLongStop = na
var int pendingLongBar = na
var float pendingShortEntry = na
var float pendingShortStop = na
var int pendingShortBar = na
var float plannedEntry = na
var float plannedStop = na
var float plannedTarget = na
var int plannedUntilBar = na
var bool reentryArmed = false
var int reentryDirection = 0
var int reentrySLBar = na
var float reentryRecoveryPrice = na
var float reentryQty = na
var float reentryEntry = na
var float reentryStop = na
var float reentryTarget = na
var int reentryPendingBar = na

// A shock cancels unfilled entry ideas immediately. Existing positions keep their
// protective TP/SL bracket; no new setup is allowed until the pause expires.
if volatilityShock
    strategy.cancel("REV LONG")
    strategy.cancel("REV SHORT")
    strategy.cancel("REENTRY LONG")
    strategy.cancel("REENTRY SHORT")
    if strategy.position_size == 0
        pendingLongEntry := na
        pendingLongStop := na
        pendingLongBar := na
        pendingShortEntry := na
        pendingShortStop := na
        pendingShortBar := na
        reentryArmed := false
        reentryDirection := 0
        reentrySLBar := na
        reentryRecoveryPrice := na
        reentryQty := na
        reentryEntry := na
        reentryStop := na
        reentryTarget := na
        reentryPendingBar := na
        plannedEntry := na
        plannedStop := na
        plannedTarget := na
        plannedUntilBar := na

// A pending trigger is withdrawn if the matching Gold/Silver direction breaks
// before entry. An existing position keeps its original protective bracket.
metalSyncInvalidatesPending = requireMetalSync and strategy.position_size == 0 and ((not na(pendingLongBar) and not metalsBullishSync) or (not na(pendingShortBar) and not metalsBearishSync) or (not na(reentryPendingBar) and reentryDirection == 1 and not metalsBullishSync) or (not na(reentryPendingBar) and reentryDirection == -1 and not metalsBearishSync))
if metalSyncInvalidatesPending
    strategy.cancel("REV LONG")
    strategy.cancel("REV SHORT")
    strategy.cancel("REENTRY LONG")
    strategy.cancel("REENTRY SHORT")
    pendingLongEntry := na
    pendingLongStop := na
    pendingLongBar := na
    pendingShortEntry := na
    pendingShortStop := na
    pendingShortBar := na
    reentryDirection := 0
    reentryEntry := na
    reentryStop := na
    reentryTarget := na
    reentryPendingBar := na
    plannedEntry := na
    plannedStop := na
    plannedTarget := na
    plannedUntilBar := na

// Any fresh P1/P2 setup outranks and cancels a lower-priority re-entry idea.
primarySetupStarted = trendLongSetup or trendShortSetup or longWatch or shortWatch
if primarySetupStarted
    strategy.cancel("REENTRY LONG")
    strategy.cancel("REENTRY SHORT")
    reentryArmed := false
    reentryDirection := 0
    reentrySLBar := na
    reentryRecoveryPrice := na
    reentryQty := na
    reentryEntry := na
    reentryStop := na
    reentryTarget := na
    reentryPendingBar := na

// Confirmed trend entries take priority and cancel any unfilled reversal trigger.
if trendLongSetup
    strategy.cancel("REV LONG")
    strategy.cancel("REV SHORT")
    pendingLongEntry := na
    pendingLongStop := na
    pendingLongBar := na
    pendingShortEntry := na
    pendingShortStop := na
    pendingShortBar := na
    trendLongStructureStop = recentStructureLow - syminfo.mintick * 2
    trendLongAtrStop = close - atrValue * trendAtrMultiple
    trendStopPrice := math.max(trendLongStructureStop, trendLongAtrStop)
    trendLongRisk = close - trendStopPrice
    trendTargetPrice := close + trendLongRisk * rewardRisk
    plannedEntry := close
    plannedStop := trendStopPrice
    plannedTarget := trendTargetPrice
    plannedUntilBar := bar_index + planBars
    if showTradePlan
        label.new(bar_index, plannedEntry, "LONG ENTRY\nR:R " + str.tostring(rewardRisk, "#.##"), style = label.style_label_up, color = color.new(color.yellow, 5), textcolor = color.black, size = size.tiny)
        label.new(bar_index, plannedTarget, "TP", style = label.style_label_down, color = color.new(color.lime, 5), textcolor = color.black, size = size.tiny)
        label.new(bar_index, plannedStop, "SL", style = label.style_label_up, color = color.new(color.red, 5), textcolor = color.white, size = size.tiny)
    strategy.entry("TREND LONG", strategy.long)
    lastTrendBar := bar_index

if trendShortSetup
    strategy.cancel("REV LONG")
    strategy.cancel("REV SHORT")
    pendingLongEntry := na
    pendingLongStop := na
    pendingLongBar := na
    pendingShortEntry := na
    pendingShortStop := na
    pendingShortBar := na
    trendShortStructureStop = recentStructureHigh + syminfo.mintick * 2
    trendShortAtrStop = close + atrValue * trendAtrMultiple
    trendStopPrice := math.min(trendShortStructureStop, trendShortAtrStop)
    trendShortRisk = trendStopPrice - close
    trendTargetPrice := close - trendShortRisk * rewardRisk
    plannedEntry := close
    plannedStop := trendStopPrice
    plannedTarget := trendTargetPrice
    plannedUntilBar := bar_index + planBars
    if showTradePlan
        label.new(bar_index, plannedEntry, "SHORT ENTRY\nR:R " + str.tostring(rewardRisk, "#.##"), style = label.style_label_down, color = color.new(color.yellow, 5), textcolor = color.black, size = size.tiny)
        label.new(bar_index, plannedTarget, "TP", style = label.style_label_up, color = color.new(color.lime, 5), textcolor = color.black, size = size.tiny)
        label.new(bar_index, plannedStop, "SL", style = label.style_label_down, color = color.new(color.red, 5), textcolor = color.white, size = size.tiny)
    strategy.entry("TREND SHORT", strategy.short)
    lastTrendBar := bar_index

if not enableReversal
    strategy.cancel("REV LONG")
    strategy.cancel("REV SHORT")
    pendingLongEntry := na
    pendingLongStop := na
    pendingLongBar := na
    pendingShortEntry := na
    pendingShortStop := na
    pendingShortBar := na

if longWatch and strategy.position_size == 0
    strategy.cancel("REV SHORT")
    pendingShortEntry := na
    pendingShortStop := na
    pendingShortBar := na
    pendingLongEntry := high + syminfo.mintick
    pendingLongStop := low - syminfo.mintick * 2
    pendingLongBar := bar_index
    plannedEntry := pendingLongEntry
    plannedStop := pendingLongStop
    plannedTarget := pendingLongEntry + (pendingLongEntry - pendingLongStop) * rewardRisk
    plannedUntilBar := bar_index + planBars
    if showTradePlan
        label.new(bar_index, plannedEntry, "REV LONG ENTRY\nR:R " + str.tostring(rewardRisk, "#.##"), style = label.style_label_up, color = color.new(color.yellow, 5), textcolor = color.black, size = size.tiny)
        label.new(bar_index, plannedTarget, "TP", style = label.style_label_down, color = color.new(color.lime, 5), textcolor = color.black, size = size.tiny)
        label.new(bar_index, plannedStop, "SL", style = label.style_label_up, color = color.new(color.red, 5), textcolor = color.white, size = size.tiny)

if shortWatch and strategy.position_size == 0
    strategy.cancel("REV LONG")
    pendingLongEntry := na
    pendingLongStop := na
    pendingLongBar := na
    pendingShortEntry := low - syminfo.mintick
    pendingShortStop := high + syminfo.mintick * 2
    pendingShortBar := bar_index
    plannedEntry := pendingShortEntry
    plannedStop := pendingShortStop
    plannedTarget := pendingShortEntry - (pendingShortStop - pendingShortEntry) * rewardRisk
    plannedUntilBar := bar_index + planBars
    if showTradePlan
        label.new(bar_index, plannedEntry, "REV SHORT ENTRY\nR:R " + str.tostring(rewardRisk, "#.##"), style = label.style_label_down, color = color.new(color.yellow, 5), textcolor = color.black, size = size.tiny)
        label.new(bar_index, plannedTarget, "TP", style = label.style_label_up, color = color.new(color.lime, 5), textcolor = color.black, size = size.tiny)
        label.new(bar_index, plannedStop, "SL", style = label.style_label_down, color = color.new(color.red, 5), textcolor = color.white, size = size.tiny)

if not na(pendingLongBar) and strategy.position_size == 0
    if bar_index - pendingLongBar <= expiryBars
        strategy.entry("REV LONG", strategy.long, stop = pendingLongEntry, oca_name = "REVERSAL", oca_type = strategy.oca.cancel)
    else
        strategy.cancel("REV LONG")
        pendingLongEntry := na
        pendingLongStop := na
        pendingLongBar := na

if not na(pendingShortBar) and strategy.position_size == 0
    if bar_index - pendingShortBar <= expiryBars
        strategy.entry("REV SHORT", strategy.short, stop = pendingShortEntry, oca_name = "REVERSAL", oca_type = strategy.oca.cancel)
    else
        strategy.cancel("REV SHORT")
        pendingShortEntry := na
        pendingShortStop := na
        pendingShortBar := na

// A reversal becomes confirmed only after price actually crosses its yellow trigger.
reversalLongConfirmed = strategy.position_size > 0 and strategy.position_size[1] <= 0 and not na(pendingLongStop)
reversalShortConfirmed = strategy.position_size < 0 and strategy.position_size[1] >= 0 and not na(pendingShortStop)

if strategy.position_size > 0 and not na(pendingLongStop)
    longRisk = strategy.position_avg_price - pendingLongStop
    if longRisk > syminfo.mintick
        revLongTarget = strategy.position_avg_price + longRisk * rewardRisk
        plannedEntry := strategy.position_avg_price
        plannedStop := pendingLongStop
        plannedTarget := revLongTarget
        plannedUntilBar := bar_index + planBars
        strategy.exit("REV LONG exit", from_entry = "REV LONG", stop = pendingLongStop, limit = revLongTarget, comment_profit = "TP", comment_loss = "SL")
    pendingLongEntry := na
    pendingLongBar := na
    pendingShortEntry := na
    pendingShortStop := na
    pendingShortBar := na

if strategy.position_size < 0 and not na(pendingShortStop)
    shortRisk = pendingShortStop - strategy.position_avg_price
    if shortRisk > syminfo.mintick
        revShortTarget = strategy.position_avg_price - shortRisk * rewardRisk
        plannedEntry := strategy.position_avg_price
        plannedStop := pendingShortStop
        plannedTarget := revShortTarget
        plannedUntilBar := bar_index + planBars
        strategy.exit("REV SHORT exit", from_entry = "REV SHORT", stop = pendingShortStop, limit = revShortTarget, comment_profit = "TP", comment_loss = "SL")
    pendingShortEntry := na
    pendingShortBar := na
    pendingLongEntry := na
    pendingLongStop := na
    pendingLongBar := na

if strategy.position_size > 0 and not na(trendStopPrice)
    activeTrendLongRisk = strategy.position_avg_price - trendStopPrice
    if activeTrendLongRisk > syminfo.mintick
        trendTargetPrice := strategy.position_avg_price + activeTrendLongRisk * rewardRisk
        plannedEntry := strategy.position_avg_price
        plannedStop := trendStopPrice
        plannedTarget := trendTargetPrice
        plannedUntilBar := bar_index + planBars
        strategy.exit("TREND LONG exit", from_entry = "TREND LONG", stop = trendStopPrice, limit = trendTargetPrice, comment_profit = "TP", comment_loss = "SL")

if strategy.position_size < 0 and not na(trendStopPrice)
    activeTrendShortRisk = trendStopPrice - strategy.position_avg_price
    if activeTrendShortRisk > syminfo.mintick
        trendTargetPrice := strategy.position_avg_price - activeTrendShortRisk * rewardRisk
        plannedEntry := strategy.position_avg_price
        plannedStop := trendStopPrice
        plannedTarget := trendTargetPrice
        plannedUntilBar := bar_index + planBars
        strategy.exit("TREND SHORT exit", from_entry = "TREND SHORT", stop = trendStopPrice, limit = trendTargetPrice, comment_profit = "TP", comment_loss = "SL")

positionJustClosed = strategy.position_size == 0 and strategy.position_size[1] != 0
if positionJustClosed
    trendStopPrice := na
    trendTargetPrice := na
    pendingLongEntry := na
    pendingLongStop := na
    pendingLongBar := na
    pendingShortEntry := na
    pendingShortStop := na
    pendingShortBar := na
    plannedEntry := na
    plannedStop := na
    plannedTarget := na
    plannedUntilBar := na

// Detect whether the broker emulator closed the latest trade at TP or SL.
// Only a non-re-entry SL can arm one controlled re-entry cycle.
if closedTradeThisBar
    lastEntryId = strategy.closedtrades.entry_id(lastClosedTradeNumber)
    lastExitPrice = strategy.closedtrades.exit_price(lastClosedTradeNumber)
    lastTradeQty = math.abs(strategy.closedtrades.size(lastClosedTradeNumber))
    closedWasReentry = str.contains(lastEntryId, "REENTRY")
    closedWasLong = str.contains(lastEntryId, "LONG")
    plannedEntry := na
    plannedStop := na
    plannedTarget := na
    plannedUntilBar := na
    if enableReentry and lastExitComment == "SL" and not closedWasReentry and not shockPauseActive
        strategy.cancel("REENTRY LONG")
        strategy.cancel("REENTRY SHORT")
        reentryArmed := true
        reentryDirection := closedWasLong ? 1 : -1
        reentrySLBar := bar_index
        reentryRecoveryPrice := lastExitPrice
        reentryQty := math.max(lastTradeQty * reentrySizeMultiplier, syminfo.mincontract)
        reentryEntry := na
        reentryStop := na
        reentryTarget := na
        reentryPendingBar := na
        if showPriorityMarks
            label.new(bar_index, lastExitPrice, "SL HIT\nP3 COOLDOWN", style = closedWasLong ? label.style_label_up : label.style_label_down, color = color.new(color.purple, 18), textcolor = color.white, size = size.tiny)
    else
        reentryArmed := false
        reentryDirection := 0
        reentrySLBar := na
        reentryRecoveryPrice := na
        reentryQty := na
        reentryEntry := na
        reentryStop := na
        reentryTarget := na
        reentryPendingBar := na
        if showPriorityMarks and closedWasReentry and lastExitComment == "SL"
            label.new(bar_index, lastExitPrice, "RE-ENTRY SL\nSTOP THIS SETUP", style = closedWasLong ? label.style_label_up : label.style_label_down, color = color.new(color.red, 12), textcolor = color.white, size = size.tiny)

// Wait for the requested number of completed chart candles, then demand a
// reclaim of the stopped price, EMA direction, RSI and HTF trend alignment.
reentryWaitComplete = enableReentry and reentryArmed and decisionBarReady and not shockPauseActive and strategy.position_size == 0 and not na(reentrySLBar) and bar_index - reentrySLBar >= reentryWaitBars
reentryLongCandidate = reentryWaitComplete and reentryDirection == 1 and higherTrendUp and close > reentryRecoveryPrice and close > fastEMA and fastEMA > fastEMA[1] and rsiValue > 50 and close > open and metalSyncLongOK
reentryShortCandidate = reentryWaitComplete and reentryDirection == -1 and higherTrendDown and close < reentryRecoveryPrice and close < fastEMA and fastEMA < fastEMA[1] and rsiValue < 50 and close < open and metalSyncShortOK

if reentryLongCandidate
    reentryArmed := false
    reentryEntry := high + syminfo.mintick
    reentryStop := math.min(low, recentStructureLow) - syminfo.mintick * 2
    reentryTarget := reentryEntry + (reentryEntry - reentryStop) * rewardRisk
    reentryPendingBar := bar_index
    plannedEntry := reentryEntry
    plannedStop := reentryStop
    plannedTarget := reentryTarget
    plannedUntilBar := bar_index + planBars
    if showTradePlan
        label.new(bar_index, reentryEntry, "P3 RE-ENTRY BUY\nWAIT TRIGGER · " + str.tostring(reentrySizeMultiplier, "#.##") + "x SIZE", style = label.style_label_up, color = color.new(color.purple, 8), textcolor = color.white, size = size.tiny)
        label.new(bar_index, reentryTarget, "RE-TP", style = label.style_label_down, color = color.new(color.lime, 5), textcolor = color.black, size = size.tiny)
        label.new(bar_index, reentryStop, "RE-SL", style = label.style_label_up, color = color.new(color.red, 5), textcolor = color.white, size = size.tiny)

if reentryShortCandidate
    reentryArmed := false
    reentryEntry := low - syminfo.mintick
    reentryStop := math.max(high, recentStructureHigh) + syminfo.mintick * 2
    reentryTarget := reentryEntry - (reentryStop - reentryEntry) * rewardRisk
    reentryPendingBar := bar_index
    plannedEntry := reentryEntry
    plannedStop := reentryStop
    plannedTarget := reentryTarget
    plannedUntilBar := bar_index + planBars
    if showTradePlan
        label.new(bar_index, reentryEntry, "P3 RE-ENTRY SELL\nWAIT TRIGGER · " + str.tostring(reentrySizeMultiplier, "#.##") + "x SIZE", style = label.style_label_down, color = color.new(color.purple, 8), textcolor = color.white, size = size.tiny)
        label.new(bar_index, reentryTarget, "RE-TP", style = label.style_label_up, color = color.new(color.lime, 5), textcolor = color.black, size = size.tiny)
        label.new(bar_index, reentryStop, "RE-SL", style = label.style_label_down, color = color.new(color.red, 5), textcolor = color.white, size = size.tiny)

if not na(reentryPendingBar) and strategy.position_size == 0
    if bar_index - reentryPendingBar <= reentryExpiryBars and reentryQty > 0
        if reentryDirection == 1
            strategy.entry("REENTRY LONG", strategy.long, qty = reentryQty, stop = reentryEntry)
        if reentryDirection == -1
            strategy.entry("REENTRY SHORT", strategy.short, qty = reentryQty, stop = reentryEntry)
    else
        strategy.cancel("REENTRY LONG")
        strategy.cancel("REENTRY SHORT")
        reentryDirection := 0
        reentryEntry := na
        reentryStop := na
        reentryTarget := na
        reentryPendingBar := na
        plannedEntry := na
        plannedStop := na
        plannedTarget := na
        plannedUntilBar := na

reentryLongConfirmed = strategy.position_size > 0 and strategy.position_size[1] <= 0 and reentryDirection == 1 and not na(reentryStop)
reentryShortConfirmed = strategy.position_size < 0 and strategy.position_size[1] >= 0 and reentryDirection == -1 and not na(reentryStop)

if strategy.position_size > 0 and reentryDirection == 1 and not na(reentryStop)
    reentryLongRisk = strategy.position_avg_price - reentryStop
    if reentryLongRisk > syminfo.mintick
        reentryTarget := strategy.position_avg_price + reentryLongRisk * rewardRisk
        plannedEntry := strategy.position_avg_price
        plannedStop := reentryStop
        plannedTarget := reentryTarget
        plannedUntilBar := bar_index + planBars
        strategy.exit("REENTRY LONG exit", from_entry = "REENTRY LONG", stop = reentryStop, limit = reentryTarget, comment_profit = "TP", comment_loss = "SL")
    reentryPendingBar := na

if strategy.position_size < 0 and reentryDirection == -1 and not na(reentryStop)
    reentryShortRisk = reentryStop - strategy.position_avg_price
    if reentryShortRisk > syminfo.mintick
        reentryTarget := strategy.position_avg_price - reentryShortRisk * rewardRisk
        plannedEntry := strategy.position_avg_price
        plannedStop := reentryStop
        plannedTarget := reentryTarget
        plannedUntilBar := bar_index + planBars
        strategy.exit("REENTRY SHORT exit", from_entry = "REENTRY SHORT", stop = reentryStop, limit = reentryTarget, comment_profit = "TP", comment_loss = "SL")
    reentryPendingBar := na

plot(enableTrend ? fastEMA : na, "Fast EMA", color = color.aqua, linewidth = 2)
plot(enableTrend ? slowEMA : na, "Slow EMA", color = color.orange, linewidth = 2)
plot(confirmedHTFEMA, "Confirmed HTF EMA", color = color.new(color.purple, 35), linewidth = 2, style = plot.style_stepline)
plot(showLiquidity ? priorSwingHigh : na, "Buy-side liquidity", color = color.new(color.fuchsia, 28), linewidth = 2, style = plot.style_linebr)
plot(showLiquidity ? priorSwingLow : na, "Sell-side liquidity", color = color.new(color.aqua, 28), linewidth = 2, style = plot.style_linebr)
plot(strategy.position_size == 0 ? pendingLongEntry : na, "Reversal long trigger", color = color.yellow, linewidth = 2, style = plot.style_linebr)
plot(strategy.position_size == 0 ? pendingShortEntry : na, "Reversal short trigger", color = color.yellow, linewidth = 2, style = plot.style_linebr)

planVisible = showTradePlan and not na(plannedUntilBar) and (bar_index <= plannedUntilBar or strategy.position_size != 0)
planEntryPlot = plot(planVisible ? plannedEntry : na, "Candidate entry", color = color.yellow, linewidth = 2, style = plot.style_linebr)
planTargetPlot = plot(planVisible ? plannedTarget : na, "Possible TP", color = color.lime, linewidth = 3, style = plot.style_linebr)
planStopPlot = plot(planVisible ? plannedStop : na, "Possible SL", color = color.red, linewidth = 3, style = plot.style_linebr)
fill(planEntryPlot, planTargetPlot, color = color.new(color.lime, 88), title = "Reward zone")
fill(planEntryPlot, planStopPlot, color = color.new(color.red, 88), title = "Risk zone")
plotshape(showPriorityMarks and trendLongSetup, title = "P1 CONFIRMED TREND BUY", text = "P1 CONFIRMED\nBUY", style = shape.labelup, location = location.belowbar, color = color.aqua, textcolor = color.black, size = size.small)
plotshape(showPriorityMarks and trendShortSetup, title = "P1 CONFIRMED TREND SELL", text = "P1 CONFIRMED\nSELL", style = shape.labeldown, location = location.abovebar, color = color.orange, textcolor = color.black, size = size.small)
plotshape(showPriorityMarks and longWatch, title = "WATCH ONLY LONG REVERSAL", text = "WATCH ONLY\nLONG", style = shape.labelup, location = location.belowbar, color = color.new(color.lime, 28), textcolor = color.black, size = size.tiny)
plotshape(showPriorityMarks and shortWatch, title = "WATCH ONLY SHORT REVERSAL", text = "WATCH ONLY\nSHORT", style = shape.labeldown, location = location.abovebar, color = color.new(color.red, 24), textcolor = color.white, size = size.tiny)
plotshape(showPriorityMarks and reversalLongConfirmed, title = "P2 CONFIRMED REVERSAL BUY", text = "P2 CONFIRMED\nBUY", style = shape.labelup, location = location.belowbar, color = color.lime, textcolor = color.black, size = size.small)
plotshape(showPriorityMarks and reversalShortConfirmed, title = "P2 CONFIRMED REVERSAL SELL", text = "P2 CONFIRMED\nSELL", style = shape.labeldown, location = location.abovebar, color = color.red, textcolor = color.white, size = size.small)
plotshape(showPriorityMarks and reentryLongCandidate, title = "P3 RE-ENTRY WATCH BUY", text = "P3 RE-ENTRY\nWAIT TRIGGER", style = shape.labelup, location = location.belowbar, color = color.new(color.purple, 20), textcolor = color.white, size = size.tiny)
plotshape(showPriorityMarks and reentryShortCandidate, title = "P3 RE-ENTRY WATCH SELL", text = "P3 RE-ENTRY\nWAIT TRIGGER", style = shape.labeldown, location = location.abovebar, color = color.new(color.purple, 20), textcolor = color.white, size = size.tiny)
plotshape(showPriorityMarks and reentryLongConfirmed, title = "P3 CONFIRMED RE-ENTRY BUY", text = "P3 CONFIRMED\nRE-BUY", style = shape.labelup, location = location.belowbar, color = color.purple, textcolor = color.white, size = size.small)
plotshape(showPriorityMarks and reentryShortConfirmed, title = "P3 CONFIRMED RE-ENTRY SELL", text = "P3 CONFIRMED\nRE-SELL", style = shape.labeldown, location = location.abovebar, color = color.purple, textcolor = color.white, size = size.small)
plotshape(volatilityShock, title = "VOLATILITY SHOCK", text = "VOLATILITY SHOCK\nNO NEW TRADES", style = shape.labeldown, location = location.abovebar, color = color.fuchsia, textcolor = color.white, size = size.small)
plotshape(shockReset, title = "SHOCK PAUSE RESET", text = "SHOCK RESET\nWAIT P1 / P2 / P3", style = shape.labelup, location = location.belowbar, color = color.new(color.teal, 8), textcolor = color.white, size = size.tiny)
plotshape(showMetalSyncMarks and metalSyncBullishChanged, title = "GOLD SILVER SYNC BULLISH", text = "SYNC GOOD\nBULLISH", style = shape.labelup, location = location.belowbar, color = color.new(color.lime, 8), textcolor = color.black, size = size.tiny)
plotshape(showMetalSyncMarks and metalSyncBearishChanged, title = "GOLD SILVER SYNC BEARISH", text = "SYNC GOOD\nBEARISH", style = shape.labeldown, location = location.abovebar, color = color.new(color.red, 8), textcolor = color.white, size = size.tiny)
plotshape(showMetalSyncMarks and metalSyncLost, title = "GOLD SILVER NOT SYNCED", text = "NOT SYNCED\nWAIT", style = shape.labeldown, location = location.abovebar, color = color.new(color.orange, 5), textcolor = color.black, size = size.tiny)
bgcolor(enableReversal and not reversalTimeframeOK ? color.new(color.orange, 92) : na, title = "Reversal timeframe warning")
bgcolor(shockPauseActive ? color.new(color.fuchsia, 92) : na, title = "Volatility shock pause")

// Live status panel. Calculations refresh on incoming ticks, while actionable
// setups remain locked until the current chart candle is confirmed.
var table syncPanel = table.new(position.top_right, 2, 7, border_width = 1)
secondsToClose = timeframe.isintraday ? math.max(0, int(math.floor((time_close - timenow) / 1000))) : 0
minutesToClose = int(math.floor(secondsToClose / 60))
remainingSeconds = secondsToClose % 60
countdownText = str.tostring(minutesToClose, "00") + ":" + str.tostring(remainingSeconds, "00")
updateText = decisionBarReady ? "UPDATED" : timeframe.isintraday ? "WAIT " + countdownText : "WAIT FOR CLOSE"
priorityText = shockPauseActive ? "SHOCK PAUSE" : trendLongSetup ? "P1 BUY CONFIRMED" : trendShortSetup ? "P1 SELL CONFIRMED" : reversalLongConfirmed ? "P2 BUY CONFIRMED" : reversalShortConfirmed ? "P2 SELL CONFIRMED" : reentryLongConfirmed ? "P3 RE-BUY CONFIRMED" : reentryShortConfirmed ? "P3 RE-SELL CONFIRMED" : reentryLongCandidate ? "P3 RE-BUY WATCH" : reentryShortCandidate ? "P3 RE-SELL WATCH" : reentryArmed ? "P3 COOLDOWN" : longWatch ? "WATCH LONG ONLY" : shortWatch ? "WATCH SHORT ONLY" : "NO CONFIRMED SETUP"
priorityColor = shockPauseActive ? color.new(color.fuchsia, 58) : trendLongSetup or trendShortSetup ? color.new(color.aqua, 72) : reversalLongConfirmed ? color.new(color.lime, 72) : reversalShortConfirmed ? color.new(color.red, 68) : reentryLongConfirmed or reentryShortConfirmed ? color.new(color.purple, 58) : reentryLongCandidate or reentryShortCandidate or reentryArmed ? color.new(color.purple, 72) : longWatch or shortWatch ? color.new(color.orange, 74) : color.new(color.gray, 82)
entryGuardText = avoidShort ? "AVOID SHORT" : avoidLong ? "AVOID LONG" : noChaseLong ? "NO CHASE LONG" : noChaseShort ? "NO CHASE SHORT" : "CLEAR"
entryGuardColor = avoidShort ? color.new(color.orange, 58) : avoidLong ? color.new(color.red, 58) : noChaseLong or noChaseShort ? color.new(color.yellow, 64) : color.new(color.lime, 82)
entryGuardTextColor = noChaseLong or noChaseShort ? color.black : color.white
shockStatusText = volatilityShock ? "SHOCK DETECTED" : shockPauseActive ? "PAUSE ACTIVE" : shockReset ? "RESET · WAIT SIGNAL" : "NORMAL"
shockStatusColor = shockPauseActive ? color.new(color.fuchsia, 58) : shockReset ? color.new(color.teal, 62) : color.new(color.lime, 82)
metalSyncText = metalsBullishSync ? "GOOD · BULLISH" : metalsBearishSync ? "GOOD · BEARISH" : "NOT SYNCED · WAIT"
metalSyncColor = metalsBullishSync ? color.new(color.lime, 64) : metalsBearishSync ? color.new(color.red, 58) : color.new(color.orange, 62)
metalSyncTextColor = metalsBullishSync ? color.black : color.white

if barstate.islast
    if showTimeframeSync
        table.cell(syncPanel, 0, 0, "CHART", bgcolor = color.new(color.black, 12), text_color = color.silver, text_size = size.tiny)
        table.cell(syncPanel, 1, 0, timeframe.period, bgcolor = color.new(color.aqua, 82), text_color = color.white, text_size = size.tiny)
        table.cell(syncPanel, 0, 1, "FILTER", bgcolor = color.new(color.black, 12), text_color = color.silver, text_size = size.tiny)
        table.cell(syncPanel, 1, 1, confirmationTimeframe, bgcolor = color.new(color.purple, 78), text_color = color.white, text_size = size.tiny)
        table.cell(syncPanel, 0, 2, "NEXT CHECK", bgcolor = color.new(color.black, 12), text_color = color.silver, text_size = size.tiny)
        table.cell(syncPanel, 1, 2, updateText, bgcolor = decisionBarReady ? color.new(color.lime, 76) : color.new(color.orange, 78), text_color = color.white, text_size = size.tiny)
        table.cell(syncPanel, 0, 3, "PRIORITY", bgcolor = color.new(color.black, 12), text_color = color.silver, text_size = size.tiny)
        table.cell(syncPanel, 1, 3, priorityText, bgcolor = priorityColor, text_color = color.white, text_size = size.tiny)
        table.cell(syncPanel, 0, 4, "ENTRY GUARD", bgcolor = color.new(color.black, 12), text_color = color.silver, text_size = size.tiny)
        table.cell(syncPanel, 1, 4, entryGuardText, bgcolor = entryGuardColor, text_color = entryGuardTextColor, text_size = size.tiny)
        table.cell(syncPanel, 0, 5, "SHOCK GUARD", bgcolor = color.new(color.black, 12), text_color = color.silver, text_size = size.tiny)
        table.cell(syncPanel, 1, 5, shockStatusText, bgcolor = shockStatusColor, text_color = color.white, text_size = size.tiny)
        table.cell(syncPanel, 0, 6, "GOLD + SILVER", bgcolor = color.new(color.black, 12), text_color = color.silver, text_size = size.tiny)
        table.cell(syncPanel, 1, 6, metalSyncText, bgcolor = metalSyncColor, text_color = metalSyncTextColor, text_size = size.tiny)
    else
        table.clear(syncPanel, 0, 0, 1, 6)

alertcondition(trendLongSetup, title = "Aurum Guard trend long", message = "Confirmed Aurum Guard trend long setup")
alertcondition(trendShortSetup, title = "Aurum Guard trend short", message = "Confirmed Aurum Guard trend short setup")
alertcondition(longWatch, title = "Possible long reversal", message = "Aurum Guard possible long reversal; wait for trigger")
alertcondition(shortWatch, title = "Possible short reversal", message = "Aurum Guard possible short reversal; wait for trigger")
alertcondition(reversalLongConfirmed, title = "Aurum Guard confirmed reversal long", message = "P2 confirmed reversal long trigger filled")
alertcondition(reversalShortConfirmed, title = "Aurum Guard confirmed reversal short", message = "P2 confirmed reversal short trigger filled")
alertcondition(reentryLongCandidate, title = "Aurum Guard re-entry long watch", message = "P3 long re-entry candidate; wait for trigger")
alertcondition(reentryShortCandidate, title = "Aurum Guard re-entry short watch", message = "P3 short re-entry candidate; wait for trigger")
alertcondition(reentryLongConfirmed, title = "Aurum Guard confirmed re-entry long", message = "P3 confirmed re-entry long trigger filled")
alertcondition(reentryShortConfirmed, title = "Aurum Guard confirmed re-entry short", message = "P3 confirmed re-entry short trigger filled")
alertcondition(avoidShort, title = "Aurum Guard avoid short", message = "Bad Entry Guard: avoid short into a bullish pullback or sell-side liquidity sweep")
alertcondition(avoidLong, title = "Aurum Guard avoid long", message = "Bad Entry Guard: avoid long into a bearish rally or buy-side liquidity sweep")
alertcondition(noChaseLong, title = "Aurum Guard no-chase long", message = "Bad Entry Guard: long is ATR-extended; wait for a pullback")
alertcondition(noChaseShort, title = "Aurum Guard no-chase short", message = "Bad Entry Guard: short is ATR-extended; wait for a rally")
alertcondition(volatilityShock, title = "Aurum Guard volatility shock", message = "Volatility Shock Guard: abnormal candle or gap; no new trades")
alertcondition(shockReset, title = "Aurum Guard shock pause reset", message = "Volatility Shock Guard reset; wait for a fresh P1, P2 or P3 confirmation")
alertcondition(metalSyncBullishChanged, title = "Gold and Silver bullish sync", message = "Gold / Silver Sync Gate: GOOD and BULLISH; long setups may pass if all other rules confirm")
alertcondition(metalSyncBearishChanged, title = "Gold and Silver bearish sync", message = "Gold / Silver Sync Gate: GOOD and BEARISH; short setups may pass if all other rules confirm")
alertcondition(metalSyncLost, title = "Gold and Silver sync lost", message = "Gold / Silver Sync Gate: NOT SYNCED; wait and cancel unfilled entries")`;

export default function Home() {
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState('16:42:08');
  const [widgetRefresh, setWidgetRefresh] = useState(0);
  const [scriptCopied, setScriptCopied] = useState(false);
  const [liveMarket, setLiveMarket] = useState<LiveMarketKey>('gold');
  const [timeframe, setTimeframe] = useState('15');
  const [equity, setEquity] = useState(25000);
  const [riskPct, setRiskPct] = useState(0.5);
  const [entry, setEntry] = useState(4805.2);
  const [stop, setStop] = useState(4742);
  const [target, setTarget] = useState(4931.6);
  const [planCreated, setPlanCreated] = useState(false);
  const activeLiveMarket = liveMarkets.find((market) => market.key === liveMarket) ?? liveMarkets[0];

  function runScan() {
    setScanning(true);
    window.setTimeout(() => {
      setScanning(false);
      setWidgetRefresh((current) => current + 1);
      setLastScan(new Date().toLocaleTimeString([], { hour12: false }));
    }, 700);
  }

  async function copyStrategy() {
    await navigator.clipboard.writeText(pineScript);
    setScriptCopied(true);
    window.setTimeout(() => setScriptCopied(false), 1600);
  }

  function selectMetal(value: LiveMarketKey) {
    setLiveMarket(value);
    setPlanCreated(false);
    if (value === 'gold') {
      setEntry(4805.2);
      setStop(4742);
      setTarget(4931.6);
    } else {
      setEntry(66.8);
      setStop(64.9);
      setTarget(70.6);
    }
  }

  const riskBudget = Math.max(0, equity * (riskPct / 100));
  const riskPerOunce = Math.abs(entry - stop);
  const positionSize = riskPerOunce > 0 ? riskBudget / riskPerOunce : 0;
  const projectedReward = Math.abs(target - entry) * positionSize;
  const rewardRisk = riskBudget > 0 ? projectedReward / riskBudget : 0;
  const riskFields: Array<[string, number, (next: number) => void, number]> = [
    ['Account equity', equity, setEquity, 100],
    ['Risk %', riskPct, setRiskPct, 0.05],
    ['Entry', entry, setEntry, 0.1],
    ['Stop', stop, setStop, 0.1],
    ['Target', target, setTarget, 0.1],
  ];

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-white/8 bg-background/88 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1800px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl border border-primary/35 bg-primary/10 text-primary shadow-[0_0_32px_rgba(225,177,78,.12)]">
              <Bot className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading text-[15px] font-semibold tracking-tight">Aurum Guard</span>
                <Badge className="hidden border border-emerald-400/20 bg-emerald-400/10 text-[10px] text-emerald-300 min-[380px]:inline-flex">PAPER</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">Precious metals decision engine</p>
            </div>
          </div>
          <div className="hidden items-center gap-5 text-xs text-muted-foreground md:flex">
            <span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-emerald-400" /> Engine online</span>
            <span className="flex items-center gap-2"><Clock3 className="size-3.5" /> Live charts · paper signals</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="#pine-script"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 text-xs font-medium text-primary transition hover:bg-primary/15"
            >
              <Code2 className="size-4" />
              <span className="hidden sm:inline">One Pine Script</span>
              <span className="sm:hidden">Script</span>
            </a>
            <Button variant="outline" className="border-white/10 bg-white/[.03] text-xs" onClick={runScan} disabled={scanning}>
              <RefreshCw className={scanning ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{scanning ? 'Refreshing' : 'Refresh live data'}</span>
              <span className="sm:hidden">{scanning ? 'Wait' : 'Refresh'}</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
        <section className="mb-5">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[.16em] text-primary">
              <Sparkles className="size-3.5" /> Probability-weighted setup
            </div>
            <h1 className="font-heading text-2xl font-semibold tracking-[-.03em] sm:text-3xl">Protect capital. Trade only the clearest setup.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Live TradingView market context, a transparent rules-based strategy and strict manual risk sizing in one workspace.</p>
          </div>
        </section>

        <section className="mb-4" aria-labelledby="combined-script-heading">
          <Card className="overflow-hidden border-fuchsia-300/25 bg-[linear-gradient(110deg,rgba(192,132,252,.12),rgba(225,177,78,.08)_52%,rgba(18,22,27,.96))] shadow-[0_20px_70px_rgba(0,0,0,.22)]">
            <CardContent className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-4xl">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border border-fuchsia-300/25 bg-fuchsia-300/10 text-fuchsia-200">FREE PLAN READY</Badge>
                  <Badge variant="outline" className="border-primary/25 text-primary">1 SCRIPT SLOT</Badge>
                  <Badge variant="outline" className="border-emerald-300/25 text-emerald-300">AUTO TP / SL</Badge>
                  <Badge variant="outline" className="border-orange-300/25 text-orange-200">BAD ENTRY GUARD</Badge>
                  <Badge variant="outline" className="border-fuchsia-300/25 text-fuchsia-200">SHOCK CIRCUIT BREAKER</Badge>
                  <Badge variant="outline" className="border-lime-300/25 text-lime-200">GOLD + SILVER SYNC</Badge>
                </div>
                <h2 id="combined-script-heading" className="mt-3 font-heading text-lg font-semibold tracking-tight sm:text-xl">One script ranks confirmed setups and checks both metals</h2>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">P1–P3 marks separate confirmed entries from watch-only conditions. Gold and Silver must agree on direction, while the bad-entry and Shock Guards block weaker or unusually volatile conditions.</p>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={copyStrategy}>
                  {scriptCopied ? <Check /> : <Clipboard />}
                  {scriptCopied ? 'Combined script copied' : 'Copy combined script'}
                </Button>
                <a href="#pine-script" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/[.035] px-4 text-xs font-medium text-foreground transition hover:bg-white/[.07]">
                  View full script <ArrowUpRight className="size-3.5" />
                </a>
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="chart-guide" className="mb-4" aria-labelledby="chart-guide-heading">
          <Card className="overflow-hidden border-cyan-300/15 bg-[linear-gradient(145deg,rgba(34,211,238,.055),rgba(18,22,27,.96)_42%)]">
            <CardHeader className="border-b border-white/7 pb-4">
              <CardTitle id="chart-guide-heading" className="flex items-center gap-2 text-lg"><BookOpenCheck className="size-5 text-cyan-300" /> How to read the chart</CardTitle>
              <CardDescription>Use this order: trend first, structure second, trade plan last.</CardDescription>
              <CardAction><Badge className="border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">QUICK GUIDE</Badge></CardAction>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4 xl:grid-cols-[1.15fr_.85fr]">
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Lines and zones</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    ['bg-cyan-300', 'Smooth cyan', 'Fast EMA · short-term direction'],
                    ['bg-orange-300', 'Smooth orange', 'Slow EMA · broader trend'],
                    ['bg-purple-400', 'Stepped purple', 'Confirmed higher-timeframe EMA · priority trend filter'],
                    ['bg-fuchsia-400', 'Stepped magenta', 'Buy-side liquidity · confirmed swing high'],
                    ['bg-cyan-500', 'Stepped teal', 'Sell-side liquidity · confirmed swing low'],
                    ['bg-yellow-300', 'Yellow', 'Candidate entry · wait for confirmation'],
                    ['bg-emerald-400', 'Green', 'Possible take-profit and reward zone'],
                    ['bg-red-400', 'Red', 'Possible stop-loss and risk zone'],
                    ['bg-blue-500', 'Blue circles', 'TradingView selection handles · not signals'],
                  ].map(([color, title, description]) => (
                    <div key={title} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[.025] p-3">
                      <span className={`h-1 w-9 shrink-0 rounded-full ${color}`} />
                      <div><p className="text-xs font-semibold">{title}</p><p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{description}</p></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid content-start gap-4">
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Signal priority</p>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    {[
                      ['P1 CONFIRMED', 'Highest priority', 'Trend setup confirmed at candle close and aligned with the higher-timeframe filter.', 'border-cyan-300/20 bg-cyan-300/[.055] text-cyan-200'],
                      ['P2 CONFIRMED', 'Second priority', 'Reversal watch became valid only after price crossed its yellow trigger.', 'border-emerald-300/20 bg-emerald-300/[.055] text-emerald-200'],
                      ['P3 RE-ENTRY', 'Third priority', 'After an SL, waits and reconfirms before offering one smaller re-entry with fresh TP and SL.', 'border-purple-300/20 bg-purple-300/[.055] text-purple-200'],
                      ['WATCH ONLY', 'No trade yet', 'A possible reversal exists, but it is unconfirmed until the trigger is crossed.', 'border-amber-300/20 bg-amber-300/[.055] text-amber-200'],
                    ].map(([label, rank, description, color]) => (
                      <div key={label} className={`rounded-xl border p-3 ${color}`}>
                        <p className="text-[10px] font-bold tracking-[.08em]">{label}</p>
                        <p className="mt-1 text-[11px] font-semibold text-foreground">{rank}</p>
                        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{description}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] leading-4 text-muted-foreground">P1 outranks P2, and either fresh P1/P2 setup cancels a P3 re-entry idea. Liquidity lines and HH/HL/LH/LL labels are context only—not BUY or SELL confirmation.</p>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Bad Entry Guard</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ['AVOID SHORT', 'Bullish pullback or sell-side sweep; shorting can make you the liquidity.', 'border-orange-300/20 bg-orange-300/[.05] text-orange-200'],
                      ['AVOID LONG', 'Bearish rally or buy-side sweep; buying can be the trapped side.', 'border-red-300/20 bg-red-300/[.05] text-red-200'],
                      ['NO CHASE LONG', 'Price is already too far above the fast EMA; wait for a pullback.', 'border-yellow-300/20 bg-yellow-300/[.05] text-yellow-200'],
                      ['NO CHASE SHORT', 'Price is already too far below the fast EMA; wait for a rally.', 'border-yellow-300/20 bg-yellow-300/[.05] text-yellow-200'],
                    ].map(([label, description, color]) => (
                      <div key={label} className={`rounded-xl border p-3 ${color}`}>
                        <p className="text-[10px] font-bold tracking-[.06em]">{label}</p>
                        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{description}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] leading-4 text-muted-foreground"><span className="font-semibold text-emerald-200">ENTRY GUARD · CLEAR</span> means no guard condition is active. It is not permission to enter; a P1, P2 or P3 confirmation is still required.</p>
                </div>

                <div className="rounded-xl border border-fuchsia-300/20 bg-fuchsia-300/[.045] p-4">
                  <p className="text-xs font-semibold text-fuchsia-100">Volatility Shock Guard</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                    {[
                      ['1 · Detect', 'A candle range above 2.00 ATR or an opening gap above 0.75 ATR triggers the guard.'],
                      ['2 · Pause', 'Unfilled reversal and re-entry orders are cancelled; fresh setups pause for three closed candles.'],
                      ['3 · Reset', 'SHOCK RESET means resume scanning only. Wait for a new P1, P2 or P3 confirmation.'],
                    ].map(([title, description]) => (
                      <div key={title} className="rounded-lg border border-white/8 bg-black/15 p-3">
                        <p className="text-[10px] font-semibold text-fuchsia-200">{title}</p>
                        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{description}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] leading-4 text-muted-foreground"><span className="font-semibold text-amber-200">Important:</span> this price-only guard reacts after a shock begins; it cannot predict the first spike or prevent an existing position from reaching its SL. The 2% strategy daily-loss lock stops further simulated orders for that session.</p>
                </div>

                <div className="rounded-xl border border-lime-300/20 bg-lime-300/[.04] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-lime-100">Gold–Silver Sync Gate</p>
                    <Badge className="border border-lime-300/20 bg-lime-300/10 text-lime-200">SAME TIMEFRAME</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                    {[
                      ['GOOD · BULLISH', 'Both metals rose over the lookback and their rolling correlation is strong enough. Only long setups may pass.', 'border-lime-300/20 text-lime-200'],
                      ['GOOD · BEARISH', 'Both metals fell over the lookback and their rolling correlation is strong enough. Only short setups may pass.', 'border-red-300/20 text-red-200'],
                      ['NOT SYNCED · WAIT', 'Direction disagrees or correlation is too weak. New entries are blocked and an unfilled trigger is cancelled.', 'border-orange-300/20 text-orange-200'],
                    ].map(([label, description, color]) => (
                      <div key={label} className={`rounded-lg border bg-black/15 p-3 ${color}`}>
                        <p className="text-[10px] font-bold tracking-[.04em]">{label}</p>
                        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{description}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] leading-4 text-muted-foreground"><span className="font-semibold text-lime-200">SYNC GOOD is a filter, not an entry.</span> Still wait for P1, P2 or P3 CONFIRMED. Defaults compare OANDA:XAUUSD with OANDA:XAGUSD over five bars using 20-bar return correlation of at least 0.25.</p>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">Market structure</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ['HH', 'Higher High', 'bg-emerald-400/12 text-emerald-200'],
                      ['HL', 'Higher Low', 'bg-cyan-400/12 text-cyan-200'],
                      ['LH', 'Lower High', 'bg-orange-400/12 text-orange-200'],
                      ['LL', 'Lower Low', 'bg-red-400/12 text-red-200'],
                    ].map(([code, meaning, color]) => (
                      <div key={code} className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[.025] p-3">
                        <span className={`grid size-8 shrink-0 place-items-center rounded-lg text-[10px] font-bold ${color}`}>{code}</span>
                        <p className="text-[11px] font-medium">{meaning}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] leading-4 text-muted-foreground"><span className="text-emerald-300">HH + HL repeating</span> supports bullish structure. <span className="text-red-300">LH + LL repeating</span> supports bearish structure. One label alone is not enough.</p>
                </div>

                <div className="rounded-xl border border-primary/15 bg-primary/[.035] p-4">
                  <p className="text-xs font-semibold">Read every setup in four checks</p>
                  <ol className="mt-2 space-y-2 text-[11px] leading-5 text-muted-foreground">
                    <li><span className="mr-2 text-primary">1.</span>Check GOLD + SILVER: GOOD · BULLISH permits only long ideas; GOOD · BEARISH permits only short ideas; NOT SYNCED means wait.</li>
                    <li><span className="mr-2 text-primary">2.</span>Cyan above orange and both rising favors longs; cyan below orange and both falling favors shorts.</li>
                    <li><span className="mr-2 text-primary">3.</span>Confirm the structure sequence and note which liquidity line price is approaching or sweeping.</li>
                    <li><span className="mr-2 text-primary">4.</span>Act only on P1, P2 or P3 CONFIRMED with yellow Entry, green TP and red SL. WATCH ONLY and P3 COOLDOWN are not entries.</li>
                  </ol>
                </div>

                <div className="rounded-xl border border-amber-300/15 bg-amber-300/[.035] p-3 text-[10px] leading-4 text-muted-foreground">
                  <p><span className="font-semibold text-amber-200">Important:</span> HH/HL/LH/LL and liquidity levels use confirmed pivots, so they appear after the swing is confirmed. Blue circles disappear when you click empty chart space or press Esc.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="live-chart" className="mb-4">
          <Card className="border-primary/15 bg-card/95 shadow-[0_30px_100px_rgba(0,0,0,.28)]">
            <CardHeader className="border-b border-white/7 pb-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="flex items-center gap-2 text-lg"><CandlestickChart className="size-5 text-primary" /> Live TradingView workspace</CardTitle>
                    <Badge className="border border-emerald-400/20 bg-emerald-400/10 text-emerald-300"><RadioTower className="size-3" /> STREAMING</Badge>
                    <Badge variant="outline" className="border-white/10 text-muted-foreground">1 MINUTE +</Badge>
                  </div>
                  <CardDescription className="mt-1.5">Gold and Silver spot charts are shown together. One shared control changes both charts from 1 minute upward.</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-wrap gap-1 rounded-lg border border-white/8 bg-black/15 p-1" aria-label="Chart timeframe">
                    {timeframes.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        aria-pressed={timeframe === item.value}
                        onClick={() => setTimeframe(item.value)}
                        className={`min-w-10 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${timeframe === item.value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-white/6 hover:text-foreground'}`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4">
              <div className="grid gap-4 lg:grid-cols-2">
                {liveMarkets.map((market) => (
                  <div key={market.key} className={`min-w-0 overflow-hidden rounded-xl border bg-black/15 ${liveMarket === market.key ? 'border-primary/35' : 'border-white/10'}`}>
                    <div className="flex min-h-14 items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className={`size-2.5 rounded-full ${market.key === 'gold' ? 'bg-amber-300' : 'bg-zinc-200'}`} />
                        <div>
                          <p className="text-sm font-semibold">{market.label}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">{market.short} · {market.symbol}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(market.symbol)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground transition hover:border-white/20 hover:text-foreground"
                        >
                          Open <ExternalLink className="size-3" />
                        </a>
                        <button
                          type="button"
                          aria-pressed={liveMarket === market.key}
                          onClick={() => selectMetal(market.key)}
                          className={`rounded-lg border px-3 py-1.5 text-[10px] font-medium transition ${liveMarket === market.key ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground'}`}
                        >
                          {liveMarket === market.key ? 'Analysis focused' : 'Focus analysis'}
                        </button>
                      </div>
                    </div>
                    <TradingViewChart
                      key={`${market.symbol}-${timeframe}-${widgetRefresh}`}
                      symbol={market.symbol}
                      interval={timeframe}
                      label={market.label}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
            <div className="flex flex-col gap-1 border-t border-white/7 px-4 py-3 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>Both charts are always visible: Gold uses OANDA:XAUUSD and Silver uses OANDA:XAGUSD. “Focus analysis” changes the quote and rating panels below.</span>
              <a href="https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">Chart details <ExternalLink className="size-3" /></a>
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(360px,.72fr)_minmax(0,1.28fr)]">
          <div className="grid content-start gap-4">
            <Card className="border-emerald-400/15 bg-card/92">
              <CardHeader className="border-b border-white/7 pb-4">
                <CardTitle className="flex items-center gap-2"><RadioTower className="size-4 text-emerald-300" /> Live market quote</CardTitle>
                <CardDescription>{activeLiveMarket.label} spot · supplied by TradingView</CardDescription>
                <CardAction><Badge className="border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">LIVE</Badge></CardAction>
              </CardHeader>
              <CardContent className="px-2 py-3">
                <TradingViewSymbolInfo key={`${activeLiveMarket.symbol}-${widgetRefresh}`} symbol={activeLiveMarket.symbol} />
                <div className="flex items-center justify-between border-t border-white/7 px-3 pt-3 text-[10px] text-muted-foreground">
                  <span>Last refreshed {lastScan}</span>
                  <span>Provider latency may apply</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/15 bg-[linear-gradient(145deg,rgba(225,177,78,.09),rgba(18,22,27,.94)_48%)]">
              <CardHeader className="border-b border-white/7 pb-4">
                <CardTitle className="flex items-center gap-2"><LineChart className="size-4 text-primary" /> Live technical rating</CardTitle>
                <CardDescription>TradingView oscillator + moving-average summary</CardDescription>
                <CardAction><Badge variant="outline" className="border-primary/25 text-primary">{timeframes.find((item) => item.value === timeframe)?.label}</Badge></CardAction>
              </CardHeader>
              <CardContent className="px-2 py-3">
                <TradingViewTechnicalAnalysis
                  key={`${activeLiveMarket.symbol}-${timeframe}-${widgetRefresh}`}
                  symbol={activeLiveMarket.symbol}
                  interval={timeframe}
                />
                <p className="border-t border-white/7 px-3 pt-3 text-[10px] leading-4 text-muted-foreground">This rating summarizes current indicators. Treat it as context, not an instruction or probability of profit.</p>
              </CardContent>
            </Card>

            <Card className="border-amber-400/15 bg-amber-400/[.035]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><TriangleAlert className="size-4 text-amber-300" /> News-risk guard</CardTitle>
                <CardDescription>High-impact event window</CardDescription>
                <CardAction><Badge className="bg-amber-300/10 text-amber-200">CAUTION</Badge></CardAction>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-amber-300/10 bg-black/15 p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div><p className="text-xs font-medium">US inflation / central-bank remarks</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Pause new entries around scheduled macro releases.</p></div>
                    <Clock3 className="size-4 shrink-0 text-amber-300" />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-muted-foreground"><ShieldCheck className="size-3.5 text-emerald-300" /> Risk gate active</span>
                  <a href="#news" className="flex items-center gap-1 text-primary hover:underline">Review sources <ArrowUpRight className="size-3" /></a>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card id="pine-script" className="overflow-hidden border-primary/15 bg-card/92 shadow-[0_24px_90px_rgba(0,0,0,.22)]">
            <CardHeader className="border-b border-white/7 pb-4">
              <CardTitle className="flex items-center gap-2"><Code2 className="size-4 text-primary" /> Combined Trend + Reversal Strategy · Pine v6</CardTitle>
              <CardDescription>One free-plan script slot · Gold/Silver direction sync + timeframe-synced setups + bad-entry warnings + volatility circuit breaker + controlled post-SL re-entry</CardDescription>
              <CardAction>
                <Button variant="outline" size="sm" className="border-white/10 bg-white/[.03]" onClick={copyStrategy}>
                  {scriptCopied ? <Check /> : <Clipboard />}
                  {scriptCopied ? 'Combined script copied' : 'Copy combined script'}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="mb-4 flex flex-col gap-3 rounded-xl border border-cyan-300/15 bg-cyan-300/[.045] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-cyan-300/15 bg-cyan-300/10 text-cyan-200">
                    <Clock3 className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-cyan-100">Timeframe-synced updates</p>
                    <p className="mt-1 max-w-2xl text-[10px] leading-4 text-muted-foreground">The selected TradingView chart controls the decision clock: 1m checks after each completed 1-minute candle, 3m after each completed 3-minute candle, and 15m after each completed 15-minute candle. The live panel counts down to the next confirmed check.</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5 text-[10px] font-semibold">
                  <span className="rounded-md border border-white/9 bg-black/15 px-2 py-1">1m → 1 min</span>
                  <span className="rounded-md border border-white/9 bg-black/15 px-2 py-1">3m → 3 min</span>
                  <span className="rounded-md border border-white/9 bg-black/15 px-2 py-1">15m → 15 min</span>
                </div>
              </div>

              <div className="mb-4 rounded-xl border border-purple-300/20 bg-purple-300/[.045] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-xs font-semibold text-purple-100">Controlled P3 re-entry after an SL</p>
                    <p className="mt-1 text-[10px] leading-4 text-muted-foreground">Default behavior: wait one completed chart candle, require price to reclaim the stopped level with EMA, RSI and higher-timeframe agreement, then place one 0.50×-size trigger, subject to the symbol’s minimum contract size. If triggered, the script draws a fresh yellow entry, green RE-TP and red RE-SL. If the trigger expires or the re-entry also stops, the cycle ends.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[.06em]">
                    {['SL hit', 'Wait 1 close', 'Reconfirm', 'P3 trigger', 'Fresh TP / SL'].map((step, index) => (
                      <div key={step} className="flex items-center gap-1.5">
                        {index > 0 && <span className="text-purple-300/60">→</span>}
                        <span className="rounded-md border border-purple-300/15 bg-black/15 px-2 py-1.5 text-purple-100">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="mt-3 border-t border-purple-300/10 pt-3 text-[10px] leading-4 text-muted-foreground"><span className="font-semibold text-purple-200">Why the wait?</span> A wick through SL is not enough reason to jump straight back in. Reclaim plus a fresh candle close is required to reduce revenge entries. Change the wait, expiry and size under Settings → Controlled re-entry.</p>
              </div>

              <div className="mb-4 rounded-xl border border-fuchsia-300/20 bg-fuchsia-300/[.045] p-4">
                <div className="flex gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-fuchsia-300/20 bg-fuchsia-300/10 text-fuchsia-200">
                    <TriangleAlert className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-fuchsia-100">Volatility Shock Guard + daily-loss lock</p>
                    <p className="mt-1 text-[10px] leading-4 text-muted-foreground">A 2.00 ATR candle or 0.75 ATR opening gap marks VOLATILITY SHOCK, cancels unfilled triggers and pauses every new entry for three completed candles. SHOCK RESET only resumes scanning. Separately, TradingView’s strategy circuit breaker defaults to a 2% intraday loss limit.</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[.06em]">
                  {['Shock detected', 'Cancel pending', 'Pause 3 closes', 'Shock reset', 'Fresh confirmation'].map((step, index) => (
                    <div key={step} className="flex items-center gap-1.5">
                      {index > 0 && <span className="text-fuchsia-300/60">→</span>}
                      <span className="rounded-md border border-fuchsia-300/15 bg-black/15 px-2 py-1.5 text-fuchsia-100">{step}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 border-t border-fuchsia-300/10 pt-3 text-[10px] leading-4 text-muted-foreground">The guard reacts after unusual movement starts—it cannot predict the first spike. The daily lock governs TradingView’s simulated strategy and does not automatically control a separate broker account unless your execution connection enforces the strategy’s orders.</p>
              </div>

              <div className="mb-4 rounded-xl border border-lime-300/20 bg-lime-300/[.04] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-xs font-semibold text-lime-100">Gold + Silver confirmation on one clock</p>
                    <p className="mt-1 text-[10px] leading-4 text-muted-foreground">The script requests OANDA Gold and Silver on the active chart timeframe, compares their five-bar direction and checks their 20-bar return correlation. It permits long logic only during bullish sync and short logic only during bearish sync.</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5 text-[9px] font-semibold uppercase tracking-[.06em]">
                    <span className="rounded-md border border-lime-300/20 bg-black/15 px-2 py-1.5 text-lime-200">Good · bullish</span>
                    <span className="rounded-md border border-red-300/20 bg-black/15 px-2 py-1.5 text-red-200">Good · bearish</span>
                    <span className="rounded-md border border-orange-300/20 bg-black/15 px-2 py-1.5 text-orange-200">Not synced · wait</span>
                  </div>
                </div>
                <p className="mt-3 border-t border-lime-300/10 pt-3 text-[10px] leading-4 text-muted-foreground">This is an intermarket agreement filter—not proof a trade will win. Change the symbols, lookback, correlation length or 0.25 threshold under Settings → Gold / Silver Sync.</p>
              </div>

              <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  ['Liquidity map', 'Confirmed swing highs mark buy-side liquidity; confirmed swing lows mark sell-side liquidity.'],
                  ['HH / HL structure', 'Labels higher highs, higher lows, lower highs and lower lows only after pivot confirmation.'],
                  ['Automatic plan', 'Yellow candidate entry, green possible TP, red possible SL and shaded reward/risk zones.'],
                  ['Priority marks', 'P1 trend, P2 reversal, P3 controlled re-entry, and Watch Only for an untriggered possibility.'],
                  ['Bad Entry Guard', 'Avoid counter-trend liquidity traps and ATR-extended chase entries.'],
                  ['Shock circuit breaker', 'Cancels pending ideas, pauses new setups and enforces a configurable strategy daily-loss lock.'],
                  ['Gold / Silver Sync', 'Requires both metals to agree on bullish or bearish direction before that side can enter.'],
                ].map(([title, description], index) => (
                  <div key={title} className="rounded-xl border border-white/8 bg-white/[.025] p-3">
                    <p className={`text-xs font-semibold ${index === 0 ? 'text-primary' : index === 1 ? 'text-fuchsia-300' : index === 2 ? 'text-emerald-300' : index === 3 ? 'text-amber-200' : index === 4 ? 'text-orange-200' : index === 5 ? 'text-fuchsia-200' : 'text-lime-200'}`}>{title}</p>
                    <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">{description}</p>
                  </div>
                ))}
              </div>

              <div className="mb-4 grid gap-3 rounded-xl border border-white/9 bg-black/15 p-4 sm:grid-cols-[auto_1fr] sm:items-center">
                <div className="flex flex-wrap gap-2 text-[10px] font-semibold">
                  <span className="rounded-md border border-yellow-300/20 bg-yellow-300/10 px-2.5 py-1.5 text-yellow-200">YELLOW · ENTRY</span>
                  <span className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1.5 text-emerald-200">GREEN · TP</span>
                  <span className="rounded-md border border-red-300/20 bg-red-300/10 px-2.5 py-1.5 text-red-200">RED · SL</span>
                </div>
                <div className="sm:border-l sm:border-white/9 sm:pl-4">
                  <p className="text-xs font-semibold">What does “2.14” mean?</p>
                  <p className="mt-1 text-[10px] leading-4 text-muted-foreground">It is the reward-to-risk ratio. A 2.14 target aims for about $2.14 of potential reward for every $1.00 risked before spread, slippage and fees. It is a projection—not a win probability.</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0c0f12]">
                <div className="flex items-center justify-between border-b border-white/8 px-4 py-2 text-[10px] uppercase tracking-[.12em] text-muted-foreground">
                  <span>aurum-guard-combined-trend-reversal.pine</span>
                  <span>Version 6</span>
                </div>
                <pre className="max-h-[730px] overflow-auto p-4 font-mono text-[11px] leading-[1.7] text-zinc-300"><code>{pineScript}</code></pre>
              </div>

              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-primary/12 bg-primary/[.035] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-medium">Use it in TradingView</p>
                  <p className="mt-1 text-[10px] leading-4 text-muted-foreground">Copy once, paste into Pine Editor and select “Add to chart.” Settings → Gold / Silver Sync controls both symbols, lookback and correlation threshold. Shock Guard, bad-entry and re-entry settings remain separately adjustable.</p>
                </div>
                <a href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(activeLiveMarket.symbol)}`} target="_blank" rel="noreferrer">
                  <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto">Open TradingView <ExternalLink /></Button>
                </a>
              </div>

              <p className="mt-3 text-[10px] leading-4 text-muted-foreground">Gold/Silver sync, shock and bad-entry warnings are reactive rule-based filters, not forecasts. They cannot prevent the first spike or guarantee fills at SL. New decisions wait for candle close; provider latency, spread, slippage and fast markets can still produce worse results. Entry, TP and SL remain conditional projections.</p>
            </CardContent>
          </Card>
        </section>

        <section id="reversal-playbook" className="mt-4">
          <Card className="border-fuchsia-400/15 bg-[linear-gradient(145deg,rgba(192,132,252,.08),rgba(18,22,27,.95)_45%)]">
            <CardHeader className="border-b border-white/7 pb-4">
              <CardTitle className="flex items-center gap-2"><RotateCcw className="size-4 text-fuchsia-300" /> Gold reversal scalping playbook</CardTitle>
              <CardDescription>A conditional 1m–5m process—not a prediction of the exact turning point.</CardDescription>
              <CardAction><Badge className="border border-fuchsia-300/20 bg-fuchsia-300/10 text-fuchsia-200">POSSIBLE REVERSAL</Badge></CardAction>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ['1 · Context', 'Use a 1m, 3m or 5m chart. The previous completed 15m close must remain on the correct side of its EMA 50.'],
                  ['2 · Reversal watch', 'Price sweeps a confirmed prior swing, closes back through it and prints a rejection wick with RSI recovery.'],
                  ['3 · Entry trigger', 'Long only one tick above the reversal candle high; short only one tick below its low. No trigger means no trade.'],
                  ['4 · Risk and expiry', 'Stop beyond the sweep candle, default target 2.14R, and cancel the pending entry if it does not trigger within three bars.'],
                ].map(([title, description]) => (
                  <div key={title} className="rounded-xl border border-white/8 bg-white/[.025] p-3">
                    <p className="text-xs font-semibold text-foreground">{title}</p>
                    <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">{description}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-primary/20 bg-primary/[.055] p-4">
                  <div className="flex items-center gap-2 text-primary"><Crosshair className="size-4" /><p className="text-xs font-semibold">Automatic candidate entry</p></div>
                  <p className="mt-2 text-sm font-semibold">Reversal candle → confirmation break → immediate predefined risk</p>
                  <p className="mt-2 text-[11px] leading-5 text-muted-foreground">The sweep candle is only a watch condition. Entry is allowed after price breaks its rejection extreme. This sacrifices the exact bottom or top to demand evidence that price is actually reversing.</p>
                </div>

                <div className="rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-4 text-[11px] leading-5 text-muted-foreground">
                  <p className="font-medium text-amber-200">Skip the setup</p>
                  <p className="mt-1">During CPI, payrolls or central-bank releases; when spread/slippage is abnormal; when the 15m filter disagrees; or after the daily loss cap is reached.</p>
                </div>
              </div>

              <p className="mt-4 text-[10px] leading-4 text-muted-foreground">For paper testing, start at 0.25% risk or less per attempt. “Possible reversal” means conditions aligned—it does not mean the market must reverse.</p>
            </CardContent>
          </Card>

        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[.82fr_1.18fr]">
          <Card id="risk-plan" className="border-emerald-400/12 bg-card/92">
            <CardHeader className="border-b border-white/7 pb-4">
              <CardTitle className="flex items-center gap-2"><Calculator className="size-4 text-emerald-300" /> Manual risk-first position plan</CardTitle>
              <CardDescription>Enter your intended prices, then size the trade from the loss limit—not from conviction.</CardDescription>
              <CardAction><Badge className="bg-emerald-400/10 text-emerald-300">MAX {riskPct.toFixed(2)}%</Badge></CardAction>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 xl:grid-cols-2 2xl:grid-cols-5">
                {riskFields.map(([label, value, setter, step]) => (
                  <label key={String(label)} className="text-[11px] text-muted-foreground">
                    {label}
                    <input
                      aria-label={String(label)}
                      type="number"
                      min="0"
                      step={Number(step)}
                      value={Number(value)}
                      onChange={(event) => (setter as (next: number) => void)(Number(event.target.value))}
                      className="mt-1.5 h-9 w-full min-w-0 rounded-lg border border-white/10 bg-black/15 px-2.5 py-1 font-mono text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-3 focus:ring-primary/15"
                    />
                  </label>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/8 bg-white/8 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
                {[
                  ['Max loss', `$${riskBudget.toFixed(2)}`],
                  ['Position', `${positionSize.toFixed(2)} oz`],
                  ['Est. reward', `$${projectedReward.toFixed(2)}`],
                  ['Reward / risk', `${rewardRisk.toFixed(2)}R`],
                ].map(([label, value]) => (
                  <div key={label} className="bg-card p-3">
                    <p className="text-[10px] uppercase tracking-[.1em] text-muted-foreground">{label}</p>
                    <p className="mt-1 font-mono text-sm font-semibold">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-white/8 bg-white/[.025] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2">
                  <LockKeyhole className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                  <div>
                    <p className="text-xs font-medium">Hard risk rules</p>
                    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">No averaging down · one stop · daily loss cap 1.5% · paper mode only</p>
                  </div>
                </div>
                <Button
                  className="bg-emerald-300 text-emerald-950 hover:bg-emerald-200"
                  onClick={() => setPlanCreated(true)}
                  disabled={riskPerOunce === 0 || riskBudget === 0}
                >
                  {planCreated ? <Check /> : <ShieldCheck />}
                  {planCreated ? 'Paper plan saved' : 'Save paper plan'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card id="news" className="border-white/8 bg-card/92">
            <CardHeader className="border-b border-white/7 pb-4">
              <CardTitle className="flex items-center gap-2"><Newspaper className="size-4 text-primary" /> Metals intelligence</CardTitle>
              <CardDescription>Authoritative source hubs and the likely price transmission.</CardDescription>
              <CardAction><Badge variant="outline" className="border-white/10 text-muted-foreground">SOURCE LINKS</Badge></CardAction>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-3">
                {[
                  {
                    source: 'World Gold Council',
                    title: 'Weekly market monitor & demand research',
                    note: 'Watch central-bank demand, ETF flows and the dollar / rates channel.',
                    bias: 'Gold lens',
                    url: 'https://www.gold.org/goldhub/research/library',
                  },
                  {
                    source: 'CME Group',
                    title: 'Metals futures research & volatility',
                    note: 'Track futures structure, contract activity and event-driven volatility.',
                    bias: 'Gold + silver',
                    url: 'https://www.cmegroup.com/markets/metals.html',
                  },
                  {
                    source: 'LBMA',
                    title: 'Benchmarks, vault data & analyst survey',
                    note: 'Use physical-market context; benchmark redistribution may require a licence.',
                    bias: 'Physical lens',
                    url: 'https://www.lbma.org.uk/ts/all',
                  },
                ].map((item) => (
                  <a key={item.source} href={item.url} target="_blank" rel="noreferrer" className="group rounded-xl border border-white/8 bg-white/[.025] p-3 transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/[.035]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-medium uppercase tracking-[.11em] text-primary">{item.source}</span>
                      <ExternalLink className="size-3 text-muted-foreground transition group-hover:text-primary" />
                    </div>
                    <p className="mt-3 text-xs font-medium leading-5">{item.title}</p>
                    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{item.note}</p>
                    <Badge className="mt-3 bg-white/5 text-[10px] text-muted-foreground">{item.bias}</Badge>
                  </a>
                ))}
              </div>

              <div className="mt-4 grid gap-3 border-t border-white/7 pt-4 sm:grid-cols-3">
                {[
                  ['US dollar', 'Neutral', 'A softer dollar is usually supportive'],
                  ['Real yields', 'Elevated', 'Higher real yields can pressure gold'],
                  ['Gold / silver ratio', '71.9', 'Falling ratio can favor silver'],
                ].map(([label, value, note]) => (
                  <div key={label} className="flex items-start gap-2">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                    <div><p className="text-[10px] uppercase tracking-[.1em] text-muted-foreground">{label}</p><p className="mt-1 text-xs font-semibold">{value}</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{note}</p></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-3">
          {[
            {
              icon: LineChart,
              step: '01 · Find regime',
              title: 'Trade with the trend',
              text: 'The model scores 20/50 EMA structure, momentum and distance from support. Counter-trend setups are rejected.',
            },
            {
              icon: Landmark,
              step: '02 · Gate the entry',
              title: 'Respect macro risk',
              text: 'Scheduled inflation, jobs and central-bank windows can block new entries even when the chart looks attractive.',
            },
            {
              icon: ShieldCheck,
              step: '03 · Cap the damage',
              title: 'Risk stays small',
              text: 'Position size is derived from the stop distance. A signal never overrides the portfolio and daily loss limits.',
            },
          ].map((item) => (
            <Card key={item.step} className="border-white/8 bg-white/[.02]" size="sm">
              <CardContent className="flex gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><item.icon className="size-4" /></div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[.12em] text-primary">{item.step}</p>
                  <h2 className="mt-1 text-sm font-semibold">{item.title}</h2>
                  <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{item.text}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <div className="mt-4 flex flex-col items-start justify-between gap-2 rounded-xl border border-white/8 bg-white/[.025] px-4 py-3 text-[11px] text-muted-foreground sm:flex-row sm:items-center">
          <span>TradingView supplies the live quote, chart and technical rating; provider latency may apply. The Pine strategy is a testable ruleset—not financial advice or a profit guarantee.</span>
          <a href="#risk-plan" className="flex items-center gap-1 text-foreground hover:text-primary">Review risk controls <ChevronDown className="size-3" /></a>
        </div>
      </div>
    </main>
  );
}
