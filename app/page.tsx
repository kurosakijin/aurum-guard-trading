'use client';

import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  Bot,
  BookOpenCheck,
  CandlestickChart,
  Check,
  Clipboard,
  Clock3,
  Code2,
  Crosshair,
  Database,
  Download,
  ExternalLink,
  Landmark,
  LineChart,
  LockKeyhole,
  Newspaper,
  PlugZap,
  RadioTower,
  RefreshCw,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UserRound,
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
import { NewsSpikeRadar } from '@/components/news-spike-radar';
import {
  TradingViewSymbolInfo,
  TradingViewTechnicalAnalysis,
} from '@/components/tradingview-insights';

const liveMarkets = [
  { key: 'gold', label: 'Gold', short: 'XAU / USD', symbol: 'OANDA:XAUUSD' },
  { key: 'silver', label: 'Silver', short: 'XAG / USD', symbol: 'OANDA:XAGUSD' },
] as const;

const demoJournalTrades = [
  { closed: 'Sep 10 · 01:45', symbol: 'XAUUSD', side: 'BUY', volume: '1.00', prices: '4,414.14 → 4,413.71', costs: '$0.00', net: -43.00 },
  { closed: 'Sep 10 · 01:41', symbol: 'XAUUSD', side: 'BUY', volume: '1.00', prices: '4,412.97 → 4,416.03', costs: '$0.00', net: 306.00 },
  { closed: 'Sep 10 · 01:36', symbol: 'XAUUSD', side: 'SELL', volume: '0.30', prices: '4,413.33 → 4,413.39', costs: '$0.00', net: -1.80 },
] as const;

const journalMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;
const demoDailyJournal: Record<string, number> = {
  '2026-09-10': 261.20,
};

const timeframes = [
  { label: '1m', value: '1' },
  { label: '3m', value: '3' },
  { label: '5m', value: '5' },
  { label: '15m', value: '15' },
  { label: '30m', value: '30' },
  { label: '1h', value: '60' },
  { label: '1D', value: 'D' },
] as const;

type LiveMarketKey = (typeof liveMarkets)[number]['key'];
type WorkspacePanel = 'desk' | 'charts' | 'pine' | 'mt5' | 'journal' | 'guides' | 'risk';

type GuideCandle = readonly [x: number, openY: number, closeY: number, lowY: number, highY: number];

function GuideCandles({ candles }: { candles: readonly GuideCandle[] }) {
  return candles.map(([x, open, close, low, high]) => {
    const rising = close < open;
    const top = Math.min(open, close);
    const color = rising ? '#22d3ee' : '#e2e8f0';
    return <g key={x}><line x1={x} y1={high} x2={x} y2={low} stroke={color} strokeWidth="2"/><rect x={x - 7} y={top} width="14" height={Math.max(6, Math.abs(close - open))} fill={color} rx="1" /></g>;
  });
}

type HistoricalBar = readonly [time: string, open: number, high: number, low: number, close: number, volume: number];

const historicalFlowBars: readonly HistoricalBar[] = [
  ['Sep 02 19:00',4420.8,4427,4418.3,4425.6,879],['19:15',4425.7,4429.7,4424.8,4427.6,804],['19:30',4427.7,4435.2,4427.6,4434.5,1200],['19:45',4434.6,4437.9,4431.4,4437.7,1955],
  ['20:00',4437.4,4438.2,4432.5,4432.6,839],['20:15',4432.5,4434.6,4430.6,4433.2,532],['20:30',4433,4436.6,4432.5,4434.8,331],['20:45',4434.9,4437.7,4433.8,4434.3,543],
  ['22:00',4436.4,4438.1,4434.8,4434.8,165],['22:15',4434.8,4435.9,4432.6,4434.8,413],['22:30',4434.3,4434.7,4430.3,4430.4,554],['22:45',4430.4,4430.5,4428.4,4429.8,266],
  ['23:00',4430.2,4432.2,4429.4,4429.6,367],['23:15',4429.4,4429.6,4427.3,4427.7,282],['23:30',4427.5,4430.8,4426.7,4430.8,469],['23:45',4430.2,4434.4,4429.9,4431,577],
  ['Sep 03 00:00',4431.2,4438,4429.9,4435.4,1191],['00:15',4435.4,4435.7,4430.3,4432.5,561],['00:30',4432.3,4435,4427.8,4433,611],['00:45',4433.1,4442.9,4431.3,4440.5,1096],
  ['01:00',4440.8,4454.7,4432.2,4446.8,4605],['01:15',4446.3,4448.9,4439.1,4447.1,1734],['01:30',4446.8,4454.8,4445.4,4445.8,1719],['01:45',4445.5,4457.6,4445.2,4455,1160],
  ['02:00',4455.2,4461.2,4454.5,4456.2,1836],['02:15',4456.9,4458.6,4452.2,4457.1,1106],['02:30',4457.1,4463.7,4454.8,4459,1997],['02:45',4459.4,4466.2,4457.1,4466,1038],
  ['03:00',4466,4475.8,4464.9,4474.6,1899],['03:15',4474.4,4477.1,4470.3,4475.1,1243],['03:30',4475.2,4477.9,4472.4,4472.4,1325],['03:45',4472.2,4478.2,4471,4477.1,1704],
];

const historicalPoc30mBars: readonly HistoricalBar[] = [
  ['Jul 24 07:30',4051.7,4056.3,4048.2,4051.1,1733],['08:00',4051.2,4055.3,4047.5,4054.9,1176],
  ['08:30',4054.8,4061.5,4051.4,4060.0,1794],['09:00',4060.4,4064.0,4055.0,4055.6,2840],
  ['09:30',4055.4,4062.6,4054.2,4062.6,1680],['10:00',4062.6,4066.6,4060.4,4064.5,1406],
  ['10:30',4064.4,4067.0,4059.4,4062.2,1454],['11:00',4062.5,4065.9,4060.8,4061.6,1700],
  ['11:30',4061.2,4063.9,4053.5,4060.2,2789],['12:00',4060.6,4062.9,4054.5,4062.1,2546],
  ['12:30',4061.9,4062.1,4054.2,4058.5,2041],['13:00',4058.8,4061.0,4046.9,4048.8,4048],
  ['13:30',4048.5,4071.5,4047.0,4070.0,6393],['14:00',4069.9,4073.0,4060.3,4068.9,7934],
  ['14:30',4069.0,4071.1,4061.4,4066.2,3621],['15:00',4066.1,4085.2,4064.7,4077.9,11619],
  ['15:30',4078.2,4082.5,4073.5,4079.9,5901],['16:00',4080.3,4080.9,4076.1,4076.6,2207],
  ['16:30',4076.6,4076.6,4066.5,4069.5,3047],['17:00',4069.7,4072.8,4065.3,4071.3,6275],
];

const historicalSilverConfirmCloses = [
  65.780,65.765,65.885,65.960,65.900,65.905,65.915,65.925,65.965,66.015,65.940,65.885,65.865,65.860,65.950,65.930,
  65.885,65.920,65.890,65.935,66.230,66.275,66.180,66.295,66.300,66.310,66.270,66.315,66.585,66.455,66.520,66.675,
] as const;

function MetalsSyncStudy() {
  const gold = historicalFlowBars;
  const silver = historicalSilverConfirmCloses;
  const left = 50, right = 1145, top = 58, goldBottom = 342, syncTop = 395, syncBottom = 520;
  const x = (index: number) => left + index * ((right-left)/(gold.length-1));
  const goldLow = Math.min(...gold.map((bar) => bar[3]));
  const goldHigh = Math.max(...gold.map((bar) => bar[2]));
  const goldPad = (goldHigh-goldLow)*0.08;
  const gy = (price: number) => top + ((goldHigh+goldPad-price)/(goldHigh-goldLow+goldPad*2))*(goldBottom-top);
  const goldReturns = gold.map((bar) => (bar[4]/gold[0][4]-1)*100);
  const silverReturns = silver.map((close) => (close/silver[0]-1)*100);
  const returnLow = Math.min(...goldReturns,...silverReturns)-0.08;
  const returnHigh = Math.max(...goldReturns,...silverReturns)+0.08;
  const ry = (value: number) => syncTop + ((returnHigh-value)/(returnHigh-returnLow))*(syncBottom-syncTop);
  const goldPoints = goldReturns.map((value,index) => `${x(index)},${ry(value)}`).join(' ');
  const silverPoints = silverReturns.map((value,index) => `${x(index)},${ry(value)}`).join(' ');
  const syncStart = 20;

  return (
    <svg viewBox="0 0 1200 575" role="img" aria-label="Historical gold chart with silver directional confirmation" className="h-full w-full bg-[#0b0e18]">
      <rect width="1200" height="575" fill="#0b0e18" />
      <text x="50" y="28" fill="#f8fafc" fontSize="14" fontWeight="700">PRIMARY · GC GOLD FUTURES · 15m</text>
      <text x="1145" y="28" textAnchor="end" fill="#64748b" fontSize="10">SILVER CONFIRMS ONLY · HISTORICAL SEP 02–03, 2026 UTC</text>
      {Array.from({length:5},(_,index)=>goldLow-goldPad+index*((goldHigh-goldLow+goldPad*2)/4)).map((price)=><line key={price} x1={left} y1={gy(price)} x2={right} y2={gy(price)} stroke="#293247" opacity=".48"/>)}
      <rect x={x(syncStart)-12} y={top} width={right-x(syncStart)+12} height={goldBottom-top} fill="#10b981" opacity=".055" />
      {gold.map((bar,index)=>{
        const [,open,high,low,close]=bar;
        const up=close>=open;
        const color=up?'#26a69a':'#ef5350';
        const candleWidth=Math.max(5,((right-left)/gold.length)*.58);
        return <g key={`sync-candle-${index}`}><line x1={x(index)} y1={gy(high)} x2={x(index)} y2={gy(low)} stroke={color} strokeWidth="1.3"/><rect x={x(index)-candleWidth/2} y={gy(Math.max(open,close))} width={candleWidth} height={Math.max(2,Math.abs(gy(open)-gy(close)))} fill={color}/></g>;
      })}
      <line x1={x(syncStart)} y1={top+8} x2={x(syncStart)} y2={syncBottom} stroke="#34d399" strokeDasharray="6 5" opacity=".8" />
      <rect x={x(syncStart)+10} y="70" width="210" height="42" rx="6" fill="#06251f" stroke="#34d399" strokeOpacity=".65" />
      <text x={x(syncStart)+22} y="88" fill="#6ee7b7" fontSize="10" fontWeight="700">SYNCED BULLISH</text>
      <text x={x(syncStart)+22} y="103" fill="#94a3b8" fontSize="9">Gold leads · silver agrees after close</text>

      <rect x={left} y={syncTop-22} width={right-left} height={syncBottom-syncTop+34} rx="7" fill="#080c16" stroke="#293247" />
      <line x1={left} y1={ry(0)} x2={right} y2={ry(0)} stroke="#475569" strokeDasharray="5 5" />
      <polyline points={goldPoints} fill="none" stroke="#facc15" strokeWidth="2.5" />
      <polyline points={silverPoints} fill="none" stroke="#94a3b8" strokeWidth="2" />
      <text x={left+10} y={syncTop-5} fill="#facc15" fontSize="10" fontWeight="700">GOLD % MOVE</text>
      <text x={left+105} y={syncTop-5} fill="#cbd5e1" fontSize="10" fontWeight="700">SILVER % MOVE</text>
      <text x={right-8} y={syncTop-5} textAnchor="end" fill="#6ee7b7" fontSize="10" fontWeight="700">SAME DIRECTION = CONFIRM · DIVERGENCE = WAIT</text>
      {[0,8,16,24,31].map((index)=><text key={`sync-time-${index}`} x={x(index)} y="553" textAnchor={index===0?'start':index===31?'end':'middle'} fill="#64748b" fontSize="9">{gold[index][0]}</text>)}
    </svg>
  );
}

const historicalReversalBars: readonly HistoricalBar[] = [
  ['Aug 14 04:00',4379.2,4380.5,4378.4,4378.6,176],['04:05',4378.4,4380.4,4378.3,4379.4,150],['04:10',4379.6,4382.7,4378.8,4381.7,237],['04:15',4381.2,4383,4380.9,4382,107],
  ['04:20',4382.2,4384.6,4381.3,4382.4,262],['04:25',4382.2,4382.7,4380.2,4380.2,103],['04:30',4380.7,4381.2,4378.4,4379.6,309],['04:35',4379.5,4380.6,4379.1,4380.1,82],
  ['04:40',4380.1,4381.2,4379.7,4380.4,80],['04:45',4380.1,4380.1,4378.9,4379.3,55],['04:50',4379.2,4380,4378.3,4379.8,86],['04:55',4379.7,4382,4379.4,4382,153],
  ['05:00',4382.2,4382.2,4378.8,4380,140],['05:05',4380.1,4380.3,4374.7,4374.7,230],['05:10',4374.5,4376.9,4374.3,4374.8,153],['05:15',4374.9,4375.1,4372.4,4373.6,195],
  ['05:20',4373.3,4374.1,4371.9,4373.3,147],['05:25',4373,4374.3,4372,4373.3,139],['05:30',4372.9,4373,4365.6,4371.5,972],['05:35',4371.8,4379.8,4371.5,4377.4,468],
  ['05:40',4377.3,4379.3,4372.4,4372.7,280],['05:45',4372.5,4379.3,4372.5,4379.2,281],['05:50',4378.6,4385.4,4378.1,4385,728],['05:55',4385.7,4389.5,4384.8,4389.5,598],
  ['06:00',4389.6,4392,4387.9,4391.4,537],['06:05',4391.5,4392.6,4385.6,4386.5,431],['06:10',4386.7,4390,4385.5,4388.3,227],['06:15',4388.2,4389.1,4387.2,4387.7,179],
  ['06:20',4387.6,4388.2,4384.2,4387,335],['06:25',4387.6,4388,4385,4385.3,149],['06:30',4385.1,4386.3,4384.2,4384.2,142],['06:35',4385.1,4386.4,4383.9,4385.3,125],
  ['06:40',4385.3,4388.8,4383.6,4388.6,301],['06:45',4389,4392.2,4388.4,4390.8,411],['06:50',4390.5,4391.2,4389.1,4390.2,142],['06:55',4389.6,4391.9,4389.6,4391.6,87],
];

const historicalStrongSweep15mBars: readonly HistoricalBar[] = [
  ['Aug 14 04:00',4379.2,4382.7,4378.3,4381.7,563],['04:15',4381.2,4384.6,4380.2,4380.2,472],
  ['04:30',4380.7,4381.2,4378.4,4380.4,471],['04:45',4380.1,4382.0,4378.3,4382.0,294],
  ['05:00',4382.2,4382.2,4374.3,4374.8,523],['05:15',4374.9,4375.1,4371.9,4373.3,481],
  ['05:30',4372.9,4379.8,4365.6,4372.7,1720],['05:45',4372.5,4389.5,4372.5,4389.5,1607],
  ['06:00',4389.6,4392.6,4385.5,4388.3,1195],['06:15',4388.2,4389.1,4384.2,4387.0,663],
  ['06:30',4385.1,4388.8,4383.6,4388.6,568],['06:45',4389.0,4392.2,4388.4,4391.6,640],
];

const historicalFibonacciBars: readonly HistoricalBar[] = [
  ['Aug 26 18:45',4651.6,4653,4648.3,4648.5,791],['19:00',4648.8,4650.4,4645.7,4649.1,685],['19:15',4649.1,4653.7,4645.8,4653.1,931],['19:30',4653.2,4656.3,4649,4650.2,802],
  ['19:45',4650.5,4651.1,4647,4648.9,1090],['20:00',4649,4651.4,4646,4646,499],['20:15',4646.4,4646.7,4638.6,4645.9,739],['20:30',4645.8,4648.4,4645,4646.4,245],
  ['20:45',4646.6,4649.7,4646.5,4647.8,255],['22:00',4650,4660,4648.1,4656.6,254],['22:15',4657,4667.7,4656.2,4665.1,926],['22:30',4665.2,4666,4663.1,4665,376],
  ['22:45',4665.3,4666.2,4660.7,4663.3,663],['23:00',4663.2,4669.5,4660.9,4669.5,863],['23:15',4669.1,4676.1,4668.2,4673.7,1135],['23:30',4674.1,4678.7,4672,4676.8,591],
  ['23:45',4676.3,4678.9,4674.7,4677.5,1043],['Aug 27 00:00',4677.9,4681,4670.3,4672,1019],['00:15',4671.7,4675.3,4667.4,4673.1,853],['00:30',4673,4673,4659.4,4660.4,1772],
  ['00:45',4660.5,4665.3,4654.5,4659.2,1182],['01:00',4658.9,4679.1,4656.2,4678.9,1911],['01:15',4679.1,4679.5,4671.2,4672.8,1349],['01:30',4672.7,4686,4672.4,4678.4,2076],
  ['01:45',4678.4,4695.4,4678.3,4694.6,2143],['02:00',4694.6,4697.7,4692.6,4695.4,1449],['02:15',4695,4695.2,4687.4,4687.9,1234],['02:30',4687.8,4688.4,4678.1,4681.6,1891],
  ['02:45',4681.8,4685.9,4678.9,4683.7,840],['03:00',4683.8,4689.7,4682.9,4689,737],['03:15',4688.7,4693.1,4687.4,4690,520],['03:30',4690,4690.3,4683.4,4684,586],
];

function HistoricalFibonacciStudy() {
  const bars = historicalFibonacciBars;
  const chartLeft = 42, chartRight = 925, chartTop = 55, chartBottom = 492, volumeTop = 515, volumeBottom = 606;
  const rawLow = Math.min(...bars.map((bar) => bar[3]));
  const rawHigh = Math.max(...bars.map((bar) => bar[2]));
  const padding = (rawHigh - rawLow) * 0.07;
  const low = rawLow - padding, high = rawHigh + padding;
  const maxVolume = Math.max(...bars.map((bar) => bar[5]));
  const x = (index: number) => chartLeft + index * ((chartRight - chartLeft) / (bars.length - 1));
  const y = (price: number) => chartTop + ((high - price) / (high - low)) * (chartBottom - chartTop);
  const swingLow = 4638.6, swingHigh = 4681.0, swingLowIndex = 6, swingHighIndex = 17, rejectionIndex = 20;
  const range = swingHigh - swingLow;
  const levels = [
    [0, 'SWING HIGH'], [0.236, 'WEAK RETRACEMENT'], [0.382, 'TREND CONTINUATION'], [0.5, 'SMART MONEY REACTION'],
    [0.618, 'GOLDEN ENTRY'], [0.705, 'SNIPER ENTRY'], [0.786, 'DEEP RETRACEMENT'], [1, 'SWING LOW / FULL'],
  ] as const;
  const priceAt = (level: number) => swingHigh - range * level;
  const goldenTop = priceAt(0.618), goldenBottom = priceAt(0.705);

  return (
    <svg viewBox="0 0 1200 650" role="img" aria-label="Historical GC gold futures bullish Fibonacci pullback" className="h-full w-full bg-[#0b0e18]">
      <rect width="1200" height="650" fill="#0b0e18" />
      <text x="42" y="30" fill="#f8fafc" fontSize="14" fontWeight="700">GC=F · 15m · Aug 26–27, 2026</text>
      <text x="1155" y="30" textAnchor="end" fill="#64748b" fontSize="10">HISTORICAL OHLC · UTC · YAHOO FINANCE</text>
      {Array.from({ length: 6 }, (_, i) => high - i * ((high-low)/5)).map((price) => <line key={price} x1={chartLeft} y1={y(price)} x2={chartRight} y2={y(price)} stroke="#293247" opacity=".46"/>)}
      {bars.map((_, index) => index % 4 === 0 ? <line key={index} x1={x(index)} y1={chartTop} x2={x(index)} y2={volumeBottom} stroke="#293247" opacity=".26"/> : null)}

      <rect x={x(swingLowIndex)} y={y(goldenTop)} width={chartRight-x(swingLowIndex)} height={y(goldenBottom)-y(goldenTop)} fill="#facc15" opacity=".12" stroke="#facc15" strokeWidth="1.5" />
      {levels.map(([level,name]) => {
        const price = priceAt(level);
        const golden = level === 0.618 || level === 0.705;
        const middle = level === 0.5;
        const anchor = level === 0 || level === 1;
        const color = golden ? '#facc15' : middle ? '#22d3ee' : anchor ? '#cbd5e1' : '#d946ef';
        return <g key={level}><line x1={x(swingLowIndex)} y1={y(price)} x2={chartRight} y2={y(price)} stroke={color} strokeWidth={golden||middle?1.8:1.1} strokeDasharray={anchor?'':'8 6'} opacity=".9"/><rect x="936" y={y(price)-14} width="250" height="28" rx="5" fill="#11172b" stroke={color} strokeOpacity=".5"/><text x="947" y={y(price)+3} fill={color} fontSize="9" fontWeight="700">{`${(level*100).toFixed(level===0.705?1:level===0||level===1?0:1).replace('.0','')}% · ${name} · ${price.toFixed(1)}`}</text></g>;
      })}

      {bars.map((bar,index) => {
        const [time,open,barHigh,barLow,close,volume] = bar;
        const up = close >= open;
        const color = up ? '#26a69a' : '#ef5350';
        const candleWidth = Math.max(6,((chartRight-chartLeft)/bars.length)*.62);
        const bodyTop = y(Math.max(open,close));
        const volumeHeight = (volume/maxVolume)*(volumeBottom-volumeTop);
        return <g key={`${time}-${index}`}><line x1={x(index)} y1={y(barHigh)} x2={x(index)} y2={y(barLow)} stroke={color} strokeWidth="1.4"/><rect x={x(index)-candleWidth/2} y={bodyTop} width={candleWidth} height={Math.max(2,Math.abs(y(open)-y(close)))} fill={color}/><rect x={x(index)-candleWidth/2} y={volumeBottom-volumeHeight} width={candleWidth} height={volumeHeight} fill={color} opacity=".42"/></g>;
      })}

      <line x1={x(swingLowIndex)} y1={y(swingLow)} x2={x(swingHighIndex)} y2={y(swingHigh)} stroke="#60a5fa" strokeWidth="2.5" />
      <circle cx={x(swingLowIndex)} cy={y(swingLow)} r="6" fill="#0b0e18" stroke="#22d3ee" strokeWidth="2.5"/><circle cx={x(swingHighIndex)} cy={y(swingHigh)} r="6" fill="#0b0e18" stroke="#a855f7" strokeWidth="2.5"/>
      <text x={x(swingLowIndex)-8} y={y(swingLow)+19} textAnchor="middle" fill="#67e8f9" fontSize="9" fontWeight="700">ANCHOR LOW</text>
      <text x={x(swingHighIndex)} y={y(swingHigh)-12} textAnchor="middle" fill="#d8b4fe" fontSize="9" fontWeight="700">CONFIRMED HIGH</text>
      <circle cx={x(rejectionIndex)} cy={y(bars[rejectionIndex][3])} r="7" fill="#0b0e18" stroke="#facc15" strokeWidth="3"/>
      <text x={x(rejectionIndex)+12} y={y(bars[rejectionIndex][3])+20} fill="#fde047" fontSize="9" fontWeight="700">GOLDEN-ZONE TOUCH · WAIT FOR CLOSE</text>
      <circle cx={x(rejectionIndex+1)} cy={y(bars[rejectionIndex+1][4])} r="7" fill="#0b0e18" stroke="#34d399" strokeWidth="3"/>
      <text x={x(rejectionIndex+1)+10} y={y(bars[rejectionIndex+1][4])-12} fill="#6ee7b7" fontSize="9" fontWeight="700">BULLISH REJECTION CONFIRMED</text>

      <text x="42" y="508" fill="#64748b" fontSize="9">VOLUME</text>
      {bars.map((bar,index) => index % 6 === 0 ? <text key={`fib-time-${index}`} x={x(index)} y="628" textAnchor="middle" fill="#64748b" fontSize="9">{bar[0].includes(' ') ? bar[0].split(' ').at(-1) : bar[0]}</text> : null)}
    </svg>
  );
}

function HistoricalGoldStudy({ mode }: { mode: 'flow' | 'reversal' | 'continuation' | 'strong-flow' }) {
  const isContinuation = mode === 'continuation';
  const isStrongFlow = mode === 'strong-flow';
  const bars = isContinuation ? historicalPoc30mBars : isStrongFlow ? historicalStrongSweep15mBars : mode === 'flow' ? historicalFlowBars : historicalReversalBars;
  const chartLeft = isContinuation ? 170 : 42, chartRight = 1002, chartTop = 55, chartBottom = 482, volumeTop = 510, volumeBottom = 606;
  const flowTarget = isContinuation ? 4094.7 : 4479.8;
  const rawLow = Math.min(...bars.map((bar) => bar[3]));
  const rawHigh = Math.max(...bars.map((bar) => bar[2]), isContinuation ? flowTarget : -Infinity);
  const padding = (rawHigh - rawLow) * 0.08;
  const low = rawLow - padding, high = rawHigh + padding;
  const maxVolume = Math.max(...bars.map((bar) => bar[5]));
  const x = (index: number) => chartLeft + index * ((chartRight - chartLeft) / (bars.length - 1));
  const y = (price: number) => chartTop + ((high - price) / (high - low)) * (chartBottom - chartTop);
  const tickPrices = Array.from({ length: 6 }, (_, i) => high - i * ((high - low) / 5));
  const rangeStart = isContinuation ? 0 : isStrongFlow ? 0 : mode === 'flow' ? 4 : 6;
  const rangeEnd = isContinuation ? 10 : isStrongFlow ? 5 : mode === 'flow' ? 13 : 17;
  const sweepIndex = isContinuation ? 11 : isStrongFlow ? 6 : mode === 'flow' ? 14 : 18;
  const breakoutIndex = isContinuation ? 12 : sweepIndex;
  const confirmationIndex = isContinuation ? 15 : isStrongFlow ? 7 : mode === 'flow' ? 20 : 22;
  const pullbackIndex = isContinuation ? 14 : confirmationIndex;
  const rangeHigh = isContinuation ? 4067.0 : isStrongFlow ? 4384.6 : mode === 'reversal' ? 4382.2 : 4438.2;
  const rangeLow = isContinuation ? 4047.5 : isStrongFlow ? 4371.9 : mode === 'reversal' ? 4371.9 : 4427.3;
  const poc = isContinuation ? 4059.5 : isStrongFlow ? 4379.4 : mode === 'reversal' ? 4379.4 : 4433.7;
  const entry = isContinuation ? 4071.2 : isStrongFlow ? 4384.7 : mode === 'flow' ? 4438.2 : 4380.0;
  const stop = isContinuation ? 4060.2 : isStrongFlow ? 4365.3 : mode === 'flow' ? 4426.2 : 4364.8;
  const target = isContinuation ? flowTarget : isStrongFlow ? 4392.0 : mode === 'flow' ? 4461.2 : 4392.0;
  const label = isContinuation ? 'GC=F · 30m · Jul 24, 2026' : isStrongFlow ? 'GC=F · 15m · Aug 14, 2026' : mode === 'flow' ? 'GC=F · 15m · Sep 02–03, 2026' : 'GC=F · 5m · Aug 14, 2026';
  const profileBins = isContinuation ? Array.from({ length: 11 }, (_, index) => {
    const binLow = rangeLow + index * ((rangeHigh - rangeLow) / 11);
    const binHigh = rangeLow + (index + 1) * ((rangeHigh - rangeLow) / 11);
    const activity = bars.slice(rangeStart, rangeEnd + 1).reduce((total, bar) => {
      const overlap = Math.max(0, Math.min(bar[2], binHigh) - Math.max(bar[3], binLow));
      return total + (bar[2] > bar[3] ? bar[5] * overlap / (bar[2] - bar[3]) : 0);
    }, 0);
    return { price: (binLow + binHigh) / 2, activity };
  }) : [];
  const maxProfileActivity = Math.max(1, ...profileBins.map((bin) => bin.activity));

  return (
    <svg viewBox="0 0 1200 650" role="img" aria-label={`${label} historical gold futures setup`} className="h-full w-full bg-[#0b0e18]">
      <rect width="1200" height="650" fill="#0b0e18" />
      <text x="42" y="30" fill="#f8fafc" fontSize="14" fontWeight="700">{label}</text>
      <text x="1155" y="30" textAnchor="end" fill="#64748b" fontSize="10">HISTORICAL OHLC · UTC · YAHOO FINANCE</text>
      {tickPrices.map((price) => <g key={price}><line x1={chartLeft} y1={y(price)} x2={chartRight} y2={y(price)} stroke="#293247" strokeWidth="1" opacity=".55"/><text x="1018" y={y(price)+4} fill="#94a3b8" fontSize="10">{price.toFixed(1)}</text></g>)}
      {bars.map((bar, index) => index % 4 === 0 ? <line key={`time-${index}`} x1={x(index)} y1={chartTop} x2={x(index)} y2={volumeBottom} stroke="#293247" opacity=".28"/> : null)}

      {isContinuation && <g aria-label="Consolidation volume profile">
        <text x="32" y={y(rangeHigh)-12} fill="#94a3b8" fontSize="9" fontWeight="700">RANGE VOLUME PROFILE</text>
        {profileBins.map((bin, index) => {
          const width = 112 * (bin.activity / maxProfileActivity);
          const binHeight = Math.max(5, Math.abs(y(rangeLow + ((index + 1) * (rangeHigh-rangeLow)/11)) - y(rangeLow + (index * (rangeHigh-rangeLow)/11))) - 1);
          const isPoc = Math.abs(bin.price - poc) < (rangeHigh-rangeLow)/11;
          return <rect key={`profile-${index}`} x={150-width} y={y(bin.price)-binHeight/2} width={width} height={binHeight} fill={isPoc ? '#facc15' : '#38bdf8'} opacity={isPoc ? '.9' : '.38'} />;
        })}
      </g>}

      <rect x={x(rangeStart)-12} y={y(rangeHigh)} width={x(rangeEnd)-x(rangeStart)+24} height={Math.max(3,y(rangeLow)-y(rangeHigh))} fill="#38bdf8" opacity=".07" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="7 5" />
      <line x1={x(rangeStart)-12} y1={y(poc)} x2={x(confirmationIndex)+22} y2={y(poc)} stroke="#facc15" strokeWidth="2" strokeDasharray="10 6" />
      <text x={x(rangeStart)} y={y(rangeHigh)-9} fill="#7dd3fc" fontSize="10" fontWeight="700">1 · RANGE / NO TRADE</text>
      <text x={x(rangeStart)} y={y(poc)-7} fill="#fde047" fontSize="9" fontWeight="700">POC PROXY {poc.toFixed(1)}</text>

      {bars.map((bar, index) => {
        const [time, open, barHigh, barLow, close, volume] = bar;
        const up = close >= open;
        const color = up ? '#26a69a' : '#ef5350';
        const candleWidth = Math.max(6, ((chartRight-chartLeft)/bars.length)*.62);
        const bodyTop = y(Math.max(open,close));
        const bodyHeight = Math.max(2,Math.abs(y(open)-y(close)));
        const volumeHeight = (volume/maxVolume)*(volumeBottom-volumeTop);
        return <g key={`${time}-${index}`}><line x1={x(index)} y1={y(barHigh)} x2={x(index)} y2={y(barLow)} stroke={color} strokeWidth="1.4"/><rect x={x(index)-candleWidth/2} y={bodyTop} width={candleWidth} height={bodyHeight} fill={color}/><rect x={x(index)-candleWidth/2} y={volumeBottom-volumeHeight} width={candleWidth} height={volumeHeight} fill={color} opacity=".42"/></g>;
      })}

      <line x1={x(sweepIndex)} y1={y(bars[sweepIndex][3])} x2={x(sweepIndex)} y2={volumeTop-8} stroke="#fb923c" strokeWidth="1.5" strokeDasharray="5 4" />
      <circle cx={x(sweepIndex)} cy={y(bars[sweepIndex][3])} r="5" fill="#0b0e18" stroke="#fb923c" strokeWidth="2.5" />
      <text x={x(sweepIndex)-8} y={volumeTop-14} textAnchor="middle" fill="#fdba74" fontSize="10" fontWeight="700">2 · LIQUIDITY SWEEP</text>
      {isContinuation && <><circle cx={x(breakoutIndex)} cy={y(bars[breakoutIndex][4])} r="6" fill="#0b0e18" stroke="#22d3ee" strokeWidth="2.5"/><text x={x(breakoutIndex)+9} y={y(bars[breakoutIndex][4])-14} fill="#67e8f9" fontSize="9" fontWeight="700">3 · BREAKOUT / RANGE RECLAIM</text><circle cx={x(pullbackIndex)} cy={y(bars[pullbackIndex][3])} r="6" fill="#0b0e18" stroke="#facc15" strokeWidth="2.5"/><text x={x(pullbackIndex)+10} y={y(bars[pullbackIndex][3])+18} fill="#fde047" fontSize="9" fontWeight="700">4 · PULLBACK HOLDS RANGE HIGH</text></>}
      <circle cx={x(confirmationIndex)} cy={y(bars[confirmationIndex][4])} r="5" fill="#0b0e18" stroke="#34d399" strokeWidth="2.5" />
      <text x={x(confirmationIndex)+10} y={y(bars[confirmationIndex][4])-12} fill="#6ee7b7" fontSize="10" fontWeight="700">{isContinuation ? '5 · CONTINUATION TRIGGER' : isStrongFlow ? '3 · RECLAIM + DISPLACEMENT CLOSE' : '3 · CLOSED CONFIRMATION'}</text>

      <line x1={x(confirmationIndex)} y1={y(entry)} x2={chartRight} y2={y(entry)} stroke="#34d399" strokeWidth="1.5" />
      <line x1={x(confirmationIndex)} y1={y(stop)} x2={chartRight} y2={y(stop)} stroke="#fb7185" strokeWidth="1.5" strokeDasharray="7 5" />
      <line x1={x(confirmationIndex)} y1={y(target)} x2={chartRight} y2={y(target)} stroke="#34d399" strokeWidth="1.5" strokeDasharray="7 5" />
      <text x="1018" y={y(entry)+4} fill="#6ee7b7" fontSize="10" fontWeight="700">{isStrongFlow ? 'RANGE RECLAIM' : 'ENTRY'} {entry.toFixed(1)}</text>
      <text x="1018" y={y(stop)+4} fill="#fda4af" fontSize="10" fontWeight="700">{isStrongFlow ? 'INVALID BELOW' : 'SL'} {stop.toFixed(1)}</text>
      <text x="1018" y={y(target)+4} fill="#6ee7b7" fontSize="10" fontWeight="700">{isStrongFlow ? 'NEXT LIQUIDITY' : 'TP'} {target.toFixed(1)}</text>

      <text x="42" y="503" fill="#64748b" fontSize="9">VOLUME</text>
      {bars.map((bar,index) => index % 6 === 0 ? <text key={`label-${index}`} x={x(index)} y="628" textAnchor="middle" fill="#64748b" fontSize="9">{bar[0].includes(' ') ? bar[0].split(' ').at(-1) : bar[0]}</text> : null)}
    </svg>
  );
}

