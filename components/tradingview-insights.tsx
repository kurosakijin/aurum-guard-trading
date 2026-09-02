'use client';

import { useEffect, useRef } from 'react';

function TradingViewWidget({
  scriptUrl,
  config,
  label,
  className,
  refreshKey = 0,
}: {
  scriptUrl: string;
  config: Record<string, string | number | boolean>;
  label: string;
  className: string;
  refreshKey?: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const configJson = JSON.stringify(config);

  useEffect(() => {
    const element = container.current;
    if (!element) return;

    element.replaceChildren();
    const widget = document.createElement('div');
    widget.className = 'tradingview-widget-container__widget';
    widget.style.height = '100%';
    widget.style.width = '100%';

    const script = document.createElement('script');
    script.src = scriptUrl;
    script.type = 'text/javascript';
    script.async = true;
    script.text = configJson;
    element.appendChild(widget);
    element.appendChild(script);

    return () => element.replaceChildren();
  }, [scriptUrl, configJson, refreshKey]);

  return (
    <div aria-label={label} className={`relative ${className}`}>
      <div className="absolute inset-0 grid place-items-center px-6 text-center text-xs text-muted-foreground">
        Loading live TradingView data…
      </div>
      <div ref={container} className="tradingview-widget-container relative h-full w-full" />
    </div>
  );
}

export function TradingViewSymbolInfo({ symbol }: { symbol: string }) {
  return (
    <TradingViewWidget
      scriptUrl="https://s3.tradingview.com/external-embedding/embed-widget-symbol-info.js"
      config={{
        symbol,
        width: '100%',
        locale: 'en',
        colorTheme: 'dark',
        isTransparent: true,
      }}
      label="Live TradingView quote"
      className="h-[220px] w-full"
    />
  );
}

const intervalMap: Record<string, string> = {
  '1': '1m',
  '5': '5m',
  '15': '15m',
  '60': '1h',
  '240': '4h',
  D: '1D',
  W: '1W',
};

export function TradingViewTechnicalAnalysis({
  symbol,
  interval,
}: {
  symbol: string;
  interval: string;
}) {
  const mappedInterval = intervalMap[interval] ?? '15m';

  return (
    <TradingViewWidget
      scriptUrl="https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js"
      config={{
        interval: mappedInterval,
        width: '100%',
        height: '100%',
        isTransparent: true,
        symbol,
        showIntervalTabs: true,
        displayMode: 'single',
        locale: 'en',
        colorTheme: 'dark',
      }}
      label="Live TradingView technical rating"
      className="h-[680px] w-full sm:h-[760px]"
    />
  );
}

export function TradingViewEconomicCalendar({
  refreshKey = 0,
}: {
  refreshKey?: number;
}) {
  return (
    <TradingViewWidget
      scriptUrl="https://s3.tradingview.com/external-embedding/embed-widget-events.js"
      config={{
        colorTheme: 'light',
        isTransparent: false,
        locale: 'en',
        countryFilter: 'us',
        importanceFilter: '1',
        width: '100%',
        height: '100%',
      }}
      refreshKey={refreshKey}
      label="Live United States high-impact economic calendar"
      className="h-[660px] w-full bg-[#f4f6f8] text-[#111827] sm:h-[720px]"
    />
  );
}

export function TradingViewMetalsNews({
  symbol,
  refreshKey = 0,
}: {
  symbol: string;
  refreshKey?: number;
}) {
  return (
    <TradingViewWidget
      scriptUrl="https://s3.tradingview.com/external-embedding/embed-widget-timeline.js"
      config={{
        feedMode: 'symbol',
        symbol,
        displayMode: 'regular',
        colorTheme: 'dark',
        isTransparent: true,
        locale: 'en',
        width: '100%',
        height: '100%',
      }}
      refreshKey={refreshKey}
      label="Live gold and silver market news"
      className="h-[660px] w-full sm:h-[720px]"
    />
  );
}
