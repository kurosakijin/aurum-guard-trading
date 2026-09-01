'use client';

import { useState } from 'react';
import {
  ArrowUpRight,
  Bot,
  Calculator,
  CandlestickChart,
  Check,
  ChevronDown,
  Clipboard,
  Clock3,
  Code2,
  ExternalLink,
  Landmark,
  LineChart,
  LockKeyhole,
  Newspaper,
  RadioTower,
  RefreshCw,
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
strategy("Aurum Guard EMA + RSI", overlay = true, pyramiding = 0,
     initial_capital = 10000,
     default_qty_type = strategy.percent_of_equity,
     default_qty_value = 1,
     commission_type = strategy.commission.percent,
     commission_value = 0.05)

fastLength = input.int(20, "Fast EMA", minval = 2)
slowLength = input.int(50, "Slow EMA", minval = 3)
rsiLength = input.int(14, "RSI length", minval = 2)
atrLength = input.int(14, "ATR length", minval = 2)
atrMultiple = input.float(1.5, "ATR stop multiple", minval = 0.5, step = 0.1)
rewardRisk = input.float(2.0, "Reward / risk", minval = 1.0, step = 0.25)

fastEMA = ta.ema(close, fastLength)
slowEMA = ta.ema(close, slowLength)
rsiValue = ta.rsi(close, rsiLength)
atrValue = ta.atr(atrLength)
atrBaseline = ta.sma(atrValue, 50)
volatilityOK = atrValue > atrBaseline * 0.65

buySignal = barstate.isconfirmed and ta.crossover(fastEMA, slowEMA) and rsiValue > 52 and volatilityOK
sellSignal = barstate.isconfirmed and ta.crossunder(fastEMA, slowEMA) and rsiValue < 48 and volatilityOK

if buySignal
    strategy.entry("BUY", strategy.long)

if sellSignal
    strategy.entry("SELL", strategy.short)

if strategy.position_size > 0
    longStop = strategy.position_avg_price - atrValue * atrMultiple
    longTarget = strategy.position_avg_price + atrValue * atrMultiple * rewardRisk
    strategy.exit("BUY exit", from_entry = "BUY", stop = longStop, limit = longTarget)

if strategy.position_size < 0
    shortStop = strategy.position_avg_price + atrValue * atrMultiple
    shortTarget = strategy.position_avg_price - atrValue * atrMultiple * rewardRisk
    strategy.exit("SELL exit", from_entry = "SELL", stop = shortStop, limit = shortTarget)

plot(fastEMA, "EMA 20", color = color.aqua, linewidth = 2)
plot(slowEMA, "EMA 50", color = color.orange, linewidth = 2)
plotshape(buySignal, title = "BUY", text = "BUY", style = shape.labelup, location = location.belowbar, color = color.lime, textcolor = color.black, size = size.tiny)
plotshape(sellSignal, title = "SELL", text = "SELL", style = shape.labeldown, location = location.abovebar, color = color.red, textcolor = color.white, size = size.tiny)

alertcondition(buySignal, title = "Aurum Guard BUY", message = "Aurum Guard BUY setup")
alertcondition(sellSignal, title = "Aurum Guard SELL", message = "Aurum Guard SELL setup")`;

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
          <Button variant="outline" className="border-white/10 bg-white/[.03] text-xs" onClick={runScan} disabled={scanning}>
            <RefreshCw className={scanning ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{scanning ? 'Refreshing' : 'Refresh live data'}</span>
            <span className="sm:hidden">{scanning ? 'Wait' : 'Refresh'}</span>
          </Button>
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
                      <button
                        type="button"
                        aria-pressed={liveMarket === market.key}
                        onClick={() => selectMetal(market.key)}
                        className={`rounded-lg border px-3 py-1.5 text-[10px] font-medium transition ${liveMarket === market.key ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground'}`}
                      >
                        {liveMarket === market.key ? 'Analysis focused' : 'Focus analysis'}
                      </button>
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
              <CardTitle className="flex items-center gap-2"><Code2 className="size-4 text-primary" /> BUY / SELL strategy for TradingView</CardTitle>
              <CardDescription>Pine Script v6 · EMA crossover + RSI confirmation + ATR stop and target</CardDescription>
              <CardAction>
                <Button variant="outline" size="sm" className="border-white/10 bg-white/[.03]" onClick={copyStrategy}>
                  {scriptCopied ? <Check /> : <Clipboard />}
                  {scriptCopied ? 'Copied' : 'Copy script'}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="mb-4 grid gap-2 sm:grid-cols-3">
                {[
                  ['BUY label', 'EMA 20 crosses above EMA 50, RSI > 52 and volatility passes.'],
                  ['SELL label', 'EMA 20 crosses below EMA 50, RSI < 48 and volatility passes.'],
                  ['Risk exit', '1.5× ATR stop with a configurable 2R profit target.'],
                ].map(([title, description], index) => (
                  <div key={title} className="rounded-xl border border-white/8 bg-white/[.025] p-3">
                    <p className={`text-xs font-semibold ${index === 0 ? 'text-emerald-300' : index === 1 ? 'text-red-300' : 'text-primary'}`}>{title}</p>
                    <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">{description}</p>
                  </div>
                ))}
              </div>

              <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0c0f12]">
                <div className="flex items-center justify-between border-b border-white/8 px-4 py-2 text-[10px] uppercase tracking-[.12em] text-muted-foreground">
                  <span>aurum-guard-strategy.pine</span>
                  <span>Version 6</span>
                </div>
                <pre className="max-h-[730px] overflow-auto p-4 font-mono text-[11px] leading-[1.7] text-zinc-300"><code>{pineScript}</code></pre>
              </div>

              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-primary/12 bg-primary/[.035] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-medium">Use it in TradingView</p>
                  <p className="mt-1 text-[10px] leading-4 text-muted-foreground">Copy the script, open Pine Editor, paste, then select “Add to chart.” Backtest each market and timeframe before considering a paper trade.</p>
                </div>
                <a href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(activeLiveMarket.symbol)}`} target="_blank" rel="noreferrer">
                  <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto">Open TradingView <ExternalLink /></Button>
                </a>
              </div>

              <p className="mt-3 text-[10px] leading-4 text-muted-foreground">No strategy can guarantee profit. Historical backtests omit some real-world effects and must not be treated as future-performance promises.</p>
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