function SetupFlowChartGuide() {
  const candles: readonly GuideCandle[] = [
    [70, 318, 286, 336, 270], [100, 286, 304, 319, 272], [130, 304, 278, 322, 262], [160, 278, 296, 312, 266],
    [190, 296, 272, 310, 258], [220, 272, 314, 326, 263], [250, 314, 292, 330, 280], [280, 292, 310, 322, 279],
    [310, 310, 284, 326, 270], [340, 284, 306, 320, 275], [370, 306, 292, 325, 281], [410, 292, 318, 334, 280],
    [450, 318, 286, 470, 275], [490, 286, 248, 302, 230], [530, 248, 190, 263, 174], [570, 190, 132, 206, 116],
    [610, 132, 102, 148, 88], [650, 102, 146, 160, 92], [690, 146, 188, 201, 133], [730, 188, 230, 246, 176],
    [770, 230, 274, 287, 216], [810, 274, 304, 320, 262], [850, 304, 278, 318, 266], [890, 278, 244, 292, 228],
    [930, 244, 210, 258, 196], [970, 210, 176, 225, 160],
  ];
  return (
    <svg viewBox="0 0 1200 650" role="img" aria-labelledby="flow-title flow-desc" className="h-full w-full bg-[#070b1c]">
      <title id="flow-title">Consolidation, manipulation, displacement and entry setup map</title>
      <desc id="flow-desc">Price consolidates around a point of control, sweeps below the range, reclaims it with displacement, then retests and defends the point of control before a possible long entry.</desc>
      {Array.from({ length: 12 }).map((_, i) => <line key={`fv-${i}`} x1={36 + i * 96} y1="32" x2={36 + i * 96} y2="612" stroke="#26304a" opacity=".3" />)}
      {Array.from({ length: 8 }).map((_, i) => <line key={`fh-${i}`} x1="32" y1={58 + i * 72} x2="1168" y2={58 + i * 72} stroke="#26304a" opacity=".28" />)}
      <GuideCandles candles={candles} />

      <rect x="48" y="244" width="350" height="100" rx="8" fill="#22d3ee" opacity=".07" stroke="#22d3ee" strokeWidth="2" strokeDasharray="8 6" />
      <line x1="48" y1="294" x2="1040" y2="294" stroke="#facc15" strokeWidth="2" strokeDasharray="12 7" />
      <rect x="56" y="250" width="205" height="42" rx="6" fill="#082535" stroke="#22d3ee" strokeOpacity=".55"/><text x="70" y="267" fill="#67e8f9" fontSize="12" fontWeight="700">1 · CONSOLIDATION</text><text x="70" y="283" fill="#94a3b8" fontSize="10">Wait inside the range · no trade</text>
      <rect x="62" y="302" width="154" height="28" rx="5" fill="#2b2308" stroke="#facc15" strokeOpacity=".65"/><text x="74" y="320" fill="#fde047" fontSize="11" fontWeight="700">POC · MOST ACTIVITY</text>

      <path d="M410 348 C430 390 436 442 450 470 C462 430 474 350 490 286" fill="none" stroke="#fb923c" strokeWidth="3" />
      <rect x="350" y="484" width="235" height="44" rx="7" fill="#2a1608" stroke="#fb923c" strokeOpacity=".65"/><text x="365" y="502" fill="#fdba74" fontSize="12" fontWeight="700">2 · MANIPULATION / SWEEP</text><text x="365" y="518" fill="#94a3b8" fontSize="10">Liquidity taken, then range reclaimed</text>

      <path d="M505 270 C555 210 584 132 624 104" fill="none" stroke="#c084fc" strokeWidth="3" markerEnd="url(#flowArrow)" />
      <defs><marker id="flowArrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#c084fc"/></marker></defs>
      <rect x="536" y="44" width="244" height="44" rx="7" fill="#17102d" stroke="#c084fc" strokeOpacity=".6"/><text x="551" y="62" fill="#d8b4fe" fontSize="12" fontWeight="700">3 · DISPLACEMENT / MOVE</text><text x="551" y="78" fill="#94a3b8" fontSize="10">Direction appears · do not chase</text>

      <circle cx="850" cy="294" r="9" fill="#070b1c" stroke="#34d399" strokeWidth="3" />
      <line x1="850" y1="294" x2="1080" y2="294" stroke="#34d399" strokeWidth="2" />
      <line x1="850" y1="360" x2="1080" y2="360" stroke="#fb7185" strokeWidth="2" />
      <line x1="850" y1="150" x2="1080" y2="150" stroke="#34d399" strokeWidth="2" strokeDasharray="9 6" />
      <rect x="900" y="238" width="260" height="44" rx="7" fill="#06251f" stroke="#34d399" strokeOpacity=".65"/><text x="915" y="256" fill="#6ee7b7" fontSize="12" fontWeight="700">4 · RETEST + DEFENDED ENTRY</text><text x="915" y="272" fill="#94a3b8" fontSize="10">Completed candle holds above POC</text>
      <text x="1088" y="153" fill="#6ee7b7" fontSize="11" fontWeight="700">TP</text><text x="1088" y="298" fill="#6ee7b7" fontSize="11" fontWeight="700">ENTRY</text><text x="1088" y="364" fill="#fda4af" fontSize="11" fontWeight="700">SL</text>
    </svg>
  );
}

function GoldReversalChartGuide() {
  const candles: readonly GuideCandle[] = [
    [70, 122, 150, 166, 108], [105, 150, 176, 190, 136], [140, 176, 160, 192, 146], [175, 160, 206, 220, 149],
    [210, 206, 232, 248, 192], [245, 232, 270, 286, 220], [280, 270, 298, 316, 258], [315, 298, 326, 342, 285],
    [350, 326, 356, 372, 313], [385, 356, 380, 394, 342], [425, 380, 352, 414, 338], [465, 352, 326, 494, 308],
    [505, 326, 292, 342, 278], [545, 292, 268, 307, 252], [585, 268, 238, 282, 222], [625, 238, 198, 252, 182],
    [665, 198, 176, 214, 161], [705, 176, 148, 192, 132], [745, 148, 164, 181, 136], [785, 164, 134, 178, 118],
    [825, 134, 108, 150, 92], [865, 108, 120, 137, 96], [905, 120, 94, 134, 78],
  ];
  return (
    <svg viewBox="0 0 1200 650" role="img" aria-labelledby="reversal-title reversal-desc" className="h-full w-full bg-[#070b1c]">
      <title id="reversal-title">Confirmed bullish gold reversal setup</title>
      <desc id="reversal-desc">A bearish approach reaches sell-side liquidity, a candle sweeps below it and closes back above, then price breaks the rejection high. Entry follows the completed break with stop below the sweep and staged take profits above.</desc>
      {Array.from({ length: 12 }).map((_, i) => <line key={`rv-${i}`} x1={36 + i * 96} y1="32" x2={36 + i * 96} y2="612" stroke="#26304a" opacity=".3" />)}
      {Array.from({ length: 8 }).map((_, i) => <line key={`rh-${i}`} x1="32" y1={58 + i * 72} x2="1168" y2={58 + i * 72} stroke="#26304a" opacity=".28" />)}
      <GuideCandles candles={candles} />

      <rect x="48" y="62" width="285" height="44" rx="7" fill="#2a1018" stroke="#fb7185" strokeOpacity=".55"/><text x="63" y="80" fill="#fda4af" fontSize="12" fontWeight="700">1 · BEARISH APPROACH</text><text x="63" y="96" fill="#94a3b8" fontSize="10">No long while sellers still control</text>
      <line x1="48" y1="370" x2="590" y2="370" stroke="#fb923c" strokeWidth="2" strokeDasharray="10 7" />
      <text x="58" y="362" fill="#fdba74" fontSize="11" fontWeight="700">PRIOR LOW / SELL-SIDE LIQUIDITY</text>
      <circle cx="465" cy="494" r="9" fill="#070b1c" stroke="#fb923c" strokeWidth="3" />
      <rect x="335" y="510" width="265" height="44" rx="7" fill="#2a1608" stroke="#fb923c" strokeOpacity=".65"/><text x="350" y="528" fill="#fdba74" fontSize="12" fontWeight="700">2 · SWEEP + REJECTION</text><text x="350" y="544" fill="#94a3b8" fontSize="10">Watch only until the high breaks</text>

      <line x1="465" y1="308" x2="695" y2="308" stroke="#facc15" strokeWidth="2" strokeDasharray="9 6" />
      <circle cx="625" cy="238" r="9" fill="#070b1c" stroke="#facc15" strokeWidth="3" />
      <rect x="548" y="328" width="260" height="44" rx="7" fill="#292208" stroke="#facc15" strokeOpacity=".65"/><text x="563" y="346" fill="#fde047" fontSize="12" fontWeight="700">3 · CONFIRMATION BREAK</text><text x="563" y="362" fill="#94a3b8" fontSize="10">Completed close above rejection high</text>

      <line x1="625" y1="238" x2="1082" y2="238" stroke="#34d399" strokeWidth="2" />
      <line x1="625" y1="494" x2="1082" y2="494" stroke="#fb7185" strokeWidth="2" />
      <line x1="625" y1="166" x2="1082" y2="166" stroke="#34d399" strokeWidth="1.5" strokeDasharray="9 6" />
      <line x1="625" y1="94" x2="1082" y2="94" stroke="#34d399" strokeWidth="1.5" strokeDasharray="9 6" />
      <rect x="850" y="265" width="285" height="44" rx="7" fill="#06251f" stroke="#34d399" strokeOpacity=".65"/><text x="865" y="283" fill="#6ee7b7" fontSize="12" fontWeight="700">4 · MANAGED LONG ENTRY</text><text x="865" y="299" fill="#94a3b8" fontSize="10">SL below sweep · profits staged above</text>
      <text x="1090" y="98" fill="#6ee7b7" fontSize="11" fontWeight="700">TP2</text><text x="1090" y="170" fill="#6ee7b7" fontSize="11" fontWeight="700">TP1</text><text x="1090" y="242" fill="#6ee7b7" fontSize="11" fontWeight="700">ENTRY</text><text x="1090" y="498" fill="#fda4af" fontSize="11" fontWeight="700">SL</text>
    </svg>
  );
}

type PatternKind = 'staircase' | 'ascending-triangle' | 'descending-triangle' | 'symmetrical-triangle' | 'flag' | 'wedge' | 'double-top' | 'double-bottom' | 'head-shoulders' | 'rounded' | 'cup-handle';
type PatternBias = 'BUY' | 'SELL' | 'BOTH';

const patternPlaybook: Array<{ kind: PatternKind; name: string; family: string; side: PatternBias; trigger: string; invalidation: string }> = [
  { kind: 'staircase', name: '1 · Ascending / descending staircase', family: 'Trend structure', side: 'BOTH', trigger: 'Trade pullbacks only while higher-high/higher-low or lower-high/lower-low structure remains intact.', invalidation: 'The latest protected swing breaks.' },
  { kind: 'ascending-triangle', name: '2 · Ascending triangle', family: 'Continuation', side: 'BUY', trigger: 'A candle closes above horizontal resistance; prefer a hold or retest.', invalidation: 'Below the latest higher low.' },
  { kind: 'descending-triangle', name: '3 · Descending triangle', family: 'Continuation', side: 'SELL', trigger: 'A candle closes below horizontal support; prefer a rejected retest.', invalidation: 'Above the latest lower high.' },
  { kind: 'symmetrical-triangle', name: '4 · Symmetrical triangle', family: 'Bilateral / continuation', side: 'BOTH', trigger: 'Wait for either converging boundary to break on a completed candle.', invalidation: 'Price closes back through the opposite side.' },
  { kind: 'flag', name: '5 · Flag', family: 'Continuation', side: 'BOTH', trigger: 'After a strong impulse and slow countertrend channel, trade the breakout with the original trend.', invalidation: 'Beyond the far side of the flag.' },
  { kind: 'wedge', name: '6 · Wedge', family: 'Breakout / reversal', side: 'BOTH', trigger: 'Trade only after price closes outside the tightening wedge; falling favors up, rising favors down.', invalidation: 'Beyond the latest internal swing.' },
  { kind: 'double-top', name: '7 · Double top', family: 'Bearish reversal', side: 'SELL', trigger: 'The neckline between the two peaks closes below.', invalidation: 'Above the second peak.' },
  { kind: 'double-bottom', name: '8 · Double bottom', family: 'Bullish reversal', side: 'BUY', trigger: 'The resistance between the two lows closes above.', invalidation: 'Below the second low.' },
  { kind: 'head-shoulders', name: '9 · Head & shoulders', family: 'Bearish reversal', side: 'SELL', trigger: 'The neckline closes below after the lower right shoulder forms.', invalidation: 'Above the right shoulder.' },
  { kind: 'rounded', name: '10 · Rounded top / bottom', family: 'Slow reversal', side: 'BOTH', trigger: 'Wait for the curved transition to complete and its rim level to break.', invalidation: 'Beyond the final structural swing.' },
  { kind: 'cup-handle', name: '11 · Cup and handle', family: 'Bullish reversal', side: 'BUY', trigger: 'The handle completes and price closes above the cup rim.', invalidation: 'Below the handle low.' },
];

function PatternMiniChart({ kind, side }: { kind: PatternKind; side: PatternBias }) {
  const bullish = side !== 'SELL';
  const accent = side === 'BOTH' ? '#60a5fa' : bullish ? '#34d399' : '#fb7185';
  const patternPoints: Record<PatternKind, number[]> = {
    'staircase': [92, 72, 82, 60, 70, 48, 58, 36, 46, 24, 32, 12],
    'ascending-triangle': [82, 40, 70, 40, 59, 40, 50, 36, 18, 8],
    'descending-triangle': [18, 60, 34, 60, 43, 60, 50, 62, 82, 94],
    'symmetrical-triangle': [18, 88, 30, 76, 42, 66, 50, 60, 54, 34, 14, 6],
    'flag': [94, 54, 18, 30, 26, 42, 36, 50, 44, 22, 8],
    'wedge': [24, 52, 34, 68, 48, 78, 62, 84, 70, 48, 24, 10],
    'double-top': [86, 58, 24, 48, 68, 42, 28, 52, 70, 86, 98],
    'double-bottom': [18, 44, 82, 54, 34, 58, 78, 52, 30, 14, 6],
    'head-shoulders': [76, 42, 58, 18, 56, 38, 62, 74, 90, 100],
    'rounded': [20, 34, 52, 70, 84, 91, 88, 74, 54, 30, 12, 5],
    'cup-handle': [22, 48, 72, 86, 82, 68, 44, 22, 34, 46, 30, 10],
  };
  const boundaryPaths: Record<PatternKind, string[]> = {
    'staircase': ['M16 96 L202 20', 'M32 84 L218 8'],
    'ascending-triangle': ['M38 40 L188 40', 'M22 88 L184 47'],
    'descending-triangle': ['M18 62 L188 62', 'M20 12 L184 54'],
    'symmetrical-triangle': ['M18 12 L182 58', 'M18 96 L182 58'],
    'flag': ['M70 20 L184 44', 'M70 42 L184 66'],
    'wedge': ['M18 14 L178 68', 'M18 82 L178 88'],
    'double-top': ['M18 70 L180 70'],
    'double-bottom': ['M18 34 L180 34'],
    'head-shoulders': ['M18 70 L180 70'],
    'rounded': ['M18 22 L190 22'],
    'cup-handle': ['M18 22 L202 22'],
  };
  const entryLevels: Record<PatternKind, number> = { staircase: 32, 'ascending-triangle': 36, 'descending-triangle': 66, 'symmetrical-triangle': 34, flag: 28, wedge: 44, 'double-top': 74, 'double-bottom': 30, 'head-shoulders': 74, rounded: 22, 'cup-handle': 22 };
  const stopLevels: Record<PatternKind, number> = { staircase: 58, 'ascending-triangle': 62, 'descending-triangle': 42, 'symmetrical-triangle': 62, flag: 52, wedge: 70, 'double-top': 48, 'double-bottom': 58, 'head-shoulders': 46, rounded: 54, 'cup-handle': 50 };
  const entryY = entryLevels[kind];
  const stopY = stopLevels[kind];
  const points = patternPoints[kind];
  const candles: GuideCandle[] = points.map((closeY, index) => {
    const x = 18 + index * (212 / Math.max(1, points.length - 1));
    const previous = index === 0 ? closeY + (bullish ? 10 : -10) : points[index - 1];
    const openY = previous + (index % 2 === 0 ? 2 : -2);
    return [x, openY, closeY, Math.max(openY, closeY) + 7, Math.min(openY, closeY) - 7];
  });

  return (
    <svg viewBox="0 0 250 110" role="img" aria-label={`${side} ${kind} confirmation diagram`} className="h-28 w-full rounded-lg bg-[#070b1c]">
      {[25, 50, 75, 100].map((x) => <line key={`px-${x}`} x1={x} y1="6" x2={x} y2="104" stroke="#26304a" opacity=".28" />)}
      {[25, 50, 75, 100].map((y) => <line key={`py-${y}`} x1="6" y1={y} x2="244" y2={y} stroke="#26304a" opacity=".28" />)}
      {boundaryPaths[kind].map((d, index) => <path key={index} d={d} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="5 4" />)}
      <GuideCandles candles={candles} />
      <line x1="176" y1={entryY} x2="242" y2={entryY} stroke={accent} strokeWidth="1.5" />
      <line x1="176" y1={stopY} x2="242" y2={stopY} stroke="#fb7185" strokeWidth="1.25" strokeDasharray="5 4" />
      <circle cx="205" cy={points[points.length - 2]} r="5" fill="#070b1c" stroke={accent} strokeWidth="2.5" />
      <text x="178" y={entryY - 4} fill={accent} fontSize="8" fontWeight="700">BREAK + RETEST</text>
      <text x="213" y={stopY - 4} fill="#fda4af" fontSize="8" fontWeight="700">SL</text>
    </svg>
  );
}

function FibonacciChartGuide() {
  const levels = [
    { y: 54, level: '0%', name: 'SWING HIGH / ZERO', price: '4419.575', color: '#cbd5e1', dash: '' },
    { y: 176, level: '23.6%', name: 'WEAK RETRACEMENT', price: '4416.044', color: '#d946ef', dash: '8 7' },
    { y: 252, level: '38.2%', name: 'TREND CONTINUATION', price: '4413.891', color: '#d946ef', dash: '8 7' },
    { y: 314, level: '50%', name: 'SMART MONEY REACTION', price: '4412.153', color: '#22d3ee', dash: '12 9' },
    { y: 376, level: '61.8%', name: 'GOLDEN ENTRY', price: '4410.411', color: '#facc15', dash: '12 7' },
    { y: 422, level: '70.5%', name: 'SNIPER ENTRY', price: '4409.128', color: '#facc15', dash: '12 7' },
    { y: 464, level: '78.6%', name: 'DEEP RETRACEMENT', price: '4407.933', color: '#d946ef', dash: '8 7' },
    { y: 576, level: '100%', name: 'SWING LOW / FULL', price: '4404.777', color: '#cbd5e1', dash: '' },
  ];
  const candles = [
    [72, 548, 526, 566, 510], [102, 526, 538, 553, 500], [132, 538, 486, 552, 472],
    [162, 486, 456, 502, 438], [192, 456, 421, 470, 400], [222, 421, 438, 447, 395],
    [252, 438, 382, 451, 361], [282, 382, 336, 396, 320], [312, 336, 286, 350, 268],
    [342, 286, 304, 319, 260], [372, 304, 242, 316, 220], [402, 242, 178, 255, 154],
    [432, 178, 112, 190, 92], [462, 112, 68, 126, 52], [492, 68, 94, 111, 57],
    [522, 94, 116, 126, 82], [552, 116, 130, 146, 103], [582, 130, 120, 142, 108],
    [612, 120, 145, 158, 112], [642, 145, 156, 170, 132], [672, 156, 166, 184, 145],
    [702, 166, 160, 176, 149], [732, 160, 178, 192, 154], [762, 178, 170, 188, 160],
  ] as const;

  return (
    <svg viewBox="0 0 1200 650" role="img" aria-labelledby="fib-chart-title fib-chart-desc" className="h-full w-full bg-[#070b1c]">
      <title id="fib-chart-title">Bullish Fibonacci retracement map</title>
      <desc id="fib-chart-desc">A bullish move is anchored from the swing low to the swing high. Zero percent is displayed at the high and one hundred percent at the low. The 61.8 to 70.5 percent golden zone is highlighted.</desc>
      <defs>
        <linearGradient id="fibMarkup" x1="0" y1="1" x2="1" y2="0"><stop stopColor="#22d3ee"/><stop offset="1" stopColor="#a855f7"/></linearGradient>
        <filter id="fibGlow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>

      {Array.from({ length: 11 }).map((_, index) => <line key={`v-${index}`} x1={40 + index * 84} y1="28" x2={40 + index * 84} y2="612" stroke="#25304a" strokeWidth="1" opacity=".35" />)}
      {Array.from({ length: 8 }).map((_, index) => <line key={`h-${index}`} x1="32" y1={54 + index * 74} x2="1168" y2={54 + index * 74} stroke="#25304a" strokeWidth="1" opacity=".28" />)}

      <rect x="32" y="376" width="838" height="46" fill="#facc15" opacity=".11" stroke="#facc15" strokeWidth="2" />
      <text x="46" y="397" fill="#fde047" fontSize="13" fontWeight="700">61.8%–70.5% GOLDEN ENTRY ZONE</text>
      <text x="46" y="414" fill="#cbd5e1" fontSize="10">Reaction area only · wait for candle rejection and confirmation</text>

      {levels.map((item) => (
        <g key={item.level}>
          <line x1="32" y1={item.y} x2="884" y2={item.y} stroke={item.color} strokeWidth={item.level === '61.8%' || item.level === '70.5%' ? 2 : 1.25} strokeDasharray={item.dash} opacity=".9" />
          <rect x="884" y={item.y - 20} width="276" height="40" rx="6" fill="#11172b" stroke={item.color} strokeOpacity=".48" />
          <text x="898" y={item.y - 3} fill={item.color} fontSize="12" fontWeight="700">{item.level} · {item.name}</text>
          <text x="898" y={item.y + 13} fill="#94a3b8" fontSize="10">Example price {item.price}</text>
        </g>
      ))}

      <line x1="132" y1="576" x2="462" y2="54" stroke="url(#fibMarkup)" strokeWidth="3" opacity=".9" />
      <circle cx="132" cy="576" r="7" fill="#070b1c" stroke="#22d3ee" strokeWidth="3" filter="url(#fibGlow)" />
      <circle cx="462" cy="54" r="7" fill="#070b1c" stroke="#a855f7" strokeWidth="3" filter="url(#fibGlow)" />

      {candles.map(([x, open, close, low, high], index) => {
        const rising = close < open;
        const top = Math.min(open, close);
        const height = Math.max(6, Math.abs(close - open));
        const color = rising ? '#06b6d4' : '#e2e8f0';
        return <g key={x}><line x1={x} y1={high} x2={x} y2={low} stroke={color} strokeWidth="2"/><rect x={x - 7} y={top} width="14" height={height} fill={color} rx="1" opacity={index > 14 ? '.96' : '1'} /></g>;
      })}

      <g transform="translate(54 590)"><rect width="230" height="36" rx="7" fill="#06263a" stroke="#22d3ee" strokeOpacity=".55"/><text x="12" y="15" fill="#67e8f9" fontSize="11" fontWeight="700">1 · START AT SWING LOW</text><text x="12" y="28" fill="#94a3b8" fontSize="9">Drag upward for a bullish markup</text></g>
      <g transform="translate(336 12)"><rect width="250" height="36" rx="7" fill="#1b1235" stroke="#c084fc" strokeOpacity=".55"/><text x="12" y="15" fill="#d8b4fe" fontSize="11" fontWeight="700">2 · END AT SWING HIGH</text><text x="12" y="28" fill="#94a3b8" fontSize="9">0% is shown here; 100% stays below</text></g>
    </svg>
  );
}

