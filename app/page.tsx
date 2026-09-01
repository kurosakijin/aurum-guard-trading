'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Bot,
  Calculator,
  CandlestickChart,
  Check,
  ChevronDown,
  Clock3,
  ExternalLink,
  Gauge,
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
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts';

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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TradingViewChart } from '@/components/tradingview-chart';

const liveMarkets = [
  { key: 'gold-spot', label: 'Gold spot', short: 'XAU / USD', symbol: 'OANDA:XAUUSD', instrument: 'gold' },
  { key: 'gold-cfd', label: 'Gold CFD', short: 'CMC GOLD', symbol: 'CMCMARKETS:GOLD', instrument: 'gold' },
  { key: 'silver-spot', label: 'Silver spot', short: 'XAG / USD', symbol: 'OANDA:XAGUSD', instrument: 'silver' },
  { key: 'silver-cfd', label: 'Silver CFD', short: 'CMC SILVER', symbol: 'CMCMARKETS:SILVER', instrument: 'silver' },
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

const goldData = [
  4354, 4378, 4362, 4401, 4428, 4412, 4446, 4461, 4450, 4488, 4522, 4504,
  4538, 4562, 4546, 4581, 4608, 4588, 4621, 4644, 4630, 4668, 4696, 4681,
  4715, 4742, 4720, 4758, 4788, 4771, 4805,
].map((price, index) => ({ day: index + 1, price }));

const silverData = [
  56.2, 56.8, 56.4, 57.1, 57.9, 57.3, 58.2, 58.7, 58.4, 59.2, 60.1, 59.4,
  60.5, 61.1, 60.4, 61.6, 62.3, 61.7, 62.8, 63.2, 62.6, 63.7, 64.4, 63.8,
  64.9, 65.5, 64.7, 65.8, 66.5, 65.9, 66.8,
].map((price, index) => ({ day: index + 1, price }));

const instruments = {
  gold: {
    symbol: 'XAU / USD',
    name: 'Gold spot',
    price: 4805.2,
    change: '+1.34%',
    confidence: 72,
    signal: 'LONG WATCH',
    support: 4742,
    resistance: 4868,
    data: goldData,
  },
  silver: {
    symbol: 'XAG / USD',
    name: 'Silver spot',
    price: 66.8,
    change: '+0.86%',
    confidence: 64,
    signal: 'WAIT',
    support: 64.9,
    resistance: 68.4,
    data: silverData,
  },
};

type InstrumentKey = keyof typeof instruments;

export default function Home() {
  const [instrument, setInstrument] = useState<InstrumentKey>('gold');
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState('16:42:08');
  const [liveMarket, setLiveMarket] = useState<LiveMarketKey>('gold-spot');
  const [timeframe, setTimeframe] = useState('15');
  const [equity, setEquity] = useState(25000);
  const [riskPct, setRiskPct] = useState(0.5);
  const [entry, setEntry] = useState(4805.2);
  const [stop, setStop] = useState(4742);
  const [target, setTarget] = useState(4931.6);
  const [planCreated, setPlanCreated] = useState(false);
  const active = instruments[instrument];
  const activeLiveMarket = liveMarkets.find((market) => market.key === liveMarket) ?? liveMarkets[0];
  const chartPad = instrument === 'gold' ? 40 : 2;
  const formatter = useMemo(
    () => new Intl.NumberFormat('en-US', { maximumFractionDigits: instrument === 'gold' ? 0 : 1 }),
    [instrument],
  );

  function runScan() {
    setScanning(true);
    window.setTimeout(() => {
      setScanning(false);
      setLastScan(new Date().toLocaleTimeString([], { hour12: false }));
    }, 700);
  }

  function changeInstrument(value: InstrumentKey) {
    setInstrument(value);
    setLiveMarket(value === 'gold' ? 'gold-spot' : 'silver-spot');
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

  function chooseLiveMarket(value: LiveMarketKey) {
    const selected = liveMarkets.find((market) => market.key === value);
    if (!selected) return;
    changeInstrument(selected.instrument);
    setLiveMarket(value);
  }

  const riskBudget = Math.max(0, equity * (riskPct / 100));
  const riskPerOunce = Math.abs(entry - stop);
  const positionSize = riskPerOunce > 0 ? riskBudget / riskPerOunce : 0;
  const projectedReward = Math.abs(target - entry) * positionSize;
  const rewardRisk = riskBudget > 0 ? projectedReward / riskBudget : 0;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-white/8 bg-background/88 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl border border-primary/35 bg-primary/10 text-primary shadow-[0_0_32px_rgba(225,177,78,.12)]">
              <Bot className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading text-[15px] font-semibold tracking-tight">Aurum Guard</span>
                <Badge className="border border-emerald-400/20 bg-emerald-400/10 text-[10px] text-emerald-300">PAPER</Badge>
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
            {scanning ? 'Scanning' : 'Run scan'}
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <section className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[.16em] text-primary">
              <Sparkles className="size-3.5" /> Probability-weighted setup
            </div>
            <h1 className="font-heading text-2xl font-semibold tracking-[-.03em] sm:text-3xl">Protect capital. Trade only the clearest setup.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Trend, momentum, volatility and news risk are combined into one explainable paper-trading signal.</p>
          </div>
          <Tabs value={instrument} onValueChange={(value) => changeInstrument(value as InstrumentKey)}>
            <TabsList className="h-10 border border-white/8 bg-white/[.035] p-1">
              <TabsTrigger value="gold" className="min-w-28">Gold · XAU</TabsTrigger>
              <TabsTrigger value="silver" className="min-w-28">Silver · XAG</TabsTrigger>
            </TabsList>
          </Tabs>
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
                  <CardDescription className="mt-1.5">Switch between embeddable spot and commodity CFD charts, then choose any supported timeframe from 1 minute upward.</CardDescription>
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

              <div className="mt-2 flex flex-wrap gap-2" aria-label="TradingView market">
                {liveMarkets.map((market) => (
                  <button
                    key={market.key}
                    type="button"
                    aria-pressed={liveMarket === market.key}
                    onClick={() => chooseLiveMarket(market.key)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition ${liveMarket === market.key ? 'border-primary/40 bg-primary/10 text-foreground' : 'border-white/8 bg-white/[.02] text-muted-foreground hover:border-white/15 hover:text-foreground'}`}
                  >
                    <span className={`size-1.5 rounded-full ${market.instrument === 'gold' ? 'bg-primary' : 'bg-zinc-300'}`} />
                    <span className="text-xs font-medium">{market.label}</span>
                    <span className="font-mono text-[10px] opacity-65">{market.short}</span>
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <TradingViewChart
                key={`${activeLiveMarket.symbol}-${timeframe}`}
                symbol={activeLiveMarket.symbol}
                interval={timeframe}
                label={activeLiveMarket.label}
              />
            </CardContent>
            <div className="flex flex-col gap-1 border-t border-white/7 px-4 py-3 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>COMEX futures cannot be displayed in third-party TradingView widgets, so CFD charts are used as reference proxies—not as the futures contract itself.</span>
              <a href="https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">Chart details <ExternalLink className="size-3" /></a>
            </div>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,.65fr)]">
          <Card className="border-white/8 bg-card/90 shadow-[0_24px_90px_rgba(0,0,0,.22)]">
            <CardHeader className="border-b border-white/7 pb-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">{active.name}</span>
                    <Badge variant="outline" className="border-white/10 text-[10px] text-muted-foreground">DEMO</Badge>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-3xl font-semibold tracking-tight">${active.price.toLocaleString()}</span>
                    <span className="text-sm font-medium text-emerald-300">{active.change}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-[.14em] text-muted-foreground">AI posture</p>
                  <div className="mt-1 flex items-center justify-end gap-2 text-lg font-semibold text-primary">
                    <Activity className="size-4" /> {active.signal}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">30-session structure</span>
                <span className="font-mono text-[11px] text-muted-foreground">Last scan {lastScan}</span>
              </div>
              <ChartContainer
                config={{ price: { label: active.symbol, color: '#e1b14e' } }}
                className="h-[285px] w-full aspect-auto"
              >
                <AreaChart data={active.data} margin={{ top: 18, right: 4, bottom: 0, left: 4 }}>
                  <defs>
                    <linearGradient id="goldArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-price)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="var(--color-price)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,.06)" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tickFormatter={(v) => v % 5 === 0 ? `D${v}` : ''} />
                  <YAxis domain={[(min: number) => min - chartPad, (max: number) => max + chartPad]} orientation="right" tickLine={false} axisLine={false} width={52} tickFormatter={(v) => formatter.format(v)} />
                  <ReferenceLine y={active.support} stroke="rgba(76,211,159,.55)" strokeDasharray="4 5" />
                  <Area type="monotone" dataKey="price" stroke="var(--color-price)" strokeWidth={2.2} fill="url(#goldArea)" />
                  <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                </AreaChart>
              </ChartContainer>
              <div className="mt-2 grid grid-cols-3 gap-2 border-t border-white/7 pt-4 text-xs">
                <div><span className="text-muted-foreground">Support</span><p className="mt-1 font-mono font-medium text-emerald-300">${formatter.format(active.support)}</p></div>
                <div><span className="text-muted-foreground">Resistance</span><p className="mt-1 font-mono font-medium">${formatter.format(active.resistance)}</p></div>
                <div><span className="text-muted-foreground">Feed</span><p className="mt-1 font-medium">Illustrative</p></div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card className="border-primary/15 bg-[linear-gradient(145deg,rgba(225,177,78,.11),rgba(18,22,27,.94)_48%)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Gauge className="size-4 text-primary" /> Signal confidence</CardTitle>
                <CardDescription>Confluence score, not a win guarantee</CardDescription>
                <CardAction><span className="font-mono text-2xl font-semibold text-primary">{active.confidence}%</span></CardAction>
              </CardHeader>
              <CardContent>
                <Progress value={active.confidence} className="[&_[data-slot=progress-indicator]]:bg-primary [&_[data-slot=progress-track]]:h-1.5" />
                <div className="mt-5 space-y-3">
                  {[
                    ['Trend above 20 / 50 EMA', true, '+24'],
                    ['Momentum confirms', true, '+18'],
                    ['Volatility acceptable', true, '+16'],
                    ['Macro regime supportive', instrument === 'gold', instrument === 'gold' ? '+14' : '+6'],
                  ].map(([label, on, score]) => (
                    <div key={String(label)} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span className={`grid size-4 place-items-center rounded-full ${on ? 'bg-emerald-400/12 text-emerald-300' : 'bg-white/6 text-muted-foreground'}`}>{on ? <Check className="size-3" /> : '–'}</span>
                        {label}
                      </span>
                      <span className="font-mono text-foreground">{score}</span>
                    </div>
                  ))}
                </div>
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
                  <button className="flex items-center gap-1 text-primary hover:underline">Review events <ArrowUpRight className="size-3" /></button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[.82fr_1.18fr]">
          <Card id="risk-plan" className="border-emerald-400/12 bg-card/92">
            <CardHeader className="border-b border-white/7 pb-4">
              <CardTitle className="flex items-center gap-2"><Calculator className="size-4 text-emerald-300" /> Risk-first position plan</CardTitle>
              <CardDescription>Size the trade from the loss limit—not from conviction.</CardDescription>
              <CardAction><Badge className="bg-emerald-400/10 text-emerald-300">MAX {riskPct.toFixed(2)}%</Badge></CardAction>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 xl:grid-cols-2 2xl:grid-cols-5">
                {[
                  ['Account equity', equity, setEquity, 100],
                  ['Risk %', riskPct, setRiskPct, 0.05],
                  ['Entry', entry, setEntry, 0.1],
                  ['Stop', stop, setStop, 0.1],
                  ['Target', target, setTarget, 0.1],
                ].map(([label, value, setter, step]) => (
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
          <span>Paper-trading prototype · AI prices, macro readings and signals are illustrative; TradingView panels stream separately and may be delayed.</span>
          <a href="#risk-plan" className="flex items-center gap-1 text-foreground hover:text-primary">Review risk controls <ChevronDown className="size-3" /></a>
        </div>
      </div>
    </main>
  );
}
