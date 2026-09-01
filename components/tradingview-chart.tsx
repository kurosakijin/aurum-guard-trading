'use client';

import { useEffect, useRef } from 'react';

type TradingViewChartProps = {
  symbol: string;
  interval: string;
  label: string;
};

export function TradingViewChart({
  symbol,
  interval,
  label,
}: TradingViewChartProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;

    element.replaceChildren();

    const widget = document.createElement('div');
    widget.className = 'tradingview-widget-container__widget';
    widget.style.height = 'calc(100% - 28px)';
    widget.style.width = '100%';

    const attribution = document.createElement('div');
    attribution.className = 'tradingview-widget-copyright';
    attribution.style.height = '28px';
    attribution.style.display = 'flex';
    attribution.style.alignItems = 'center';
    attribution.style.justifyContent = 'center';
    attribution.style.fontSize = '11px';
    attribution.style.color = '#87909b';
    const attributionLink = document.createElement('a');
    attributionLink.href = 'https://www.tradingview.com/';
    attributionLink.rel = 'noopener nofollow';
    attributionLink.target = '_blank';
    attributionLink.style.color = '#e1b14e';
    attributionLink.style.textDecoration = 'none';
    attributionLink.textContent = `${label} chart`;
    attribution.appendChild(attributionLink);
    attribution.appendChild(document.createTextNode(' by TradingView'));

    const script = document.createElement('script');
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.text = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: 'exchange',
      theme: 'dark',
      backgroundColor: '#171b20',
      gridColor: 'rgba(255, 255, 255, 0.05)',
      style: '1',
      locale: 'en',
      withdateranges: true,
      hide_side_toolbar: false,
      hide_top_toolbar: false,
      hide_legend: false,
      hide_volume: false,
      allow_symbol_change: true,
      save_image: false,
      calendar: false,
      details: false,
      hotlist: false,
      show_popup_button: true,
      popup_width: '1200',
      popup_height: '720',
      support_host: 'https://www.tradingview.com',
    });

    element.appendChild(widget);
    element.appendChild(attribution);
    element.appendChild(script);

    return () => {
      element.replaceChildren();
    };
  }, [symbol, interval, label]);

  return (
    <div
      ref={container}
      aria-label={`Interactive ${label} TradingView chart`}
      className="tradingview-widget-container h-[650px] w-full sm:h-[760px] xl:h-[880px]"
    />
  );
}