const pineScript = String.raw`//@version=6
strategy("Asheparte AI Combined v59: Trend + Reversal", overlay = true, pyramiding = 0,
     initial_capital = 10000,
     default_qty_type = strategy.percent_of_equity,
     default_qty_value = 0.5,
     commission_type = strategy.commission.percent,
     commission_value = 0.05,
     calc_on_every_tick = true,
     calc_on_order_fills = true,
     process_orders_on_close = true,
     max_bars_back = 600,
     max_labels_count = 300,
     max_lines_count = 100,
     max_boxes_count = 100)

// One strategy slot, two independently switchable engines.
enableTrend = input.bool(true, "Enable confirmed trend setups", group = "Engines")
enableReversal = input.bool(true, "Enable reversal scout", group = "Engines")
autoConfirmationTimeframe = input.bool(true, "Auto confirmation timeframe", group = "Shared filters")
manualConfirmationTimeframe = input.timeframe("15", "Manual confirmation timeframe", group = "Shared filters")
rsiLength = input.int(14, "RSI length", minval = 2, group = "Shared filters")
atrLength = input.int(14, "ATR length", minval = 2, group = "Shared filters")
rewardRisk = input.float(2.14, "Final TP3 reward / risk", minval = 1.5, maxval = 10.0, step = 0.01, group = "Shared filters")

fastLength = input.int(20, "Fast EMA", minval = 2, group = "Confirmed trend engine")
slowLength = input.int(50, "Slow EMA", minval = 3, group = "Confirmed trend engine")
trendAtrMultiple = input.float(1.5, "ATR stop multiple", minval = 0.5, step = 0.1, group = "Confirmed trend engine")
slopeBars = input.int(3, "EMA slope lookback", minval = 1, group = "Confirmed trend engine")
cooldownBars = input.int(10, "Bars between trend setups", minval = 1, group = "Confirmed trend engine")
useDefendedTrendEntry = input.bool(true, "Require pullback + defended reclaim", group = "Confirmed trend engine")
trendPullbackBufferATR = input.float(0.35, "Pullback touch buffer in ATR", minval = 0.05, maxval = 1.00, step = 0.05, group = "Confirmed trend engine")
trendMaximumRangeATR = input.float(1.25, "Maximum reclaim candle range in ATR", minval = 0.50, maxval = 3.00, step = 0.05, group = "Confirmed trend engine")
trendMinimumBodyShare = input.float(0.40, "Minimum reclaim candle body share", minval = 0.20, maxval = 0.80, step = 0.05, group = "Confirmed trend engine")

enableLowerTFPrecision = input.bool(true, "Require closed 15m + 1H alignment on 1m–5m", group = "1m / 5m Precision Gate")
lowerTFMinimumRoomR = input.float(1.50, "Minimum room to next liquidity level (R)", minval = 1.00, maxval = 4.00, step = 0.10, group = "1m / 5m Precision Gate")
lowerTFBullishRSI = input.float(52.0, "Minimum bullish MTF RSI", minval = 50.0, maxval = 65.0, step = 0.5, group = "1m / 5m Precision Gate")
lowerTFBearishRSI = input.float(48.0, "Maximum bearish MTF RSI", minval = 35.0, maxval = 50.0, step = 0.5, group = "1m / 5m Precision Gate")
showNoRoomMarks = input.bool(true, "Show WAIT · NO ROOM marks", group = "1m / 5m Precision Gate")

enableOneHourPrecision = input.bool(true, "Use 1H pullback + rejection entries", group = "1H Precision Entry")
precisionPullbackBufferATR = input.float(0.20, "20 EMA touch buffer in ATR", minval = 0.05, maxval = 1.00, step = 0.05, group = "1H Precision Entry")
precisionMaxEntryDistanceATR = input.float(0.45, "Maximum close distance from 20 EMA in ATR", minval = 0.10, maxval = 1.50, step = 0.05, group = "1H Precision Entry")
precisionStopBufferATR = input.float(0.10, "Stop buffer beyond rejection candle in ATR", minval = 0.02, maxval = 0.50, step = 0.01, group = "1H Precision Entry")

minimumWickBody = input.float(1.5, "Minimum wick / body", minval = 0.5, step = 0.1, group = "Reversal scout")
expiryBars = input.int(3, "Entry expiry bars", minval = 1, maxval = 10, group = "Reversal scout")
tradeSession = input.session("0700-1700", "Active session in UTC", group = "Reversal scout")

enableReentry = input.bool(true, "Enable post-SL reset scan", group = "Controlled re-entry")
reentryWaitBars = input.int(1, "Closed candles to wait after SL", minval = 1, maxval = 10, group = "Controlled re-entry")
reentryScanBars = input.int(12, "Post-SL direction scan bars", minval = 2, maxval = 50, group = "Controlled re-entry")
reentryExpiryBars = input.int(2, "Re-entry trigger expiry bars", minval = 1, maxval = 10, group = "Controlled re-entry")
reentrySizeMultiplier = input.float(0.50, "Re-entry size multiplier", minval = 0.10, maxval = 1.00, step = 0.05, group = "Controlled re-entry")

enableOneMinuteRecoveryFlip = input.bool(true, "Enable confirmed 1m failure flip", group = "1m Auto Recovery")
oneMinuteFlipRSI = input.float(45.0, "Opposite RSI confirmation", minval = 35.0, maxval = 50.0, step = 0.5, group = "1m Auto Recovery")
oneMinuteFlipStopBufferATR = input.float(0.10, "Fresh SL buffer in ATR", minval = 0.02, maxval = 0.50, step = 0.01, group = "1m Auto Recovery")

showTradeHealth = input.bool(true, "Show active-trade health warnings", group = "Active Trade Health")
tp1ApproachPercent = input.float(0.75, "TP1 approach threshold", minval = 0.50, maxval = 0.95, step = 0.05, group = "Active Trade Health")
tp1GivebackPercent = input.float(0.35, "TP1 failure giveback level", minval = 0.10, maxval = 0.60, step = 0.05, group = "Active Trade Health")
halfStopPercent = input.float(0.50, "Half-to-SL warning level", minval = 0.25, maxval = 0.75, step = 0.05, group = "Active Trade Health")
protectAfterTP1 = input.bool(true, "Protect remaining position after TP1", group = "Active Trade Health")
tp1ProfitLockR = input.float(0.10, "Remaining-position profit lock (R)", minval = 0.00, maxval = 0.50, step = 0.05, group = "Active Trade Health")

showBadEntryGuard = input.bool(true, "Show bad-entry warnings", group = "Bad Entry Guard")
chaseDistanceATR = input.float(1.35, "No-chase distance from fast EMA in ATR", minval = 0.50, maxval = 5.00, step = 0.05, group = "Bad Entry Guard")
badEntryCooldownBars = input.int(4, "Bars between warning labels", minval = 1, maxval = 50, group = "Bad Entry Guard")

enableShockGuard = input.bool(true, "Enable volatility shock pause", group = "Volatility Shock Guard")
shockRangeATR = input.float(2.00, "Shock candle range in ATR", minval = 1.00, maxval = 10.00, step = 0.10, group = "Volatility Shock Guard")
shockGapATR = input.float(0.75, "Shock opening gap in ATR", minval = 0.25, maxval = 5.00, step = 0.05, group = "Volatility Shock Guard")
shockPauseBars = input.int(3, "Closed candles to pause after shock", minval = 1, maxval = 20, group = "Volatility Shock Guard")
maxDailyLossPercent = input.float(2.00, "Strategy daily-loss lock (%)", minval = 0.10, maxval = 100.00, step = 0.10, group = "Volatility Shock Guard")

requireMetalSync = input.bool(true, "Require Gold / Silver sync for entries", group = "Gold / Silver Sync")
showMetalSyncMarks = input.bool(false, "Show sync state-change marks", group = "Gold / Silver Sync")
goldSyncSymbol = input.symbol("OANDA:XAUUSD", "Gold symbol", group = "Gold / Silver Sync")
silverSyncSymbol = input.symbol("OANDA:XAGUSD", "Silver symbol", group = "Gold / Silver Sync")
syncLookbackBars = input.int(5, "Direction lookback bars", minval = 2, maxval = 50, group = "Gold / Silver Sync")
syncCorrelationLength = input.int(20, "Correlation length", minval = 5, maxval = 100, group = "Gold / Silver Sync")
syncMinimumCorrelation = input.float(0.25, "Minimum correlation", minval = -1.00, maxval = 1.00, step = 0.05, group = "Gold / Silver Sync")

// TradingView's strategy-wide circuit breaker cancels pending orders, closes an
// open simulated position and blocks additional orders for the session at this loss.
strategy.risk.max_intraday_loss(maxDailyLossPercent, strategy.percent_of_equity, "Asheparte AI daily-loss lock")

pivotLength = input.int(5, "Liquidity / structure swing length", minval = 2, maxval = 30, group = "Automatic chart map")
simpleChartMode = input.bool(true, "Simple chart mode (recommended)", group = "Automatic chart map")
showLiquidity = input.bool(true, "Show confirmed liquidity levels", group = "Automatic chart map")
showStructure = input.bool(false, "Show HH / HL / LH / LL", group = "Automatic chart map")
showTradePlan = input.bool(true, "Show Entry / TP / SL zones", group = "Automatic chart map")
showTimeframeSync = input.bool(true, "Show timeframe sync panel", group = "Automatic chart map")
showPriorityMarks = input.bool(true, "Show confirmed BUY / SELL marks", group = "Automatic chart map")
structureStopLookback = input.int(7, "Trend structural stop lookback", minval = 2, maxval = 50, group = "Automatic chart map")
planBars = input.int(25, "Keep projected plan for bars", minval = 5, maxval = 200, group = "Automatic chart map")

showAutoFibonacci = input.bool(true, "Show automatic swing Fibonacci", group = "Automatic Fibonacci")
showFibonacciLabels = input.bool(false, "Show Fibonacci level names", group = "Automatic Fibonacci")
showFibonacciRejections = input.bool(true, "Mark confirmed golden-zone rejection", group = "Automatic Fibonacci")
carryFibonacciAcrossSessions = input.bool(true, "Carry confirmed swings across session breaks", group = "Automatic Fibonacci")
fibonacciLowerPivotLength = input.int(8, "1m–15m confirmed pivot length", minval = 3, maxval = 30, group = "Automatic Fibonacci")
fibonacciProjectionBars = input.int(35, "Project levels for bars", minval = 10, maxval = 200, group = "Automatic Fibonacci")
fibonacciSignalCooldown = input.int(5, "Bars between rejection watches", minval = 1, maxval = 50, group = "Automatic Fibonacci")

showDetailedVolumeProfile = input.bool(true, "Show detailed volume profile", group = "Detailed Volume Profile")
volumeProfileLookback = input.int(120, "Profile lookback bars", minval = 30, maxval = 500, group = "Detailed Volume Profile")
volumeProfileRows = input.int(16, "Profile rows", minval = 8, maxval = 40, group = "Detailed Volume Profile")
volumeProfileValueArea = input.float(70.0, "Value area percent", minval = 50.0, maxval = 90.0, step = 1.0, group = "Detailed Volume Profile")
volumeProfileWidthBars = input.int(12, "Maximum profile width in bars", minval = 5, maxval = 40, group = "Detailed Volume Profile")
showVolumeProfileLabels = input.bool(false, "Show VAH / VAL labels", group = "Detailed Volume Profile")

enable15mManipulation = input.bool(true, "Enable 15m manipulation detector", group = "15m Manipulation + Blow-off")
manipulationMinimumWick = input.float(0.45, "Manipulation wick share", minval = 0.25, maxval = 0.80, step = 0.05, group = "15m Manipulation + Blow-off")
blowOffRangeATR = input.float(2.20, "Blow-off candle range in ATR", minval = 1.50, maxval = 5.00, step = 0.10, group = "15m Manipulation + Blow-off")
blowOffDistanceATR = input.float(2.00, "Minimum extension from EMA in ATR", minval = 0.50, maxval = 6.00, step = 0.10, group = "15m Manipulation + Blow-off")
blowOffVolumeMultiple = input.float(1.80, "Tick-volume multiple", minval = 1.00, maxval = 5.00, step = 0.10, group = "15m Manipulation + Blow-off")
requireBlowOffVolume = input.bool(true, "Require tick-volume spike", group = "15m Manipulation + Blow-off")
manipulationCooldownBars = input.int(6, "Bars between warnings", minval = 1, maxval = 30, group = "15m Manipulation + Blow-off")

showFourStageCycle = input.bool(true, "Show consolidation → sweep → move → entry", group = "M15 / H1 Four-stage confirmation")
cycleRangeBars = input.int(24, "Consolidation lookback bars", minval = 12, maxval = 80, group = "M15 / H1 Four-stage confirmation")
cycleProfileBins = input.int(20, "POC profile bins", minval = 8, maxval = 40, group = "M15 / H1 Four-stage confirmation")
cycleMaximumRangeATR = input.float(2.40, "Maximum consolidation width in ATR", minval = 0.80, maxval = 6.00, step = 0.10, group = "M15 / H1 Four-stage confirmation")
cycleSweepBufferATR = input.float(0.08, "Sweep distance in ATR", minval = 0.01, maxval = 0.50, step = 0.01, group = "M15 / H1 Four-stage confirmation")
cycleDisplacementATR = input.float(0.55, "Distribution / move distance from POC in ATR", minval = 0.20, maxval = 2.00, step = 0.05, group = "M15 / H1 Four-stage confirmation")
cyclePOCToleranceATR = input.float(0.18, "POC retest tolerance in ATR", minval = 0.05, maxval = 0.60, step = 0.01, group = "M15 / H1 Four-stage confirmation")
cycleExpiryBars = input.int(18, "Expire unfinished cycle after bars", minval = 5, maxval = 80, group = "M15 / H1 Four-stage confirmation")

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

// Closed multi-timeframe stack for 1m–5m entries. Each value uses the previous
// completed source candle, so a forming 15m or 1H candle cannot flip the gate.
[confirmedM15Close, confirmedM15FastEMA, confirmedM15SlowEMA, confirmedM15RSI] = request.security(syminfo.tickerid, "15", [close[1], ta.ema(close, fastLength)[1], ta.ema(close, slowLength)[1], ta.rsi(close, rsiLength)[1]], lookahead = barmerge.lookahead_on)
[confirmedH1Close, confirmedH1FastEMA, confirmedH1SlowEMA, confirmedH1RSI] = request.security(syminfo.tickerid, "60", [close[1], ta.ema(close, fastLength)[1], ta.ema(close, slowLength)[1], ta.rsi(close, rsiLength)[1]], lookahead = barmerge.lookahead_on)
lowerTimeframePrecisionActive = enableLowerTFPrecision and timeframe.in_seconds() <= 300
lowerTFLongStack = confirmedM15Close > confirmedM15FastEMA and confirmedM15FastEMA > confirmedM15SlowEMA and confirmedM15RSI >= lowerTFBullishRSI and confirmedH1Close > confirmedH1FastEMA and confirmedH1FastEMA > confirmedH1SlowEMA and confirmedH1RSI >= lowerTFBullishRSI
lowerTFShortStack = confirmedM15Close < confirmedM15FastEMA and confirmedM15FastEMA < confirmedM15SlowEMA and confirmedM15RSI <= lowerTFBearishRSI and confirmedH1Close < confirmedH1FastEMA and confirmedH1FastEMA < confirmedH1SlowEMA and confirmedH1RSI <= lowerTFBearishRSI

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

// Evaluate this history-dependent series on every calculation. Reusing the
// result inside the exit block avoids TradingView's consistency warning.
closedTradesChange = ta.change(strategy.closedtrades)
closedTradeThisBar = closedTradesChange > 0
lastClosedTradeNumber = strategy.closedtrades - 1
lastExitComment = strategy.closedtrades > 0 ? strategy.closedtrades.exit_comment(lastClosedTradeNumber) : ""
stopClosedThisBar = closedTradeThisBar and lastExitComment == "SL"
failureClosedThisBar = closedTradeThisBar and lastExitComment == "1M FAIL FLIP"

// Confirmed trend engine.
var int lastTrendBar = na
trendCooldownOK = na(lastTrendBar) or bar_index - lastTrendBar > cooldownBars
oneHourChart = timeframe.in_seconds() == 3600
oneHourPrecisionActive = enableOneHourPrecision and oneHourChart
oneMinuteChart = timeframe.in_seconds() == 60
fiveMinuteChart = timeframe.in_seconds() == 300
oneMinuteRecoveryActive = enableOneMinuteRecoveryFlip and oneMinuteChart
signalBody = math.max(math.abs(close - open), syminfo.mintick)
signalLowerWick = math.min(open, close) - low
signalUpperWick = high - math.max(open, close)
signalRange = high - low
signalBodyShare = signalBody / math.max(signalRange, syminfo.mintick)
oneHourLongBias = fastEMA > slowEMA and slowSlopeUp and higherTrendUp and trendVolatilityOK and metalSyncLongOK
oneHourShortBias = fastEMA < slowEMA and slowSlopeDown and higherTrendDown and trendVolatilityOK and metalSyncShortOK
oneHourLongRetest = oneHourLongBias and low <= fastEMA + atrValue * precisionPullbackBufferATR and close > fastEMA and close > slowEMA and close > open and signalLowerWick / signalBody >= 0.35 and close - fastEMA <= atrValue * precisionMaxEntryDistanceATR and rsiValue >= 52 and rsiValue <= 68 and signalRange <= atrValue * 1.50
oneHourShortRetest = oneHourShortBias and high >= fastEMA - atrValue * precisionPullbackBufferATR and close < fastEMA and close < slowEMA and close < open and signalUpperWick / signalBody >= 0.35 and fastEMA - close <= atrValue * precisionMaxEntryDistanceATR and rsiValue <= 48 and rsiValue >= 32 and signalRange <= atrValue * 1.50
longPullbackCandle = close[1] < open[1] and low[1] <= fastEMA[1] + atrValue[1] * trendPullbackBufferATR
shortPullbackCandle = close[1] > open[1] and high[1] >= fastEMA[1] - atrValue[1] * trendPullbackBufferATR
longDefendedReclaim = longPullbackCandle and close > open and close > high[1] and close > fastEMA and close > slowEMA and signalBodyShare >= trendMinimumBodyShare and signalRange <= atrValue * trendMaximumRangeATR and close - fastEMA <= atrValue * 0.75 and rsiValue >= 52 and rsiValue <= 68
shortDefendedReclaim = shortPullbackCandle and close < open and close < low[1] and close < fastEMA and close < slowEMA and signalBodyShare >= trendMinimumBodyShare and signalRange <= atrValue * trendMaximumRangeATR and fastEMA - close <= atrValue * 0.75 and rsiValue <= 48 and rsiValue >= 32
standardTrendLongSignal = fastEMA > slowEMA and slowSlopeUp and trendVolatilityOK and higherTrendUp and metalSyncLongOK and (useDefendedTrendEntry ? longDefendedReclaim : fastCrossUp and rsiValue > 55)
standardTrendShortSignal = fastEMA < slowEMA and slowSlopeDown and trendVolatilityOK and higherTrendDown and metalSyncShortOK and (useDefendedTrendEntry ? shortDefendedReclaim : fastCrossDown and rsiValue < 45)
trendLongSetup = enableTrend and decisionBarReady and not shockPauseActive and not stopClosedThisBar and not failureClosedThisBar and strategy.position_size == 0 and trendCooldownOK and (oneHourPrecisionActive ? oneHourLongRetest : standardTrendLongSignal)
trendShortSetup = enableTrend and decisionBarReady and not shockPauseActive and not stopClosedThisBar and not failureClosedThisBar and strategy.position_size == 0 and trendCooldownOK and (oneHourPrecisionActive ? oneHourShortRetest : standardTrendShortSignal)

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
var int previousPivotHighBar = na
var int previousPivotLowBar = na

if not na(pivotHigh)
    if showStructure and not simpleChartMode and not na(previousPivotHigh)
        highStructureText = pivotHigh > previousPivotHigh ? "HH" : "LH"
        highStructureColor = pivotHigh > previousPivotHigh ? color.lime : color.orange
        label.new(bar_index - pivotLength, pivotHigh, highStructureText, style = label.style_label_down, color = color.new(highStructureColor, 12), textcolor = color.black, size = size.tiny)
    previousPivotHigh := pivotHigh
    previousPivotHighBar := bar_index - pivotLength

if not na(pivotLow)
    if showStructure and not simpleChartMode and not na(previousPivotLow)
        lowStructureText = pivotLow > previousPivotLow ? "HL" : "LL"
        lowStructureColor = pivotLow > previousPivotLow ? color.aqua : color.red
        label.new(bar_index - pivotLength, pivotLow, lowStructureText, style = label.style_label_up, color = color.new(lowStructureColor, 12), textcolor = color.black, size = size.tiny)
    previousPivotLow := pivotLow
    previousPivotLowBar := bar_index - pivotLength

// Track each exchange-day session as a complete high-to-low swing. At the first
// bar of a new session, the finished session is frozen and projected forward.
// This prevents small pivots in the active session from replacing the intended
// prior-session Fibonacci map.
newFibonacciSession = timeframe.change("D")
var float fibonacciCurrentSessionHigh = na
var float fibonacciCurrentSessionLow = na
var int fibonacciCurrentSessionHighBar = na
var int fibonacciCurrentSessionLowBar = na
var int fibonacciCurrentSessionStartBar = na
var float fibonacciPreviousSessionHigh = na
var float fibonacciPreviousSessionLow = na
var int fibonacciPreviousSessionHighBar = na
var int fibonacciPreviousSessionLowBar = na
var int fibonacciPreviousSessionStartBar = na
var int fibonacciPreviousSessionEndBar = na

if barstate.isfirst
    fibonacciCurrentSessionHigh := high
    fibonacciCurrentSessionLow := low
    fibonacciCurrentSessionHighBar := bar_index
    fibonacciCurrentSessionLowBar := bar_index
    fibonacciCurrentSessionStartBar := bar_index
else if newFibonacciSession
    fibonacciPreviousSessionHigh := fibonacciCurrentSessionHigh
    fibonacciPreviousSessionLow := fibonacciCurrentSessionLow
    fibonacciPreviousSessionHighBar := fibonacciCurrentSessionHighBar
    fibonacciPreviousSessionLowBar := fibonacciCurrentSessionLowBar
    fibonacciPreviousSessionStartBar := fibonacciCurrentSessionStartBar
    fibonacciPreviousSessionEndBar := bar_index - 1
    fibonacciCurrentSessionHigh := high
    fibonacciCurrentSessionLow := low
    fibonacciCurrentSessionHighBar := bar_index
    fibonacciCurrentSessionLowBar := bar_index
    fibonacciCurrentSessionStartBar := bar_index
else
    if na(fibonacciCurrentSessionHigh) or high >= fibonacciCurrentSessionHigh
        fibonacciCurrentSessionHigh := high
        fibonacciCurrentSessionHighBar := bar_index
    if na(fibonacciCurrentSessionLow) or low <= fibonacciCurrentSessionLow
        fibonacciCurrentSessionLow := low
        fibonacciCurrentSessionLowBar := bar_index

// Keep a second, optional latest-pivot mode. With cross-session carry enabled,
// an overnight, weekend or broker-session gap does not erase these anchors.
expectedBarMilliseconds = timeframe.in_seconds() * 1000
fibonacciSessionBreak = timeframe.isintraday and not na(time[1]) and time - time[1] > expectedBarMilliseconds * 3
var float fibonacciPivotHigh = na
var float fibonacciPivotLow = na
var int fibonacciPivotHighBar = na
var int fibonacciPivotLowBar = na
fibonacciLowerPivotHigh = ta.pivothigh(high, fibonacciLowerPivotLength, fibonacciLowerPivotLength)
fibonacciLowerPivotLow = ta.pivotlow(low, fibonacciLowerPivotLength, fibonacciLowerPivotLength)

if fibonacciSessionBreak and not carryFibonacciAcrossSessions
    fibonacciPivotHigh := na
    fibonacciPivotLow := na
    fibonacciPivotHighBar := na
    fibonacciPivotLowBar := na

if not na(fibonacciLowerPivotHigh)
    fibonacciPivotHigh := fibonacciLowerPivotHigh
    fibonacciPivotHighBar := bar_index - fibonacciLowerPivotLength

if not na(fibonacciLowerPivotLow)
    fibonacciPivotLow := fibonacciLowerPivotLow
    fibonacciPivotLowBar := bar_index - fibonacciLowerPivotLength

previousSessionFibReady = timeframe.isintraday and not na(fibonacciPreviousSessionHigh) and not na(fibonacciPreviousSessionLow) and not na(fibonacciPreviousSessionHighBar) and not na(fibonacciPreviousSessionLowBar) and fibonacciPreviousSessionHigh != fibonacciPreviousSessionLow
fibonacciTimeframeSeconds = timeframe.in_seconds()
fibonacciLowerTimeframe = timeframe.isintraday and fibonacciTimeframeSeconds >= 60 and fibonacciTimeframeSeconds <= 900
fibonacciPreviousSessionTimeframe = timeframe.isintraday and fibonacciTimeframeSeconds >= 1800 and fibonacciTimeframeSeconds <= 3600
fibonacciTimeframeSupported = fibonacciLowerTimeframe or fibonacciPreviousSessionTimeframe
usePreviousSessionFib = fibonacciPreviousSessionTimeframe and previousSessionFibReady
fibSelectedHigh = usePreviousSessionFib ? fibonacciPreviousSessionHigh : fibonacciPivotHigh
fibSelectedLow = usePreviousSessionFib ? fibonacciPreviousSessionLow : fibonacciPivotLow
fibSelectedHighBar = usePreviousSessionFib ? fibonacciPreviousSessionHighBar : fibonacciPivotHighBar
fibSelectedLowBar = usePreviousSessionFib ? fibonacciPreviousSessionLowBar : fibonacciPivotLowBar

// For a bullish markup, 0% sits at the swing high and 100% at the swing low.
// A bearish markup is mirrored from low back to high.
fibReady = showAutoFibonacci and fibonacciTimeframeSupported and not na(fibSelectedHigh) and not na(fibSelectedLow) and not na(fibSelectedHighBar) and not na(fibSelectedLowBar) and fibSelectedHigh != fibSelectedLow
fibBullishMove = fibReady and fibSelectedHighBar > fibSelectedLowBar
fibBearishMove = fibReady and fibSelectedLowBar > fibSelectedHighBar
fibAnchorZero = fibBullishMove ? fibSelectedHigh : fibBearishMove ? fibSelectedLow : na
fibAnchorOne = fibBullishMove ? fibSelectedLow : fibBearishMove ? fibSelectedHigh : na
fibRange = math.abs(fibSelectedHigh - fibSelectedLow)

getFibPrice(level) =>
    fibAnchorZero + (fibAnchorOne - fibAnchorZero) * level

fibZero = fibReady ? getFibPrice(0.0) : na
fib236 = fibReady ? getFibPrice(0.236) : na
fib382 = fibReady ? getFibPrice(0.382) : na
fib500 = fibReady ? getFibPrice(0.500) : na
fib618 = fibReady ? getFibPrice(0.618) : na
fib705 = fibReady ? getFibPrice(0.705) : na
fib786 = fibReady ? getFibPrice(0.786) : na
fibOne = fibReady ? getFibPrice(1.0) : na
fibGoldenTop = fibReady ? math.max(fib618, fib705) : na
fibGoldenBottom = fibReady ? math.min(fib618, fib705) : na
fibTouchesGoldenZone = fibReady and low <= fibGoldenTop and high >= fibGoldenBottom

var int lastFibonacciWatchBar = na
fibonacciWatchCooldownOK = na(lastFibonacciWatchBar) or bar_index - lastFibonacciWatchBar > fibonacciSignalCooldown
fibLongRejection = showFibonacciRejections and decisionBarReady and fibonacciWatchCooldownOK and fibBullishMove and fibTouchesGoldenZone and close > open and close >= fib618 and higherTrendUp and fastEMA > slowEMA and metalSyncLongOK and not shockPauseActive
fibShortRejection = showFibonacciRejections and decisionBarReady and fibonacciWatchCooldownOK and fibBearishMove and fibTouchesGoldenZone and close < open and close <= fib618 and higherTrendDown and fastEMA < slowEMA and metalSyncShortOK and not shockPauseActive

if fibLongRejection or fibShortRejection
    lastFibonacciWatchBar := bar_index

rsiRecentLow = ta.lowest(rsiValue, 4)
rsiRecentHigh = ta.highest(rsiValue, 4)
sweptLow = not na(priorSwingLow) and low < priorSwingLow and close > priorSwingLow
sweptHigh = not na(priorSwingHigh) and high > priorSwingHigh and close < priorSwingHigh

// 15-minute manipulation and blow-off detector. These marks wait for the
// candle to close and block a same-bar setup, but never create a reverse trade.
fifteenMinuteChart = timeframe.in_seconds() == 900
manipulationRange = math.max(high - low, syminfo.mintick)
manipulationUpperWickShare = upperWick / manipulationRange
manipulationLowerWickShare = lowerWick / manipulationRange
manipulationCloseLocation = (close - low) / manipulationRange
manipulationVolumeAverage = ta.sma(volume, 20)
manipulationVolumeSpike = not na(manipulationVolumeAverage) and manipulationVolumeAverage > 0 and volume >= manipulationVolumeAverage * blowOffVolumeMultiple
blowOffVolumeOK = not requireBlowOffVolume or manipulationVolumeSpike

rawBuySideManipulation = sweptHigh and manipulationUpperWickShare >= manipulationMinimumWick and manipulationCloseLocation <= 0.45
rawSellSideManipulation = sweptLow and manipulationLowerWickShare >= manipulationMinimumWick and manipulationCloseLocation >= 0.55
rawBlowOffTop = high - fastEMA >= atrValue * blowOffDistanceATR and manipulationRange >= atrValue * blowOffRangeATR and manipulationUpperWickShare >= 0.30 and manipulationCloseLocation <= 0.55 and fastEMA > slowEMA and blowOffVolumeOK
rawBlowOffBottom = fastEMA - low >= atrValue * blowOffDistanceATR and manipulationRange >= atrValue * blowOffRangeATR and manipulationLowerWickShare >= 0.30 and manipulationCloseLocation >= 0.45 and fastEMA < slowEMA and blowOffVolumeOK

var int lastManipulationWarningBar = na
manipulationCooldownOK = na(lastManipulationWarningBar) or bar_index - lastManipulationWarningBar > manipulationCooldownBars
blowOffTop = enable15mManipulation and fifteenMinuteChart and decisionBarReady and manipulationCooldownOK and rawBlowOffTop
blowOffBottom = enable15mManipulation and fifteenMinuteChart and decisionBarReady and manipulationCooldownOK and not blowOffTop and rawBlowOffBottom
buySideManipulation = enable15mManipulation and fifteenMinuteChart and decisionBarReady and manipulationCooldownOK and not blowOffTop and not blowOffBottom and rawBuySideManipulation
sellSideManipulation = enable15mManipulation and fifteenMinuteChart and decisionBarReady and manipulationCooldownOK and not blowOffTop and not blowOffBottom and not buySideManipulation and rawSellSideManipulation
fifteenMinuteRiskDetected = blowOffTop or blowOffBottom or buySideManipulation or sellSideManipulation

if fifteenMinuteRiskDetected
    lastManipulationWarningBar := bar_index

// A detected exhaustion/manipulation bar is a no-new-entry candle.
trendLongSetup := trendLongSetup and not fifteenMinuteRiskDetected
trendShortSetup := trendShortSetup and not fifteenMinuteRiskDetected

// M15/H1 four-stage confirmation. Tick volume is distributed into price bins
// to estimate a local POC; it is an approximation, not TradingView's paid
// Volume Profile. A trade needs: range, sweep, displacement and a later defended
// POC retest. This prevents a first-touch entry while continuation is unresolved.
estimateCyclePOC(firstOffset, count, lowBound, highBound, bins) =>
    float result = na
    profileWidth = highBound - lowBound
    if profileWidth > syminfo.mintick
        profile = array.new_float(bins, 0.0)
        for profileOffset = 0 to count - 1
            profilePrice = (high[firstOffset + profileOffset] + low[firstOffset + profileOffset] + close[firstOffset + profileOffset]) / 3.0
            rawBin = int(math.floor((profilePrice - lowBound) / profileWidth * bins))
            safeBin = math.max(0, math.min(bins - 1, rawBin))
            array.set(profile, safeBin, array.get(profile, safeBin) + nz(volume[firstOffset + profileOffset], 1))
        strongestBin = 0
        strongestVolume = array.get(profile, 0)
        for profileBin = 1 to bins - 1
            binVolume = array.get(profile, profileBin)
            if binVolume > strongestVolume
                strongestVolume := binVolume
                strongestBin := profileBin
        result := lowBound + profileWidth * (strongestBin + 0.5) / bins
    result

cycleTimeframe = fifteenMinuteChart or oneHourChart
cycleCandidateHigh = ta.highest(high[2], cycleRangeBars)
cycleCandidateLow = ta.lowest(low[2], cycleRangeBars)
cycleCandidateWidth = cycleCandidateHigh - cycleCandidateLow
cycleCandidatePOC = estimateCyclePOC(2, cycleRangeBars, cycleCandidateLow, cycleCandidateHigh, cycleProfileBins)
cycleCandidateValid = cycleTimeframe and decisionBarReady and not na(cycleCandidatePOC) and cycleCandidateWidth > syminfo.mintick * 10 and cycleCandidateWidth <= atrValue * cycleMaximumRangeATR

var int cycleStage = 0
var int cycleDirection = 0
var int cycleStartedBar = na
var int cycleSweepBar = na
var int cycleMoveBar = na
var int cycleLastExitBar = na
var float cycleHigh = na
var float cycleLow = na
var float cyclePOC = na
var box cycleRangeBox = na
var box cycleSweepBox = na
var box cycleMoveBox = na
var box cycleEntryBox = na
var line cyclePOCLine = na
var label cycleRangeLabel = na
var label cycleSweepLabel = na
var label cycleMoveLabel = na

cycleMayStart = cycleCandidateValid and strategy.position_size == 0 and (na(cycleLastExitBar) or bar_index > cycleLastExitBar + 1)
if cycleStage == 0 and cycleMayStart
    cycleStage := 1
    cycleDirection := 0
    cycleStartedBar := bar_index - cycleRangeBars - 1
    cycleHigh := cycleCandidateHigh
    cycleLow := cycleCandidateLow
    cyclePOC := cycleCandidatePOC
    if showFourStageCycle
        if not na(cycleRangeBox)
            box.delete(cycleRangeBox)
        if not na(cycleSweepBox)
            box.delete(cycleSweepBox)
        if not na(cycleMoveBox)
            box.delete(cycleMoveBox)
        if not na(cycleEntryBox)
            box.delete(cycleEntryBox)
        if not na(cyclePOCLine)
            line.delete(cyclePOCLine)
        if not na(cycleRangeLabel)
            label.delete(cycleRangeLabel)
        if not na(cycleSweepLabel)
            label.delete(cycleSweepLabel)
        if not na(cycleMoveLabel)
            label.delete(cycleMoveLabel)
        cycleRangeBox := box.new(cycleStartedBar, cycleHigh, bar_index, cycleLow, border_color = color.aqua, bgcolor = color.new(color.aqua, 92))
        cyclePOCLine := line.new(cycleStartedBar, cyclePOC, bar_index, cyclePOC, color = color.yellow, width = 2, style = line.style_dashed)
        cycleRangeLabel := label.new(cycleStartedBar, cycleHigh, "1 CONSOLIDATION", style = label.style_label_down, color = color.new(color.aqua, 12), textcolor = color.black, size = size.tiny)

if cycleStage > 0 and showFourStageCycle
    if not na(cycleRangeBox)
        box.set_right(cycleRangeBox, bar_index)
    if not na(cyclePOCLine)
        line.set_x2(cyclePOCLine, bar_index)

cycleSweptLow = cycleStage == 1 and bar_index > cycleStartedBar + cycleRangeBars and low < cycleLow - atrValue * cycleSweepBufferATR and close > cycleLow
cycleSweptHigh = cycleStage == 1 and bar_index > cycleStartedBar + cycleRangeBars and high > cycleHigh + atrValue * cycleSweepBufferATR and close < cycleHigh
if cycleSweptLow or cycleSweptHigh
    cycleStage := 2
    cycleDirection := cycleSweptLow ? 1 : -1
    cycleSweepBar := bar_index
    if showFourStageCycle
        sweepTop = cycleSweptLow ? cycleLow : high
        sweepBottom = cycleSweptLow ? low : cycleHigh
        cycleSweepBox := box.new(bar_index, sweepTop, bar_index + 1, sweepBottom, border_color = color.orange, bgcolor = color.new(color.orange, 82))
        cycleSweepLabel := label.new(bar_index, cycleSweptLow ? low : high, "2 MANIPULATION / SWEEP", style = cycleSweptLow ? label.style_label_up : label.style_label_down, color = color.new(color.orange, 6), textcolor = color.black, size = size.tiny)

cycleLongMove = cycleStage == 2 and cycleDirection == 1 and bar_index > cycleSweepBar and close >= cyclePOC + atrValue * cycleDisplacementATR and close > open and signalBodyShare >= 0.55 and fastEMA >= fastEMA[1]
cycleShortMove = cycleStage == 2 and cycleDirection == -1 and bar_index > cycleSweepBar and close <= cyclePOC - atrValue * cycleDisplacementATR and close < open and signalBodyShare >= 0.55 and fastEMA <= fastEMA[1]
if cycleLongMove or cycleShortMove
    cycleStage := 3
    cycleMoveBar := bar_index
    if showFourStageCycle
        cycleMoveBox := box.new(cycleSweepBar + 1, math.max(cyclePOC, close), bar_index, math.min(cyclePOC, close), border_color = color.purple, bgcolor = color.new(color.purple, 88))
        cycleMoveLabel := label.new(cycleSweepBar + 1, cycleLongMove ? math.max(cyclePOC, close) : math.min(cyclePOC, close), "3 DISTRIBUTION / MOVE", style = cycleLongMove ? label.style_label_down : label.style_label_up, color = color.new(color.purple, 8), textcolor = color.white, size = size.tiny)

cycleRetestTouched = cycleStage == 3 and bar_index > cycleMoveBar and low[1] <= cyclePOC + atrValue[1] * cyclePOCToleranceATR and high[1] >= cyclePOC - atrValue[1] * cyclePOCToleranceATR
cycleLongEntry = cycleRetestTouched and cycleDirection == 1 and close > high[1] and close > cyclePOC and close > fastEMA and close > slowEMA and fastEMA > slowEMA and slowSlopeUp and higherTrendUp and signalBodyShare >= trendMinimumBodyShare and rsiValue >= 52 and rsiValue <= 66 and metalSyncLongOK and not fifteenMinuteRiskDetected and not shockPauseActive
cycleShortEntry = cycleRetestTouched and cycleDirection == -1 and close < low[1] and close < cyclePOC and close < fastEMA and close < slowEMA and fastEMA < slowEMA and slowSlopeDown and higherTrendDown and signalBodyShare >= trendMinimumBodyShare and rsiValue <= 48 and rsiValue >= 34 and metalSyncShortOK and not fifteenMinuteRiskDetected and not shockPauseActive
cycleLongEntryConfirmed = cycleLongEntry and trendLongSetup
cycleShortEntryConfirmed = cycleShortEntry and trendShortSetup
if cycleLongEntryConfirmed or cycleShortEntryConfirmed
    cycleStage := 4

cycleExpired = cycleStage > 0 and cycleStage < 4 and not na(cycleStartedBar) and bar_index - cycleStartedBar > cycleRangeBars + cycleExpiryBars
cycleInvalidated = cycleStage == 3 and ((cycleDirection == 1 and close < cycleLow) or (cycleDirection == -1 and close > cycleHigh))
if cycleExpired or cycleInvalidated
    cycleStage := 0
    cycleDirection := 0
    cycleStartedBar := na
    cycleSweepBar := na
    cycleMoveBar := na
    cycleHigh := na
    cycleLow := na
    cyclePOC := na

// M15/H1 P1 is now permitted only by the completed fourth stage. Lower chart
// timeframes retain the existing defended-reclaim engine.
trendLongSetup := trendLongSetup and (not cycleTimeframe or cycleLongEntryConfirmed)
trendShortSetup := trendShortSetup and (not cycleTimeframe or cycleShortEntryConfirmed)

// Lower-timeframe room check. The projected structural/ATR stop is compared
// with the next confirmed pivot liquidity level. If 1.5R is not available, the
// old BUY/SELL is replaced by WAIT · NO ROOM.
lowerTFLongStopEstimate = math.max(recentStructureLow - syminfo.mintick * 2, close - atrValue * trendAtrMultiple)
lowerTFShortStopEstimate = math.min(recentStructureHigh + syminfo.mintick * 2, close + atrValue * trendAtrMultiple)
lowerTFLongRiskEstimate = math.max(close - lowerTFLongStopEstimate, syminfo.mintick)
lowerTFShortRiskEstimate = math.max(lowerTFShortStopEstimate - close, syminfo.mintick)
lowerTFLongRoomToLiquidity = not na(priorSwingHigh) ? priorSwingHigh - close : na
lowerTFShortRoomToLiquidity = not na(priorSwingLow) ? close - priorSwingLow : na
lowerTFLongRoomOK = not lowerTimeframePrecisionActive or not na(lowerTFLongRoomToLiquidity) and (lowerTFLongRoomToLiquidity <= 0 or lowerTFLongRoomToLiquidity >= lowerTFLongRiskEstimate * lowerTFMinimumRoomR)
lowerTFShortRoomOK = not lowerTimeframePrecisionActive or not na(lowerTFShortRoomToLiquidity) and (lowerTFShortRoomToLiquidity <= 0 or lowerTFShortRoomToLiquidity >= lowerTFShortRiskEstimate * lowerTFMinimumRoomR)
lowerTFLongNoRoom = lowerTimeframePrecisionActive and trendLongSetup and lowerTFLongStack and not lowerTFLongRoomOK
lowerTFShortNoRoom = lowerTimeframePrecisionActive and trendShortSetup and lowerTFShortStack and not lowerTFShortRoomOK
lowerTFLongMTFBlocked = lowerTimeframePrecisionActive and trendLongSetup and not lowerTFLongStack
lowerTFShortMTFBlocked = lowerTimeframePrecisionActive and trendShortSetup and not lowerTFShortStack
trendLongSetup := trendLongSetup and (not lowerTimeframePrecisionActive or lowerTFLongStack and lowerTFLongRoomOK)
trendShortSetup := trendShortSetup and (not lowerTimeframePrecisionActive or lowerTFShortStack and lowerTFShortRoomOK)

longWatch = enableReversal and reversalTimeframeOK and decisionBarReady and not fifteenMinuteRiskDetected and not shockPauseActive and not stopClosedThisBar and not failureClosedThisBar and strategy.position_size == 0 and not trendLongSetup and not trendShortSetup and sessionOK and reversalVolatilityOK and higherTrendUp and sweptLow and close > open and lowerWick / body >= minimumWickBody and rsiRecentLow < 35 and rsiValue > 35 and rsiValue > rsiValue[1] and metalSyncLongOK and (not lowerTimeframePrecisionActive or lowerTFLongStack and lowerTFLongRoomOK)
shortWatch = enableReversal and reversalTimeframeOK and decisionBarReady and not fifteenMinuteRiskDetected and not shockPauseActive and not stopClosedThisBar and not failureClosedThisBar and strategy.position_size == 0 and not trendLongSetup and not trendShortSetup and sessionOK and reversalVolatilityOK and higherTrendDown and sweptHigh and close < open and upperWick / body >= minimumWickBody and rsiRecentHigh > 65 and rsiValue < 65 and rsiValue < rsiValue[1] and metalSyncShortOK and (not lowerTimeframePrecisionActive or lowerTFShortStack and lowerTFShortRoomOK)

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
    if not simpleChartMode
        label.new(bar_index, high, "AVOID SHORT\n" + (sellSideSweepTrap ? "SELL-SIDE SWEEP" : "BULLISH PULLBACK"), style = label.style_label_down, color = color.new(color.orange, 6), textcolor = color.black, size = size.small)
    lastBadEntryBar := bar_index

if avoidLong
    if not simpleChartMode
        label.new(bar_index, low, "AVOID LONG\n" + (buySideSweepTrap ? "BUY-SIDE SWEEP" : "BEARISH RALLY"), style = label.style_label_up, color = color.new(color.red, 6), textcolor = color.white, size = size.small)
    lastBadEntryBar := bar_index

if noChaseLong
    if not simpleChartMode
        label.new(bar_index, high, "NO CHASE LONG\nWAIT PULLBACK", style = label.style_label_down, color = color.new(color.yellow, 5), textcolor = color.black, size = size.tiny)
    lastBadEntryBar := bar_index

if noChaseShort
    if not simpleChartMode
        label.new(bar_index, low, "NO CHASE SHORT\nWAIT RALLY", style = label.style_label_up, color = color.new(color.yellow, 5), textcolor = color.black, size = size.tiny)
    lastBadEntryBar := bar_index

// Optional early heads-up for the compact panel. FORMING is not a signal: P1
// requires a completed pullback and defended reclaim when the safer default is on.
p1LongForming = enableTrend and not fifteenMinuteRiskDetected and not shockPauseActive and strategy.position_size == 0 and not trendLongSetup and not lowerTFLongNoRoom and not lowerTFLongMTFBlocked and not rawAvoidLong and not rawNoChaseLong and (oneHourPrecisionActive ? oneHourLongBias and close > slowEMA and math.abs(close - fastEMA) <= atrValue * 0.75 : fastEMA > slowEMA and slowSlopeUp and higherTrendUp and metalSyncLongOK and trendVolatilityOK and rsiValue > 48 and (longPullbackCandle or low <= fastEMA + atrValue * trendPullbackBufferATR))
p1ShortForming = enableTrend and not fifteenMinuteRiskDetected and not shockPauseActive and strategy.position_size == 0 and not trendShortSetup and not lowerTFShortNoRoom and not lowerTFShortMTFBlocked and not rawAvoidShort and not rawNoChaseShort and (oneHourPrecisionActive ? oneHourShortBias and close < slowEMA and math.abs(close - fastEMA) <= atrValue * 0.75 : fastEMA < slowEMA and slowSlopeDown and higherTrendDown and metalSyncShortOK and trendVolatilityOK and rsiValue < 52 and (shortPullbackCandle or high >= fastEMA - atrValue * trendPullbackBufferATR))

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
var float plannedTarget1 = na
var float plannedTarget2 = na
var float plannedTarget = na
var int plannedUntilBar = na
var label planEntryLabel = na
var label planTarget1Label = na
var label planTarget2Label = na
var label planTarget3Label = na
var label planStopLabel = na
var bool tp1ApproachArmed = false
var bool tp1Reached = false
var bool tp1FailureWarned = false
var bool halfStopWarned = false
var bool fiveMinuteProtectionExitSent = false
var float protectedStop = na
var int trackedOpenTrades = 0
var bool reentryArmed = false
var int reentryDirection = 0
var int reentrySLBar = na
var float reentryRecoveryPrice = na
var float reentryQty = na
var float reentryEntry = na
var float reentryStop = na
var float reentryTarget = na
var int reentryPendingBar = na
var int reentryForcedDirection = 0

// A fresh 15m warning invalidates any unfilled trigger. Existing trades retain
// their protective bracket; the warning never moves or removes an active SL.
if fifteenMinuteRiskDetected and strategy.position_size == 0
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
    reentryEntry := na
    reentryStop := na
    reentryTarget := na
    reentryPendingBar := na

// Label handles make each projected plan self-cleaning. The old Entry / TP / SL
// map is deleted before a replacement plan and immediately after a full exit.
deletePlanLabels(entryLabel, target1Label, target2Label, target3Label, stopLabel) =>
    if not na(entryLabel)
        label.delete(entryLabel)
    if not na(target1Label)
        label.delete(target1Label)
    if not na(target2Label)
        label.delete(target2Label)
    if not na(target3Label)
        label.delete(target3Label)
    if not na(stopLabel)
        label.delete(stopLabel)
    true

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
        reentryForcedDirection := 0
        plannedEntry := na
        plannedStop := na
        plannedTarget1 := na
        plannedTarget2 := na
        plannedTarget := na
        plannedUntilBar := na
        deletePlanLabels(planEntryLabel, planTarget1Label, planTarget2Label, planTarget3Label, planStopLabel)
        planEntryLabel := na
        planTarget1Label := na
        planTarget2Label := na
        planTarget3Label := na
        planStopLabel := na

// A pending trigger is withdrawn if the matching Gold/Silver direction breaks
// before entry. An existing position keeps its original protective bracket.
metalSyncInvalidatesPending = requireMetalSync and strategy.position_size == 0 and ((not na(pendingLongBar) and not metalsBullishSync) or (not na(pendingShortBar) and not metalsBearishSync) or (not na(reentryPendingBar) and reentryDirection == 1 and not metalsBullishSync) or (not na(reentryPendingBar) and reentryDirection == -1 and not metalsBearishSync))
if metalSyncInvalidatesPending
    resumeAfterSyncBreak = not na(reentryPendingBar) and not na(reentrySLBar) and bar_index - reentrySLBar <= reentryScanBars
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
    reentryArmed := resumeAfterSyncBreak
    reentryDirection := 0
    reentryEntry := na
    reentryStop := na
    reentryTarget := na
    reentryPendingBar := na
    plannedEntry := na
    plannedStop := na
    plannedTarget1 := na
    plannedTarget2 := na
    plannedTarget := na
    plannedUntilBar := na
    deletePlanLabels(planEntryLabel, planTarget1Label, planTarget2Label, planTarget3Label, planStopLabel)
    planEntryLabel := na
    planTarget1Label := na
    planTarget2Label := na
    planTarget3Label := na
    planStopLabel := na

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
    reentryForcedDirection := 0

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
    trendStopPrice := oneHourPrecisionActive ? low - atrValue * precisionStopBufferATR : math.max(trendLongStructureStop, trendLongAtrStop)
    trendLongRisk = close - trendStopPrice
    trendTargetPrice := close + trendLongRisk * rewardRisk
    plannedEntry := close
    plannedStop := trendStopPrice
    plannedTarget1 := close + trendLongRisk
    plannedTarget2 := close + trendLongRisk * 1.50
    plannedTarget := trendTargetPrice
    plannedUntilBar := bar_index + planBars
    deletePlanLabels(planEntryLabel, planTarget1Label, planTarget2Label, planTarget3Label, planStopLabel)
    planEntryLabel := na
    planTarget1Label := na
    planTarget2Label := na
    planTarget3Label := na
    planStopLabel := na
    if showTradePlan
        planEntryLabel := label.new(bar_index, plannedEntry, simpleChartMode ? (oneHourPrecisionActive ? "BUY CONFIRMED\n1H RETEST" : "BUY CONFIRMED\nDEFENDED P1") : "LONG ENTRY\nR:R " + str.tostring(rewardRisk, "#.##"), style = label.style_label_up, color = color.new(color.yellow, 5), textcolor = color.black, size = size.tiny)
        planTarget1Label := label.new(bar_index, plannedTarget1, "TP1 · 1R", style = label.style_label_down, color = color.new(color.lime, 18), textcolor = color.black, size = size.tiny)
        planTarget2Label := label.new(bar_index, plannedTarget2, "TP2 · 1.5R", style = label.style_label_down, color = color.new(color.lime, 10), textcolor = color.black, size = size.tiny)
        planTarget3Label := label.new(bar_index, plannedTarget, "TP3 · " + str.tostring(rewardRisk, "#.##") + "R", style = label.style_label_down, color = color.new(color.lime, 2), textcolor = color.black, size = size.tiny)
        planStopLabel := label.new(bar_index, plannedStop, "SL", style = label.style_label_up, color = color.new(color.red, 5), textcolor = color.white, size = size.tiny)
    if cycleTimeframe and cycleStage == 4 and showFourStageCycle
        if not na(cycleEntryBox)
            box.delete(cycleEntryBox)
        cycleEntryBox := box.new(bar_index, plannedTarget1, bar_index + 4, plannedStop, border_color = color.lime, bgcolor = color.new(color.lime, 91), text = "4 ENTRY BUY", text_color = color.lime, text_size = size.tiny)
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
    trendStopPrice := oneHourPrecisionActive ? high + atrValue * precisionStopBufferATR : math.min(trendShortStructureStop, trendShortAtrStop)
    trendShortRisk = trendStopPrice - close
    trendTargetPrice := close - trendShortRisk * rewardRisk
    plannedEntry := close
    plannedStop := trendStopPrice
    plannedTarget1 := close - trendShortRisk
    plannedTarget2 := close - trendShortRisk * 1.50
    plannedTarget := trendTargetPrice
    plannedUntilBar := bar_index + planBars
    deletePlanLabels(planEntryLabel, planTarget1Label, planTarget2Label, planTarget3Label, planStopLabel)
    planEntryLabel := na
    planTarget1Label := na
    planTarget2Label := na
    planTarget3Label := na
    planStopLabel := na
    if showTradePlan
        planEntryLabel := label.new(bar_index, plannedEntry, simpleChartMode ? (oneHourPrecisionActive ? "SELL CONFIRMED\n1H RETEST" : "SELL CONFIRMED\nDEFENDED P1") : "SHORT ENTRY\nR:R " + str.tostring(rewardRisk, "#.##"), style = label.style_label_down, color = color.new(color.yellow, 5), textcolor = color.black, size = size.tiny)
        planTarget1Label := label.new(bar_index, plannedTarget1, "TP1 · 1R", style = label.style_label_up, color = color.new(color.lime, 18), textcolor = color.black, size = size.tiny)
        planTarget2Label := label.new(bar_index, plannedTarget2, "TP2 · 1.5R", style = label.style_label_up, color = color.new(color.lime, 10), textcolor = color.black, size = size.tiny)
        planTarget3Label := label.new(bar_index, plannedTarget, "TP3 · " + str.tostring(rewardRisk, "#.##") + "R", style = label.style_label_up, color = color.new(color.lime, 2), textcolor = color.black, size = size.tiny)
        planStopLabel := label.new(bar_index, plannedStop, "SL", style = label.style_label_down, color = color.new(color.red, 5), textcolor = color.white, size = size.tiny)
    if cycleTimeframe and cycleStage == 4 and showFourStageCycle
        if not na(cycleEntryBox)
            box.delete(cycleEntryBox)
        cycleEntryBox := box.new(bar_index, plannedStop, bar_index + 4, plannedTarget1, border_color = color.red, bgcolor = color.new(color.red, 91), text = "4 ENTRY SELL", text_color = color.red, text_size = size.tiny)
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
    pendingLongRisk = pendingLongEntry - pendingLongStop
    plannedTarget1 := pendingLongEntry + pendingLongRisk
    plannedTarget2 := pendingLongEntry + pendingLongRisk * 1.50
    plannedTarget := pendingLongEntry + (pendingLongEntry - pendingLongStop) * rewardRisk
    plannedUntilBar := bar_index + planBars
    deletePlanLabels(planEntryLabel, planTarget1Label, planTarget2Label, planTarget3Label, planStopLabel)
    planEntryLabel := na
    planTarget1Label := na
    planTarget2Label := na
    planTarget3Label := na
    planStopLabel := na
    if showTradePlan
        planEntryLabel := label.new(bar_index, plannedEntry, simpleChartMode ? "WAIT · P2 BUY\nTRIGGER" : "REV LONG ENTRY\nR:R " + str.tostring(rewardRisk, "#.##"), style = label.style_label_up, color = color.new(color.yellow, 5), textcolor = color.black, size = size.tiny)
        planTarget1Label := label.new(bar_index, plannedTarget1, "TP1 · 1R", style = label.style_label_down, color = color.new(color.lime, 18), textcolor = color.black, size = size.tiny)
        planTarget2Label := label.new(bar_index, plannedTarget2, "TP2 · 1.5R", style = label.style_label_down, color = color.new(color.lime, 10), textcolor = color.black, size = size.tiny)
        planTarget3Label := label.new(bar_index, plannedTarget, "TP3 · " + str.tostring(rewardRisk, "#.##") + "R", style = label.style_label_down, color = color.new(color.lime, 2), textcolor = color.black, size = size.tiny)
        planStopLabel := label.new(bar_index, plannedStop, "SL", style = label.style_label_up, color = color.new(color.red, 5), textcolor = color.white, size = size.tiny)

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
    pendingShortRisk = pendingShortStop - pendingShortEntry
    plannedTarget1 := pendingShortEntry - pendingShortRisk
    plannedTarget2 := pendingShortEntry - pendingShortRisk * 1.50
    plannedTarget := pendingShortEntry - (pendingShortStop - pendingShortEntry) * rewardRisk
    plannedUntilBar := bar_index + planBars
    deletePlanLabels(planEntryLabel, planTarget1Label, planTarget2Label, planTarget3Label, planStopLabel)
    planEntryLabel := na
    planTarget1Label := na
    planTarget2Label := na
    planTarget3Label := na
    planStopLabel := na
    if showTradePlan
        planEntryLabel := label.new(bar_index, plannedEntry, simpleChartMode ? "WAIT · P2 SELL\nTRIGGER" : "REV SHORT ENTRY\nR:R " + str.tostring(rewardRisk, "#.##"), style = label.style_label_down, color = color.new(color.yellow, 5), textcolor = color.black, size = size.tiny)
        planTarget1Label := label.new(bar_index, plannedTarget1, "TP1 · 1R", style = label.style_label_up, color = color.new(color.lime, 18), textcolor = color.black, size = size.tiny)
        planTarget2Label := label.new(bar_index, plannedTarget2, "TP2 · 1.5R", style = label.style_label_up, color = color.new(color.lime, 10), textcolor = color.black, size = size.tiny)
        planTarget3Label := label.new(bar_index, plannedTarget, "TP3 · " + str.tostring(rewardRisk, "#.##") + "R", style = label.style_label_up, color = color.new(color.lime, 2), textcolor = color.black, size = size.tiny)
        planStopLabel := label.new(bar_index, plannedStop, "SL", style = label.style_label_down, color = color.new(color.red, 5), textcolor = color.white, size = size.tiny)

if not na(pendingLongBar) and strategy.position_size == 0
    if bar_index - pendingLongBar <= expiryBars
        strategy.entry("REV LONG", strategy.long, stop = pendingLongEntry, oca_name = "REVERSAL", oca_type = strategy.oca.cancel)
    else
        strategy.cancel("REV LONG")
        pendingLongEntry := na
        pendingLongStop := na
        pendingLongBar := na
        plannedEntry := na
        plannedStop := na
        plannedTarget1 := na
        plannedTarget2 := na
        plannedTarget := na
        plannedUntilBar := na
        deletePlanLabels(planEntryLabel, planTarget1Label, planTarget2Label, planTarget3Label, planStopLabel)
        planEntryLabel := na
        planTarget1Label := na
        planTarget2Label := na
        planTarget3Label := na
        planStopLabel := na

if not na(pendingShortBar) and strategy.position_size == 0
    if bar_index - pendingShortBar <= expiryBars
        strategy.entry("REV SHORT", strategy.short, stop = pendingShortEntry, oca_name = "REVERSAL", oca_type = strategy.oca.cancel)
    else
        strategy.cancel("REV SHORT")
        pendingShortEntry := na
        pendingShortStop := na
        pendingShortBar := na
        plannedEntry := na
        plannedStop := na
        plannedTarget1 := na
        plannedTarget2 := na
        plannedTarget := na
        plannedUntilBar := na
        deletePlanLabels(planEntryLabel, planTarget1Label, planTarget2Label, planTarget3Label, planStopLabel)
        planEntryLabel := na
        planTarget1Label := na
        planTarget2Label := na
        planTarget3Label := na
        planStopLabel := na

// A reversal becomes confirmed only after price actually crosses its yellow trigger.
reversalLongConfirmed = strategy.position_size > 0 and strategy.position_size[1] <= 0 and not na(pendingLongStop)
reversalShortConfirmed = strategy.position_size < 0 and strategy.position_size[1] >= 0 and not na(pendingShortStop)

if strategy.position_size > 0 and not na(pendingLongStop)
    longRisk = strategy.position_avg_price - pendingLongStop
    if longRisk > syminfo.mintick
        revLongTarget1 = strategy.position_avg_price + longRisk
        revLongTarget2 = strategy.position_avg_price + longRisk * 1.50
        revLongTarget = strategy.position_avg_price + longRisk * rewardRisk
        plannedEntry := strategy.position_avg_price
        managedRevLongStop = protectAfterTP1 and tp1Reached and not na(protectedStop) ? math.max(pendingLongStop, protectedStop) : pendingLongStop
        plannedStop := managedRevLongStop
        plannedTarget1 := revLongTarget1
        plannedTarget2 := revLongTarget2
        plannedTarget := revLongTarget
        plannedUntilBar := bar_index + planBars
        strategy.exit("REV LONG TP1", from_entry = "REV LONG", stop = pendingLongStop, limit = revLongTarget1, qty_percent = 50, comment_profit = "TP1", comment_loss = "SL")
        strategy.exit("REV LONG TP2", from_entry = "REV LONG", stop = managedRevLongStop, limit = revLongTarget2, qty_percent = 25, comment_profit = "TP2", comment_loss = "SL")
        strategy.exit("REV LONG TP3", from_entry = "REV LONG", stop = managedRevLongStop, limit = revLongTarget, qty_percent = 25, comment_profit = "TP3", comment_loss = "SL")
    pendingLongEntry := na
    pendingLongBar := na
    pendingShortEntry := na
    pendingShortStop := na
    pendingShortBar := na

if strategy.position_size < 0 and not na(pendingShortStop)
    shortRisk = pendingShortStop - strategy.position_avg_price
    if shortRisk > syminfo.mintick
        revShortTarget1 = strategy.position_avg_price - shortRisk
        revShortTarget2 = strategy.position_avg_price - shortRisk * 1.50
        revShortTarget = strategy.position_avg_price - shortRisk * rewardRisk
        plannedEntry := strategy.position_avg_price
        managedRevShortStop = protectAfterTP1 and tp1Reached and not na(protectedStop) ? math.min(pendingShortStop, protectedStop) : pendingShortStop
        plannedStop := managedRevShortStop
        plannedTarget1 := revShortTarget1
        plannedTarget2 := revShortTarget2
        plannedTarget := revShortTarget
        plannedUntilBar := bar_index + planBars
        strategy.exit("REV SHORT TP1", from_entry = "REV SHORT", stop = pendingShortStop, limit = revShortTarget1, qty_percent = 50, comment_profit = "TP1", comment_loss = "SL")
        strategy.exit("REV SHORT TP2", from_entry = "REV SHORT", stop = managedRevShortStop, limit = revShortTarget2, qty_percent = 25, comment_profit = "TP2", comment_loss = "SL")
        strategy.exit("REV SHORT TP3", from_entry = "REV SHORT", stop = managedRevShortStop, limit = revShortTarget, qty_percent = 25, comment_profit = "TP3", comment_loss = "SL")
    pendingShortEntry := na
    pendingShortBar := na
    pendingLongEntry := na
    pendingLongStop := na
    pendingLongBar := na

if strategy.position_size > 0 and not na(trendStopPrice)
    activeTrendLongRisk = strategy.position_avg_price - trendStopPrice
    if activeTrendLongRisk > syminfo.mintick
        trendLongTarget1 = strategy.position_avg_price + activeTrendLongRisk
        trendLongTarget2 = strategy.position_avg_price + activeTrendLongRisk * 1.50
        trendTargetPrice := strategy.position_avg_price + activeTrendLongRisk * rewardRisk
        plannedEntry := strategy.position_avg_price
        managedTrendLongStop = protectAfterTP1 and tp1Reached and not na(protectedStop) ? math.max(trendStopPrice, protectedStop) : trendStopPrice
        plannedStop := managedTrendLongStop
        plannedTarget1 := trendLongTarget1
        plannedTarget2 := trendLongTarget2
        plannedTarget := trendTargetPrice
        plannedUntilBar := bar_index + planBars
        strategy.exit("TREND LONG TP1", from_entry = "TREND LONG", stop = trendStopPrice, limit = trendLongTarget1, qty_percent = 50, comment_profit = "TP1", comment_loss = "SL")
        strategy.exit("TREND LONG TP2", from_entry = "TREND LONG", stop = managedTrendLongStop, limit = trendLongTarget2, qty_percent = 25, comment_profit = "TP2", comment_loss = "SL")
        strategy.exit("TREND LONG TP3", from_entry = "TREND LONG", stop = managedTrendLongStop, limit = trendTargetPrice, qty_percent = 25, comment_profit = "TP3", comment_loss = "SL")

if strategy.position_size < 0 and not na(trendStopPrice)
    activeTrendShortRisk = trendStopPrice - strategy.position_avg_price
    if activeTrendShortRisk > syminfo.mintick
        trendShortTarget1 = strategy.position_avg_price - activeTrendShortRisk
        trendShortTarget2 = strategy.position_avg_price - activeTrendShortRisk * 1.50
        trendTargetPrice := strategy.position_avg_price - activeTrendShortRisk * rewardRisk
        plannedEntry := strategy.position_avg_price
        managedTrendShortStop = protectAfterTP1 and tp1Reached and not na(protectedStop) ? math.min(trendStopPrice, protectedStop) : trendStopPrice
        plannedStop := managedTrendShortStop
        plannedTarget1 := trendShortTarget1
        plannedTarget2 := trendShortTarget2
        plannedTarget := trendTargetPrice
        plannedUntilBar := bar_index + planBars
        strategy.exit("TREND SHORT TP1", from_entry = "TREND SHORT", stop = trendStopPrice, limit = trendShortTarget1, qty_percent = 50, comment_profit = "TP1", comment_loss = "SL")
        strategy.exit("TREND SHORT TP2", from_entry = "TREND SHORT", stop = managedTrendShortStop, limit = trendShortTarget2, qty_percent = 25, comment_profit = "TP2", comment_loss = "SL")
        strategy.exit("TREND SHORT TP3", from_entry = "TREND SHORT", stop = managedTrendShortStop, limit = trendTargetPrice, qty_percent = 25, comment_profit = "TP3", comment_loss = "SL")

// Active Trade Health does not predict the next candle. It reacts only after a
// completed candle proves that price approached TP1, gave back momentum, or
// consumed half of the original Entry-to-SL distance.
newTradeForHealth = strategy.opentrades > trackedOpenTrades
if newTradeForHealth
    tp1ApproachArmed := false
    tp1Reached := false
    tp1FailureWarned := false
    halfStopWarned := false
    fiveMinuteProtectionExitSent := false
    protectedStop := na
trackedOpenTrades := strategy.opentrades

validActivePlan = strategy.position_size != 0 and not na(plannedEntry) and not na(plannedStop) and not na(plannedTarget1)
activePlanRisk = validActivePlan ? math.abs(plannedEntry - plannedStop) : na
longTP1Hit = validActivePlan and strategy.position_size > 0 and high >= plannedTarget1
shortTP1Hit = validActivePlan and strategy.position_size < 0 and low <= plannedTarget1
firstTP1Hit = (longTP1Hit or shortTP1Hit) and not tp1Reached

if firstTP1Hit
    protectedStop := strategy.position_size > 0 ? plannedEntry + activePlanRisk * tp1ProfitLockR : plannedEntry - activePlanRisk * tp1ProfitLockR
    if showPriorityMarks
        label.new(bar_index, strategy.position_size > 0 ? high : low, protectAfterTP1 ? "TP1 BANKED · 50%\nREST SL → +" + str.tostring(tp1ProfitLockR, "#.##") + "R NEXT UPDATE" : "TP1 BANKED · 50%", style = strategy.position_size > 0 ? label.style_label_down : label.style_label_up, color = color.new(color.lime, 4), textcolor = color.black, size = size.small)

if longTP1Hit or shortTP1Hit
    tp1ApproachArmed := false
    tp1Reached := true
    tp1FailureWarned := false
    halfStopWarned := false

// Once TP1 has banked half on a 5m chart, a completed close through the fast
// EMA plus the prior candle exits the remainder rather than giving the move back.
fiveMinuteLongProtectionExit = fiveMinuteChart and decisionBarReady and strategy.position_size > 0 and tp1Reached and not fiveMinuteProtectionExitSent and close < fastEMA and close < low[1] and rsiValue < 50
fiveMinuteShortProtectionExit = fiveMinuteChart and decisionBarReady and strategy.position_size < 0 and tp1Reached and not fiveMinuteProtectionExitSent and close > fastEMA and close > high[1] and rsiValue > 50
fiveMinuteProtectionExit = fiveMinuteLongProtectionExit or fiveMinuteShortProtectionExit
if fiveMinuteProtectionExit
    fiveMinuteProtectionExitSent := true
    strategy.close_all(comment = "5M TP1 PROTECT")
    if showPriorityMarks
        label.new(bar_index, fiveMinuteLongProtectionExit ? high : low, "5M REVERSAL\nCLOSE REMAINDER", style = fiveMinuteLongProtectionExit ? label.style_label_down : label.style_label_up, color = color.new(color.orange, 4), textcolor = color.black, size = size.small)

longTP1Approached = showTradeHealth and validActivePlan and decisionBarReady and strategy.position_size > 0 and not tp1Reached and not longTP1Hit and high >= plannedEntry + activePlanRisk * tp1ApproachPercent
shortTP1Approached = showTradeHealth and validActivePlan and decisionBarReady and strategy.position_size < 0 and not tp1Reached and not shortTP1Hit and low <= plannedEntry - activePlanRisk * tp1ApproachPercent
if longTP1Approached or shortTP1Approached
    tp1ApproachArmed := true

longTP1FailureWarning = showTradeHealth and validActivePlan and decisionBarReady and strategy.position_size > 0 and tp1ApproachArmed and not tp1Reached and not tp1FailureWarned and not longTP1Hit and close <= plannedEntry + activePlanRisk * tp1GivebackPercent and close < open and close < close[1] and (close < fastEMA or rsiValue < 50)
shortTP1FailureWarning = showTradeHealth and validActivePlan and decisionBarReady and strategy.position_size < 0 and tp1ApproachArmed and not tp1Reached and not tp1FailureWarned and not shortTP1Hit and close >= plannedEntry - activePlanRisk * tp1GivebackPercent and close > open and close > close[1] and (close > fastEMA or rsiValue > 50)
tp1FailureWarning = longTP1FailureWarning or shortTP1FailureWarning

if tp1FailureWarning
    tp1FailureWarned := true
    tp1ApproachArmed := false
    label.new(bar_index, longTP1FailureWarning ? high : low, oneMinuteRecoveryActive ? "TP1 FAILED · FLIP WATCH\nWAIT FOR OPPOSITE CLOSE" : "TP1 FAILED · POSSIBLE REVERSE\nMOMENTUM BACK TOWARD SL", style = longTP1FailureWarning ? label.style_label_down : label.style_label_up, color = color.new(color.orange, 4), textcolor = color.black, size = size.small)

longHalfToSLWarning = showTradeHealth and validActivePlan and decisionBarReady and strategy.position_size > 0 and not halfStopWarned and low <= plannedEntry - activePlanRisk * halfStopPercent and low > plannedStop
shortHalfToSLWarning = showTradeHealth and validActivePlan and decisionBarReady and strategy.position_size < 0 and not halfStopWarned and high >= plannedEntry + activePlanRisk * halfStopPercent and high < plannedStop
halfToSLWarning = longHalfToSLWarning or shortHalfToSLWarning

if halfToSLWarning
    halfStopWarned := true
    label.new(bar_index, longHalfToSLWarning ? low : high, oneMinuteRecoveryActive ? "½ TO SL · FLIP WATCH\nWAIT FOR OPPOSITE CLOSE" : "½ TO SL\nRISK DISTANCE CONSUMED", style = longHalfToSLWarning ? label.style_label_up : label.style_label_down, color = color.new(color.red, 4), textcolor = color.white, size = size.small)

// On the 1-minute chart, half-to-SL or a failed TP1 only arms the recovery
// logic. The active trade is closed only after a completed candle confirms an
// opposite break through the 20 EMA and the previous candle, with RSI and the
// other metal agreeing. The fresh P3 bracket is calculated after one more close.
oneMinuteFailureContext = oneMinuteRecoveryActive and validActivePlan and not tp1Reached and (halfStopWarned or tp1FailureWarned)
oneMinuteFlipShortConfirmed = oneMinuteFailureContext and decisionBarReady and strategy.position_size > 0 and not shockPauseActive and close < plannedEntry and close < fastEMA and fastEMA < fastEMA[1] and close < low[1] and close < open and rsiValue <= oneMinuteFlipRSI and metalSyncShortOK
oneMinuteFlipLongConfirmed = oneMinuteFailureContext and decisionBarReady and strategy.position_size < 0 and not shockPauseActive and close > plannedEntry and close > fastEMA and fastEMA > fastEMA[1] and close > high[1] and close > open and rsiValue >= 100.0 - oneMinuteFlipRSI and metalSyncLongOK

if oneMinuteFlipShortConfirmed
    reentryForcedDirection := -1
    strategy.close_all(comment = "1M FAIL FLIP")
    if showPriorityMarks
        label.new(bar_index, high, "EXIT BUY\nSELL FLIP SCAN", style = label.style_label_down, color = color.new(color.red, 4), textcolor = color.white, size = size.small)

if oneMinuteFlipLongConfirmed
    reentryForcedDirection := 1
    strategy.close_all(comment = "1M FAIL FLIP")
    if showPriorityMarks
        label.new(bar_index, low, "EXIT SELL\nBUY FLIP SCAN", style = label.style_label_up, color = color.new(color.lime, 4), textcolor = color.black, size = size.small)

if not showTradeHealth
    tp1ApproachArmed := false
    tp1Reached := false
    tp1FailureWarned := false
    halfStopWarned := false

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
    plannedTarget1 := na
    plannedTarget2 := na
    plannedTarget := na
    plannedUntilBar := na
    deletePlanLabels(planEntryLabel, planTarget1Label, planTarget2Label, planTarget3Label, planStopLabel)
    planEntryLabel := na
    planTarget1Label := na
    planTarget2Label := na
    planTarget3Label := na
    planStopLabel := na
    tp1ApproachArmed := false
    tp1Reached := false
    tp1FailureWarned := false
    halfStopWarned := false
    fiveMinuteProtectionExitSent := false
    protectedStop := na
    // A completed TP/SL retires the whole four-stage map. The next M15/H1
    // signal must be built from a fresh consolidation after this exit.
    if not na(cycleRangeBox)
        box.delete(cycleRangeBox)
    if not na(cycleSweepBox)
        box.delete(cycleSweepBox)
    if not na(cycleMoveBox)
        box.delete(cycleMoveBox)
    if not na(cycleEntryBox)
        box.delete(cycleEntryBox)
    if not na(cyclePOCLine)
        line.delete(cyclePOCLine)
    if not na(cycleRangeLabel)
        label.delete(cycleRangeLabel)
    if not na(cycleSweepLabel)
        label.delete(cycleSweepLabel)
    if not na(cycleMoveLabel)
        label.delete(cycleMoveLabel)
    cycleRangeBox := na
    cycleSweepBox := na
    cycleMoveBox := na
    cycleEntryBox := na
    cyclePOCLine := na
    cycleRangeLabel := na
    cycleSweepLabel := na
    cycleMoveLabel := na
    cycleStage := 0
    cycleDirection := 0
    cycleStartedBar := na
    cycleSweepBar := na
    cycleMoveBar := na
    cycleHigh := na
    cycleLow := na
    cyclePOC := na
    cycleLastExitBar := bar_index

// Detect whether the broker emulator closed the latest trade at TP, SL or a
// confirmed 1m failure exit. On 1m, every stop can start another smaller reset
// scan; the strategy-wide daily-loss lock remains the final circuit breaker.
// M15/H1 never recycle a stopped four-stage setup through P3. Those charts
// must discover a completely fresh range/POC cycle after the full exit.
recoveryEngineEnabled = (enableReentry and not cycleTimeframe) or oneMinuteRecoveryActive
if closedTradeThisBar
    lastEntryId = strategy.closedtrades.entry_id(lastClosedTradeNumber)
    lastExitPrice = strategy.closedtrades.exit_price(lastClosedTradeNumber)
    closedCountThisBar = int(closedTradesChange)
    float stoppedQtyThisBar = 0.0
    float exitedQtyThisBar = 0.0
    bool forcedFlipExit = false
    for closedOffset = 0 to closedCountThisBar - 1
        closedIndex = strategy.closedtrades - 1 - closedOffset
        closedComment = strategy.closedtrades.exit_comment(closedIndex)
        exitedQtyThisBar += math.abs(strategy.closedtrades.size(closedIndex))
        if closedComment == "SL"
            stoppedQtyThisBar += math.abs(strategy.closedtrades.size(closedIndex))
        if closedComment == "1M FAIL FLIP"
            forcedFlipExit := true
    stopHitThisBar = stoppedQtyThisBar > 0
    recoveryExitThisBar = stopHitThisBar or forcedFlipExit
    closedWasReentry = str.contains(lastEntryId, "REENTRY")
    closedWasLong = str.contains(lastEntryId, "LONG")
    if strategy.position_size == 0
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
        plannedTarget1 := na
        plannedTarget2 := na
        plannedTarget := na
        plannedUntilBar := na
        deletePlanLabels(planEntryLabel, planTarget1Label, planTarget2Label, planTarget3Label, planStopLabel)
        planEntryLabel := na
        planTarget1Label := na
        planTarget2Label := na
        planTarget3Label := na
        planStopLabel := na
        tp1ApproachArmed := false
        tp1Reached := false
        tp1FailureWarned := false
        halfStopWarned := false
    if recoveryEngineEnabled and recoveryExitThisBar and strategy.position_size == 0 and (not closedWasReentry or oneMinuteRecoveryActive) and not shockPauseActive
        strategy.cancel("REENTRY LONG")
        strategy.cancel("REENTRY SHORT")
        reentryArmed := true
        reentryDirection := 0
        reentrySLBar := bar_index
        reentryRecoveryPrice := lastExitPrice
        if not forcedFlipExit
            reentryForcedDirection := 0
        recoveryQtySource = forcedFlipExit ? exitedQtyThisBar : stoppedQtyThisBar
        reentryQty := math.max(recoveryQtySource * reentrySizeMultiplier, syminfo.mincontract)
        reentryEntry := na
        reentryStop := na
        reentryTarget := na
        reentryPendingBar := na
        if showPriorityMarks
            recoveryLabel = forcedFlipExit ? "FAIL EXIT\nWAIT 1 CLOSE" : oneMinuteRecoveryActive ? "STOP HIT\n1M RESET AFTER 1 CLOSE" : simpleChartMode ? "STOP HIT\nWAIT 1 CLOSE" : "SL HIT · PLAN CLEARED\nWAIT NEXT CLOSE · P3 SCAN"
            label.new(bar_index, lastExitPrice, recoveryLabel, style = closedWasLong ? label.style_label_up : label.style_label_down, color = color.new(color.purple, 18), textcolor = color.white, size = size.tiny)
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
        reentryForcedDirection := 0
        if showPriorityMarks and closedWasReentry and stopHitThisBar
            label.new(bar_index, lastExitPrice, simpleChartMode ? "STOP HIT\nP3 ENDED" : "RE-ENTRY SL\nSTOP THIS SETUP", style = closedWasLong ? label.style_label_up : label.style_label_down, color = color.new(color.red, 12), textcolor = color.white, size = size.tiny)

// After the wait, every completed chart candle is re-evaluated during the scan
// window. The first fully aligned direction may be opposite the stopped trade.
reentryScanActive = recoveryEngineEnabled and reentryArmed and strategy.position_size == 0 and not na(reentrySLBar) and bar_index - reentrySLBar <= reentryScanBars
reentryWaitComplete = reentryScanActive and decisionBarReady and not shockPauseActive and bar_index - reentrySLBar >= reentryWaitBars
reentryLongCandidate = reentryWaitComplete and not fifteenMinuteRiskDetected and (reentryForcedDirection == 0 or reentryForcedDirection == 1) and higherTrendUp and close > reentryRecoveryPrice and close > close[1] and close > fastEMA and fastEMA > fastEMA[1] and rsiValue > 52 and close > open and metalSyncLongOK and not rawAvoidLong and not rawNoChaseLong and (not lowerTimeframePrecisionActive or lowerTFLongStack and lowerTFLongRoomOK)
reentryShortCandidate = reentryWaitComplete and not fifteenMinuteRiskDetected and not reentryLongCandidate and (reentryForcedDirection == 0 or reentryForcedDirection == -1) and higherTrendDown and close < reentryRecoveryPrice and close < close[1] and close < fastEMA and fastEMA < fastEMA[1] and rsiValue < 48 and close < open and metalSyncShortOK and not rawAvoidShort and not rawNoChaseShort and (not lowerTimeframePrecisionActive or lowerTFShortStack and lowerTFShortRoomOK)
reentryScanExpired = recoveryEngineEnabled and reentryArmed and decisionBarReady and strategy.position_size == 0 and not na(reentrySLBar) and bar_index - reentrySLBar > reentryScanBars

if reentryScanExpired
    reentryArmed := false
    reentryDirection := 0
    reentrySLBar := na
    reentryRecoveryPrice := na
    reentryQty := na
    reentryForcedDirection := 0
    if showPriorityMarks and not simpleChartMode
        label.new(bar_index, close, "P3 RESET EXPIRED\nNO RE-ENTRY", style = label.style_label_left, color = color.new(color.gray, 28), textcolor = color.white, size = size.tiny)

if reentryLongCandidate
    reentryArmed := false
    reentryDirection := 1
    reentryEntry := high + syminfo.mintick
    reentryStop := oneMinuteRecoveryActive ? low - atrValue * oneMinuteFlipStopBufferATR : math.min(low, recentStructureLow) - syminfo.mintick * 2
    reentryRisk = reentryEntry - reentryStop
    reentryTarget := reentryEntry + reentryRisk * rewardRisk
    reentryPendingBar := bar_index
    plannedEntry := reentryEntry
    plannedStop := reentryStop
    plannedTarget1 := reentryEntry + reentryRisk
    plannedTarget2 := reentryEntry + reentryRisk * 1.50
    plannedTarget := reentryTarget
    plannedUntilBar := bar_index + planBars
    deletePlanLabels(planEntryLabel, planTarget1Label, planTarget2Label, planTarget3Label, planStopLabel)
    planEntryLabel := na
    planTarget1Label := na
    planTarget2Label := na
    planTarget3Label := na
    planStopLabel := na
    if showTradePlan
        planEntryLabel := label.new(bar_index, reentryEntry, oneMinuteRecoveryActive and reentryForcedDirection == 1 ? "WAIT · 1M FLIP BUY\nTRIGGER" : simpleChartMode ? "WAIT · P3 BUY\nTRIGGER" : "P3 RESET BUY\nWAIT TRIGGER · " + str.tostring(reentrySizeMultiplier, "#.##") + "x STOPPED SIZE", style = label.style_label_up, color = color.new(color.purple, 8), textcolor = color.white, size = size.tiny)
        planTarget1Label := label.new(bar_index, plannedTarget1, "TP1 · 1R", style = label.style_label_down, color = color.new(color.lime, 18), textcolor = color.black, size = size.tiny)
        planTarget2Label := label.new(bar_index, plannedTarget2, "TP2 · 1.5R", style = label.style_label_down, color = color.new(color.lime, 10), textcolor = color.black, size = size.tiny)
        planTarget3Label := label.new(bar_index, reentryTarget, "TP3 · " + str.tostring(rewardRisk, "#.##") + "R", style = label.style_label_down, color = color.new(color.lime, 2), textcolor = color.black, size = size.tiny)
        planStopLabel := label.new(bar_index, reentryStop, oneMinuteRecoveryActive ? "NEW SL" : "RE-SL", style = label.style_label_up, color = color.new(color.red, 5), textcolor = color.white, size = size.tiny)

if reentryShortCandidate
    reentryArmed := false
    reentryDirection := -1
    reentryEntry := low - syminfo.mintick
    reentryStop := oneMinuteRecoveryActive ? high + atrValue * oneMinuteFlipStopBufferATR : math.max(high, recentStructureHigh) + syminfo.mintick * 2
    reentryRisk = reentryStop - reentryEntry
    reentryTarget := reentryEntry - reentryRisk * rewardRisk
    reentryPendingBar := bar_index
    plannedEntry := reentryEntry
    plannedStop := reentryStop
    plannedTarget1 := reentryEntry - reentryRisk
    plannedTarget2 := reentryEntry - reentryRisk * 1.50
    plannedTarget := reentryTarget
    plannedUntilBar := bar_index + planBars
    deletePlanLabels(planEntryLabel, planTarget1Label, planTarget2Label, planTarget3Label, planStopLabel)
    planEntryLabel := na
    planTarget1Label := na
    planTarget2Label := na
    planTarget3Label := na
    planStopLabel := na
    if showTradePlan
        planEntryLabel := label.new(bar_index, reentryEntry, oneMinuteRecoveryActive and reentryForcedDirection == -1 ? "WAIT · 1M FLIP SELL\nTRIGGER" : simpleChartMode ? "WAIT · P3 SELL\nTRIGGER" : "P3 RESET SELL\nWAIT TRIGGER · " + str.tostring(reentrySizeMultiplier, "#.##") + "x STOPPED SIZE", style = label.style_label_down, color = color.new(color.purple, 8), textcolor = color.white, size = size.tiny)
        planTarget1Label := label.new(bar_index, plannedTarget1, "TP1 · 1R", style = label.style_label_up, color = color.new(color.lime, 18), textcolor = color.black, size = size.tiny)
        planTarget2Label := label.new(bar_index, plannedTarget2, "TP2 · 1.5R", style = label.style_label_up, color = color.new(color.lime, 10), textcolor = color.black, size = size.tiny)
        planTarget3Label := label.new(bar_index, reentryTarget, "TP3 · " + str.tostring(rewardRisk, "#.##") + "R", style = label.style_label_up, color = color.new(color.lime, 2), textcolor = color.black, size = size.tiny)
        planStopLabel := label.new(bar_index, reentryStop, oneMinuteRecoveryActive ? "NEW SL" : "RE-SL", style = label.style_label_down, color = color.new(color.red, 5), textcolor = color.white, size = size.tiny)

if not na(reentryPendingBar) and strategy.position_size == 0
    if bar_index - reentryPendingBar <= reentryExpiryBars and reentryQty > 0
        if reentryDirection == 1
            strategy.entry("REENTRY LONG", strategy.long, qty = reentryQty, stop = reentryEntry)
        if reentryDirection == -1
            strategy.entry("REENTRY SHORT", strategy.short, qty = reentryQty, stop = reentryEntry)
    else
        strategy.cancel("REENTRY LONG")
        strategy.cancel("REENTRY SHORT")
        resumeResetScan = recoveryEngineEnabled and not shockPauseActive and not na(reentrySLBar) and bar_index - reentrySLBar <= reentryScanBars
        reentryArmed := resumeResetScan
        reentryDirection := 0
        reentryEntry := na
        reentryStop := na
        reentryTarget := na
        reentryPendingBar := na
        if not resumeResetScan
            reentryForcedDirection := 0
        plannedEntry := na
        plannedStop := na
        plannedTarget1 := na
        plannedTarget2 := na
        plannedTarget := na
        plannedUntilBar := na
        deletePlanLabels(planEntryLabel, planTarget1Label, planTarget2Label, planTarget3Label, planStopLabel)
        planEntryLabel := na
        planTarget1Label := na
        planTarget2Label := na
        planTarget3Label := na
        planStopLabel := na
        if showPriorityMarks and not simpleChartMode and resumeResetScan
            label.new(bar_index, close, "P3 TRIGGER EXPIRED\nRESCAN NEXT CLOSE", style = label.style_label_left, color = color.new(color.purple, 32), textcolor = color.white, size = size.tiny)

reentryLongConfirmed = strategy.position_size > 0 and strategy.position_size[1] <= 0 and reentryDirection == 1 and not na(reentryStop)
reentryShortConfirmed = strategy.position_size < 0 and strategy.position_size[1] >= 0 and reentryDirection == -1 and not na(reentryStop)

if strategy.position_size > 0 and reentryDirection == 1 and not na(reentryStop)
    reentryLongRisk = strategy.position_avg_price - reentryStop
    if reentryLongRisk > syminfo.mintick
        reentryLongTarget1 = strategy.position_avg_price + reentryLongRisk
        reentryLongTarget2 = strategy.position_avg_price + reentryLongRisk * 1.50
        reentryTarget := strategy.position_avg_price + reentryLongRisk * rewardRisk
        plannedEntry := strategy.position_avg_price
        managedReentryLongStop = protectAfterTP1 and tp1Reached and not na(protectedStop) ? math.max(reentryStop, protectedStop) : reentryStop
        plannedStop := managedReentryLongStop
        plannedTarget1 := reentryLongTarget1
        plannedTarget2 := reentryLongTarget2
        plannedTarget := reentryTarget
        plannedUntilBar := bar_index + planBars
        strategy.exit("REENTRY LONG TP1", from_entry = "REENTRY LONG", stop = reentryStop, limit = reentryLongTarget1, qty_percent = 50, comment_profit = "TP1", comment_loss = "SL")
        strategy.exit("REENTRY LONG TP2", from_entry = "REENTRY LONG", stop = managedReentryLongStop, limit = reentryLongTarget2, qty_percent = 25, comment_profit = "TP2", comment_loss = "SL")
        strategy.exit("REENTRY LONG TP3", from_entry = "REENTRY LONG", stop = managedReentryLongStop, limit = reentryTarget, qty_percent = 25, comment_profit = "TP3", comment_loss = "SL")
    reentryPendingBar := na

if strategy.position_size < 0 and reentryDirection == -1 and not na(reentryStop)
    reentryShortRisk = reentryStop - strategy.position_avg_price
    if reentryShortRisk > syminfo.mintick
        reentryShortTarget1 = strategy.position_avg_price - reentryShortRisk
        reentryShortTarget2 = strategy.position_avg_price - reentryShortRisk * 1.50
        reentryTarget := strategy.position_avg_price - reentryShortRisk * rewardRisk
        plannedEntry := strategy.position_avg_price
        managedReentryShortStop = protectAfterTP1 and tp1Reached and not na(protectedStop) ? math.min(reentryStop, protectedStop) : reentryStop
        plannedStop := managedReentryShortStop
        plannedTarget1 := reentryShortTarget1
        plannedTarget2 := reentryShortTarget2
        plannedTarget := reentryTarget
        plannedUntilBar := bar_index + planBars
        strategy.exit("REENTRY SHORT TP1", from_entry = "REENTRY SHORT", stop = reentryStop, limit = reentryShortTarget1, qty_percent = 50, comment_profit = "TP1", comment_loss = "SL")
        strategy.exit("REENTRY SHORT TP2", from_entry = "REENTRY SHORT", stop = managedReentryShortStop, limit = reentryShortTarget2, qty_percent = 25, comment_profit = "TP2", comment_loss = "SL")
        strategy.exit("REENTRY SHORT TP3", from_entry = "REENTRY SHORT", stop = managedReentryShortStop, limit = reentryTarget, qty_percent = 25, comment_profit = "TP3", comment_loss = "SL")
    reentryPendingBar := na

// Keep one clean Fibonacci map on the latest confirmed swing instead of
// leaving historical ladders across the chart.
var fibLines = array.new_line()
var fibLevelLabels = array.new_label()
var box fibGoldenBox = na

if barstate.islast
    while array.size(fibLines) > 0
        line.delete(array.pop(fibLines))
    while array.size(fibLevelLabels) > 0
        label.delete(array.pop(fibLevelLabels))
    if not na(fibGoldenBox)
        box.delete(fibGoldenBox)
        fibGoldenBox := na

    if fibReady
        fibStartBar = math.min(fibSelectedHighBar, fibSelectedLowBar)
        fibEndBar = bar_index + fibonacciProjectionBars
        fibLevels = array.from(0.0, 0.236, 0.382, 0.500, 0.618, 0.705, 0.786, 1.0)
        fibNames = array.from("0% · SWING EXTREME", "23.6% · WEAK RETRACEMENT", "38.2% · TREND CONTINUATION", "50% · SMART MONEY REACTION", "61.8% · GOLDEN ENTRY", "70.5% · SNIPER ENTRY", "78.6% · DEEP RETRACEMENT", "100% · FULL RETRACEMENT")

        for fibIndex = 0 to array.size(fibLevels) - 1
            fibLevel = array.get(fibLevels, fibIndex)
            fibPrice = getFibPrice(fibLevel)
            fibIsGolden = fibLevel == 0.618 or fibLevel == 0.705
            fibIsMiddle = fibLevel == 0.500
            fibIsAnchor = fibLevel == 0.0 or fibLevel == 1.0
            fibColor = fibIsGolden ? color.yellow : fibIsMiddle ? color.aqua : fibIsAnchor ? color.silver : color.new(color.purple, 22)
            fibWidth = fibIsGolden ? 2 : fibIsMiddle ? 2 : 1
            fibStyle = fibIsAnchor ? line.style_solid : line.style_dashed
            fibLine = line.new(fibStartBar, fibPrice, fibEndBar, fibPrice, xloc = xloc.bar_index, extend = extend.none, color = fibColor, width = fibWidth, style = fibStyle)
            array.push(fibLines, fibLine)
            if showFibonacciLabels
                fibLabelText = array.get(fibNames, fibIndex) + "\n" + str.tostring(fibPrice, format.mintick)
                fibLabel = label.new(fibEndBar, fibPrice, fibLabelText, style = label.style_label_left, color = color.new(fibColor, 74), textcolor = color.white, size = size.tiny)
                array.push(fibLevelLabels, fibLabel)

        fibGoldenBox := box.new(fibStartBar, fibGoldenTop, fibEndBar, fibGoldenBottom, xloc = xloc.bar_index, border_color = color.new(color.yellow, 18), bgcolor = color.new(color.yellow, 88))

plot(enableTrend ? fastEMA : na, "Fast EMA", color = color.aqua, linewidth = 2)
plot(enableTrend ? slowEMA : na, "Slow EMA", color = color.orange, linewidth = 2)
plot(confirmedHTFEMA, "Confirmed HTF EMA", color = color.new(color.purple, 35), linewidth = 2, style = plot.style_stepline)
plot(showLiquidity ? priorSwingHigh : na, "Buy-side liquidity", color = color.new(color.fuchsia, 28), linewidth = 2, style = plot.style_linebr)
plot(showLiquidity ? priorSwingLow : na, "Sell-side liquidity", color = color.new(color.aqua, 28), linewidth = 2, style = plot.style_linebr)
plot(strategy.position_size == 0 ? pendingLongEntry : na, "Reversal long trigger", color = color.yellow, linewidth = 2, style = plot.style_linebr)
plot(strategy.position_size == 0 ? pendingShortEntry : na, "Reversal short trigger", color = color.yellow, linewidth = 2, style = plot.style_linebr)

planVisible = showTradePlan and not na(plannedUntilBar) and (bar_index <= plannedUntilBar or strategy.position_size != 0)
planEntryPlot = plot(planVisible ? plannedEntry : na, "Candidate entry", color = color.yellow, linewidth = 2, style = plot.style_linebr)
planTarget1Plot = plot(planVisible ? plannedTarget1 : na, "Possible TP1 · 1R", color = color.new(color.lime, 35), linewidth = 2, style = plot.style_linebr)
planTarget2Plot = plot(planVisible ? plannedTarget2 : na, "Possible TP2 · 1.5R", color = color.new(color.lime, 18), linewidth = 2, style = plot.style_linebr)
planTargetPlot = plot(planVisible ? plannedTarget : na, "Possible TP3 · final target", color = color.lime, linewidth = 3, style = plot.style_linebr)
planStopPlot = plot(planVisible ? plannedStop : na, "Possible SL", color = color.red, linewidth = 3, style = plot.style_linebr)
fill(planEntryPlot, planTargetPlot, color = color.new(color.lime, 88), title = "Reward zone")
fill(planEntryPlot, planStopPlot, color = color.new(color.red, 88), title = "Risk zone")
plotshape(showPriorityMarks and trendLongSetup, title = "P1 CONFIRMED TREND BUY", text = "BUY\nP1", style = shape.labelup, location = location.belowbar, color = color.lime, textcolor = color.black, size = size.small)
plotshape(showPriorityMarks and trendShortSetup, title = "P1 CONFIRMED TREND SELL", text = "SELL\nP1", style = shape.labeldown, location = location.abovebar, color = color.red, textcolor = color.white, size = size.small)
plotshape(showNoRoomMarks and lowerTFLongNoRoom, title = "WAIT NO ROOM FOR BUY", text = "WAIT\nNO ROOM BUY", style = shape.labeldown, location = location.abovebar, color = color.orange, textcolor = color.black, size = size.tiny)
plotshape(showNoRoomMarks and lowerTFShortNoRoom, title = "WAIT NO ROOM FOR SELL", text = "WAIT\nNO ROOM SELL", style = shape.labelup, location = location.belowbar, color = color.orange, textcolor = color.black, size = size.tiny)
plotshape(showPriorityMarks and not simpleChartMode and longWatch, title = "WATCH ONLY LONG REVERSAL", text = "WATCH ONLY\nLONG", style = shape.labelup, location = location.belowbar, color = color.new(color.lime, 28), textcolor = color.black, size = size.tiny)
plotshape(showPriorityMarks and not simpleChartMode and shortWatch, title = "WATCH ONLY SHORT REVERSAL", text = "WATCH ONLY\nSHORT", style = shape.labeldown, location = location.abovebar, color = color.new(color.red, 24), textcolor = color.white, size = size.tiny)
plotshape(showPriorityMarks and reversalLongConfirmed, title = "P2 CONFIRMED REVERSAL BUY", text = "BUY\nP2", style = shape.labelup, location = location.belowbar, color = color.lime, textcolor = color.black, size = size.small)
plotshape(showPriorityMarks and reversalShortConfirmed, title = "P2 CONFIRMED REVERSAL SELL", text = "SELL\nP2", style = shape.labeldown, location = location.abovebar, color = color.red, textcolor = color.white, size = size.small)
plotshape(showPriorityMarks and not simpleChartMode and reentryLongCandidate, title = "P3 RESET WATCH BUY", text = "P3 RESET BUY\nWAIT TRIGGER", style = shape.labelup, location = location.belowbar, color = color.new(color.purple, 20), textcolor = color.white, size = size.tiny)
plotshape(showPriorityMarks and not simpleChartMode and reentryShortCandidate, title = "P3 RESET WATCH SELL", text = "P3 RESET SELL\nWAIT TRIGGER", style = shape.labeldown, location = location.abovebar, color = color.new(color.purple, 20), textcolor = color.white, size = size.tiny)
plotshape(showPriorityMarks and reentryLongConfirmed and not (oneMinuteRecoveryActive and reentryForcedDirection == 1), title = "P3 CONFIRMED RESET BUY", text = "BUY\nP3", style = shape.labelup, location = location.belowbar, color = color.lime, textcolor = color.black, size = size.small)
plotshape(showPriorityMarks and reentryShortConfirmed and not (oneMinuteRecoveryActive and reentryForcedDirection == -1), title = "P3 CONFIRMED RESET SELL", text = "SELL\nP3", style = shape.labeldown, location = location.abovebar, color = color.red, textcolor = color.white, size = size.small)
plotshape(showPriorityMarks and reentryLongConfirmed and oneMinuteRecoveryActive and reentryForcedDirection == 1, title = "1M CONFIRMED FAILURE FLIP BUY", text = "BUY\n1M FLIP", style = shape.labelup, location = location.belowbar, color = color.lime, textcolor = color.black, size = size.small)
plotshape(showPriorityMarks and reentryShortConfirmed and oneMinuteRecoveryActive and reentryForcedDirection == -1, title = "1M CONFIRMED FAILURE FLIP SELL", text = "SELL\n1M FLIP", style = shape.labeldown, location = location.abovebar, color = color.red, textcolor = color.white, size = size.small)
// Custom fixed-lookback volume profile. It distributes each chart candle's
// available volume across every price row crossed by that candle, then expands
// from the highest-volume row until the requested value-area percentage is met.
// Forex/CFD symbols normally supply tick volume, so this is an approximation.
volumeProfileHigh = fibonacciPreviousSessionHigh
volumeProfileLow = fibonacciPreviousSessionLow
var detailedVPBoxes = array.new_box()
var line detailedVPPocLine = na
var line detailedVPVahLine = na
var line detailedVPValLine = na
var label detailedVPPocLabel = na
var label detailedVPVahLabel = na
var label detailedVPValLabel = na
var int detailedVPUpdateBar = na

if barstate.islast and (na(detailedVPUpdateBar) or bar_index != detailedVPUpdateBar)
    detailedVPUpdateBar := bar_index
    while array.size(detailedVPBoxes) > 0
        box.delete(array.pop(detailedVPBoxes))
    if not na(detailedVPPocLine)
        line.delete(detailedVPPocLine)
    if not na(detailedVPVahLine)
        line.delete(detailedVPVahLine)
    if not na(detailedVPValLine)
        line.delete(detailedVPValLine)
    if not na(detailedVPPocLabel)
        label.delete(detailedVPPocLabel)
    if not na(detailedVPVahLabel)
        label.delete(detailedVPVahLabel)
    if not na(detailedVPValLabel)
        label.delete(detailedVPValLabel)
    detailedVPPocLine := na
    detailedVPVahLine := na
    detailedVPValLine := na
    detailedVPPocLabel := na
    detailedVPVahLabel := na
    detailedVPValLabel := na

    profileRange = volumeProfileHigh - volumeProfileLow
    previousSessionProfileReady = fibonacciPreviousSessionTimeframe and not na(fibonacciPreviousSessionStartBar) and not na(fibonacciPreviousSessionEndBar)
    if showDetailedVolumeProfile and previousSessionProfileReady and profileRange > syminfo.mintick
        rowHeight = profileRange / volumeProfileRows
        profileVolumes = array.new_float(volumeProfileRows, 0.0)
        for profileOffset = 1 to volumeProfileLookback
            profileSourceBar = bar_index - profileOffset
            if profileSourceBar >= fibonacciPreviousSessionStartBar and profileSourceBar <= fibonacciPreviousSessionEndBar
                candleLow = low[profileOffset]
                candleHigh = high[profileOffset]
                candleRange = candleHigh - candleLow
                candleVolume = nz(volume[profileOffset], 1.0)
                if candleRange <= syminfo.mintick
                    typicalBin = int(math.floor((close[profileOffset] - volumeProfileLow) / profileRange * volumeProfileRows))
                    safeTypicalBin = math.max(0, math.min(volumeProfileRows - 1, typicalBin))
                    array.set(profileVolumes, safeTypicalBin, array.get(profileVolumes, safeTypicalBin) + candleVolume)
                else
                    for profileRow = 0 to volumeProfileRows - 1
                        rowLow = volumeProfileLow + profileRow * rowHeight
                        rowHigh = rowLow + rowHeight
                        overlap = math.max(0.0, math.min(candleHigh, rowHigh) - math.max(candleLow, rowLow))
                        if overlap > 0
                            distributedVolume = candleVolume * overlap / candleRange
                            array.set(profileVolumes, profileRow, array.get(profileVolumes, profileRow) + distributedVolume)

        pocRow = 0
        maximumRowVolume = array.get(profileVolumes, 0)
        for profileRow = 1 to volumeProfileRows - 1
            rowVolume = array.get(profileVolumes, profileRow)
            if rowVolume > maximumRowVolume
                maximumRowVolume := rowVolume
                pocRow := profileRow

        totalProfileVolume = array.sum(profileVolumes)
        valueAreaTarget = totalProfileVolume * volumeProfileValueArea / 100.0
        valueAreaVolume = maximumRowVolume
        valueAreaLowRow = pocRow
        valueAreaHighRow = pocRow
        while valueAreaVolume < valueAreaTarget and (valueAreaLowRow > 0 or valueAreaHighRow < volumeProfileRows - 1)
            nextLowerVolume = valueAreaLowRow > 0 ? array.get(profileVolumes, valueAreaLowRow - 1) : -1.0
            nextUpperVolume = valueAreaHighRow < volumeProfileRows - 1 ? array.get(profileVolumes, valueAreaHighRow + 1) : -1.0
            if nextUpperVolume >= nextLowerVolume
                valueAreaHighRow += 1
                valueAreaVolume += math.max(0.0, nextUpperVolume)
            else
                valueAreaLowRow -= 1
                valueAreaVolume += math.max(0.0, nextLowerVolume)

        profileEndX = fibonacciPreviousSessionEndBar
        for profileRow = 0 to volumeProfileRows - 1
            rowVolume = array.get(profileVolumes, profileRow)
            rowWidth = maximumRowVolume > 0 ? math.max(1, int(math.round(volumeProfileWidthBars * rowVolume / maximumRowVolume))) : 1
            rowLow = volumeProfileLow + profileRow * rowHeight
            rowHigh = rowLow + rowHeight
            isPOCRow = profileRow == pocRow
            isValueAreaRow = profileRow >= valueAreaLowRow and profileRow <= valueAreaHighRow
            rowColor = isPOCRow ? color.new(color.yellow, 58) : isValueAreaRow ? color.new(color.aqua, 84) : color.new(color.gray, 92)
            rowBorder = isPOCRow ? color.new(color.yellow, 35) : isValueAreaRow ? color.new(color.aqua, 72) : color.new(color.gray, 88)
            profileBox = box.new(left = profileEndX - rowWidth + 1, top = rowHigh, right = profileEndX, bottom = rowLow, xloc = xloc.bar_index, border_color = rowBorder, bgcolor = rowColor)
            array.push(detailedVPBoxes, profileBox)

        pocPrice = volumeProfileLow + (pocRow + 0.5) * rowHeight
        vahPrice = volumeProfileLow + (valueAreaHighRow + 1.0) * rowHeight
        valPrice = volumeProfileLow + valueAreaLowRow * rowHeight
        profileLineStart = fibonacciPreviousSessionStartBar
        profileLineEnd = fibonacciPreviousSessionEndBar
        detailedVPPocLine := line.new(profileLineStart, pocPrice, profileLineEnd, pocPrice, xloc = xloc.bar_index, color = color.yellow, width = 2)
        detailedVPVahLine := line.new(profileLineStart, vahPrice, profileLineEnd, vahPrice, xloc = xloc.bar_index, color = color.new(color.aqua, 20), style = line.style_dashed)
        detailedVPValLine := line.new(profileLineStart, valPrice, profileLineEnd, valPrice, xloc = xloc.bar_index, color = color.new(color.aqua, 20), style = line.style_dashed)
        detailedVPPocLabel := label.new(profileLineStart, pocPrice, "POC · " + str.tostring(pocPrice, format.mintick), xloc = xloc.bar_index, style = label.style_label_left, color = color.new(color.yellow, 35), textcolor = color.black, size = size.tiny)
        if showVolumeProfileLabels
            detailedVPVahLabel := label.new(profileLineStart, vahPrice, "VAH · " + str.tostring(vahPrice, format.mintick), xloc = xloc.bar_index, style = label.style_label_left, color = color.new(color.aqua, 65), textcolor = color.white, size = size.tiny)
            detailedVPValLabel := label.new(profileLineStart, valPrice, "VAL · " + str.tostring(valPrice, format.mintick), xloc = xloc.bar_index, style = label.style_label_left, color = color.new(color.aqua, 65), textcolor = color.white, size = size.tiny)

plotshape(buySideManipulation, title = "15M BUY-SIDE MANIPULATION", text = "MANIPULATION\nAVOID LONG", style = shape.labeldown, location = location.abovebar, color = color.orange, textcolor = color.black, size = size.small)
plotshape(sellSideManipulation, title = "15M SELL-SIDE MANIPULATION", text = "MANIPULATION\nAVOID SHORT", style = shape.labelup, location = location.belowbar, color = color.orange, textcolor = color.black, size = size.small)
plotshape(blowOffTop, title = "15M BLOW-OFF TOP", text = "BLOW-OFF TOP\nWAIT", style = shape.labeldown, location = location.abovebar, color = color.fuchsia, textcolor = color.white, size = size.small)
plotshape(blowOffBottom, title = "15M BLOW-OFF BOTTOM", text = "BLOW-OFF BOTTOM\nWAIT", style = shape.labelup, location = location.belowbar, color = color.aqua, textcolor = color.black, size = size.small)
plotshape(showPriorityMarks and not simpleChartMode and fibLongRejection, title = "FIBONACCI CONTEXT ONLY LONG", text = "FIB CONTEXT\nNOT AN ENTRY", style = shape.labelup, location = location.belowbar, color = color.yellow, textcolor = color.black, size = size.tiny)
plotshape(showPriorityMarks and not simpleChartMode and fibShortRejection, title = "FIBONACCI CONTEXT ONLY SHORT", text = "FIB CONTEXT\nNOT AN ENTRY", style = shape.labeldown, location = location.abovebar, color = color.yellow, textcolor = color.black, size = size.tiny)
newVolatilityShock = volatilityShock and not volatilityShock[1]
plotshape(newVolatilityShock and not blowOffTop and not blowOffBottom, title = "VOLATILITY SHOCK", text = "NO TRADE\nSHOCK", style = shape.labeldown, location = location.abovebar, color = color.fuchsia, textcolor = color.white, size = size.small)
plotshape(not simpleChartMode and shockReset, title = "SHOCK PAUSE RESET", text = "SHOCK RESET\nWAIT P1 / P2 / P3", style = shape.labelup, location = location.belowbar, color = color.new(color.teal, 8), textcolor = color.white, size = size.tiny)
plotshape(not simpleChartMode and showMetalSyncMarks and metalSyncBullishChanged, title = "GOLD SILVER SYNC BULLISH", text = "SYNC GOOD\nBULLISH", style = shape.labelup, location = location.belowbar, color = color.new(color.lime, 8), textcolor = color.black, size = size.tiny)
plotshape(not simpleChartMode and showMetalSyncMarks and metalSyncBearishChanged, title = "GOLD SILVER SYNC BEARISH", text = "SYNC GOOD\nBEARISH", style = shape.labeldown, location = location.abovebar, color = color.new(color.red, 8), textcolor = color.white, size = size.tiny)
plotshape(not simpleChartMode and showMetalSyncMarks and metalSyncLost, title = "GOLD SILVER NOT SYNCED", text = "NOT SYNCED\nWAIT", style = shape.labeldown, location = location.abovebar, color = color.new(color.orange, 5), textcolor = color.black, size = size.tiny)
bgcolor(enableReversal and not reversalTimeframeOK ? color.new(color.orange, 92) : na, title = "Reversal timeframe warning")
bgcolor(shockPauseActive ? color.new(color.fuchsia, 92) : na, title = "Volatility shock pause")

// Live status panel. Calculations refresh on incoming ticks, while actionable
// setups remain locked until the current chart candle is confirmed.
var table syncPanel = table.new(position.top_right, 2, 10, border_width = 1)
secondsToClose = timeframe.isintraday ? math.max(0, int(math.floor((time_close - timenow) / 1000))) : 0
minutesToClose = int(math.floor(secondsToClose / 60))
remainingSeconds = secondsToClose % 60
countdownText = str.tostring(minutesToClose, "00") + ":" + str.tostring(remainingSeconds, "00")
updateText = decisionBarReady ? "UPDATED" : timeframe.isintraday ? "WAIT " + countdownText : "WAIT FOR CLOSE"
cycleStatusText = not cycleTimeframe ? "USE 15m OR 1H" : cycleStage == 1 ? "STAGE 1 · RANGE / POC" : cycleStage == 2 ? "STAGE 2 · SWEEP FOUND" : cycleStage == 3 ? "STAGE 3 · WAIT POC RETEST" : cycleStage == 4 ? "STAGE 4 · ENTRY CONFIRMED" : "SEARCHING FRESH RANGE"
priorityText = blowOffTop ? "15M BLOW-OFF TOP" : blowOffBottom ? "15M BLOW-OFF BOTTOM" : buySideManipulation ? "15M AVOID LONG" : sellSideManipulation ? "15M AVOID SHORT" : shockPauseActive ? "SHOCK PAUSE" : lowerTFLongNoRoom ? "WAIT · NO ROOM BUY" : lowerTFShortNoRoom ? "WAIT · NO ROOM SELL" : lowerTFLongMTFBlocked or lowerTFShortMTFBlocked ? "WAIT · M15/H1 DISAGREE" : trendLongSetup ? "P1 BUY CONFIRMED" : trendShortSetup ? "P1 SELL CONFIRMED" : reversalLongConfirmed ? "P2 BUY CONFIRMED" : reversalShortConfirmed ? "P2 SELL CONFIRMED" : reentryLongConfirmed ? oneMinuteRecoveryActive and reentryForcedDirection == 1 ? "1M FLIP BUY CONFIRMED" : "P3 RESET BUY CONFIRMED" : reentryShortConfirmed ? oneMinuteRecoveryActive and reentryForcedDirection == -1 ? "1M FLIP SELL CONFIRMED" : "P3 RESET SELL CONFIRMED" : reentryLongCandidate ? oneMinuteRecoveryActive and reentryForcedDirection == 1 ? "1M FLIP BUY ARMED" : "P3 RESET BUY WATCH" : reentryShortCandidate ? oneMinuteRecoveryActive and reentryForcedDirection == -1 ? "1M FLIP SELL ARMED" : "P3 RESET SELL WATCH" : reentryArmed ? oneMinuteRecoveryActive and reentryForcedDirection == 1 ? "1M FLIP BUY SCANNING" : oneMinuteRecoveryActive and reentryForcedDirection == -1 ? "1M FLIP SELL SCANNING" : "P3 RESET SCANNING" : cycleTimeframe and cycleStage > 0 ? cycleStatusText : longWatch ? "WATCH LONG ONLY" : shortWatch ? "WATCH SHORT ONLY" : fibLongRejection ? "FIB LONG · CONTEXT ONLY" : fibShortRejection ? "FIB SHORT · CONTEXT ONLY" : "NO CONFIRMED SETUP"
priorityColor = blowOffTop or blowOffBottom ? color.new(color.fuchsia, 48) : buySideManipulation or sellSideManipulation ? color.new(color.orange, 52) : shockPauseActive ? color.new(color.fuchsia, 58) : lowerTFLongNoRoom or lowerTFShortNoRoom or lowerTFLongMTFBlocked or lowerTFShortMTFBlocked ? color.new(color.orange, 56) : trendLongSetup or trendShortSetup ? color.new(color.aqua, 72) : reversalLongConfirmed ? color.new(color.lime, 72) : reversalShortConfirmed ? color.new(color.red, 68) : reentryLongConfirmed or reentryShortConfirmed ? color.new(color.purple, 58) : reentryLongCandidate or reentryShortCandidate or reentryArmed ? color.new(color.purple, 72) : longWatch or shortWatch ? color.new(color.orange, 74) : color.new(color.gray, 82)
entryGuardText = lowerTFLongNoRoom or lowerTFShortNoRoom ? "WAIT · NO ROOM" : lowerTFLongMTFBlocked or lowerTFShortMTFBlocked ? "WAIT · MTF DISAGREE" : avoidShort ? "AVOID SHORT" : avoidLong ? "AVOID LONG" : noChaseLong ? "NO CHASE LONG" : noChaseShort ? "NO CHASE SHORT" : "CLEAR"
entryGuardColor = lowerTFLongNoRoom or lowerTFShortNoRoom or lowerTFLongMTFBlocked or lowerTFShortMTFBlocked ? color.new(color.orange, 52) : avoidShort ? color.new(color.orange, 58) : avoidLong ? color.new(color.red, 58) : noChaseLong or noChaseShort ? color.new(color.yellow, 64) : color.new(color.lime, 82)
entryGuardTextColor = noChaseLong or noChaseShort ? color.black : color.white
shockStatusText = volatilityShock ? "SHOCK DETECTED" : shockPauseActive ? "PAUSE ACTIVE" : shockReset ? "RESET · WAIT SIGNAL" : "NORMAL"
shockStatusColor = shockPauseActive ? color.new(color.fuchsia, 58) : shockReset ? color.new(color.teal, 62) : color.new(color.lime, 82)
metalSyncText = metalsBullishSync ? "GOOD · BULLISH" : metalsBearishSync ? "GOOD · BEARISH" : "NOT SYNCED · WAIT"
metalSyncColor = metalsBullishSync ? color.new(color.lime, 64) : metalsBearishSync ? color.new(color.red, 58) : color.new(color.orange, 62)
metalSyncTextColor = metalsBullishSync ? color.black : color.white
tradeHealthText = strategy.position_size == 0 ? "NO ACTIVE TRADE" : oneMinuteFailureContext ? "1M FLIP WATCH" : tp1FailureWarned ? "TP1 FAILED · REVERSE RISK" : halfStopWarned ? "HALF TO SL" : tp1Reached ? protectAfterTP1 ? "TP1 BANKED · REST +" + str.tostring(tp1ProfitLockR, "#.##") + "R" : "TP1 BANKED" : tp1ApproachArmed ? "TP1 APPROACHED" : "NORMAL"
tradeHealthColor = strategy.position_size == 0 ? color.new(color.gray, 82) : tp1FailureWarned ? color.new(color.orange, 52) : halfStopWarned ? color.new(color.red, 54) : tp1Reached ? color.new(color.lime, 62) : tp1ApproachArmed ? color.new(color.yellow, 60) : color.new(color.aqua, 82)
tradeHealthTextColor = tp1ApproachArmed and not tp1FailureWarned and not halfStopWarned ? color.black : color.white
buySignalNow = not fifteenMinuteRiskDetected and (trendLongSetup or reversalLongConfirmed or reentryLongConfirmed)
sellSignalNow = not fifteenMinuteRiskDetected and (trendShortSetup or reversalShortConfirmed or reentryShortConfirmed)
activeEntryId = strategy.opentrades > 0 ? strategy.opentrades.entry_id(0) : ""
activeSignalText = str.contains(activeEntryId, "TREND") ? (oneHourPrecisionActive ? "P1 · 1H RETEST" : "P1 · DEFENDED") : str.contains(activeEntryId, "REENTRY") ? oneMinuteRecoveryActive and reentryForcedDirection != 0 ? "1M AUTO FLIP" : "P3 · RESET" : str.contains(activeEntryId, "REV") ? "P2 · REVERSAL" : "ACTIVE TRADE"
simpleActionText = buySignalNow ? "BUY SIGNAL" : sellSignalNow ? "SELL SIGNAL" : strategy.position_size > 0 ? "LONG ACTIVE" : strategy.position_size < 0 ? "SHORT ACTIVE" : shockPauseActive or fifteenMinuteRiskDetected ? "NO TRADE" : "WAIT"
simpleActionColor = buySignalNow ? color.new(color.lime, 44) : sellSignalNow ? color.new(color.red, 42) : strategy.position_size != 0 ? color.new(color.aqua, 68) : shockPauseActive or fifteenMinuteRiskDetected ? color.new(color.fuchsia, 48) : color.new(color.orange, 68)
simpleSignalText = trendLongSetup or trendShortSetup ? (cycleTimeframe ? "P1 · STAGE 4 CONFIRMED" : oneHourPrecisionActive ? "P1 · 1H RETEST" : "P1 · M15+H1 CONFIRMED") : reversalLongConfirmed or reversalShortConfirmed ? "P2 · REVERSAL" : reentryLongConfirmed or reentryShortConfirmed ? oneMinuteRecoveryActive and reentryForcedDirection != 0 ? (reentryDirection == 1 ? "1M FLIP BUY" : "1M FLIP SELL") : "P3 · RESET" : strategy.position_size != 0 ? activeSignalText : lowerTFLongNoRoom or lowerTFShortNoRoom ? "WAIT · NO ROOM" : lowerTFLongMTFBlocked or lowerTFShortMTFBlocked ? "WAIT · M15/H1 DISAGREE" : not na(reentryPendingBar) ? oneMinuteRecoveryActive and reentryForcedDirection != 0 ? (reentryDirection == 1 ? "1M FLIP BUY · ARMED" : "1M FLIP SELL · ARMED") : (reentryDirection == 1 ? "P3 BUY · ARMED" : "P3 SELL · ARMED") : reentryArmed ? oneMinuteRecoveryActive and reentryForcedDirection != 0 ? (reentryForcedDirection == 1 ? "1M FLIP BUY · SCAN" : "1M FLIP SELL · SCAN") : "P3 · SCANNING" : not na(pendingLongBar) ? "P2 BUY · ARMED" : not na(pendingShortBar) ? "P2 SELL · ARMED" : cycleTimeframe ? cycleStatusText : p1LongForming ? (oneHourPrecisionActive ? "P1 BUY · WAIT RETEST" : "P1 BUY · WAIT DEFENSE") : p1ShortForming ? (oneHourPrecisionActive ? "P1 SELL · WAIT RETEST" : "P1 SELL · WAIT DEFENSE") : "NONE · KEEP WAITING"
simpleSignalColor = buySignalNow ? color.new(color.lime, 60) : sellSignalNow ? color.new(color.red, 56) : strategy.position_size != 0 ? color.new(color.aqua, 76) : lowerTFLongNoRoom or lowerTFShortNoRoom or lowerTFLongMTFBlocked or lowerTFShortMTFBlocked ? color.new(color.orange, 56) : not na(reentryPendingBar) or reentryArmed ? color.new(color.purple, 68) : not na(pendingLongBar) or not na(pendingShortBar) or p1LongForming or p1ShortForming ? color.new(color.yellow, 68) : color.new(color.gray, 82)
simpleMetalText = metalsBullishSync ? "BULLISH" : metalsBearishSync ? "BEARISH" : "WAIT · NOT SYNCED"
simpleRiskText = blowOffTop ? "BLOW-OFF TOP" : blowOffBottom ? "BLOW-OFF BOTTOM" : buySideManipulation ? "MANIPULATION · AVOID LONG" : sellSideManipulation ? "MANIPULATION · AVOID SHORT" : shockPauseActive ? "HIGH · NO NEW TRADE" : lowerTFLongNoRoom or lowerTFShortNoRoom ? "NO ROOM · BLOCKED" : lowerTFLongMTFBlocked or lowerTFShortMTFBlocked ? "M15/H1 · BLOCKED" : oneMinuteFailureContext ? "1M FLIP WATCH" : tp1FailureWarned ? "TP1 FAILED" : halfStopWarned ? "HALF TO SL" : rawAvoidShort or rawAvoidLong or rawNoChaseLong or rawNoChaseShort ? "BLOCKED · WAIT" : "CLEAR"
simpleRiskColor = blowOffTop or blowOffBottom or shockPauseActive ? color.new(color.fuchsia, 48) : buySideManipulation or sellSideManipulation ? color.new(color.orange, 52) : lowerTFLongNoRoom or lowerTFShortNoRoom or lowerTFLongMTFBlocked or lowerTFShortMTFBlocked ? color.new(color.orange, 54) : tp1FailureWarned ? color.new(color.orange, 48) : halfStopWarned ? color.new(color.red, 48) : rawAvoidShort or rawAvoidLong or rawNoChaseLong or rawNoChaseShort ? color.new(color.orange, 62) : color.new(color.lime, 78)
oneMinuteModeText = oneMinuteRecoveryActive ? "ON · AUTO SL/TP + FLIP" : oneMinuteChart ? "OFF IN SETTINGS" : "OFF · USE 1m CHART"
oneMinuteModeColor = oneMinuteRecoveryActive ? color.new(color.lime, 72) : color.new(color.gray, 82)
fibonacciStatusText = not showAutoFibonacci ? "OFF IN SETTINGS" : not fibonacciTimeframeSupported ? "USE 1m–15m OR 30m–1H" : not fibReady ? "WAIT CONFIRMED SWINGS" : fibLongRejection ? "LONG REJECTION · WATCH" : fibShortRejection ? "SHORT REJECTION · WATCH" : fibTouchesGoldenZone ? "IN 61.8–70.5 ZONE" : usePreviousSessionFib and fibBullishMove ? "PREV SESSION · BULL MAP" : usePreviousSessionFib and fibBearishMove ? "PREV SESSION · BEAR MAP" : fibBullishMove ? "INTRADAY PIVOT · BULL" : "INTRADAY PIVOT · BEAR"
fibonacciStatusColor = fibLongRejection or fibShortRejection ? color.new(color.yellow, 48) : fibTouchesGoldenZone ? color.new(color.orange, 58) : fibReady ? color.new(color.purple, 70) : color.new(color.gray, 82)
fibonacciTextColor = fibLongRejection or fibShortRejection ? color.black : color.white
manipulationStatusText = not enable15mManipulation ? "OFF IN SETTINGS" : not fifteenMinuteChart ? "USE 15m CHART" : blowOffTop ? "BLOW-OFF TOP · WAIT" : blowOffBottom ? "BLOW-OFF BOTTOM · WAIT" : buySideManipulation ? "BUY-SIDE SWEEP · AVOID LONG" : sellSideManipulation ? "SELL-SIDE SWEEP · AVOID SHORT" : "SCANNING · CLEAR"
manipulationStatusColor = blowOffTop or blowOffBottom ? color.new(color.fuchsia, 48) : buySideManipulation or sellSideManipulation ? color.new(color.orange, 52) : fifteenMinuteChart ? color.new(color.lime, 80) : color.new(color.gray, 82)
manipulationTextColor = buySideManipulation or sellSideManipulation ? color.black : color.white

if barstate.islast
    table.clear(syncPanel, 0, 0, 1, 9)
    if showTimeframeSync
        if simpleChartMode
            table.cell(syncPanel, 0, 0, "ACTION", bgcolor = color.new(color.black, 12), text_color = color.silver, text_size = size.tiny)
            table.cell(syncPanel, 1, 0, simpleActionText, bgcolor = simpleActionColor, text_color = color.white, text_size = size.tiny)
            table.cell(syncPanel, 0, 1, "SIGNAL", bgcolor = color.new(color.black, 12), text_color = color.silver, text_size = size.tiny)
            table.cell(syncPanel, 1, 1, simpleSignalText, bgcolor = simpleSignalColor, text_color = color.white, text_size = size.tiny)
            table.cell(syncPanel, 0, 2, "NEXT CLOSE", bgcolor = color.new(color.black, 12), text_color = color.silver, text_size = size.tiny)
            table.cell(syncPanel, 1, 2, updateText, bgcolor = decisionBarReady ? color.new(color.lime, 76) : color.new(color.orange, 78), text_color = color.white, text_size = size.tiny)
            table.cell(syncPanel, 0, 3, "METALS", bgcolor = color.new(color.black, 12), text_color = color.silver, text_size = size.tiny)
            table.cell(syncPanel, 1, 3, simpleMetalText, bgcolor = metalSyncColor, text_color = metalSyncTextColor, text_size = size.tiny)
            table.cell(syncPanel, 0, 4, "RISK", bgcolor = color.new(color.black, 12), text_color = color.silver, text_size = size.tiny)
            table.cell(syncPanel, 1, 4, simpleRiskText, bgcolor = simpleRiskColor, text_color = color.white, text_size = size.tiny)
            table.cell(syncPanel, 0, 5, "1M RECOVERY", bgcolor = color.new(color.black, 12), text_color = color.silver, text_size = size.tiny)
            table.cell(syncPanel, 1, 5, oneMinuteModeText, bgcolor = oneMinuteModeColor, text_color = color.white, text_size = size.tiny)
            table.cell(syncPanel, 0, 6, "FIBONACCI", bgcolor = color.new(color.black, 12), text_color = color.silver, text_size = size.tiny)
            table.cell(syncPanel, 1, 6, fibonacciStatusText, bgcolor = fibonacciStatusColor, text_color = fibonacciTextColor, text_size = size.tiny)
            table.cell(syncPanel, 0, 7, "15M SAFETY", bgcolor = color.new(color.black, 12), text_color = color.silver, text_size = size.tiny)
            table.cell(syncPanel, 1, 7, manipulationStatusText, bgcolor = manipulationStatusColor, text_color = manipulationTextColor, text_size = size.tiny)
        else
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
            table.cell(syncPanel, 0, 7, "TRADE HEALTH", bgcolor = color.new(color.black, 12), text_color = color.silver, text_size = size.tiny)
            table.cell(syncPanel, 1, 7, tradeHealthText, bgcolor = tradeHealthColor, text_color = tradeHealthTextColor, text_size = size.tiny)
            table.cell(syncPanel, 0, 8, "FIBONACCI", bgcolor = color.new(color.black, 12), text_color = color.silver, text_size = size.tiny)
            table.cell(syncPanel, 1, 8, fibonacciStatusText, bgcolor = fibonacciStatusColor, text_color = fibonacciTextColor, text_size = size.tiny)
            table.cell(syncPanel, 0, 9, "15M SAFETY", bgcolor = color.new(color.black, 12), text_color = color.silver, text_size = size.tiny)
            table.cell(syncPanel, 1, 9, manipulationStatusText, bgcolor = manipulationStatusColor, text_color = manipulationTextColor, text_size = size.tiny)

// Strategies cannot create alert triggers with alertcondition(). In TradingView,
// select "Order fills and alert() function calls" to receive signals and fills.
sendAurumAlert(condition, eventMessage) =>
    if condition
        alert(eventMessage + " | " + syminfo.tickerid + " | TF " + timeframe.period, alert.freq_once_per_bar)

sendAurumAlert(trendLongSetup, oneHourPrecisionActive ? "P1 CONFIRMED: 1H pullback-rejection BUY" : "P1 CONFIRMED: trend long setup")
sendAurumAlert(trendShortSetup, oneHourPrecisionActive ? "P1 CONFIRMED: 1H pullback-rejection SELL" : "P1 CONFIRMED: trend short setup")
sendAurumAlert(longWatch, "WATCH ONLY: possible long reversal; wait for trigger")
sendAurumAlert(shortWatch, "WATCH ONLY: possible short reversal; wait for trigger")
sendAurumAlert(reversalLongConfirmed, "P2 CONFIRMED: reversal long trigger filled")
sendAurumAlert(reversalShortConfirmed, "P2 CONFIRMED: reversal short trigger filled")
sendAurumAlert(oneMinuteFlipShortConfirmed, "1M FAILURE CONFIRMED: exit BUY; scan for fresh SELL with new SL and TP1/TP2/TP3")
sendAurumAlert(oneMinuteFlipLongConfirmed, "1M FAILURE CONFIRMED: exit SELL; scan for fresh BUY with new SL and TP1/TP2/TP3")
sendAurumAlert(reentryLongCandidate, oneMinuteRecoveryActive and reentryForcedDirection == 1 ? "1M FLIP BUY ARMED: wait for yellow trigger; fresh SL and TP1/TP2/TP3 projected" : "P3 RESET WATCH: fresh BUY direction qualified; wait for trigger")
sendAurumAlert(reentryShortCandidate, oneMinuteRecoveryActive and reentryForcedDirection == -1 ? "1M FLIP SELL ARMED: wait for yellow trigger; fresh SL and TP1/TP2/TP3 projected" : "P3 RESET WATCH: fresh SELL direction qualified; wait for trigger")
sendAurumAlert(reentryLongConfirmed, oneMinuteRecoveryActive and reentryForcedDirection == 1 ? "1M FLIP BUY CONFIRMED: trigger filled with automatic SL and TP1/TP2/TP3" : "P3 RESET CONFIRMED: BUY trigger filled")
sendAurumAlert(reentryShortConfirmed, oneMinuteRecoveryActive and reentryForcedDirection == -1 ? "1M FLIP SELL CONFIRMED: trigger filled with automatic SL and TP1/TP2/TP3" : "P3 RESET CONFIRMED: SELL trigger filled")
sendAurumAlert(reentryScanExpired, "P3 RESET EXPIRED: no qualified post-SL entry")
sendAurumAlert(tp1FailureWarning, "TRADE HEALTH: TP1 approached but failed; possible reversal and increased SL risk")
sendAurumAlert(firstTP1Hit, protectAfterTP1 ? "TRADE MANAGEMENT: TP1 reached; 50% banked and remaining TP2/TP3 stop moves to protected profit on the next update" : "TRADE MANAGEMENT: TP1 reached; 50% banked")
sendAurumAlert(fiveMinuteProtectionExit, "5M PROTECTION: TP1 banked; confirmed fast-EMA reversal closed the remainder")
sendAurumAlert(halfToSLWarning, "TRADE HEALTH: price consumed half of the Entry-to-SL risk distance")
sendAurumAlert(lowerTFLongNoRoom, "LOWER-TF GUARD: WAIT; BUY has less than the required room to confirmed liquidity")
sendAurumAlert(lowerTFShortNoRoom, "LOWER-TF GUARD: WAIT; SELL has less than the required room to confirmed liquidity")
sendAurumAlert(avoidShort, "BAD ENTRY GUARD: avoid short into bullish pullback or sell-side sweep")
sendAurumAlert(avoidLong, "BAD ENTRY GUARD: avoid long into bearish rally or buy-side sweep")
sendAurumAlert(noChaseLong, "BAD ENTRY GUARD: no-chase long; wait for pullback")
sendAurumAlert(noChaseShort, "BAD ENTRY GUARD: no-chase short; wait for rally")
sendAurumAlert(volatilityShock and not blowOffTop and not blowOffBottom, "VOLATILITY SHOCK: abnormal candle or gap; no new trades")
sendAurumAlert(shockReset, "SHOCK RESET: resume scanning and wait for fresh confirmation")
sendAurumAlert(metalSyncBullishChanged, "GOLD + SILVER SYNC: GOOD and BULLISH; long setups may pass")
sendAurumAlert(metalSyncBearishChanged, "GOLD + SILVER SYNC: GOOD and BEARISH; short setups may pass")
sendAurumAlert(metalSyncLost, "GOLD + SILVER SYNC: NOT SYNCED; wait and cancel unfilled entries")
sendAurumAlert(fibLongRejection, "FIBONACCI WATCH: bullish rejection from 61.8-70.5 golden zone; wait for P1/P2/P3 confirmation")
sendAurumAlert(fibShortRejection, "FIBONACCI WATCH: bearish rejection from 61.8-70.5 golden zone; wait for P1/P2/P3 confirmation")
sendAurumAlert(buySideManipulation, "15M MANIPULATION: buy-side liquidity swept; avoid new longs and wait for fresh confirmation")
sendAurumAlert(sellSideManipulation, "15M MANIPULATION: sell-side liquidity swept; avoid new shorts and wait for fresh confirmation")
sendAurumAlert(blowOffTop, "15M BLOW-OFF TOP: extended exhaustion candle confirmed; wait, this is not an automatic short")
sendAurumAlert(blowOffBottom, "15M BLOW-OFF BOTTOM: extended exhaustion candle confirmed; wait, this is not an automatic long")`;

