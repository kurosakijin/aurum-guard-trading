// Single source for the displayed, copied and downloaded indicator.
export const deliveryPineScript = String.raw`//@version=6
indicator("Asheparte AI · Engulfing + CISD Watch v2", overlay = true, max_labels_count = 100, max_bars_back = 500)
// Analysis ONLY. Separate from Combined/MT5 entry engines; do not combine votes.
// Prior closed pattern bars are checked at the NEXT chart bar's CLOSE.
// Extra confirmation delay allows invalidation/chase checks before a watch alert.
goldSymbol = input.symbol("OANDA:XAUUSD", "Gold symbol (XAU base)", group = "Metals")
silverSymbol = input.symbol("OANDA:XAGUSD", "Silver symbol (XAG base)", group = "Metals")
strictSilverPattern = input.bool(false, "Require a Silver pattern too (stricter)", group = "Metals")
useEngulf = input.bool(true, "Body engulfing", group = "Patterns")
useCISD = input.bool(true, "Delivery-sequence origin reclaim", group = "Patterns")
minimumBodyShare = input.float(0.55, "Minimum body / range", minval = 0.05, maxval = 1.0, step = 0.05, group = "Patterns")
minimumBodyRatio = input.float(1.0, "Engulfing body / previous body", minval = 0.5, maxval = 3.0, step = 0.1, group = "Patterns")
maxLegBars = input.int(20, "Maximum delivery-leg age", minval = 2, maxval = 100, group = "Patterns")
minimumBodyATR = input.float(0.25, "Minimum body / prior ATR", minval = 0.1, maxval = 1.0, step = 0.05, group = "Safety")
maximumRangeATR = input.float(1.8, "Maximum pattern range / prior ATR", minval = 1.0, maxval = 3.0, step = 0.1, group = "Safety")
maximumChaseATR = input.float(0.75, "Maximum move beyond pattern close / ATR", minval = 0.1, maxval = 2.0, step = 0.05, group = "Safety")
watchBars = input.int(3, "Watch expiry in chart bars", minval = 1, maxval = 10, group = "Safety")
manualNewsPause = input.bool(false, "PAUSE around scheduled news (manual)", group = "Safety")
showPanel = input.bool(true, "Show status panel", group = "Display")

f_closedPattern() =>
    // Keep the opposing leg's FIRST open through partial retracements.
    var int legDirection = 0
    var float legOrigin = na
    var float legLow = na
    var float legHigh = na
    var int legStart = na
    var float bullRunOpen = na
    var float bearRunOpen = na
    if close > open
        bullRunOpen := close[1] > open[1] ? bullRunOpen : open
    if close < open
        bearRunOpen := close[1] < open[1] ? bearRunOpen : open
    bool bullishShift = false
    bool bearishShift = false
    float shiftedLow = math.min(low, low[1])
    float shiftedHigh = math.max(high, high[1])
    if legDirection == 0 or na(legStart) or bar_index - legStart > maxLegBars
        legDirection := close > open ? 1 : close < open ? -1 : 0
        legOrigin := open
        legStart := bar_index
        legLow := low
        legHigh := high
    else
        legLow := math.min(legLow, low)
        legHigh := math.max(legHigh, high)
        bullishShift := legDirection == -1 and close > open and close > legOrigin and close[1] <= legOrigin
        bearishShift := legDirection == 1 and close < open and close < legOrigin and close[1] >= legOrigin
        if bullishShift or bearishShift
            shiftedLow := legLow
            shiftedHigh := legHigh
            legDirection := bullishShift ? 1 : -1
            legOrigin := bullishShift ? bullRunOpen : bearRunOpen
            legStart := bar_index
            legLow := low
            legHigh := high
    atrBefore = ta.atr(14)[1]
    fast = ta.ema(close, 20)
    slow = ta.ema(close, 50)
    rsi = ta.rsi(close, 14)
    body = math.abs(close - open)
    candleRange = math.max(high - low, syminfo.mintick)
    quality = not na(atrBefore) and atrBefore > 0 and body / candleRange >= minimumBodyShare and body >= atrBefore * minimumBodyATR and candleRange <= atrBefore * maximumRangeATR and math.abs(open - close[1]) <= atrBefore * 0.75
    bullEngulf = useEngulf and quality and close > open and close[1] < open[1] and open <= close[1] and close >= open[1] and body >= math.max(math.abs(close[1] - open[1]), syminfo.mintick) * minimumBodyRatio
    bearEngulf = useEngulf and quality and close < open and close[1] > open[1] and open >= close[1] and close <= open[1] and body >= math.max(math.abs(close[1] - open[1]), syminfo.mintick) * minimumBodyRatio
    bullCISD = useCISD and quality and bullishShift
    bearCISD = useCISD and quality and bearishShift
    direction = bullCISD or bullEngulf ? 1 : bearCISD or bearEngulf ? -1 : 0
    isShift = bullCISD or bearCISD
    patternLow = isShift ? shiftedLow : math.min(low, low[1])
    patternHigh = isShift ? shiftedHigh : math.max(high, high[1])
    trend = close > fast and fast > slow and rsi > 50 ? 1 : close < fast and fast < slow and rsi < 50 ? -1 : 0
    priorTrend = close[1] > fast[1] and fast[1] > slow[1] ? 1 : close[1] < fast[1] and fast[1] < slow[1] ? -1 : 0
    // All market series are offset; symbol metadata is constant.
    [direction[1], isShift[1], priorTrend[1], time[1], time_close[1], patternLow[1], patternHigh[1], close[1], atrBefore[1], trend[1], fast[1], syminfo.basecurrency, syminfo.currency]

f_closedTrend() =>
    fast = ta.ema(close, 20)
    slow = ta.ema(close, 50)
    rsi = ta.rsi(close, 14)
    direction = close > fast and fast > slow and rsi > 50 ? 1 : close < fast and fast < slow and rsi < 50 ? -1 : 0
    [direction[1], time_close[1]]

[gDir, gShift, gPriorTrend, gTime, gEnd, gLow, gHigh, gClose, gATR, gTrend, gFast, gBase, gQuote] = request.security(goldSymbol, timeframe.period, f_closedPattern(), gaps = barmerge.gaps_off, lookahead = barmerge.lookahead_on, ignore_invalid_symbol = true)
[sDir, sShift, sPriorTrend, sTime, sEnd, sLow, sHigh, sClose, sATR, sTrend, sFast, sBase, sQuote] = request.security(silverSymbol, timeframe.period, f_closedPattern(), gaps = barmerge.gaps_off, lookahead = barmerge.lookahead_on, ignore_invalid_symbol = true)
[hourTrend, hourEnd] = request.security(goldSymbol, "60", f_closedTrend(), gaps = barmerge.gaps_off, lookahead = barmerge.lookahead_on, ignore_invalid_symbol = true)
[dayTrend, dayEnd] = request.security(goldSymbol, "D", f_closedTrend(), gaps = barmerge.gaps_off, lookahead = barmerge.lookahead_on, ignore_invalid_symbol = true)

supportedTF = timeframe.isminutes and (timeframe.multiplier == 1 or timeframe.multiplier == 15 or timeframe.multiplier == 30 or timeframe.multiplier == 60)
correctChart = chart.is_standard and ticker.standard(syminfo.tickerid) == ticker.standard(goldSymbol)
validPair = ticker.standard(goldSymbol) != ticker.standard(silverSymbol) and gBase == "XAU" and sBase == "XAG" and gQuote == sQuote
freshPair = not na(gTime) and not na(sTime) and gTime == sTime and gEnd == sEnd and gEnd == time
freshHTF = not na(hourEnd) and not na(dayEnd) and hourEnd <= time and time - hourEnd < 3600000 and dayEnd <= time and time - dayEnd < 259200000
silverDirection = strictSilverPattern ? sDir : sTrend
aligned = gDir != 0 and silverDirection == gDir and hourTrend == gDir and dayTrend == gDir
dataOK = supportedTF and correctChart and validPair and freshPair and freshHTF and not na(gATR) and gATR > 0
shock = not na(gATR) and (high - low > gATR * 2.0 or math.abs(open - gClose) > gATR * 0.75)
distanceOK = not na(gFast) and math.abs(gClose - gFast) <= gATR * 1.35
// Watch bounds are NOT trade entry/SL/TP recommendations.
boundsOK = gDir == 1 ? gClose - gLow >= gATR * 0.25 and gClose - gLow <= gATR * 2.0 : gDir == -1 ? gHigh - gClose >= gATR * 0.25 and gHigh - gClose <= gATR * 2.0 : false
survived = gDir == 1 ? low > gLow and high <= gClose + gATR * maximumChaseATR : gDir == -1 ? high < gHigh and low >= gClose - gATR * maximumChaseATR : false
candidate = dataOK and aligned and not manualNewsPause and not shock and distanceOK and boundsOK and survived

var int watchDirection = 0
var int startedBar = na
var int startedTime = na
var int consumedPattern = na
var float watchLow = na
var float watchHigh = na
var float watchAnchor = na
var float watchATR = na
var string watchPattern = ""
var string watchContext = ""
var string retiredReason = ""
bool hadWatch = watchDirection != 0
bool newBullWatch = false
bool newBearWatch = false
if hadWatch
    invalidated = watchDirection == 1 ? low <= watchLow : high >= watchHigh
    chased = watchDirection == 1 ? high > watchAnchor + watchATR * maximumChaseATR : low < watchAnchor - watchATR * maximumChaseATR
    expired = bar_index - startedBar >= watchBars or time - startedTime >= watchBars * timeframe.in_seconds() * 1000
    lostAlignment = not dataOK or silverDirection != watchDirection or hourTrend != watchDirection or dayTrend != watchDirection
    oppositePattern = gDir != 0 and gDir != watchDirection
    if invalidated or chased or expired or lostAlignment or oppositePattern or shock or manualNewsPause
        retiredReason := invalidated ? "INVALIDATED" : chased ? "TOO FAR · NO CHASE" : expired ? "EXPIRED" : manualNewsPause ? "NEWS PAUSE" : shock ? "VOLATILITY PAUSE" : "ALIGNMENT LOST"
        watchDirection := 0
// Consider a prior pattern once at the next bar CLOSE. No instant reversal on cancellation.
if barstate.isconfirmed and not na(gTime) and (na(consumedPattern) or gTime != consumedPattern)
    consumedPattern := gTime
    if not hadWatch and watchDirection == 0 and candidate
        watchDirection := gDir
        startedBar := bar_index
        startedTime := time
        watchLow := gLow
        watchHigh := gHigh
        watchAnchor := gClose
        watchATR := gATR
        watchPattern := gShift ? "CISD · sequence origin reclaim" : "Body engulfing"
        watchContext := gPriorTrend == gDir ? "Trend-aligned watch" : gPriorTrend == -gDir ? "Countertrend watch · not confirmed reversal" : "Mixed local structure"
        retiredReason := ""
        newBullWatch := gDir == 1
        newBearWatch := gDir == -1

// Markers record historical WATCH starts. Only the panel/bounds show an ACTIVE watch.
plotshape(newBullWatch, title = "Bullish watch started", text = "BULL\nWATCH", style = shape.labelup, location = location.belowbar, color = color.rgb(6, 95, 70), textcolor = color.white, size = size.tiny)
plotshape(newBearWatch, title = "Bearish watch started", text = "BEAR\nWATCH", style = shape.labeldown, location = location.abovebar, color = color.rgb(153, 27, 27), textcolor = color.white, size = size.tiny)
plot(watchDirection != 0 ? watchLow : na, "Active watch lower bound (not trade SL)", color = color.orange, style = plot.style_linebr)
plot(watchDirection != 0 ? watchHigh : na, "Active watch upper bound (not trade SL)", color = color.orange, style = plot.style_linebr)
status = not correctChart ? "Select matching Gold / standard candles" : not supportedTF ? "Use M1, M15, M30 or H1" : not validPair ? "BLOCKED · distinct XAU / XAG feeds required" : manualNewsPause ? "MANUAL NEWS PAUSE" : watchDirection == 1 ? "BULLISH WATCH · NOT AN ENTRY" : watchDirection == -1 ? "BEARISH WATCH · NOT AN ENTRY" : not dataOK ? "WAIT · missing / stale data" : shock ? "WAIT · volatility shock" : retiredReason != "" ? retiredReason + " · scanning" : gDir == 0 ? "WAIT · no Gold pattern" : not aligned ? "WAIT · Silver / H1 / D1 disagree" : not distanceOK or not boundsOK or not survived ? "WAIT · invalidated / extended" : "WAIT · confirmation bar close"
var table panel = table.new(position.top_right, 1, 5, border_width = 1, border_color = color.rgb(71, 85, 105))
if barstate.islast
    if showPanel
        table.cell(panel, 0, 0, status, text_color = color.white, bgcolor = watchDirection == 1 ? color.rgb(6, 95, 70) : watchDirection == -1 ? color.rgb(153, 27, 27) : color.rgb(30, 41, 59))
        table.cell(panel, 0, 1, watchDirection != 0 ? watchPattern : "No active watch", text_color = color.white, bgcolor = color.rgb(15, 23, 42))
        table.cell(panel, 0, 2, watchDirection != 0 ? watchContext : "Waiting for fresh closed pattern", text_color = color.rgb(203, 213, 225), bgcolor = color.rgb(15, 23, 42))
        table.cell(panel, 0, 3, "Closed H1 + D1 · EMA20/50 + RSI50", text_color = color.rgb(203, 213, 225), bgcolor = color.rgb(15, 23, 42))
        table.cell(panel, 0, 4, "NO ORDERS · NEWS CHECK IS MANUAL", text_color = color.rgb(253, 224, 71), bgcolor = color.rgb(15, 23, 42))
    else
        table.clear(panel, 0, 0, 0, 4)
alertcondition(newBullWatch, "Bullish WATCH started", "Asheparte v2: bullish WATCH, not an entry. Check news and execution risk manually.")
alertcondition(newBearWatch, "Bearish WATCH started", "Asheparte v2: bearish WATCH, not an entry. Check news and execution risk manually.")
// Create alerts with Once Per Bar Close. Recreate old alerts after replacing this script.
`;
