'use client';

import { useEffect, useRef } from 'react';

function TradingViewWidget({
  scriptUrl,
  config,
  label,
  className,
}: {
  scriptUrl: string;
  config: Record<string, string | number | boolean>;
  label: string;
  className: string;
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
  }, [scriptUrl, configJson]);

  return <div ref={container} aria-label={label} className={className} />;
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
      className="tradingview-widget-container h-[180px] w-full"
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
      className="tradingview-widget-container h-[680px] w-full sm:h-[760px]"
    />
  );
}