const swingStructureScript = String.raw`//@version=6
indicator("Asheparte AI · Swing High / Low + Consolidation", overlay = true, max_labels_count = 300, max_boxes_count = 80)

// Confirmed pivots print only after the right-side bars have closed.
leftBars = input.int(5, "Swing bars left", minval = 1, maxval = 25, group = "Swing High / Low")
rightBars = input.int(5, "Swing bars right", minval = 1, maxval = 25, group = "Swing High / Low")

// A range is marked only when price is compact and directionless relative to ATR.
rangeBars = input.int(20, "Consolidation lookback", minval = 8, maxval = 100, group = "Consolidation")
atrLength = input.int(14, "ATR length", minval = 5, maxval = 100, group = "Consolidation")
maxRangeATR = input.float(2.0, "Maximum range size (ATR)", minval = 0.5, maxval = 6.0, step = 0.1, group = "Consolidation")
maxNetMove = input.float(0.45, "Maximum net move / range", minval = 0.10, maxval = 0.90, step = 0.05, group = "Consolidation")
breakBufferATR = input.float(0.05, "Close breakout buffer (ATR)", minval = 0.0, maxval = 0.5, step = 0.01, group = "Consolidation")
boxFill = input.int(86, "Box transparency", minval = 60, maxval = 95, group = "Style")

swingHigh = ta.pivothigh(high, leftBars, rightBars)
swingLow = ta.pivotlow(low, leftBars, rightBars)

if not na(swingHigh)
    label.new(bar_index - rightBars, swingHigh, "Swing High", style = label.style_label_down, color = color.new(color.red, 5), textcolor = color.white, size = size.tiny)

if not na(swingLow)
    label.new(bar_index - rightBars, swingLow, "Swing Low", style = label.style_label_up, color = color.new(color.lime, 12), textcolor = color.white, size = size.tiny)

atr = ta.atr(atrLength)
candidateHigh = ta.highest(high, rangeBars)
candidateLow = ta.lowest(low, rangeBars)
candidateRange = candidateHigh - candidateLow
netMove = math.abs(close - close[rangeBars - 1])
enoughHistory = bar_index >= rangeBars - 1 and not na(atr)
compactRange = enoughHistory and candidateRange <= atr * maxRangeATR
directionless = enoughHistory and candidateRange > syminfo.mintick and netMove / candidateRange <= maxNetMove
rangeConfirmed = compactRange and directionless

var box consolidationBox = na
var float consolidationHigh = na
var float consolidationLow = na
var bool inConsolidation = false

if not inConsolidation and rangeConfirmed
    consolidationHigh := candidateHigh
    consolidationLow := candidateLow
    consolidationBox := box.new(left = bar_index - rangeBars + 1, top = consolidationHigh, right = bar_index, bottom = consolidationLow, border_color = color.new(color.aqua, 15), border_width = 1, bgcolor = color.new(color.blue, boxFill), text = "CONSOLIDATION", text_color = color.new(color.aqua, 5), text_size = size.tiny, text_halign = text.align_left, text_valign = text.align_top)
    inConsolidation := true

if inConsolidation
    breakoutBuffer = atr * breakBufferATR
    confirmedBreakout = close > consolidationHigh + breakoutBuffer or close < consolidationLow - breakoutBuffer
    box.set_right(consolidationBox, bar_index)
    if confirmedBreakout
        inConsolidation := false
        consolidationBox := na
        consolidationHigh := na
         consolidationLow := na`;

