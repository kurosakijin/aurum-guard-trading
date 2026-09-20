'use client';

import { useState } from 'react';
import { Clipboard, Download } from 'lucide-react';
import script from '@/strategies/asheparte-confluence-v1.pine?raw';
import volumePane from '@/strategies/volume-fight-pane-v6.pine?raw';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function download(source: string, name: string) {
  const url = URL.createObjectURL(new Blob([source], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ConfluencePine() {
  const [status, setStatus] = useState('');
  async function copy() {
    try {
      await navigator.clipboard.writeText(script);
      setStatus('Asheparte Confluence v1 copied.');
    } catch {
      setStatus('Clipboard unavailable. Download the script or select its source below.');
    }
  }
  return <Card className="min-w-0 overflow-hidden">
    <CardHeader>
      <CardTitle>Asheparte Confluence v1</CardTitle>
      <CardDescription>5-minute XAU strategy · Pine v6 · structure, volume and price-action overlays.</CardDescription>
    </CardHeader>
    <CardContent className="min-w-0 space-y-4">
      <p className="text-sm leading-6 text-muted-foreground">The XAU A+ sweep → structure break → retest strategy, with corrected TP1/retry handling. Includes market-structure and order-block zones, Ashe Color Forecast, PSAR labels, a white 200-period SMA and Volume Fight.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={copy}><Clipboard /> Copy Confluence v1</Button>
        <Button type="button" variant="outline" onClick={() => download(script, 'asheparte-confluence-v1.pine')}><Download /> Download strategy</Button>
        <Button type="button" variant="outline" onClick={() => download(volumePane, 'volume-fight-pane-v6.pine')}><Download /> Volume Fight pane</Button>
      </div>
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{status}</p>
      <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm leading-6">
        <p>Defaults: Fib factor 0.273 · white SMA 200 · PSAR dots and state filling off · forecast 7 / 100 · Volume Fight 24 / 15%.</p>
        <p className="mt-2">Paste the complete script into TradingView’s Pine Editor on a standard 5-minute XAUUSD chart. Match commissions, slippage and other backtest settings. The chart title should read “Asheparte Confluence v1”.</p>
        <p className="mt-2">Overlays do not add entry requirements or change exits. Forecast candles replay a historical color-pattern example—not a guaranteed prediction. The optional Volume Fight graph uses a separate lower-pane indicator.</p>
      </div>
      <p className="text-sm text-muted-foreground">Validation: local source checks passed; TradingView compilation and performance remain unverified. No win-rate or profit guarantee.</p>
      <details className="rounded-lg border border-border">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">View full Pine source</summary>
        <pre className="max-h-[600px] overflow-auto bg-muted/30 p-4 text-xs text-foreground"><code>{script}</code></pre>
      </details>
      <p className="text-xs leading-5 text-muted-foreground">Credits: user-supplied XAU A+, Market Structure Break &amp; Order Block (“Jin Kurosaki”), Price Action Color Forecast (Ashe), Parabolic/PSAR and community “Volume fight”. Source authorship and redistribution terms have not been independently verified; Volume Fight’s original author/link was not supplied.</p>
    </CardContent>
  </Card>;
}
