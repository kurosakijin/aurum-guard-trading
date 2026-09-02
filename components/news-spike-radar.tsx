'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  CalendarClock,
  Clock3,
  ExternalLink,
  Newspaper,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
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
import {
  TradingViewEconomicCalendar,
  TradingViewMetalsNews,
} from '@/components/tradingview-insights';

const refreshIntervalMs = 5 * 60 * 1000;

function formatPhilippineDate(date: Date, includeSeconds = true) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: true,
  }).format(date);
}

export function NewsSpikeRadar() {
  const [philippineTime, setPhilippineTime] = useState('Loading Philippine time…');
  const [monitoringSince, setMonitoringSince] = useState('Starting now');
  const [lastRefresh, setLastRefresh] = useState('Connecting…');
  const [refreshKey, setRefreshKey] = useState(0);
  const [newsSymbol, setNewsSymbol] = useState('OANDA:XAUUSD');

  useEffect(() => {
    const startedAt = new Date();
    const updateClock = () => setPhilippineTime(formatPhilippineDate(new Date()));
    const initialFrame = window.requestAnimationFrame(() => {
      setMonitoringSince(formatPhilippineDate(startedAt, false));
      setLastRefresh(formatPhilippineDate(startedAt, false));
      updateClock();
    });
    const clockTimer = window.setInterval(updateClock, 1000);
    const refreshTimer = window.setInterval(() => {
      setRefreshKey((current) => current + 1);
      setLastRefresh(formatPhilippineDate(new Date(), false));
    }, refreshIntervalMs);

    return () => {
      window.cancelAnimationFrame(initialFrame);
      window.clearInterval(clockTimer);
      window.clearInterval(refreshTimer);
    };
  }, []);

  function refreshNews() {
    setRefreshKey((current) => current + 1);
    setLastRefresh(formatPhilippineDate(new Date(), false));
  }

  return (
    <section id="news-radar" className="mb-4" aria-labelledby="news-radar-heading">
      <Card className="border-red-300/20 bg-[linear-gradient(145deg,rgba(248,113,113,.085),rgba(225,177,78,.04)_35%,rgba(18,22,27,.97)_68%)] shadow-[0_20px_80px_rgba(0,0,0,.18)]">
        <CardHeader className="border-b border-white/7 pb-4">
          <CardTitle id="news-radar-heading" className="flex items-center gap-2 text-lg">
            <ShieldAlert className="size-5 text-red-300" /> Gold news & spike radar
          </CardTitle>
          <CardDescription>US high-impact releases, live metals headlines and a Philippine-time safety window.</CardDescription>
          <CardAction>
            <Badge className="border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-300" /> LIVE 24/7
            </Badge>
          </CardAction>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-primary/20 bg-primary/[.055] p-3">
                <div className="flex items-center gap-2 text-primary"><Clock3 className="size-4" /><span className="text-[10px] font-semibold uppercase tracking-[.12em]">Philippine time · PHT</span></div>
                <p className="mt-2 font-mono text-xs font-semibold sm:text-sm">{philippineTime}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">Asia/Manila · UTC+8 · no daylight saving</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[.025] p-3">
                <div className="flex items-center gap-2 text-muted-foreground"><CalendarClock className="size-4" /><span className="text-[10px] font-semibold uppercase tracking-[.12em]">Monitoring started</span></div>
                <p className="mt-2 text-xs font-semibold">{monitoringSince}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">Calendar dates roll forward automatically</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[.025] p-3">
                <div className="flex items-center gap-2 text-muted-foreground"><RefreshCw className="size-4" /><span className="text-[10px] font-semibold uppercase tracking-[.12em]">Auto refresh</span></div>
                <p className="mt-2 text-xs font-semibold">Every 5 minutes</p>
                <p className="mt-1 text-[10px] text-muted-foreground">Last reload · {lastRefresh}</p>
              </div>
            </div>
            <Button variant="outline" className="border-white/10 bg-white/[.03]" onClick={refreshNews}>
              <RefreshCw /> Refresh radar now
            </Button>
          </div>

          <div className="mt-4 rounded-xl border border-red-300/20 bg-red-300/[.055] p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-red-200">Current rule before any release</p>
                <p className="mt-1 text-base font-semibold">TWO-WAY SPIKE RISK · WAIT FOR THE ACTUAL NUMBER</p>
              </div>
              <Badge variant="outline" className="border-red-300/30 text-red-200">NO PRE-NEWS ENTRY</Badge>
            </div>
            <p className="mt-2 max-w-5xl text-[11px] leading-5 text-muted-foreground">The calendar can tell you the exact event date and importance, but it cannot know the surprise before publication. Avoid fresh entries from 30 minutes before until at least 15 minutes after a high-impact release; for CPI, NFP and FOMC, wait until the first violent move and spreads settle.</p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-emerald-300/18 bg-emerald-300/[.045] p-3">
              <div className="flex items-center gap-2 text-emerald-300"><TrendingUp className="size-4" /><p className="text-xs font-semibold">Possible gold up-spike</p></div>
              <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Cooler inflation, weaker jobs/growth, a dovish Fed or falling USD and Treasury yields can support gold after the result confirms it.</p>
            </div>
            <div className="rounded-xl border border-red-300/18 bg-red-300/[.045] p-3">
              <div className="flex items-center gap-2 text-red-300"><TrendingDown className="size-4" /><p className="text-xs font-semibold">Possible gold down-spike</p></div>
              <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Hotter inflation, stronger jobs/growth, a hawkish Fed or rising USD and Treasury yields can pressure gold after confirmation.</p>
            </div>
            <div className="rounded-xl border border-fuchsia-300/18 bg-fuchsia-300/[.045] p-3">
              <div className="flex items-center gap-2 text-fuchsia-300"><ArrowLeftRight className="size-4" /><p className="text-xs font-semibold">Whipsaw / both directions</p></div>
              <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Mixed data, revisions, Powell remarks or geopolitical headlines can spike both sides. The first candle is often not a trustworthy direction.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.08fr_.92fr]">
            <div className="overflow-hidden rounded-xl border border-zinc-300/20 bg-[#f4f6f8] shadow-[inset_0_0_0_1px_rgba(255,255,255,.04)]">
              <div className="flex flex-col gap-2 border-b border-zinc-300/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-xs font-semibold text-zinc-950"><CalendarClock className="size-4 text-amber-700" /> Incoming US events</p>
                  <p className="mt-1 text-[10px] text-zinc-600">High importance only · check the exact date, forecast and actual</p>
                </div>
                <Badge variant="outline" className="border-amber-700/30 bg-amber-100 text-amber-900">US ONLY</Badge>
              </div>
              <TradingViewEconomicCalendar refreshKey={refreshKey} />
            </div>

            <div className="overflow-hidden rounded-xl border border-white/8 bg-black/10">
              <div className="flex flex-col gap-2 border-b border-white/7 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-xs font-semibold"><Newspaper className="size-4 text-primary" /> Live metals headlines</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">Continuously refreshed by TradingView</p>
                </div>
                <div className="flex rounded-lg border border-white/10 bg-black/15 p-0.5" aria-label="News market">
                  {[
                    ['OANDA:XAUUSD', 'Gold'],
                    ['OANDA:XAGUSD', 'Silver'],
                  ].map(([symbol, label]) => (
                    <button
                      key={symbol}
                      type="button"
                      onClick={() => setNewsSymbol(symbol)}
                      className={`min-h-8 rounded-md px-3 text-[11px] font-semibold transition ${newsSymbol === symbol ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <TradingViewMetalsNews symbol={newsSymbol} refreshKey={refreshKey} />
            </div>
          </div>

          <div className="mt-4 grid gap-3 border-t border-white/7 pt-4 md:grid-cols-[1fr_auto] md:items-center">
            <p className="text-[10px] leading-4 text-muted-foreground"><strong className="text-foreground">About “pips”:</strong> XAUUSD pip size varies by broker, so the radar does not invent a fixed pip forecast. Use your broker’s quote convention and the chart’s ATR. Aurum Guard’s Pine shock label activates after a completed candle reaches at least 2.0× ATR or gaps at least 0.75× ATR.</p>
            <a href="https://www.tradingview.com/economic-calendar/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Open full calendar <ExternalLink className="size-3" /></a>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