const volumeClusterScript = String.raw`//@version=6
// Original concept and open-source VCP code by Zeiierman.
// Modified by Asheparte AI: Pine v6 compatibility, bounded drawings,
// range-distributed candle volume, explicit approximation labels and compact UI.
indicator("Asheparte AI · Volume Cluster Profile [Zeiierman concept]", overlay = true, max_boxes_count = 260, max_lines_count = 30, max_labels_count = 20, max_bars_back = 5000)

lookback = input.int(250, "Profile lookback", minval = 50, maxval = 2000, group = "Profile")
rows = input.int(36, "Price rows", minval = 12, maxval = 60, group = "Profile")
widthBars = input.int(32, "Maximum width", minval = 8, maxval = 100, group = "Profile")
valueAreaPct = input.float(70.0, "Value area %", minval = 50, maxval = 95, step = 1, group = "Profile")
smoothRadius = input.int(2, "Cluster smoothing", minval = 0, maxval = 6, group = "Clusters")
clusterCount = input.int(3, "Cluster centers", minval = 1, maxval = 6, group = "Clusters")
showClusters = input.bool(true, "Show cluster centers", group = "Clusters")
showValueArea = input.bool(true, "Show VAH / VAL", group = "Levels")
profileColor = input.color(color.new(color.teal, 72), "Profile", group = "Style")
valueColor = input.color(color.new(color.aqua, 58), "Value area", group = "Style")
pocColor = input.color(color.yellow, "POC", group = "Style")
clusterColor = input.color(color.orange, "Clusters", group = "Style")

var array<box> drawnBoxes = array.new_box()
var array<line> drawnLines = array.new_line()
var array<label> drawnLabels = array.new_label()

clearDrawings() =>
    while array.size(drawnBoxes) > 0
        box.delete(array.pop(drawnBoxes))
    while array.size(drawnLines) > 0
        line.delete(array.pop(drawnLines))
    while array.size(drawnLabels) > 0
        label.delete(array.pop(drawnLabels))

clampInt(int value, int minimum, int maximum) =>
    math.max(minimum, math.min(maximum, value))

if barstate.islast
    clearDrawings()
    barsUsed = math.min(lookback, bar_index + 1)
    if barsUsed >= 20
        profileHigh = ta.highest(high, barsUsed)
        profileLow = ta.lowest(low, barsUsed)
        profileRange = profileHigh - profileLow
        if profileRange > syminfo.mintick
            rowSize = profileRange / rows
            raw = array.new_float(rows, 0.0)
            smoothed = array.new_float(rows, 0.0)

            // Spread each candle's volume evenly through every price row its range touches.
            // This remains a bar-data approximation; it is not exchange order-flow data.
            for offset = 0 to barsUsed - 1
                firstRow = clampInt(int(math.floor((low[offset] - profileLow) / rowSize)), 0, rows - 1)
                lastRow = clampInt(int(math.floor((high[offset] - profileLow) / rowSize)), 0, rows - 1)
                touched = math.max(1, lastRow - firstRow + 1)
                share = nz(volume[offset]) / touched
                for row = firstRow to lastRow
                    array.set(raw, row, array.get(raw, row) + share)

            for row = 0 to rows - 1
                weighted = 0.0
                weightSum = 0.0
                for neighbor = 0 to rows - 1
                    distance = math.abs(row - neighbor)
                    if distance <= smoothRadius
                        weight = smoothRadius == 0 ? 1.0 : math.exp(-0.5 * math.pow(distance / math.max(1.0, smoothRadius * 0.65), 2))
                        weighted += array.get(raw, neighbor) * weight
                        weightSum += weight
                array.set(smoothed, row, weightSum > 0 ? weighted / weightSum : array.get(raw, row))

            totalVolume = array.sum(smoothed)
            maxVolume = array.max(smoothed)
            pocRow = array.indexof(smoothed, maxVolume)
            lowerVA = pocRow
            upperVA = pocRow
            includedVolume = array.get(smoothed, pocRow)
            targetVolume = totalVolume * valueAreaPct / 100.0
            while includedVolume < targetVolume and (lowerVA > 0 or upperVA < rows - 1)
                belowVolume = lowerVA > 0 ? array.get(smoothed, lowerVA - 1) : -1.0
                aboveVolume = upperVA < rows - 1 ? array.get(smoothed, upperVA + 1) : -1.0
                if aboveVolume >= belowVolume and upperVA < rows - 1
                    upperVA += 1
                    includedVolume += aboveVolume
                else if lowerVA > 0
                    lowerVA -= 1
                    includedVolume += belowVolume

            anchorRight = bar_index
            for row = 0 to rows - 1
                relativeVolume = maxVolume > 0 ? array.get(smoothed, row) / maxVolume : 0.0
                rowWidth = math.max(1, int(math.round(relativeVolume * widthBars)))
                rowBottom = profileLow + row * rowSize
                rowTop = rowBottom + rowSize
                insideVA = row >= lowerVA and row <= upperVA
                fill = insideVA ? valueColor : profileColor
                profileBox = box.new(anchorRight - rowWidth + 1, rowTop, anchorRight, rowBottom, bgcolor = fill, border_color = color.new(fill, 38))
                array.push(drawnBoxes, profileBox)

            pocPrice = profileLow + (pocRow + 0.5) * rowSize
            vahPrice = profileLow + (upperVA + 1.0) * rowSize
            valPrice = profileLow + lowerVA * rowSize
            pocLine = line.new(anchorRight - widthBars + 1, pocPrice, anchorRight, pocPrice, color = pocColor, width = 2)
            array.push(drawnLines, pocLine)
            array.push(drawnLabels, label.new(anchorRight, pocPrice, "POC · approx", style = label.style_label_left, color = pocColor, textcolor = color.black, size = size.tiny))

            if showValueArea
                array.push(drawnLines, line.new(anchorRight - widthBars + 1, vahPrice, anchorRight, vahPrice, color = color.new(color.aqua, 10), style = line.style_dashed))
                array.push(drawnLines, line.new(anchorRight - widthBars + 1, valPrice, anchorRight, valPrice, color = color.new(color.aqua, 10), style = line.style_dashed))

            if showClusters
                candidates = array.new_int()
                for row = 0 to rows - 1
                    current = array.get(smoothed, row)
                    left = row > 0 ? array.get(smoothed, row - 1) : current
                    right = row < rows - 1 ? array.get(smoothed, row + 1) : current
                    if current >= left and current >= right
                        array.push(candidates, row)
                for pick = 0 to clusterCount - 1
                    if array.size(candidates) > 0
                        bestAt = 0
                        bestRow = array.get(candidates, 0)
                        bestVolume = array.get(smoothed, bestRow)
                        for candidateAt = 1 to array.size(candidates) - 1
                            candidateRow = array.get(candidates, candidateAt)
                            candidateVolume = array.get(smoothed, candidateRow)
                            if candidateVolume > bestVolume
                                bestAt := candidateAt
                                bestRow := candidateRow
                                bestVolume := candidateVolume
                        clusterPrice = profileLow + (bestRow + 0.5) * rowSize
                        array.push(drawnLines, line.new(anchorRight - widthBars + 1, clusterPrice, anchorRight, clusterPrice, color = color.new(clusterColor, 15), style = line.style_dotted))
                        array.remove(candidates, bestAt)`;

