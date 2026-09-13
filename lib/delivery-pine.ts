// Single source for the displayed, copied and downloaded Pine indicator.
export const deliveryPineScript = String.raw`//@version=6
indicator("Asheparte AI · Engulfing + CISD · Gold/Silver", overlay = true, max_labels_count = 100, max_bars_back = 200)

// Analysis only. No strategy orders or webhook execution payloads.
// Mirrors the EA's pattern detector, not its full entry engine or performance.
// CISD here means a strong close beyond the prior opposing candle's extreme.
// Signals appear on the NEXT bar, using only prior closed candles; never backdated.
goldSymbol = input.symbol("OANDA:XAUUSD", "Gold chart symbol")
silverSymbol = input.symbol("OANDA:XAGUSD", "Silver confirmation symbol")
useEngulf = input.bool(true, "Detect body engulfing")
useCISD = input.bool(true, "Detect delivery shift (CISD)")
minimumBodyShare = input.float(0.55, "Minimum body / candle range", minval = 0.05, maxval = 1.0, step = 0.05)
minimumBodyRatio = input.float(1.0, "Engulfing body / prior body", minval = 0.5, maxval = 3.0, step = 0.1)
priorMoveBars = input.int(4, "Prior direction lookback", minval = 2, maxval = 20)
showReversals = input.bool(true, "Show reversal setups")
showContinuations = input.bool(true, "Show continuation setups")
showPanel = input.bool(true, "Show status panel")

f_closedPattern() =>
    candleRange = math.max(high - low, syminfo.mintick)
    body = math.abs(close - open)
    priorBody = math.max(math.abs(close[1] - open[1]), syminfo.mintick)
    bodyOK = body / candleRange >= minimumBodyShare
    bullEngulf = useEngulf and bodyOK and close > open and close[1] < open[1] and open <= close[1] and close >= open[1] and body >= priorBody * minimumBodyRatio
    bearEngulf = useEngulf and bodyOK and close < open and close[1] > open[1] and open >= close[1] and close <= open[1] and body >= priorBody * minimumBodyRatio
    bullShift = useCISD and bodyOK and close > open and close[1] <= open[1] and close > high[1]
    bearShift = useCISD and bodyOK and close < open and close[1] >= open[1] and close < low[1]
    direction = bullShift or bullEngulf ? 1 : bearShift or bearEngulf ? -1 : 0
    shift = bullShift or bearShift
    priorMove = close[1] - close[1 + priorMoveBars]
    reversal = direction == 1 and priorMove < 0 or direction == -1 and priorMove > 0
    continuation = direction == 1 and priorMove > 0 or direction == -1 and priorMove < 0
    // Every returned field is offset: lookahead_on never exposes an unfinished candle.
    [direction[1], shift[1], reversal[1], continuation[1], time[1], time_close[1]]

[goldDirection, goldShift, goldReversal, goldContinuation, goldTime, goldCloseTime] = request.security(goldSymbol, timeframe.period, f_closedPattern(), gaps = barmerge.gaps_off, lookahead = barmerge.lookahead_on, ignore_invalid_symbol = true)
[silverDirection, silverShift, silverReversal, silverContinuation, silverTime, silverCloseTime] = request.security(silverSymbol, timeframe.period, f_closedPattern(), gaps = barmerge.gaps_off, lookahead = barmerge.lookahead_on, ignore_invalid_symbol = true)

supportedTimeframe = timeframe.isminutes and (timeframe.multiplier == 1 or timeframe.multiplier == 15 or timeframe.multiplier == 30 or timeframe.multiplier == 60)
correctChart = chart.is_standard and ticker.standard(syminfo.tickerid) == ticker.standard(goldSymbol)
dataReady = not na(goldDirection) and not na(silverDirection) and not na(goldTime) and not na(silverTime)
// Exact bar timestamps prevent stale Silver or different sessions confirming Gold.
freshPair = dataReady and goldTime == silverTime and goldCloseTime == silverCloseTime and goldCloseTime == time
synced = freshPair and goldDirection != 0 and goldDirection == silverDirection
selectedContext = (showReversals and goldReversal) or (showContinuations and goldContinuation)
buySetup = supportedTimeframe and correctChart and synced and selectedContext and goldDirection == 1
sellSetup = supportedTimeframe and correctChart and synced and selectedContext and goldDirection == -1

plotshape(buySetup and goldReversal, title = "Bullish reversal setup", text = "BUY\nREV", style = shape.labelup, location = location.belowbar, color = color.rgb(6, 95, 70), textcolor = color.white, size = size.tiny)
plotshape(buySetup and goldContinuation, title = "Bullish continuation setup", text = "BUY\nCONT", style = shape.labelup, location = location.belowbar, color = color.rgb(6, 95, 70), textcolor = color.white, size = size.tiny)
plotshape(sellSetup and goldReversal, title = "Bearish reversal setup", text = "SELL\nREV", style = shape.labeldown, location = location.abovebar, color = color.rgb(153, 27, 27), textcolor = color.white, size = size.tiny)
plotshape(sellSetup and goldContinuation, title = "Bearish continuation setup", text = "SELL\nCONT", style = shape.labeldown, location = location.abovebar, color = color.rgb(153, 27, 27), textcolor = color.white, size = size.tiny)

status = not correctChart ? "Use selected Gold / standard candles" : not supportedTimeframe ? "Use M1, M15, M30 or H1" : not freshPair ? "WAIT · missing / stale paired bars" : goldDirection == 0 ? "WAIT · no Gold pattern" : not synced ? "WAIT · Silver disagrees / no pattern" : not selectedContext ? "WAIT · flat prior move / filtered type" : buySetup ? "BULLISH SETUP" : "BEARISH SETUP"
pattern = goldDirection == 0 or not freshPair ? "—" : goldShift ? "CISD · extreme close" : "Body engulfing"
context = not freshPair or goldDirection == 0 ? "—" : goldReversal ? "Reversal" : goldContinuation ? "Continuation" : "Flat prior move"
var table panel = table.new(position.top_right, 1, 4, border_width = 1, border_color = color.rgb(71, 85, 105))
if barstate.islast and showPanel
    table.cell(panel, 0, 0, status, text_color = color.white, bgcolor = buySetup ? color.rgb(6, 95, 70) : sellSetup ? color.rgb(153, 27, 27) : color.rgb(30, 41, 59))
    table.cell(panel, 0, 1, pattern + " · " + context, text_color = color.white, bgcolor = color.rgb(15, 23, 42))
    table.cell(panel, 0, 2, "Prior closed bars · Gold + Silver required", text_color = color.rgb(203, 213, 225), bgcolor = color.rgb(15, 23, 42))
    table.cell(panel, 0, 3, "SETUP ONLY · NO ORDERS · NO NEWS FILTER", text_color = color.rgb(253, 224, 71), bgcolor = color.rgb(15, 23, 42))

// Select Once Per Bar in TradingView. These are informational, not order alerts.
alertcondition(buySetup, "Bullish Gold/Silver setup", "Asheparte: bullish engulfing/CISD setup on prior closed Gold + Silver bars. Analysis only; check risk and news manually.")
alertcondition(sellSetup, "Bearish Gold/Silver setup", "Asheparte: bearish engulfing/CISD setup on prior closed Gold + Silver bars. Analysis only; check risk and news manually.")
`;
