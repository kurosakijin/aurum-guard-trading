# Aurum Guard

A responsive gold and silver market dashboard with live TradingView widgets, a combined Pine Script v6 strategy, Gold/Silver confirmation, automatic projected SL/TP levels, a confirmed-swing Fibonacci golden zone, a 15-minute manipulation and blow-off safety detector, Philippine-time US news monitoring, and risk-first entry guidance.

## MT5 Expert Advisor

The downloadable `public/downloads/AurumGuardAutoTrader.mq5` is an H1 Gold Expert Advisor with M15 manipulation/shock protection, Gold/Silver confirmation, the MT5 USD economic-calendar filter, risk-based sizing, a daily loss lock, broker-side SL/TP3, and managed TP1/TP2 partial exits. It refuses real-account initialization unless `AllowLiveTrading` is deliberately enabled; use demo forward testing first.

## Public website

The GitHub Pages deployment uses the free project address:

https://kurosakijin.github.io/aurum-guard-trading/

No custom domain is required.

## Run locally

```bash
npm install
npm run dev
```

## Build targets

```bash
# ChatGPT Sites / Cloudflare-compatible build
npm run build

# Static GitHub Pages build
npm run build:pages
```

## Risk notice

Aurum Guard provides educational, rule-based paper-trading tools. Signals, targets, stops, correlations, and TradingView ratings are not guarantees of profit or personalized financial advice. Backtest and paper-trade before considering live capital.