export default function Home() {
  const [workspacePanel, setWorkspacePanel] = useState<WorkspacePanel>('desk');
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState('16:42:08');
  const [widgetRefresh, setWidgetRefresh] = useState(0);
  const [scriptCopied, setScriptCopied] = useState(false);
  const [structureScriptCopied, setStructureScriptCopied] = useState(false);
  const [volumeScriptCopied, setVolumeScriptCopied] = useState(false);
  const [demoJournalEnabled, setDemoJournalEnabled] = useState(true);
  const [journalCalendarMode, setJournalCalendarMode] = useState<'month' | 'year'>('month');
  const [journalCalendarCursor, setJournalCalendarCursor] = useState({ year: 2026, month: 8 });
  const [pineScriptView, setPineScriptView] = useState<'structure' | 'volume' | 'combined'>('structure');
  const [liveMarket, setLiveMarket] = useState<LiveMarketKey>('gold');
  const [timeframe, setTimeframe] = useState('60');
  const activeLiveMarket = liveMarkets.find((market) => market.key === liveMarket) ?? liveMarkets[0];

  useEffect(() => {
    const syncPanelFromHash = () => {
      const hash = window.location.hash;
      if (hash === '#live-chart') setWorkspacePanel('charts');
      else if (hash === '#pine-script') setWorkspacePanel('pine');
      else if (hash === '#mt5-bot') setWorkspacePanel('mt5');
      else if (hash === '#journal' || hash === '#trade-journal') setWorkspacePanel('journal');
      else if (hash === '#chart-guide' || hash === '#pattern-playbook' || hash === '#fibonacci-guide' || hash === '#reversal-playbook') setWorkspacePanel('guides');
      else if (hash === '#risk-plan' || hash === '#news' || hash === '#news-radar') setWorkspacePanel('risk');
    };
    syncPanelFromHash();
    window.addEventListener('hashchange', syncPanelFromHash);
    return () => window.removeEventListener('hashchange', syncPanelFromHash);
  }, []);

  function openWorkspace(panel: WorkspacePanel, hash = panel) {
    setWorkspacePanel(panel);
    window.history.replaceState(null, '', `#${hash}`);
    window.requestAnimationFrame(() => {
      document.getElementById('workspace-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

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

  async function copyStructureScript() {
    await navigator.clipboard.writeText(swingStructureScript);
    setStructureScriptCopied(true);
    window.setTimeout(() => setStructureScriptCopied(false), 1600);
  }

  async function copyVolumeScript() {
    await navigator.clipboard.writeText(volumeClusterScript);
    setVolumeScriptCopied(true);
    window.setTimeout(() => setVolumeScriptCopied(false), 1600);
  }

  function selectMetal(value: LiveMarketKey) {
    setLiveMarket(value);
  }

  function shiftJournalCalendar(direction: number) {
    setJournalCalendarCursor((cursor) => {
      if (journalCalendarMode === 'year') return { year: cursor.year + direction, month: cursor.month };
      const next = new Date(cursor.year, cursor.month + direction, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  const monthStartWeekday = new Date(journalCalendarCursor.year, journalCalendarCursor.month, 1).getDay();
  const daysInJournalMonth = new Date(journalCalendarCursor.year, journalCalendarCursor.month + 1, 0).getDate();
  const journalCalendarCells = Array.from({ length: Math.ceil((monthStartWeekday + daysInJournalMonth) / 7) * 7 }, (_, index) => {
    const day = index - monthStartWeekday + 1;
    return day >= 1 && day <= daysInJournalMonth ? day : null;
  });

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="glass-chrome z-30 shrink-0 border-b border-sky-200/10">
        <div className="mx-auto flex h-14 max-w-[1800px] items-center justify-between px-3 sm:px-5 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl border border-primary/35 bg-primary/10 text-primary shadow-[0_0_32px_rgba(225,177,78,.12)]">
              <Bot className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading text-[15px] font-semibold tracking-tight">Asheparte AI</span>
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
            <button
              type="button"
              onClick={() => openWorkspace('mt5', 'mt5-bot')}
              className="hidden h-9 items-center gap-2 rounded-lg border border-emerald-300/25 bg-emerald-300/[.07] px-3 text-xs font-medium text-emerald-200 transition hover:bg-emerald-300/10 lg:inline-flex"
            >
              <Bot className="size-4" /> MT5 bot
            </button>
            <button
              type="button"
              onClick={() => openWorkspace('risk', 'news-radar')}
              className="hidden h-9 items-center gap-2 rounded-lg border border-red-300/25 bg-red-300/[.07] px-3 text-xs font-medium text-red-200 transition hover:bg-red-300/10 sm:inline-flex"
            >
              <Newspaper className="size-4" /> News radar
            </button>
            <button
              type="button"
              onClick={() => openWorkspace('pine', 'pine-script')}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 text-xs font-medium text-primary transition hover:bg-primary/15"
            >
              <Code2 className="size-4" />
              <span className="hidden sm:inline">Pine Scripts</span>
              <span className="sm:hidden">Script</span>
            </button>
            <Button variant="outline" className="border-white/10 bg-white/[.03] text-xs" onClick={runScan} disabled={scanning}>
              <RefreshCw className={scanning ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{scanning ? 'Refreshing' : 'Refresh live data'}</span>
              <span className="sm:hidden">{scanning ? 'Wait' : 'Refresh'}</span>
            </Button>
          </div>
        </div>
      </header>

      <nav className="glass-chrome shrink-0 border-b border-sky-200/10 px-2 py-2" aria-label="Trader workspace">
        <div className="mx-auto flex max-w-[1800px] gap-1 overflow-x-auto">
          {([
            ['desk', 'Desk', LineChart],
            ['charts', 'Charts', CandlestickChart],
            ['pine', 'Pine strategy', Code2],
            ['mt5', 'MT5', Bot],
            ['journal', 'Journal', Database],
            ['guides', 'Guides', BookOpenCheck],
            ['risk', 'Risk & news', ShieldCheck],
          ] as const).map(([panel, label, Icon]) => (
            <button
              key={panel}
              type="button"
              onClick={() => openWorkspace(panel, panel === 'charts' ? 'live-chart' : panel === 'pine' ? 'pine-script' : panel === 'mt5' ? 'mt5-bot' : panel === 'journal' ? 'trade-journal' : panel === 'guides' ? 'chart-guide' : panel === 'risk' ? 'news-radar' : 'desk')}
              className={`flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition ${workspacePanel === panel ? 'border-primary/35 bg-primary/12 text-primary shadow-[0_0_24px_rgba(225,177,78,.08)]' : 'border-transparent text-muted-foreground hover:border-white/10 hover:bg-white/[.04] hover:text-foreground'}`}
              aria-pressed={workspacePanel === panel}
            >
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>
      </nav>

      <div id="workspace-scroll" className="mx-auto min-h-0 w-full max-w-[1800px] flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 lg:px-6">
        <section className={workspacePanel === 'desk' ? 'mb-5' : 'hidden'}>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[.16em] text-primary">
                <Sparkles className="size-3.5" /> Live decision workspace
              </div>
              <h1 className="font-heading text-2xl font-semibold tracking-[-.03em] sm:text-3xl">Gold and silver trading desk</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Chart context, guarded setups and account-aware analytics in one blue-glass workspace.</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-sky-200/15 bg-sky-300/[.055] px-3 py-2 text-[11px] text-sky-100">
              <span className="size-2 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(253,224,71,.7)]" />
              ACCM demo snapshot connected
            </div>
          </div>
        </section>

        <section className={workspacePanel === 'desk' ? 'mb-4 grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]' : 'hidden'} aria-label="Trading desk overview">
          <Card className="min-w-0 border-sky-300/20">
            <CardHeader className="border-b border-sky-200/10 pb-3">
              <CardTitle className="flex items-center gap-2"><CandlestickChart className="size-4 text-cyan-300" /> XAUUSD live chart</CardTitle>
              <CardDescription>Account-independent market view · H1 by default</CardDescription>
              <CardAction>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="hidden border-cyan-300/20 bg-cyan-300/[.06] text-cyan-100 sm:inline-flex" onClick={() => openWorkspace('pine', 'pine-script')}>
                    <Code2 className="size-3.5" /> Use Aurum Pine
                  </Button>
                  <Badge className="border border-emerald-300/20 bg-emerald-300/10 text-emerald-200"><RadioTower className="size-3" /> LIVE</Badge>
                </div>
              </CardAction>
            </CardHeader>
            <CardContent className="p-2 sm:p-3">
              <div className="overflow-hidden rounded-xl border border-sky-200/12 bg-[#071525]/85">
                <TradingViewChart
                  key={`desk-${widgetRefresh}`}
                  symbol="OANDA:XAUUSD"
                  interval="60"
                  label="Gold"
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid content-start gap-4">
            <Card className="border-cyan-300/20">
              <CardHeader className="border-b border-sky-200/10 pb-3">
                <CardTitle className="flex items-center gap-2"><UserRound className="size-4 text-cyan-300" /> MT5 / ACCM account</CardTitle>
                <CardDescription>Public demo snapshot · read-only</CardDescription>
                <CardAction><Badge variant="outline" className="border-emerald-300/25 text-emerald-200">DEMO</Badge></CardAction>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="rounded-xl border border-sky-200/12 bg-sky-950/25 p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-sky-100"><Database className="size-4 text-cyan-300" /> ACCMIntl-Demo · 316•••</div>
                  <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Snapshot imported from the read-only combined advisor. It is demonstration data, not a live or real-money account connection.</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[['Balance', '$100,261.20'], ['Equity', '$100,261.20'], ['Free margin', '$100,261.20'], ['Open P/L', '$0.00']].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-sky-200/10 bg-white/[.025] p-2.5">
                      <p className="text-[9px] uppercase tracking-[.11em] text-muted-foreground">{label}</p>
                      <p className="mt-1 font-mono text-sm text-sky-100">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button disabled className="border border-sky-300/15 bg-sky-300/10 text-sky-200 opacity-70">
                    <PlugZap className="size-4" /> MT5
                  </Button>
                  <Button disabled className="border border-amber-300/15 bg-amber-300/[.08] text-amber-200 opacity-70">
                    <PlugZap className="size-4" /> ACCM
                  </Button>
                </div>
                <Button variant="outline" className="mt-2 w-full border-white/10 bg-white/[.025]" onClick={() => openWorkspace('journal', 'trade-journal')}>
                  <BookOpenCheck className="size-4" /> Open account journal
                </Button>
              </CardContent>
            </Card>

            <Card className="border-sky-300/18" size="sm">
              <CardContent>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-cyan-300" />
                  <div>
                    <p className="text-xs font-medium text-sky-100">Prepared for account isolation</p>
                    <p className="mt-1 text-[10px] leading-4 text-muted-foreground">Future balances, orders and history will be scoped by the authenticated account—not shared globally or stored in this browser UI.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <div className={workspacePanel === 'risk' ? 'block' : 'hidden'}>
          <NewsSpikeRadar />
        </div>

        <section id="trade-journal" className={workspacePanel === 'journal' ? 'space-y-4' : 'hidden'} aria-labelledby="trade-journal-heading">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[.16em] text-cyan-300">
                <Database className="size-3.5" /> Account performance
              </div>
              <h1 id="trade-journal-heading" className="font-heading text-2xl font-semibold tracking-[-.03em] sm:text-3xl">MT5 / ACCM trading journal</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Closed trades become a daily record of profit, loss, fees and execution quality for the MT5 or ACCM account linked to the signed-in user.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className={demoJournalEnabled ? 'border-red-300/20 bg-red-300/[.04] text-red-200' : 'border-cyan-300/20 bg-cyan-300/[.05] text-cyan-100'} onClick={() => setDemoJournalEnabled((enabled) => !enabled)}>
                {demoJournalEnabled ? 'Hide demo' : 'Show ACCM demo'}
              </Button>
              <Badge variant="outline" className={demoJournalEnabled ? 'w-fit border-fuchsia-300/25 bg-fuchsia-300/[.08] px-3 py-1.5 text-fuchsia-200' : 'w-fit border-amber-300/25 bg-amber-300/[.06] px-3 py-1.5 text-amber-200'}>{demoJournalEnabled ? 'ACCM DEMO SNAPSHOT' : 'DEMO HIDDEN'}</Badge>
            </div>
          </div>

          <Card className="overflow-hidden border-cyan-300/18 bg-[linear-gradient(135deg,rgba(34,211,238,.055),rgba(251,191,36,.035),rgba(5,18,32,.82))]">
            <CardContent className="grid gap-3 pt-4 md:grid-cols-2">
              <div className="rounded-xl border border-sky-300/15 bg-sky-300/[.035] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-xs font-semibold text-sky-100"><PlugZap className="size-4 text-cyan-300" /> Standard MT5</p>
                  <Badge variant="outline" className="border-emerald-300/20 text-[9px] text-emerald-200">BRIDGE READY</Badge>
                </div>
                <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Connect any supported MT5 broker through the Asheparte read-only journal bridge. Closed deals and account metrics use the broker server as their source.</p>
              </div>
              <div className="rounded-xl border border-amber-300/15 bg-amber-300/[.035] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-xs font-semibold text-amber-100"><Landmark className="size-4 text-amber-300" /> ACCM account</p>
                  <Badge variant="outline" className="border-amber-300/20 text-[9px] text-amber-200">VIA MT5</Badge>
                </div>
                <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Select ACCM, then connect the ACCM MT5 login and exact broker server through the same bridge. ACCM trades remain labeled as an ACCM source in the journal.</p>
              </div>
              <div className="md:col-span-2 flex flex-col gap-2 rounded-xl border border-white/8 bg-black/15 px-4 py-3 text-[10px] leading-4 text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>Connection fields will stay server-side. The browser journal will never request or retain the master trading password.</span>
                <Badge className="w-fit shrink-0 border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">READ-ONLY JOURNAL</Badge>
              </div>
              <div className="md:col-span-2 grid gap-3 rounded-xl border border-cyan-300/12 bg-[#041326]/55 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <p className="text-xs font-semibold text-cyan-100">Install the combined analysis + journal advisor</p>
                  <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">One analysis-only EA now provides the chart dashboard and read-only journal sync. Add <span className="font-mono text-sky-100">https://asheparte-ai.vercel.app</span> to MT5 WebRequest permissions before pairing a future hosted journal.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href="/downloads/AurumGuardAnalysisAdvisor.ex5" download>
                    <Button className="bg-cyan-300 text-[#03121f] hover:bg-cyan-200"><Download className="size-4" /> Download combined EA</Button>
                  </a>
                  <a href="/downloads/AurumGuardAnalysisAdvisor.mq5" download>
                    <Button variant="outline" className="border-white/10 bg-white/[.025]"><Code2 className="size-4" /> Source</Button>
                  </a>
                </div>
              </div>
              <div className="md:col-span-2 grid gap-2 sm:grid-cols-3">
                {[
                  ['1 · Install', 'Put the combined EA in MT5 Experts and attach it to one chart.'],
                  ['2 · Analyze', 'Chart guidance and the account journal run together without trade execution.'],
                  ['3 · Pair later', 'Hosted continuous sync activates after private storage and sign-in are added.'],
                ].map(([step, detail]) => (
                  <div key={step} className="rounded-lg border border-white/8 bg-white/[.025] p-3">
                    <p className="text-[10px] font-semibold text-sky-100">{step}</p>
                    <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{detail}</p>
                  </div>
                ))}
              </div>
              <div className="md:col-span-2 flex flex-col gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[.035] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-amber-100">Pairing token</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">This public version displays a masked ACCM demo snapshot. Tokens remain local and are never published.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="border-cyan-300/20 bg-cyan-300/[.05] text-cyan-100" onClick={() => setDemoJournalEnabled(true)}><BookOpenCheck className="size-4" /> Try demo journal</Button>
                  <Button disabled variant="outline" className="shrink-0 border-amber-300/15 bg-amber-300/[.04] text-amber-200 opacity-65"><LockKeyhole className="size-4" /> Generate token</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Net P/L', demoJournalEnabled ? '+$261.20' : '—', 'Profit − loss − costs', 'text-sky-100'],
              ['Gross profit', demoJournalEnabled ? '$306.00' : '—', 'Sum of winning trades', 'text-emerald-300'],
              ['Gross loss', demoJournalEnabled ? '−$44.80' : '—', 'Sum of losing trades', 'text-red-300'],
              ['Closed trades', demoJournalEnabled ? '3' : '—', 'Completed deals only', 'text-amber-200'],
            ].map(([label, value, note, tone]) => (
              <Card key={label} className="border-sky-300/15 bg-[linear-gradient(145deg,rgba(56,189,248,.055),rgba(5,18,32,.78))]" size="sm">
                <CardContent>
                  <p className="text-[9px] font-medium uppercase tracking-[.13em] text-muted-foreground">{label}</p>
                  <p className={`mt-2 font-mono text-xl font-semibold ${tone}`}>{value}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{note}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="overflow-hidden border-fuchsia-300/15 bg-[linear-gradient(145deg,rgba(192,132,252,.045),rgba(5,18,32,.84)_48%)]">
            <CardHeader className="border-b border-white/7 pb-3">
              <CardTitle className="flex items-center gap-2"><Clock3 className="size-4 text-fuchsia-300" /> Profit &amp; loss calendar</CardTitle>
              <CardDescription>Green days are profitable, red days are losses, and empty days have no closed trades.</CardDescription>
              <CardAction>
                <div className="flex rounded-lg border border-white/10 bg-black/15 p-0.5">
                  {(['month', 'year'] as const).map((mode) => (
                    <button key={mode} type="button" aria-pressed={journalCalendarMode === mode} onClick={() => setJournalCalendarMode(mode)} className={`rounded-md px-3 py-1.5 text-[10px] font-semibold capitalize transition ${journalCalendarMode === mode ? 'bg-fuchsia-300 text-[#190a20]' : 'text-muted-foreground hover:text-foreground'}`}>{mode}</button>
                  ))}
                </div>
              </CardAction>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <Button variant="outline" size="sm" className="size-8 border-white/10 bg-white/[.025] p-0" aria-label={`Previous ${journalCalendarMode}`} onClick={() => shiftJournalCalendar(-1)}>←</Button>
                <div className="text-center">
                  <p className="text-sm font-semibold text-sky-50">{journalCalendarMode === 'month' ? `${journalMonthNames[journalCalendarCursor.month]} ${journalCalendarCursor.year}` : journalCalendarCursor.year}</p>
                  <p className="mt-1 text-[9px] uppercase tracking-[.12em] text-muted-foreground">{demoJournalEnabled ? 'ACCM demo snapshot' : 'Demo hidden'}</p>
                </div>
                <Button variant="outline" size="sm" className="size-8 border-white/10 bg-white/[.025] p-0" aria-label={`Next ${journalCalendarMode}`} onClick={() => shiftJournalCalendar(1)}>→</Button>
              </div>

              {journalCalendarMode === 'month' ? (
                <div>
                  <div className="grid grid-cols-7 gap-1.5 text-center text-[9px] font-medium uppercase tracking-[.08em] text-muted-foreground">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day} className="py-1">{day}</span>)}
                  </div>
                  <div className="mt-1.5 grid grid-cols-7 gap-1.5">
                    {journalCalendarCells.map((day, index) => {
                      const dateKey = day ? `${journalCalendarCursor.year}-${String(journalCalendarCursor.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
                      const result = demoJournalEnabled ? demoDailyJournal[dateKey] : undefined;
                      return (
                        <div key={`${index}-${day ?? 'blank'}`} className={`min-h-16 rounded-lg border p-2 sm:min-h-20 ${day === null ? 'border-transparent bg-transparent' : result === undefined ? 'border-white/7 bg-white/[.018]' : result >= 0 ? 'border-emerald-300/20 bg-emerald-300/[.07]' : 'border-red-300/20 bg-red-300/[.07]'}`}>
                          {day !== null && <><p className="text-[10px] text-muted-foreground">{day}</p>{result !== undefined && <><p className={`mt-2 font-mono text-[11px] font-semibold ${result >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{result >= 0 ? '+' : '−'}${Math.abs(result).toFixed(2)}</p><p className="mt-1 text-[8px] text-muted-foreground">{day === 7 ? '3 trades' : '3 trades'}</p></>}</>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {journalMonthNames.map((month, monthIndex) => {
                    const value = demoJournalEnabled && journalCalendarCursor.year === 2026 && monthIndex === 8 ? 261.20 : undefined;
                    return (
                      <button key={month} type="button" onClick={() => { setJournalCalendarCursor({ year: journalCalendarCursor.year, month: monthIndex }); setJournalCalendarMode('month'); }} className={`rounded-xl border p-3 text-left transition hover:border-fuchsia-300/25 ${value === undefined ? 'border-white/8 bg-white/[.02]' : value >= 0 ? 'border-emerald-300/20 bg-emerald-300/[.06]' : 'border-red-300/20 bg-red-300/[.06]'}`}>
                        <p className="text-[10px] font-medium text-muted-foreground">{month.slice(0, 3)}</p>
                        <p className={`mt-2 font-mono text-sm font-semibold ${value === undefined ? 'text-sky-100' : value >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{value === undefined ? '—' : `${value >= 0 ? '+' : '−'}$${Math.abs(value).toFixed(2)}`}</p>
                        <p className="mt-1 text-[9px] text-muted-foreground">{value === undefined ? 'No trades' : '3 trades'}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,.5fr)]">
            <Card className="min-w-0 overflow-hidden border-sky-300/18">
              <CardHeader className="border-b border-white/7 pb-3">
                <CardTitle className="flex items-center gap-2"><BookOpenCheck className="size-4 text-cyan-300" /> Trade history</CardTitle>
                <CardDescription>{demoJournalEnabled ? 'Three closed trades from the masked ACCM demo snapshot' : 'One row per closed MT5 deal · broker-reported values'}</CardDescription>
                <CardAction><Badge variant="outline" className={demoJournalEnabled ? 'border-fuchsia-300/20 text-fuchsia-200' : 'border-white/10 text-muted-foreground'}>{demoJournalEnabled ? 'DEMO' : 'All time'}</Badge></CardAction>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <div className="grid min-w-[760px] grid-cols-[1.1fr_.7fr_.55fr_.6fr_1fr_.7fr_.7fr] gap-3 border-b border-white/7 bg-white/[.025] px-4 py-2.5 text-[9px] font-semibold uppercase tracking-[.1em] text-muted-foreground">
                    <span>Closed</span><span>Symbol</span><span>Side</span><span>Volume</span><span>Entry → exit</span><span>Costs</span><span className="text-right">Net P/L</span>
                  </div>
                  {demoJournalEnabled ? (
                    <div className="min-w-[760px] divide-y divide-white/6">
                      {demoJournalTrades.map((trade) => (
                        <div key={`${trade.closed}-${trade.side}`} className="grid grid-cols-[1.1fr_.7fr_.55fr_.6fr_1fr_.7fr_.7fr] gap-3 px-4 py-3 text-[10px] text-sky-50">
                          <span className="text-muted-foreground">{trade.closed}</span>
                          <span>{trade.symbol}</span>
                          <span className={trade.side === 'BUY' ? 'text-emerald-300' : 'text-red-300'}>{trade.side}</span>
                          <span className="font-mono">{trade.volume}</span>
                          <span className="font-mono text-muted-foreground">{trade.prices}</span>
                          <span className="font-mono text-muted-foreground">{trade.costs}</span>
                          <span className={`text-right font-mono font-semibold ${trade.net >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{trade.net >= 0 ? '+' : '−'}${Math.abs(trade.net).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid min-h-44 place-items-center px-5 py-10 text-center">
                      <div>
                        <Database className="mx-auto size-7 text-cyan-300/65" />
                        <p className="mt-3 text-sm font-medium text-sky-100">Waiting for linked account history</p>
                        <p className="mx-auto mt-2 max-w-md text-[11px] leading-5 text-muted-foreground">No sample trades are shown. Load the demo journal to test this page, or connect the secure bridge later for real MT5 or ACCM history.</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid content-start gap-4">
              <Card className="border-emerald-300/15" size="sm">
                <CardContent>
                  <p className="text-xs font-semibold text-emerald-200">Daily performance</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[
                      ['Win rate', demoJournalEnabled ? '33.3%' : '—'],
                      ['Profit factor', demoJournalEnabled ? '6.83' : '—'],
                      ['Average win', demoJournalEnabled ? '$306.00' : '—'],
                      ['Average loss', demoJournalEnabled ? '−$22.40' : '—'],
                    ].map(([metric, value]) => (
                      <div key={metric} className="rounded-lg border border-white/8 bg-white/[.025] p-2.5">
                        <p className="text-[9px] text-muted-foreground">{metric}</p>
                        <p className="mt-1 font-mono text-sm text-sky-100">{value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-cyan-300/15" size="sm">
                <CardContent className="flex gap-3">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-cyan-300" />
                  <div>
                    <p className="text-xs font-medium text-sky-100">Private by account</p>
                    <p className="mt-1 text-[10px] leading-4 text-muted-foreground">The bridge will submit account number, deal ticket, timestamps, symbol, side, volume, prices, commission, swap and realized P/L. Each record must be scoped to its authenticated owner.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="rounded-xl border border-amber-300/15 bg-amber-300/[.035] px-4 py-3 text-[10px] leading-5 text-muted-foreground">
            {demoJournalEnabled ? 'Public demo snapshot from ACCMIntl-Demo, captured September 10, 2026. The login is masked, the bridge token is not included, and these values do not update continuously yet.' : 'Deposits and withdrawals are excluded from trading results, preventing added funds from being mistaken for profit. Show the demo to inspect the masked broker-reported snapshot.'}
          </div>
        </section>

        <section id="mt5-bot" className={workspacePanel === 'mt5' ? 'mb-4' : 'hidden'} aria-labelledby="mt5-bot-heading">
          <Card className="overflow-hidden border-emerald-300/20 bg-[linear-gradient(135deg,rgba(52,211,153,.085),rgba(34,211,238,.045)_48%,rgba(18,22,27,.97))] shadow-[0_22px_80px_rgba(0,0,0,.22)]">
            <CardHeader className="border-b border-white/7 pb-4">
              <CardTitle id="mt5-bot-heading" className="flex items-center gap-2 text-lg"><Bot className="size-5 text-emerald-300" /> Asheparte AI MT5 Auto Trader</CardTitle>
              <CardDescription>MT5 v1.90 · M15/M30/H1 consolidation/POC → sweep → displacement → POC-return entry · fixed 0.01 lot · 2.14R target</CardDescription>
              <CardAction><Badge className="border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">DEMO ENTRIES ON</Badge></CardAction>
            </CardHeader>
            <CardContent className="grid gap-5 pt-5 xl:grid-cols-[1.1fr_.9fr]">
              <div className="grid content-start gap-4">
                <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/[.045] p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="max-w-2xl">
                      <p className="text-sm font-semibold text-emerald-100">MT5 Expert Advisor for demo testing</p>
                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Trades M15–H1 POC pullbacks with 0.01 lot, structural SL and a 2.14R target. M1 entries, martingale and revenge trading are disabled.</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <a
                        href="./downloads/AurumGuardAutoTrader.mq5"
                        download
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-200"
                      >
                        <Download className="size-4" /> Download MT5 v1.90
                      </a>
                      <a
                        href="./downloads/AurumGuardAI.zip"
                        download
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-4 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
                      >
                        <Sparkles className="size-4" /> Download AI layer
                      </a>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    ['1 · Range', 'Find consolidation and estimate its tick-volume POC.'],
                    ['2 · Sweep', 'Wait for price to take liquidity beyond the range.'],
                    ['3 · Move', 'Confirm displacement; do not chase the breakout candle.'],
                    ['4 · Entry', 'Enter only after a defended return to POC.'],
                  ].map(([title, description]) => (
                    <div key={title} className="rounded-xl border border-white/8 bg-black/15 p-3">
                      <p className="text-[10px] font-semibold text-emerald-200">{title}</p>
                      <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{description}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-violet-300/20 bg-violet-300/[.045] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-xs font-semibold text-violet-100"><Sparkles className="size-3.5" /> AI research status</p>
                    <Badge variant="outline" className="border-amber-300/25 text-amber-200">SHADOW ONLY</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-4">
                    {[
                      ['95', 'Test trades'],
                      ['48.4%', 'Win rate'],
                      ['+7.11R', 'Net after costs'],
                      ['1.30', 'Profit factor'],
                    ].map(([value, label]) => (
                      <div key={label} className="rounded-lg border border-white/8 bg-black/15 p-2.5">
                        <p className="font-heading text-sm font-semibold text-violet-100">{value}</p>
                        <p className="mt-0.5 text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] leading-4 text-amber-100/85">Promising recent results, but the full research gate still failed. Keep <span className="font-mono">AIShadowMode = true</span>; AI approval must not place orders yet.</p>
                </div>
              </div>

              <div className="grid content-start gap-4">
                <div className="rounded-xl border border-white/9 bg-black/15 p-4">
                  <p className="text-xs font-semibold">Safe defaults included</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                    {[
                      ['0.01', 'Fixed lot size'],
                      ['$7.50', 'Default planned SL'],
                      ['$20', 'Final TP per trade'],
                      ['$7.50', 'One-loss daily lock'],
                    ].map(([value, label]) => (
                      <div key={label} className="rounded-lg border border-white/8 bg-white/[.025] p-3">
                        <p className="font-heading text-base font-semibold text-primary">{value}</p>
                        <p className="mt-0.5 text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] leading-4 text-muted-foreground">Broker support for 0.01 lot is required. Slippage, gaps and commission can change the actual result.</p>
                </div>

                <div className="rounded-xl border border-amber-300/20 bg-amber-300/[.04] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-amber-100">Broad M1 research result</p>
                    <Badge variant="outline" className="border-red-300/25 text-red-200">NOT LIVE READY</Badge>
                  </div>
                  <p className="mt-1 text-[10px] leading-4 text-muted-foreground">XAUUSD M1 · January–September 2026 · every tick</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                    {[
                      ['+$0.04', 'Net result'],
                      ['1.00', 'Profit factor'],
                      ['0.19%', 'Max equity drawdown'],
                      ['7', 'Total trades'],
                    ].map(([value, label]) => (
                      <div key={label} className="rounded-lg border border-white/8 bg-black/15 p-2.5">
                        <p className="font-heading text-sm font-semibold text-amber-100">{value}</p>
                        <p className="mt-0.5 text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] leading-4 text-red-100/85">Failed validation: too few trades and no measured edge. This is not a profit forecast.</p>
                </div>

                <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[.035] p-4">
                  <p className="text-xs font-semibold text-cyan-100">Install in MetaTrader 5</p>
                  <ol className="mt-2 space-y-2 text-[10px] leading-4 text-muted-foreground">
                    <li><span className="mr-2 font-semibold text-cyan-200">1.</span>Download the EA and copy it to <span className="font-mono text-foreground">MQL5/Experts</span>.</li>
                    <li><span className="mr-2 font-semibold text-cyan-200">2.</span>Compile it in MetaEditor with F7.</li>
                    <li><span className="mr-2 font-semibold text-cyan-200">3.</span>Attach it to a Gold chart and enter the correct Silver symbol.</li>
                    <li><span className="mr-2 font-semibold text-cyan-200">4.</span>On demo only, enable Algo Trading and <span className="font-mono text-foreground">EnableNewEntries</span>.</li>
                    <li><span className="mr-2 font-semibold text-cyan-200">5.</span>Keep <span className="font-mono text-foreground">AIShadowMode = true</span> and monitor Experts/Journal.</li>
                  </ol>
                </div>

                <div className="rounded-xl border border-amber-300/20 bg-amber-300/[.04] p-3 text-[10px] leading-4 text-muted-foreground">
                  <p><span className="font-semibold text-amber-200">Keep MT5 running:</span> the website cannot place orders. MT5 must stay connected on your PC or VPS. No EA guarantees profit.</p>
                </div>
              </div>
            </CardContent>
          </Card>

        </section>

        <section id="chart-guide" className={workspacePanel === 'guides' ? 'mb-4' : 'hidden'} aria-labelledby="chart-guide-heading">
          <Card className="overflow-hidden border-cyan-300/15 bg-[linear-gradient(145deg,rgba(34,211,238,.055),rgba(18,22,27,.96)_42%)]">
            <CardHeader className="border-b border-white/7 pb-4">
              <CardTitle id="chart-guide-heading" className="flex items-center gap-2 text-lg"><BookOpenCheck className="size-5 text-cyan-300" /> How to read the chart</CardTitle>
              <CardDescription>Read ACTION first. If it says WAIT, do not treat anything else as an entry.</CardDescription>
              <CardAction><Badge className="border border-lime-300/20 bg-lime-300/10 text-lime-200">SIMPLE MODE</Badge></CardAction>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="hidden" aria-hidden="true">
              <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
              <div className="rounded-xl border border-lime-300/20 bg-lime-300/[.045] p-4 xl:col-span-2">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-lime-100">The simple rule: trust the ACTION row</p>
                    <p className="mt-1 max-w-3xl text-[11px] leading-5 text-muted-foreground">The small panel at the chart’s top-right now combines every filter. A P1, P2 or P3 idea is actionable only when ACTION changes from WAIT to a confirmed BUY SIGNAL or SELL SIGNAL at candle close.</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                    <span className="rounded-lg border border-lime-300/20 bg-lime-300/10 px-3 py-2 text-lime-200">BUY SIGNAL · GREEN</span>
                    <span className="rounded-lg border border-red-300/20 bg-red-300/10 px-3 py-2 text-red-200">SELL SIGNAL · RED</span>
                    <span className="rounded-lg border border-orange-300/20 bg-orange-300/10 px-3 py-2 text-orange-200">WAIT · NO ENTRY</span>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ['P1 · DEFENDED', 'WAIT DEFENSE is not an entry. BUY/SELL appears only after a completed pullback and a strong reclaim close; on 1H it also requires the daily-aligned 20 EMA retest.', 'border-cyan-300/20 text-cyan-200'],
                    ['P2 · REVERSAL', 'ARMED means a liquidity-sweep reversal passed its first check. Keep waiting until price crosses the yellow trigger and BUY/SELL P2 appears.', 'border-emerald-300/20 text-emerald-200'],
                    ['P3 · RESET', 'SCANNING or ARMED means the post-stop reset is searching. It becomes actionable only when BUY/SELL P3 appears after its trigger.', 'border-purple-300/20 text-purple-200'],
                    ['1M · FAILURE FLIP', 'FLIP WATCH is only a warning. BUY/SELL 1M FLIP appears after an opposite candle closes, the old trade exits, one candle passes and the fresh trigger fills.', 'border-red-300/20 text-red-200'],
                  ].map(([label, description, color]) => (
                    <div key={label} className={`rounded-lg border bg-black/15 p-3 ${color}`}>
                      <p className="text-[10px] font-bold tracking-[.05em]">{label}</p>
                      <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{description}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 border-t border-lime-300/10 pt-3 text-[10px] leading-4 text-muted-foreground"><span className="font-semibold text-amber-200">FORMING, ARMED and SCANNING are advance warnings—not entries.</span> There is no honest way to know that P1–P3 “will” appear before the completed candle satisfies every rule.</p>
              </div>

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
                    ['bg-emerald-400', 'Green ladder', 'TP1 at 1R · TP2 at 1.5R · TP3 at the final target'],
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
                      ['BUY / SELL · P1', 'Highest priority', 'On the 1H chart, a pullback and rejection entry confirmed after daily direction, 20/50 EMA trend, RSI, volatility and metals sync all passed.', 'border-cyan-300/20 bg-cyan-300/[.055] text-cyan-200'],
                      ['BUY / SELL · P2', 'Second priority', 'A reversal setup became valid only after price crossed its yellow trigger. P2 ARMED still means wait.', 'border-emerald-300/20 bg-emerald-300/[.055] text-emerald-200'],
                      ['BUY / SELL · P3', 'Third priority', 'After an SL and one closed candle, the smaller reset trade crossed its trigger with all direction filters aligned.', 'border-purple-300/20 bg-purple-300/[.055] text-purple-200'],
                      ['WAIT', 'No trade yet', 'FORMING, ARMED, SCANNING, NOT SYNCED or BLOCKED means the complete signal is not ready.', 'border-amber-300/20 bg-amber-300/[.055] text-amber-200'],
                    ].map(([label, rank, description, color]) => (
                      <div key={label} className={`rounded-xl border p-3 ${color}`}>
                        <p className="text-[10px] font-bold tracking-[.08em]">{label}</p>
                        <p className="mt-1 text-[11px] font-semibold text-foreground">{rank}</p>
                        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{description}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] leading-4 text-muted-foreground">On the candle, the only entry marks are green BUY P1/P2/P3/1M FLIP or red SELL P1/P2/P3/1M FLIP. Liquidity lines and optional HH/HL/LH/LL labels are context only.</p>
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

                <div className="rounded-xl border border-orange-300/20 bg-orange-300/[.04] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-orange-100">Active Trade Health</p>
                    <Badge className="border border-orange-300/20 bg-orange-300/10 text-orange-200">CANDLE-CLOSE CHECK</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {[
                      ['TP1 APPROACHED', 'Price reached 75% of the Entry-to-TP1 distance but has not touched TP1 yet.', 'border-yellow-300/20 text-yellow-200'],
                      ['TP1 FAILED · POSSIBLE REVERSE', 'After that approach, price gave back most of the move and adverse momentum confirmed at candle close.', 'border-orange-300/20 text-orange-200'],
                      ['½ TO SL', 'The candle wick crossed halfway from Entry toward SL without actually touching the stop.', 'border-red-300/20 text-red-200'],
                      ['SL HIT · PLAN CLEARED', 'The old yellow Entry, green TPs and red SL are deleted; P3 waits for the next completed candle.', 'border-purple-300/20 text-purple-200'],
                    ].map(([label, description, color]) => (
                      <div key={label} className={`rounded-lg border bg-black/15 p-3 ${color}`}>
                        <p className="text-[10px] font-bold tracking-[.04em]">{label}</p>
                        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{description}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] leading-4 text-muted-foreground"><span className="font-semibold text-orange-200">These are risk warnings, not reverse entries.</span> TP1 failure cannot know that SL will be hit; it only reports a confirmed loss of momentum. Wait for a new P1, P2 or P3 CONFIRMED before taking another direction.</p>
                </div>

                <div className="rounded-xl border border-fuchsia-300/20 bg-fuchsia-300/[.045] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-xs font-semibold text-fuchsia-100"><TriangleAlert className="size-3.5" /> 15-minute Manipulation + Blow-off Safety</p>
                    <Badge className="border border-fuchsia-300/20 bg-fuchsia-300/10 text-fuchsia-200">15M ONLY</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {[
                      ['MANIPULATION · AVOID LONG', 'Price swept a confirmed swing high, left a large upper wick and closed back inside. Do not chase the high.', 'border-orange-300/20 text-orange-200'],
                      ['MANIPULATION · AVOID SHORT', 'Price swept a confirmed swing low, left a large lower wick and closed back inside. Do not chase the low.', 'border-orange-300/20 text-orange-200'],
                      ['BLOW-OFF TOP · WAIT', 'An abnormally large, extended bullish move showed upper-wick exhaustion with a tick-volume spike.', 'border-fuchsia-300/20 text-fuchsia-200'],
                      ['BLOW-OFF BOTTOM · WAIT', 'An abnormally large, extended bearish move showed lower-wick exhaustion with a tick-volume spike.', 'border-cyan-300/20 text-cyan-200'],
                    ].map(([label, description, color]) => (
                      <div key={label} className={`rounded-lg border bg-black/15 p-3 ${color}`}>
                        <p className="text-[10px] font-bold tracking-[.04em]">{label}</p>
                        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{description}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] leading-4 text-muted-foreground"><span className="font-semibold text-fuchsia-200">How it behaves:</span> it works only on the 15-minute chart and confirms at candle close. A warning cancels unfilled triggers and blocks a same-candle entry. It does not open the opposite trade—wait for a fresh P1, P2 or P3 BUY/SELL confirmation.</p>
                  <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Default blow-off test: candle range ≥ 2.2 ATR, extension ≥ 2 ATR from the fast EMA, exhaustion wick and tick volume ≥ 1.8× its 20-bar average. Spot/CFD volume is broker tick volume, so treat every mark as a risk heuristic—not proof of manipulation.</p>
                </div>

                <div className="rounded-xl border border-fuchsia-300/20 bg-fuchsia-300/[.045] p-4">
                  <p className="text-xs font-semibold text-fuchsia-100">Volatility Shock Guard</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                    {[
                      ['1 · Detect', 'A candle range above 2.00 ATR or an opening gap above 0.75 ATR triggers the guard.'],
                      ['2 · Pause', 'Unfilled reversal and reset orders are cancelled; fresh setups pause for three closed candles.'],
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
                  <p className="text-xs font-semibold">Read every setup in five checks</p>
                  <ol className="mt-2 space-y-2 text-[11px] leading-5 text-muted-foreground">
                    <li><span className="mr-2 text-primary">1.</span>Check GOLD + SILVER: GOOD · BULLISH permits only long ideas; GOOD · BEARISH permits only short ideas; NOT SYNCED means wait.</li>
                    <li><span className="mr-2 text-primary">2.</span>Cyan above orange and both rising favors longs; cyan below orange and both falling favors shorts.</li>
                    <li><span className="mr-2 text-primary">3.</span>Confirm the structure sequence and note which liquidity line price is approaching or sweeping.</li>
                    <li><span className="mr-2 text-primary">4.</span>On 15m, any MANIPULATION or BLOW-OFF label means wait; do not convert the warning into an instant reversal trade.</li>
                    <li><span className="mr-2 text-primary">5.</span>Act only on P1, P2 or P3 CONFIRMED with yellow Entry, green TP1–TP3 and red SL. WATCH ONLY and P3 RESET SCANNING are not entries.</li>
                    <li><span className="mr-2 text-primary">6.</span>After entry, read TRADE HEALTH: TP1 failure and ½ TO SL mean risk increased, not that an opposite entry is confirmed.</li>
                  </ol>
                </div>

                <div className="rounded-xl border border-amber-300/15 bg-amber-300/[.035] p-3 text-[10px] leading-4 text-muted-foreground">
                  <p><span className="font-semibold text-amber-200">Important:</span> HH/HL/LH/LL and liquidity levels use confirmed pivots, so they appear after the swing is confirmed. Blue circles disappear when you click empty chart space or press Esc.</p>
                </div>
              </div>
              </div>
              </div>

              <div className="mb-6 overflow-hidden rounded-2xl border border-yellow-300/18 bg-[linear-gradient(145deg,rgba(250,204,21,.055),rgba(148,163,184,.035),rgba(4,19,38,.72))]">
                <div className="flex flex-col gap-2 border-b border-yellow-200/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-yellow-100">Gold + Silver directional confirmation</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">Gold is always the primary setup chart. Silver is a secondary confirmation and never creates the entry by itself.</p>
                  </div>
                  <Badge className="w-fit border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">CLOSED-CANDLE SYNC</Badge>
                </div>
                <div className="aspect-[2.08/1] min-h-[300px] overflow-hidden">
                  <MetalsSyncStudy />
                </div>
                <div className="grid gap-2 border-t border-yellow-200/10 bg-black/15 px-4 py-3 md:grid-cols-3">
                  <p className="text-[10px] leading-4 text-muted-foreground"><span className="font-semibold text-emerald-200">BULLISH SYNC:</span> gold confirms the long structure and silver also closes with bullish direction/momentum.</p>
                  <p className="text-[10px] leading-4 text-muted-foreground"><span className="font-semibold text-red-200">BEARISH SYNC:</span> gold confirms the short structure and silver also closes with bearish direction/momentum.</p>
                  <p className="text-[10px] leading-4 text-muted-foreground"><span className="font-semibold text-amber-200">NOT SYNCED:</span> opposite direction, flat confirmation, stale data or an unfinished candle means wait—never force a trade.</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-cyan-300/18 bg-[#041326]/65">
                <div className="flex flex-col gap-2 border-b border-cyan-200/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-cyan-100">Strong sell-side sweep → range reclaim study</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">Real GC gold-futures 15-minute OHLC and volume from Aug 14, 2026. The higher-volume sweep is followed by an immediate full-range displacement close.</p>
                  </div>
                  <Badge className="w-fit border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">15M–1H SETUP</Badge>
                </div>

                <div className="aspect-[16/9] min-h-[330px] overflow-hidden">
                  <HistoricalGoldStudy mode="strong-flow" />
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['1', 'Define the balance', 'Use the repeated 15-minute overlap to mark the range high, range low and POC. There is no trade while price rotates inside it.'],
                  ['2', 'Demand a real liquidity raid', 'The sweep must clearly break the range low and expand on stronger volume. The sweep candle itself is still not an entry.'],
                  ['3', 'Require a decisive reclaim', 'The next completed candle must close back through the POC and above the opposite range boundary with strong displacement.'],
                  ['4', 'Wait for executable risk', 'Do not chase the large reclaim candle. Entry needs a later retest that holds; invalidation remains below the sweep extreme.'],
                ].map(([number, title, description]) => (
                  <div key={number} className="rounded-xl border border-sky-200/12 bg-[#06182b]/42 p-4">
                    <div className="grid size-7 place-items-center rounded-full border border-cyan-300/25 bg-cyan-300/10 text-[10px] font-bold text-cyan-100">{number}</div>
                    <p className="mt-3 text-xs font-semibold text-sky-100">{title}</p>
                    <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">{description}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-amber-300/18 bg-amber-300/[.045] p-3"><p className="text-[10px] font-semibold text-amber-200">WAIT</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">Inside consolidation, during the sweep, or while price is moving away without a retest.</p></div>
                <div className="rounded-xl border border-emerald-300/18 bg-emerald-300/[.045] p-3"><p className="text-[10px] font-semibold text-emerald-200">ENTRY POSSIBLE</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">Only after the retest is defended and the completed candle agrees with the direction filters.</p></div>
                <div className="rounded-xl border border-red-300/18 bg-red-300/[.045] p-3"><p className="text-[10px] font-semibold text-red-200">INVALID</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">Price closes back through the defended structure, volatility shocks, or Gold/Silver confirmation fails.</p></div>
              </div>

              <div className="mt-6 overflow-hidden rounded-2xl border border-yellow-300/18 bg-[#041326]/65">
                <div className="flex flex-col gap-2 border-b border-yellow-200/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-yellow-100">30-minute consolidation → POC → breakout → pullback → continuation</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">Real GC gold-futures 30-minute candles from Jul 24, 2026. Price rotates across the range before a sell-side sweep, bullish reclaim, controlled pullback and second expansion.</p>
                  </div>
                  <Badge className="w-fit border border-yellow-300/25 bg-yellow-300/10 text-yellow-200">30M CONTINUATION</Badge>
                </div>
                <div className="aspect-[16/9] min-h-[330px] overflow-hidden">
                  <HistoricalGoldStudy mode="continuation" />
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {[
                  ['1', 'Build a real range', 'Require repeated rotation between both boundaries with overlapping candles. A one-direction drift is not consolidation.'],
                  ['2', 'Mark the sweep', 'The final range candle probes below sell-side liquidity. Treat that as manipulation context, not an entry.'],
                  ['3', 'Confirm the breakout', 'A high-volume bullish candle reclaims the full range and closes above its high. Do not chase that expansion.'],
                  ['4', 'Inspect the pullback', 'Price returns into the broken range high, but closes near or above it instead of collapsing through the POC.'],
                  ['5', 'Trigger continuation', 'A later candle breaks the pullback high. Put invalidation below pullback structure and size the target from actual risk.'],
                ].map(([number, title, description]) => (
                  <div key={`continuation-${number}`} className="rounded-xl border border-yellow-200/12 bg-yellow-300/[.025] p-4">
                    <div className="grid size-7 place-items-center rounded-full border border-yellow-300/25 bg-yellow-300/10 text-[10px] font-bold text-yellow-100">{number}</div>
                    <p className="mt-3 text-xs font-semibold text-yellow-100">{title}</p>
                    <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">{description}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-amber-300/18 bg-amber-300/[.04] p-3 text-[10px] leading-4 text-muted-foreground">
                <span className="font-semibold text-amber-200">Continuation rule:</span> stay out during the range, the first breakout candle and an unconfirmed pullback. If price closes back inside the range or through the POC instead of defending it, the setup is invalid—not an automatic reverse trade.
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="pattern-playbook" className={workspacePanel === 'guides' ? 'mb-4' : 'hidden'} aria-labelledby="pattern-playbook-heading">
          <Card className="border-sky-300/16 bg-[linear-gradient(145deg,rgba(14,165,233,.065),rgba(18,22,27,.97)_42%)]">
            <CardHeader className="border-b border-white/7 pb-4">
              <CardTitle id="pattern-playbook-heading" className="flex items-center gap-2 text-lg"><LineChart className="size-5 text-sky-300" /> 11 chart patterns · candlestick playbook</CardTitle>
              <CardDescription>Eleven sourced pattern categories, redrawn as candles. Use them as structure—not prediction—and wait for a completed breakout.</CardDescription>
              <CardAction><a href="https://www.forex.com/en/learn-trading/11-chart-patterns-you-should-know/" target="_blank" rel="noreferrer"><Badge className="border border-sky-300/20 bg-sky-300/10 text-sky-200">FOREX.COM SOURCE <ExternalLink className="size-3" /></Badge></a></CardAction>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {patternPlaybook.map((pattern) => (
                  <div key={pattern.kind} className="overflow-hidden rounded-xl border border-white/8 bg-black/15 p-3">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div><p className="text-xs font-semibold text-foreground">{pattern.name}</p><p className="mt-1 text-[9px] uppercase tracking-[.1em] text-muted-foreground">{pattern.family}</p></div>
                      <Badge className={pattern.side === 'BUY' ? 'border border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : pattern.side === 'SELL' ? 'border border-red-300/20 bg-red-300/10 text-red-200' : 'border border-blue-300/20 bg-blue-300/10 text-blue-200'}>{pattern.side} BIAS</Badge>
                    </div>
                    <PatternMiniChart kind={pattern.kind} side={pattern.side} />
                    <div className="mt-3 grid gap-2 text-[10px] leading-4">
                      <p className="text-muted-foreground"><span className="font-semibold text-sky-200">Trigger:</span> {pattern.trigger}</p>
                      <p className="text-muted-foreground"><span className="font-semibold text-red-200">Invalidation:</span> {pattern.invalidation}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_.8fr]">
                <div className="rounded-xl border border-sky-300/16 bg-sky-300/[.04] p-4">
                  <p className="text-xs font-semibold text-sky-100">How Asheparte AI should use these patterns</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    {[
                      ['1 · STRUCTURE', 'Pattern must be visible on 15m or 1H—not imagined from two candles.'],
                      ['2 · BREAK', 'Require a completed candle outside the boundary. Wick-only breaks are sweeps.'],
                      ['3 · RETEST', 'Prefer price to revisit and defend the broken level before entry.'],
                      ['4 · ALIGN', 'Direction must agree with EMA trend, Gold/Silver sync and the news-risk gate.'],
                    ].map(([title, text]) => <div key={title} className="rounded-lg border border-white/8 bg-black/15 p-3"><p className="text-[9px] font-bold text-sky-200">{title}</p><p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">{text}</p></div>)}
                  </div>
                </div>
                <div className="rounded-xl border border-amber-300/18 bg-amber-300/[.045] p-4">
                  <p className="text-xs font-semibold text-amber-100">Do not enter from the shape alone</p>
                  <p className="mt-2 text-[11px] leading-5 text-muted-foreground">A pattern can fail or break in either direction. WAIT if the candle has not closed, the breakout runs directly into nearby liquidity, the retest fails, or high-impact US news is close. Project the target from the pattern height, but keep the structural stop and required reward/risk valid.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="fibonacci-guide" className={workspacePanel === 'guides' ? 'mb-4' : 'hidden'} aria-labelledby="fibonacci-guide-heading">
          <Card className="border-yellow-300/18 bg-[linear-gradient(145deg,rgba(250,204,21,.07),rgba(168,85,247,.045)_48%,rgba(18,22,27,.97))]">
            <CardHeader className="border-b border-white/7 pb-4">
              <CardTitle id="fibonacci-guide-heading" className="flex items-center gap-2 text-lg"><Crosshair className="size-5 text-yellow-300" /> Automatic Fibonacci pullback map</CardTitle>
              <CardDescription>Historical GC gold-futures example anchored from a confirmed swing low to swing high. The live map redraws only after a new pivot is confirmed.</CardDescription>
              <CardAction><Badge className="border border-yellow-300/25 bg-yellow-300/10 text-yellow-200">61.8%–70.5% GOLDEN ZONE</Badge></CardAction>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="mb-4 overflow-hidden rounded-2xl border border-yellow-300/18 bg-[#041326]/65">
                <div className="flex flex-col gap-2 border-b border-yellow-200/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="text-xs font-semibold text-yellow-100">Historical bullish Fibonacci pullback</p><p className="mt-1 text-[10px] text-muted-foreground">Real 15-minute GC=F candles and volume from Aug 26–27, 2026. Annotations are retrospective.</p></div>
                  <Badge className="w-fit border border-yellow-300/25 bg-yellow-300/10 text-yellow-200">61.8%–70.5% FOCUS</Badge>
                </div>
                <div className="aspect-[16/9] min-h-[330px] overflow-hidden">
                  <HistoricalFibonacciStudy />
                </div>
                <div className="grid gap-2 border-t border-yellow-200/10 bg-black/15 px-4 py-3 sm:grid-cols-3">
                  <p className="text-[10px] leading-4 text-muted-foreground"><span className="font-semibold text-cyan-200">1 · Anchor:</span> for a bullish move, start at the confirmed swing low and finish at the confirmed swing high.</p>
                  <p className="text-[10px] leading-4 text-muted-foreground"><span className="font-semibold text-yellow-200">2 · Watch:</span> this sample pulled back into the yellow 61.8%–70.5% band. A touch alone is not an entry.</p>
                  <p className="text-[10px] leading-4 text-muted-foreground"><span className="font-semibold text-emerald-200">3 · Confirm:</span> wait for a closed rejection candle, then require trend, structure, risk and news filters to agree.</p>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
              <div className="overflow-hidden rounded-xl border border-white/8 bg-black/15 p-3">
                <div className="mb-3 flex items-center justify-between gap-3 px-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[.13em] text-muted-foreground">Automatic level ladder</p>
                  <span className="text-[10px] text-muted-foreground">Price appears beside each line</span>
                </div>
                <div className="grid gap-1.5">
                  {[
                    ['0%', 'Swing extreme', 'border-zinc-300/20 text-zinc-200'],
                    ['23.6%', 'Weak retracement', 'border-purple-300/20 text-purple-200'],
                    ['38.2%', 'Trend continuation zone', 'border-purple-300/20 text-purple-200'],
                    ['50%', 'Smart-money reaction area', 'border-cyan-300/25 text-cyan-200'],
                    ['61.8%', 'Golden entry boundary', 'border-yellow-300/35 bg-yellow-300/[.07] text-yellow-200'],
                    ['70.5%', 'Sniper entry boundary', 'border-yellow-300/35 bg-yellow-300/[.07] text-yellow-200'],
                    ['78.6%', 'Deep retracement zone', 'border-purple-300/20 text-purple-200'],
                    ['100%', 'Full retracement / swing origin', 'border-zinc-300/20 text-zinc-200'],
                  ].map(([level, meaning, color]) => (
                    <div key={level} className={`grid grid-cols-[54px_1fr] items-center gap-3 rounded-lg border px-3 py-2 ${color}`}>
                      <span className="font-mono text-[11px] font-bold">{level}</span>
                      <span className="text-[10px] text-muted-foreground">{meaning}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid content-start gap-3">
                <div className="rounded-xl border border-emerald-300/18 bg-emerald-300/[.04] p-4">
                  <p className="text-xs font-semibold text-emerald-100">Bullish markup · swing low → swing high</p>
                  <p className="mt-2 text-[11px] leading-5 text-muted-foreground">The script places 0% at the confirmed high and 100% at the confirmed low, then watches price retrace downward into the ladder. A bullish candle closing back above 61.8%, with the higher trend and Gold/Silver sync bullish, creates <span className="font-semibold text-yellow-200">FIB CONTEXT · NOT AN ENTRY</span> in detailed mode.</p>
                </div>
                <div className="rounded-xl border border-red-300/18 bg-red-300/[.04] p-4">
                  <p className="text-xs font-semibold text-red-100">Bearish markup · swing high → swing low</p>
                  <p className="mt-2 text-[11px] leading-5 text-muted-foreground">The ladder mirrors upward from the confirmed low. A bearish candle closing back below 61.8%, with the higher trend and metals sync bearish, creates <span className="font-semibold text-yellow-200">FIB CONTEXT · NOT AN ENTRY</span> in detailed mode.</p>
                </div>
                <div className="rounded-xl border border-yellow-300/22 bg-yellow-300/[.055] p-4">
                  <p className="text-xs font-semibold text-yellow-100">What counts as the better setup?</p>
                  <p className="mt-2 text-[11px] leading-5 text-muted-foreground">61.8%–70.5% plus candle rejection is confluence, not an entry by itself. Prioritize it only when the panel also shows the correct metals direction, no shock pause, and a completed <span className="font-semibold text-foreground">BUY/SELL P1, P2 or P3</span>. If ACTION still says WAIT, keep waiting.</p>
                </div>
                <p className="rounded-xl border border-orange-300/15 bg-orange-300/[.035] p-3 text-[10px] leading-4 text-muted-foreground"><span className="font-semibold text-orange-200">Important:</span> the middle/golden zone is a possible reaction area—not proof that price cannot continue down or up. Confirmed pivots appear after the selected pivot length, so the newest swing map deliberately arrives with confirmation delay.</p>
              </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="live-chart" className={workspacePanel === 'charts' ? 'mb-4' : 'hidden'}>
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

        <section className={workspacePanel === 'pine' ? 'grid gap-4 xl:grid-cols-[minmax(360px,.72fr)_minmax(0,1.28fr)]' : 'hidden'}>
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

          <div id="pine-script" className="min-w-0">
            <div className="mb-3 grid grid-cols-1 gap-1 rounded-xl border border-sky-300/15 bg-[#06182b]/70 p-1 shadow-[0_12px_40px_rgba(0,0,0,.18)] sm:grid-cols-3">
              <Button
                type="button"
                variant="ghost"
                className={pineScriptView === 'structure' ? 'bg-cyan-300 text-[#03121f] hover:bg-cyan-200 hover:text-[#03121f]' : 'text-muted-foreground hover:bg-white/[.05] hover:text-foreground'}
                onClick={() => setPineScriptView('structure')}
              >
                <ScanLine /> Swing Structure
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={pineScriptView === 'volume' ? 'bg-yellow-300 text-[#171003] hover:bg-yellow-200 hover:text-[#171003]' : 'text-muted-foreground hover:bg-white/[.05] hover:text-foreground'}
                onClick={() => setPineScriptView('volume')}
              >
                <BarChart3 /> Volume Clusters
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={pineScriptView === 'combined' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground hover:bg-white/[.05] hover:text-foreground'}
                onClick={() => setPineScriptView('combined')}
              >
                <Code2 /> Combined Strategy
              </Button>
            </div>

          <Card className={pineScriptView === 'volume' ? 'overflow-hidden border-yellow-300/18 bg-[linear-gradient(145deg,rgba(250,204,21,.065),rgba(18,22,27,.96)_42%)] shadow-[0_20px_70px_rgba(0,0,0,.2)]' : 'hidden'}>
            <CardHeader className="border-b border-white/7 pb-4">
              <CardTitle className="flex items-center gap-2"><BarChart3 className="size-4 text-yellow-300" /> Volume Cluster Profile · Pine v6</CardTitle>
              <CardDescription>POC, value area and smoothed volume clusters · Original VCP concept and open-source code by Zeiierman · modified by Asheparte AI</CardDescription>
              <CardAction>
                <Button variant="outline" size="sm" className="border-yellow-300/15 bg-yellow-300/[.04]" onClick={copyVolumeScript}>
                  {volumeScriptCopied ? <Check /> : <Clipboard />}
                  {volumeScriptCopied ? 'Volume script copied' : 'Copy volume script'}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-yellow-300/15 bg-yellow-300/[.035] p-3">
                  <p className="text-xs font-semibold text-yellow-200">POC</p>
                  <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">Marks the profile row with the greatest estimated participation. Treat it as a reaction area, not an automatic entry or stop.</p>
                </div>
                <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[.035] p-3">
                  <p className="text-xs font-semibold text-cyan-200">VAH / VAL</p>
                  <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">Expands outward from POC until the selected percentage of estimated volume is included, showing the accepted-value region.</p>
                </div>
                <div className="rounded-xl border border-orange-300/15 bg-orange-300/[.035] p-3">
                  <p className="text-xs font-semibold text-orange-200">Cluster centers</p>
                  <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">Ranks local peaks after light Gaussian smoothing. These are statistical concentrations—not predictions or trained-AI signals.</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-sky-300/12 bg-sky-300/[.035] p-3 text-[10px] leading-4 text-muted-foreground">
                <span className="font-semibold text-sky-100">Asheparte modification:</span> volume is shared across every price row touched by each candle instead of being placed entirely at the close. Object counts are bounded for TradingView, and the script identifies all values as bar-data approximations. On XAUUSD this is normally tick volume; GC futures is preferable when exchange-traded gold volume is required.
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#0c0f12]">
                <div className="flex items-center justify-between border-b border-white/8 px-4 py-2 text-[10px] uppercase tracking-[.12em] text-muted-foreground">
                  <span>asheparte-ai-volume-cluster-profile.pine</span>
                  <span>Credits preserved · Version 6</span>
                </div>
                <pre className="max-h-[620px] overflow-auto p-4 font-mono text-[11px] leading-[1.7] text-zinc-300"><code>{volumeClusterScript}</code></pre>
              </div>

              <p className="mt-3 text-[10px] leading-4 text-muted-foreground">Use it as context for consolidation, acceptance and retests. A valid entry still needs structure and candle confirmation, while the stop belongs beyond the setup’s invalidation point. Credit: Zeiierman, original Volume Cluster Profile concept and supplied open-source implementation.</p>
            </CardContent>
          </Card>

          <Card className={pineScriptView === 'combined' ? 'overflow-hidden border-primary/15 bg-card/92 shadow-[0_24px_90px_rgba(0,0,0,.22)]' : 'hidden'}>
            <CardHeader className="border-b border-white/7 pb-4">
              <CardTitle className="flex items-center gap-2"><Code2 className="size-4 text-primary" /> Combined Trend + Reversal Strategy · Pine v6 · Build v59</CardTitle>
              <CardDescription>One free-plan script slot · M15/H1 four-stage POC cycle + Gold/Silver sync + three take-profit levels + strategy-compatible alerts</CardDescription>
              <CardAction>
                <Button variant="outline" size="sm" className="border-white/10 bg-white/[.03]" onClick={copyStrategy}>
                  {scriptCopied ? <Check /> : <Clipboard />}
                  {scriptCopied ? 'Combined script copied' : 'Copy combined script'}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="hidden" aria-hidden="true">
              <div className="mb-4 flex flex-col gap-3 rounded-xl border border-cyan-300/15 bg-cyan-300/[.045] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-cyan-300/15 bg-cyan-300/10 text-cyan-200">
                    <Clock3 className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-cyan-100">Timeframe-synced updates</p>
                    <p className="mt-1 max-w-2xl text-[10px] leading-4 text-muted-foreground">The selected TradingView chart controls the decision clock. A 1H setup confirms on the hourly close; 1-minute recovery checks run only when the chart is exactly 1m and confirm on each completed minute.</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5 text-[10px] font-semibold">
                  <span className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-cyan-100">1H → hourly close</span>
                  <span className="rounded-md border border-purple-300/20 bg-purple-300/10 px-2 py-1 text-purple-100">1m → recovery close</span>
                  <span className="rounded-md border border-fuchsia-300/20 bg-fuchsia-300/10 px-2 py-1 text-fuchsia-100">15m → manipulation safety</span>
                  <span className="rounded-md border border-white/9 bg-black/15 px-2 py-1">Daily trend filter</span>
                  <span className="rounded-md border border-white/9 bg-black/15 px-2 py-1">No intrabar entry</span>
                </div>
              </div>

              <div className="mb-4 rounded-xl border border-orange-300/20 bg-orange-300/[.045] p-4 text-[10px] leading-5 text-muted-foreground">
                <p className="font-semibold text-orange-100">Important: TradingView does not automatically sync website updates.</p>
                <p className="mt-1">Click <span className="font-semibold text-foreground">Copy combined script</span>, open Pine Editor, select all of the old code, paste the new copy, save it, then remove and re-add the strategy to the chart. The chart title must say <span className="font-semibold text-orange-100">Asheparte AI Combined v59</span>. The four-stage boxes appear only when the chart is set to 15m or 1H—not on 1m.</p>
              </div>

              <div className="mb-4 rounded-xl border border-amber-300/20 bg-amber-300/[.04] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-xs font-semibold text-amber-100">M15 / H1 · four-stage POC confirmation</p>
                    <p className="mt-1 text-[10px] leading-4 text-muted-foreground">The TradingView script now draws the same boxed sequence: cyan consolidation with a yellow estimated POC, orange liquidity sweep, purple distribution / displacement, then a green BUY or red SELL entry box. POC uses TradingView tick volume as an approximation. It is available only on 15m and 1H so the 1m chart cannot mislabel this slower setup.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[.06em]">
                    {['1 Range + POC', '2 Sweep', '3 Move', 'POC retest', 'Defended close', '4 BUY / SELL'].map((step, index) => (
                      <div key={step} className="flex items-center gap-1.5">
                        {index > 0 && <span className="text-amber-300/60">→</span>}
                        <span className="rounded-md border border-amber-300/15 bg-black/15 px-2 py-1.5 text-amber-100">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="mt-3 border-t border-amber-300/10 pt-3 text-[10px] leading-4 text-muted-foreground">The first POC touch is no longer an entry. Stage 4 needs a later candle to retest POC and the next completed candle to defend it, reclaim the prior high / low, agree with EMA slope, RSI, higher-timeframe direction and Gold/Silver. After the position fully closes at TP or SL, all four-stage boxes are deleted and the scanner waits for a fresh consolidation before drawing another plan.</p>
              </div>

              <div className="mb-4 rounded-xl border border-cyan-300/20 bg-cyan-300/[.045] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-xs font-semibold text-cyan-100">v59 · timeframe-specific Fibonacci maps</p>
                    <p className="mt-1 text-[10px] leading-4 text-muted-foreground">On 30m and 1H, Fibonacci uses the previous completed session’s full swing. On 1m through 15m, a separate eight-bar confirmed-pivot scanner follows local structure. The map stays off outside those ranges so an unsuitable timeframe cannot display misleading anchors.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[.06em]">
                    {['15m agrees', '1H agrees', 'Pullback defended', '≥ 1.5R room', 'BUY / SELL P1'].map((step, index) => (
                      <div key={step} className="flex items-center gap-1.5">
                        {index > 0 && <span className="text-cyan-300/60">→</span>}
                        <span className="rounded-md border border-cyan-300/15 bg-black/15 px-2 py-1.5 text-cyan-100">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="mt-3 border-t border-cyan-300/10 pt-3 text-[10px] leading-4 text-muted-foreground">The gate applies to P1, P2 watches and post-SL reset candidates on charts from 1m through 5m. Confirmed higher-timeframe values do not repaint during the active lower-timeframe candle. This reduces late entries into support or resistance but cannot guarantee the next move.</p>
              </div>

              <div className="mb-4 rounded-xl border border-red-300/20 bg-red-300/[.04] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-xs font-semibold text-red-100">1m automatic failure recovery</p>
                    <p className="mt-1 text-[10px] leading-4 text-muted-foreground">Every confirmed 1-minute entry receives a red SL and green TP1–TP3 bracket. Before TP1, reaching 50% of the Entry-to-SL distance or failing after a near-TP1 move changes the panel to FLIP WATCH. It does not reverse immediately. The current BUY closes only after a bearish 1m candle breaks the 20 EMA and prior low with bearish RSI and Gold/Silver agreement; SELL uses the mirrored bullish rules.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[.06em]">
                    {['½ SL or TP1 fail', 'FLIP WATCH', 'Opposite close', 'Exit old trade', 'Wait 1 close', 'Fresh trigger + SL/TP'].map((step, index) => (
                      <div key={step} className="flex items-center gap-1.5">
                        {index > 0 && <span className="text-red-300/60">→</span>}
                        <span className="rounded-md border border-red-300/15 bg-black/15 px-2 py-1.5 text-red-100">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="mt-3 border-t border-red-300/10 pt-3 text-[10px] leading-4 text-muted-foreground">The replacement order uses 0.50× of the exited quantity by default, puts a new SL beyond its confirmation candle plus 0.10 ATR, and rebuilds TP1 = 1R, TP2 = 1.5R and TP3 = 2.14R. After an actual SL on 1m, the same reset process may run again; the 2% strategy daily-loss lock is the final stop.</p>
              </div>

              <div className="mb-4 rounded-xl border border-purple-300/20 bg-purple-300/[.045] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-xs font-semibold text-purple-100">P3 post-SL direction reset</p>
                    <p className="mt-1 text-[10px] leading-4 text-muted-foreground">After an SL, the old Entry / TP / SL plan is removed immediately. Lower timeframes can wait one completed candle and rescan for up to 12 bars. M15 and H1 do not recycle the stopped setup through P3: they erase the cycle and require a completely fresh consolidation, POC, sweep, move and defended retest. On 1m, another stopped reset may start a new smaller scan instead of ending the sequence.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[.06em]">
                    {['SL hit', 'Wait 1 close', 'Scan each close', 'Direction resets', 'P3 trigger', 'TP1 / TP2 / TP3 + SL'].map((step, index) => (
                      <div key={step} className="flex items-center gap-1.5">
                        {index > 0 && <span className="text-purple-300/60">→</span>}
                        <span className="rounded-md border border-purple-300/15 bg-black/15 px-2 py-1.5 text-purple-100">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="mt-3 border-t border-purple-300/10 pt-3 text-[10px] leading-4 text-muted-foreground"><span className="font-semibold text-purple-200">Why the reset?</span> An SL invalidates the old setup; it is not an instruction to revenge-trade. The scanner chooses only a newly confirmed direction and retries an expired unfilled trigger while the 12-bar window remains. Outside 1m it stops after one reset trade; on 1m the recovery engine can restart after another SL, subject to the daily-loss lock.</p>
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

              <div className="mb-4 rounded-xl border border-orange-300/20 bg-orange-300/[.04] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-xs font-semibold text-orange-100">Smart TP1 failure + halfway-to-stop warnings</p>
                    <p className="mt-1 text-[10px] leading-4 text-muted-foreground">The strategy arms a TP1-failure check only after price travels 75% of the way to TP1 without touching it. A separate ½ TO SL mark appears when price consumes 50% of the original risk. On 1m these become FLIP WATCH context; the old position changes direction only after the stricter opposite-close confirmation.</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5 text-[9px] font-semibold uppercase tracking-[.06em]">
                    <span className="rounded-md border border-yellow-300/20 bg-black/15 px-2 py-1.5 text-yellow-200">TP1 approached</span>
                    <span className="rounded-md border border-orange-300/20 bg-black/15 px-2 py-1.5 text-orange-200">Giveback confirmed</span>
                    <span className="rounded-md border border-red-300/20 bg-black/15 px-2 py-1.5 text-red-200">Watch SL risk</span>
                  </div>
                </div>
                <p className="mt-3 border-t border-orange-300/10 pt-3 text-[10px] leading-4 text-muted-foreground">Both thresholds are adjustable under Settings → Active Trade Health. On timeframes other than 1m they remain warnings only. A recovery flip is still conditional and can also stop out.</p>
              </div>

              <div className="mb-4 rounded-xl border border-emerald-300/20 bg-emerald-300/[.04] p-4">
                <p className="text-xs font-semibold text-emerald-100">New TP1 protection</p>
                <p className="mt-1 text-[10px] leading-4 text-muted-foreground">When TP1 is actually touched, the strategy marks <span className="font-semibold text-emerald-200">TP1 BANKED · 50%</span>. TP2 and TP3 each retain 25%, with their stop protected at entry plus 0.10R by default. On 5m, a later completed candle that reverses through the fast EMA and the prior candle closes the remainder. Spread, commission, gaps and intrabar order sequence can still produce a small loss.</p>
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
                    ['Defended P1 entry', 'An EMA cross is watch-only; P1 needs a completed pullback candle and a strong reclaim through its high or low.'],
                    ['Three-target plan', 'Yellow candidate entry, green TP1 at 1R, TP2 at 1.5R, TP3 at the final target; after TP1, the remaining stop protects +0.10R by default.'],
                  ['Simple chart mode', 'Shows only confirmed BUY/SELL marks and serious safety warnings; detailed context labels stay hidden.'],
                  ['1H precision entry', 'Waits for daily alignment, a 1H pullback to the 20 EMA and a confirmed rejection instead of chasing the crossover.'],
                  ['1m auto recovery', 'Arms at half-to-SL or failed TP1, confirms an opposite close, then rebuilds a smaller fresh SL/TP bracket.'],
                  ['Bad Entry Guard', 'Avoid counter-trend liquidity traps and ATR-extended chase entries.'],
                  ['Shock circuit breaker', 'Cancels pending ideas, pauses new setups and enforces a configurable strategy daily-loss lock.'],
                  ['Gold / Silver Sync', 'Requires both metals to agree on bullish or bearish direction before that side can enter.'],
                  ['Self-cleaning trade health', 'Removes a stopped plan, flags a failed TP1 approach and marks when half the SL distance is consumed.'],
                  ['Working strategy alerts', 'Uses alert() events supported by TradingView strategies instead of indicator-only alertcondition() calls.'],
                ].map(([title, description], index) => (
                  <div key={title} className="rounded-xl border border-white/8 bg-white/[.025] p-3">
                    <p className={`text-xs font-semibold ${index === 0 ? 'text-primary' : index === 1 ? 'text-fuchsia-300' : index === 2 ? 'text-emerald-300' : index === 3 ? 'text-amber-200' : index === 4 ? 'text-orange-200' : index === 5 ? 'text-fuchsia-200' : index === 6 ? 'text-lime-200' : 'text-cyan-200'}`}>{title}</p>
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
                  <p className="mt-1 text-[10px] leading-4 text-muted-foreground">It is the final TP3 reward-to-risk ratio. The strategy scales out 50% at TP1 = 1R, 25% at TP2 = 1.5R, and 25% at TP3 = 2.14R. After TP1, the remaining stop protects +0.10R by default. These are projections before spread, slippage and fees—not win probabilities.</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0c0f12]">
                <div className="flex items-center justify-between border-b border-white/8 px-4 py-2 text-[10px] uppercase tracking-[.12em] text-muted-foreground">
                  <span>asheparte-ai-combined-trend-reversal.pine</span>
                  <span>Version 6</span>
                </div>
                <pre className="max-h-[730px] overflow-auto p-4 font-mono text-[11px] leading-[1.7] text-zinc-300"><code>{pineScript}</code></pre>
              </div>

              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-primary/12 bg-primary/[.035] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-medium">Use it in TradingView</p>
                  <p className="mt-1 text-[10px] leading-4 text-muted-foreground">Copy once, replace the old code in Pine Editor and select “Add to chart.” Use exactly 1m for automatic failure recovery, or 1H for the selective pullback entry. Keep Settings → 1m Auto Recovery and Simple chart mode enabled. For signals plus TP/SL fills, choose Create Alert → Asheparte AI → “Order fills and alert() function calls.”</p>
                </div>
                <a href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(activeLiveMarket.symbol)}`} target="_blank" rel="noreferrer">
                  <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto">Open TradingView <ExternalLink /></Button>
                </a>
              </div>

              <p className="mt-3 text-[10px] leading-4 text-muted-foreground">Gold/Silver sync, shock, failure flips and bad-entry warnings are reactive rules—not forecasts. In this Pine section, “automatic” means simulated strategy orders and alerts inside TradingView. The separate MT5 EA above is the executable version and remains demo-locked by default. Fast markets can gap through SL, create slippage and stop the replacement trade too.</p>
              </div>

              <div className="rounded-xl border border-sky-300/18 bg-sky-300/[.045] p-4 sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <p className="text-xs font-semibold uppercase tracking-[.12em] text-cyan-200">What the combined strategy does</p>
                    <h3 className="mt-2 font-heading text-lg font-semibold text-sky-50">Waits for agreement, confirms the entry, then manages three profit targets</h3>
                    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Asheparte AI combines trend, reversal, liquidity and risk rules. It does not buy or sell from one indicator alone. Every signal is evaluated after the candle closes, then rejected if market direction, Gold/Silver agreement, volatility or available price room is unsuitable.</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5 text-[9px] font-semibold uppercase tracking-[.07em]">
                    <Badge className="border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">Pine v6</Badge>
                    <Badge variant="outline" className="border-sky-300/20 text-sky-200">Build v59</Badge>
                    <Badge variant="outline" className="border-emerald-300/20 text-emerald-200">Paper strategy</Badge>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[.06em]">
                  {['Read trend', 'Check liquidity', 'Wait for pullback', 'Confirm candle', 'Place SL + TP1–TP3', 'Monitor trade'].map((step, index) => (
                    <div key={step} className="flex items-center gap-1.5">
                      {index > 0 && <span className="text-cyan-300/55">→</span>}
                      <span className="rounded-md border border-cyan-300/15 bg-[#06182b]/55 px-2 py-1.5 text-cyan-50">{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-yellow-300/18 bg-yellow-300/[.035] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <p className="text-xs font-semibold text-yellow-100">Compact volume profile by default</p>
                    <p className="mt-2 text-[10px] leading-5 text-muted-foreground">Build v59 calculates the Volume Profile from the previous completed session only on 30m and 1H. Its translucent rows, POC, VAH and VAL stay inside that historical session instead of extending into future space or covering current candles.</p>
                  </div>
                  <Badge className="w-fit border border-yellow-300/25 bg-yellow-300/10 text-yellow-200">POC + VAH + VAL</Badge>
                </div>
                <div className="mt-3 grid gap-2 text-[10px] sm:grid-cols-4">
                  <div className="rounded-lg border border-white/8 bg-black/15 p-2.5"><span className="font-semibold text-yellow-200">Lookback</span><p className="mt-1 text-muted-foreground">120 bars</p></div>
                  <div className="rounded-lg border border-white/8 bg-black/15 p-2.5"><span className="font-semibold text-cyan-200">Rows</span><p className="mt-1 text-muted-foreground">16 price levels</p></div>
                  <div className="rounded-lg border border-white/8 bg-black/15 p-2.5"><span className="font-semibold text-cyan-200">Value area</span><p className="mt-1 text-muted-foreground">70% of volume</p></div>
                  <div className="rounded-lg border border-white/8 bg-black/15 p-2.5"><span className="font-semibold text-sky-200">Width</span><p className="mt-1 text-muted-foreground">12 chart bars</p></div>
                </div>
                <p className="mt-3 border-t border-yellow-300/10 pt-3 text-[10px] leading-4 text-muted-foreground">Adjust these under Settings → Detailed Volume Profile. XAUUSD normally supplies tick volume; use GC futures when exchange-traded gold volume is required. POC and value-area levels are context, not automatic entries.</p>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {[
                  ['1 · Market direction', 'Uses EMA structure, RSI and confirmed higher-timeframe candles. Gold and Silver must agree before a directional setup is allowed.'],
                  ['2 · Entry confirmation', 'P1 waits for a defended trend pullback. Reversal setups require a liquidity sweep and rejection. M15/H1 can use the range → POC → sweep → displacement → retest sequence.'],
                  ['3 · Trade plan', 'A confirmed signal draws Entry, structural Stop Loss, TP1 at 1R, TP2 at 1.5R and TP3 at 2.14R. TP1 banks 50%; TP2 and TP3 retain 25% each.'],
                  ['4 · Safety response', 'Shock candles, opening gaps, crowded liquidity or unsynced metals produce WAIT. A stopped or completed plan is cleared before the strategy scans for a genuinely fresh setup.'],
                ].map(([title, description]) => (
                  <div key={title} className="rounded-xl border border-sky-200/12 bg-[#06182b]/38 p-4">
                    <p className="text-xs font-semibold text-sky-100">{title}</p>
                    <p className="mt-2 text-[10px] leading-5 text-muted-foreground">{description}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="rounded-xl border border-white/8 bg-white/[.025] p-4">
                  <p className="text-xs font-semibold text-foreground">How to read its output</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div><span className="text-[10px] font-semibold text-emerald-300">BUY / SELL</span><p className="mt-1 text-[10px] leading-4 text-muted-foreground">All required conditions confirmed on a completed candle.</p></div>
                    <div><span className="text-[10px] font-semibold text-amber-200">WATCH / WAIT</span><p className="mt-1 text-[10px] leading-4 text-muted-foreground">A setup may be forming, but entry is not approved.</p></div>
                    <div><span className="text-[10px] font-semibold text-fuchsia-300">SHOCK / AVOID</span><p className="mt-1 text-[10px] leading-4 text-muted-foreground">Volatility or bad-entry protection is blocking new trades.</p></div>
                  </div>
                </div>
                <div>
                  <a href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(activeLiveMarket.symbol)}`} target="_blank" rel="noreferrer">
                    <Button variant="outline" className="w-full border-sky-300/15 bg-sky-300/[.05]">Open TradingView <ExternalLink /></Button>
                  </a>
                </div>
              </div>

              <p className="mt-4 text-[10px] leading-4 text-muted-foreground">Use 1m–5m for lower-timeframe pullback and recovery logic; use 15m or 1H for the slower consolidation/POC sequence. Signals are conditional and cannot guarantee a profitable outcome. The complete source stays available through “Copy full Pine script” without filling this page with thousands of lines.</p>
            </CardContent>
          </Card>

          <Card className={pineScriptView === 'structure' ? 'overflow-hidden border-cyan-300/18 bg-[linear-gradient(145deg,rgba(34,211,238,.07),rgba(18,22,27,.96)_42%)] shadow-[0_20px_70px_rgba(0,0,0,.2)]' : 'hidden'}>
            <CardHeader className="border-b border-white/7 pb-4">
              <CardTitle className="flex items-center gap-2"><ScanLine className="size-4 text-cyan-300" /> Swing Structure + Consolidation · Pine v6</CardTitle>
              <CardDescription>A separate clean overlay: confirmed Swing High, confirmed Swing Low, and consolidation boxes—nothing else.</CardDescription>
              <CardAction>
                <Button variant="outline" size="sm" className="border-cyan-300/15 bg-cyan-300/[.04]" onClick={copyStructureScript}>
                  {structureScriptCopied ? <Check /> : <Clipboard />}
                  {structureScriptCopied ? 'Structure script copied' : 'Copy structure script'}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-red-300/15 bg-red-300/[.035] p-3">
                  <p className="text-xs font-semibold text-red-200">Swing High</p>
                  <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">Marks a pivot only after the selected right-side candles close, preventing a developing pivot from being presented as confirmed.</p>
                </div>
                <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[.035] p-3">
                  <p className="text-xs font-semibold text-emerald-200">Swing Low</p>
                  <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">Uses the same confirmed-pivot rule and places the label on the original pivot candle.</p>
                </div>
                <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[.035] p-3">
                  <p className="text-xs font-semibold text-cyan-200">Consolidation Box</p>
                  <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">Requires a compact ATR-sized range with limited net movement, then extends the box until a candle closes outside its boundary.</p>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#0c0f12]">
                <div className="flex items-center justify-between border-b border-white/8 px-4 py-2 text-[10px] uppercase tracking-[.12em] text-muted-foreground">
                  <span>asheparte-ai-swing-structure.pine</span>
                  <span>Indicator · Version 6</span>
                </div>
                <pre className="max-h-[520px] overflow-auto p-4 font-mono text-[11px] leading-[1.7] text-zinc-300"><code>{swingStructureScript}</code></pre>
              </div>

              <p className="mt-3 text-[10px] leading-4 text-muted-foreground">Default settings use five candles on each side of a pivot and a 20-bar consolidation scan. Because pivots need future candles for confirmation, labels appear later but remain anchored to the true swing candle.</p>
            </CardContent>
          </Card>
          </div>
        </section>

        <section id="reversal-playbook" className={workspacePanel === 'guides' ? 'mt-4' : 'hidden'}>
          <Card className="border-fuchsia-400/15 bg-[linear-gradient(145deg,rgba(192,132,252,.08),rgba(18,22,27,.95)_45%)]">
            <CardHeader className="border-b border-white/7 pb-4">
              <CardTitle className="flex items-center gap-2"><RotateCcw className="size-4 text-fuchsia-300" /> Gold reversal scalping playbook</CardTitle>
              <CardDescription>A conditional 1m–5m process—not a prediction of the exact turning point.</CardDescription>
              <CardAction><Badge className="border border-fuchsia-300/20 bg-fuchsia-300/10 text-fuchsia-200">POSSIBLE REVERSAL</Badge></CardAction>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="mb-4 overflow-hidden rounded-2xl border border-fuchsia-300/18 bg-[#041326]/65">
                <div className="flex flex-col gap-2 border-b border-fuchsia-200/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="text-xs font-semibold text-fuchsia-100">Historical sell-side sweep reversal study</p><p className="mt-1 text-[10px] text-muted-foreground">Real GC gold-futures 5-minute OHLC and volume from Aug 14, 2026. The sweep creates the watch; a later close confirms.</p></div>
                  <Badge className="w-fit border border-fuchsia-300/20 bg-fuchsia-300/10 text-fuchsia-200">1M–5M PLAYBOOK</Badge>
                </div>
                <div className="aspect-[16/9] min-h-[330px] overflow-hidden">
                  <HistoricalGoldStudy mode="reversal" />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ['1 · Context', 'Use a 1m, 3m or 5m chart. The previous completed 15m close must remain on the correct side of its EMA 50.'],
                  ['2 · Reversal watch', 'Price sweeps a confirmed prior swing, closes back through it and prints a rejection wick with RSI recovery.'],
                  ['3 · Entry trigger', 'Long only one tick above the reversal candle high; short only one tick below its low. No trigger means no trade.'],
                  ['4 · Risk and expiry', 'Stop beyond the sweep candle, scale out at 1R / 1.5R / 2.14R, and cancel the pending entry if it does not trigger within three bars.'],
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

        <section className={workspacePanel === 'risk' ? 'mt-4' : 'hidden'}>
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

        <section className={workspacePanel === 'desk' ? 'mt-4 grid gap-4 lg:grid-cols-3' : 'hidden'}>
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

        <div className={workspacePanel === 'desk' ? 'mt-4 flex flex-col items-start justify-between gap-2 rounded-xl border border-white/8 bg-white/[.025] px-4 py-3 text-[11px] text-muted-foreground sm:flex-row sm:items-center' : 'hidden'}>
          <span>TradingView supplies the live quote, chart and technical rating; provider latency may apply. The Pine strategy is a testable ruleset—not financial advice or a profit guarantee.</span>
          <a href="#news-radar" className="flex items-center gap-1 text-foreground hover:text-primary">Open risk &amp; news <Newspaper className="size-3" /></a>
        </div>
      </div>
    </main>
  );
}
