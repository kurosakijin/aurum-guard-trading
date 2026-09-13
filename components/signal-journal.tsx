'use client';

import { useRef, useState } from 'react';
import { parseSignalJournal, signalSummary, type SignalPlan } from '@/lib/signal-journal';
import { Button } from '@/components/ui/button';

export function SignalJournal() {
  const [plans, setPlans] = useState<SignalPlan[]>([]);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('All');
  const [limit, setLimit] = useState(20);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const visible = plans.filter(p => filter === 'All' || p.timeframe === filter);
  const totals = signalSummary(visible);
  async function importFiles(files: FileList | null) {
    if (!files?.length) return;
    const id = ++generation.current;
    setBusy(true); setMessage('');
    try {
      const list = Array.from(files);
      if (list.reduce((sum, file) => sum + file.size, 0) > 10_000_000) throw new Error('Select less than 10 MB of journal files.');
      const result = parseSignalJournal((await Promise.all(list.map(file => file.text()))).join('\n'));
      if (id !== generation.current) return;
      setPlans(result.plans); setLimit(20);
      setMessage(`${result.plans.length} plans imported. ${result.duplicates} duplicate records ignored. ${result.rejected} invalid/conflicting records and ${result.orphaned} records without an original plan found.`);
    } catch (error) {
      if (id === generation.current) setMessage(error instanceof Error ? error.message : 'Could not read journal.');
    } finally { if (id === generation.current) setBusy(false); }
  }
  return <section className="space-y-4 rounded-xl border border-border p-4 sm:p-5" aria-labelledby="signal-journal-heading">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="signal-journal-heading" className="text-base font-semibold text-foreground">Signal performance journal</h2>
        <p className="mt-1 text-sm text-muted-foreground">Observed plans only—not executed trades or broker P/L.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Reading…' : 'Import MT5 journal'}</Button>
        {plans.length > 0 && <Button type="button" variant="ghost" onClick={() => { generation.current++; setPlans([]); setMessage('Journal cleared from this view. Your files are unchanged.'); setBusy(false); }}>Clear view</Button>}
      </div>
    </div>
    <input ref={input} className="sr-only" type="file" accept=".jsonl" multiple aria-label="Select MT5 signal journal files" onChange={event => { void importFiles(event.target.files); event.target.value = ''; }} />
    <p className="text-sm leading-6 text-muted-foreground">In MT5, choose File → Open Data Folder → MQL5 → Files → AsheparteSignals. Select the .jsonl file created by advisor v3.28. Files are processed only in this browser tab; nothing is uploaded or saved to browser storage. Refreshing clears this view.</p>
    <p role="status" className="break-words text-sm text-foreground">{message}</p>
    {plans.length === 0 ? <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">No signal history imported. New plans are recorded after installing v3.28; earlier signals cannot be reconstructed.</p> : <>
      <label className="flex flex-wrap items-center gap-2 text-sm text-foreground">Setup timeframe
        <select className="rounded-lg border border-border bg-background p-2 text-foreground" value={filter} onChange={e => { setFilter(e.target.value); setLimit(20); }}>
          {['All', 'PERIOD_M1', 'PERIOD_M15', 'PERIOD_M30', 'PERIOD_H1'].map(value => <option key={value} value={value}>{value.replace('PERIOD_', '')}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Object.entries({ 'Plans': totals.total, 'TP1 observed': totals.tp1, 'TP2 observed': totals.tp2, 'TP3 completed': totals.tp3, 'SL observed': totals.sl, 'Unknown': totals.unknown, 'Unresolved': totals.unresolved }).map(([label, value]) => <div key={label} className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold text-foreground">{value}</p></div>)}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">TP counts overlap. An SL may follow TP1/TP2. Unknown outcomes are excluded from target totals. Unresolved means no final outcome in this file—not necessarily a currently active plan. These observations do not measure fills, costs, profit or future win probability.</p>
      <div className="space-y-2">{visible.slice(0, limit).map(plan => <details key={plan.planId} className="rounded-lg border border-border p-3 text-foreground">
        <summary className="cursor-pointer text-sm leading-6"><span className="font-semibold">{plan.symbol} · {plan.direction > 0 ? 'Buy' : 'Sell'} · {plan.timeframe.replace('PERIOD_', '')}</span> — {plan.strategy} · {plan.outcome === 'ACTIVE' ? 'Unresolved' : plan.outcome} · {plan.targets}/3 targets</summary>
        <div className="mt-3 space-y-2 break-words text-sm leading-6">
          <p className="text-muted-foreground">Recorded {new Date(plan.recordedAt).toLocaleString()} · v{plan.version}</p>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">{[['Entry', plan.entry], ['Original SL', plan.stop], ['TP1', plan.tp1], ['TP2', plan.tp2], ['TP3', plan.tp3]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd>{value}</dd></div>)}</dl>
          <p>{plan.explanation}</p><p>Rule score: {plan.ruleScore}/100 · MTF: {plan.mtfScore}/9. Not win probabilities.</p>
          <p>AI opinion at creation: {plan.aiOpinion}</p><p className="text-xs text-muted-foreground">Plan ID: {plan.planId}</p>
        </div>
      </details>)}</div>
      {visible.length > limit && <Button type="button" variant="outline" onClick={() => setLimit(n => n + 20)}>Show 20 more</Button>}
    </>}
  </section>;
}
