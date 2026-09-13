// Imported local observations only. Never use this data in broker P/L or order APIs.
export type SignalPlan = {
  planId: string; recordedAt: number; version: string; symbol: string; timeframe: string;
  strategy: string; direction: number; entry: number; stop: number; tp1: number; tp2: number;
  tp3: number; ruleScore: number; mtfScore: number; aiOpinion: string; explanation: string;
  targets: number; outcome: 'ACTIVE' | 'SL' | 'TP3' | 'UNKNOWN';
};
type Json = Record<string, unknown>;
const text = (v: unknown, max = 300): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const outcomes = ['ACTIVE', 'SL', 'TP3', 'UNKNOWN'];

export function parseSignalJournal(input: string) {
  if (input.length > 10_000_000) throw new Error('Select journal files totaling less than 10 MB.');
  const lines = input.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.length > 30_000) throw new Error('Journal exceeds 30,000 lines. Import a smaller export.');
  const plans = new Map<string, SignalPlan>();
  const seen = new Map<string, string>();
  const corrupt = new Set<string>();
  let rejected = 0, duplicates = 0, orphaned = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    let row: Json;
    try { row = JSON.parse(line); } catch { rejected++; continue; }
    if (!row || typeof row !== 'object' || Array.isArray(row) || row.schema !== 1 ||
        !text(row.planId, 160) || !text(row.eventId, 200) || !number(row.recordedAt) ||
        row.recordedAt <= 0 || row.recordedAt > 8_640_000_000_000_000) { rejected++; continue; }
    const expectedId = row.type === 'CREATED' ? `${row.planId}/CREATED` : `${row.planId}/${row.targets}/${row.outcome}`;
    if (row.eventId !== expectedId) { rejected++; continue; }
    // Retry timestamps can differ. Compare the immutable content, not serialization order.
    const canonical = JSON.stringify(Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'recordedAt').sort(([a], [b]) => a.localeCompare(b))));
    const prior = seen.get(row.eventId);
    if (prior) {
      if (prior === canonical) duplicates++;
      else { rejected++; corrupt.add(row.planId); }
      continue;
    }
    if (row.type === 'CREATED') {
      if (![row.entry, row.stop, row.tp1, row.tp2, row.tp3].every(v => number(v) && v > 0) ||
          ![1, -1].includes(row.direction as number) ||
          !['PERIOD_M1', 'PERIOD_M15', 'PERIOD_M30', 'PERIOD_H1'].includes(row.timeframe as string) ||
          !text(row.symbol, 80) || !text(row.strategy, 80) || !text(row.version, 20) ||
          !text(row.aiOpinion) || !text(row.explanation, 600) ||
          !number(row.ruleScore) || row.ruleScore < 0 || row.ruleScore > 100 ||
          !number(row.mtfScore) || row.mtfScore < 0 || row.mtfScore > 9) { rejected++; continue; }
      const [entry, stop, tp1, tp2, tp3, direction] = [row.entry, row.stop, row.tp1, row.tp2, row.tp3, row.direction] as number[];
      if (direction * (entry - stop) <= 0 || direction * (tp1 - entry) <= 0 ||
          direction * (tp2 - tp1) <= 0 || direction * (tp3 - tp2) <= 0) { rejected++; continue; }
      // Explicit property selection: no arbitrary imported properties or HTML.
      plans.set(row.planId, { planId: row.planId, recordedAt: row.recordedAt, version: row.version,
        symbol: row.symbol, timeframe: row.timeframe as string, strategy: row.strategy, direction,
        entry, stop, tp1, tp2, tp3, ruleScore: row.ruleScore, mtfScore: row.mtfScore,
        aiOpinion: row.aiOpinion, explanation: row.explanation, targets: 0, outcome: 'ACTIVE' });
    } else if (row.type === 'PROGRESS') {
      if (!Number.isInteger(row.targets) || (row.targets as number) < 0 || (row.targets as number) > 3 ||
          !outcomes.includes(row.outcome as string) || (row.outcome === 'TP3') !== (row.targets === 3)) { rejected++; corrupt.add(row.planId); continue; }
      const plan = plans.get(row.planId);
      if (!plan) { orphaned++; continue; }
      if (plan.outcome !== 'ACTIVE' || (row.targets as number) < plan.targets) { rejected++; corrupt.add(row.planId); continue; }
      plan.targets = row.targets as number;
      plan.outcome = row.outcome as SignalPlan['outcome'];
    } else { rejected++; continue; }
    seen.set(row.eventId, canonical);
  }
  for (const id of corrupt) { const plan = plans.get(id); if (plan) plan.outcome = 'UNKNOWN'; }
  return { plans: [...plans.values()].sort((a, b) => b.recordedAt - a.recordedAt), rejected, duplicates, orphaned };
}

export function signalSummary(plans: SignalPlan[]) {
  return {
    total: plans.length, tp1: plans.filter(p => p.targets >= 1 && p.outcome !== 'UNKNOWN').length,
    tp2: plans.filter(p => p.targets >= 2 && p.outcome !== 'UNKNOWN').length,
    tp3: plans.filter(p => p.outcome === 'TP3').length,
    sl: plans.filter(p => p.outcome === 'SL').length,
    unknown: plans.filter(p => p.outcome === 'UNKNOWN').length,
    unresolved: plans.filter(p => p.outcome === 'ACTIVE').length,
  };
}
