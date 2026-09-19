export type JournalAccountOption = { id: string; provider: string; server: string; loginMasked: string; mode: string; updatedAt?: string };

export function accountOptionLabel(account: JournalAccountOption, now = Date.now()) {
  const age = now - Date.parse(account.updatedAt ?? '');
  const status = Number.isFinite(age) && age >= -30_000 && age <= 135_000 ? 'Live' : 'Offline';
  const mode = account.mode === 'live' ? 'Real' : account.mode === 'demo' ? 'Demo' : account.mode === 'contest' ? 'Contest' : 'Unknown';
  return `${account.provider} ${mode} ${account.loginMasked.replace(/•/g, '*')} - ${status}`;
}

export function JournalAccountSelect({ id, accounts, value, onChange, loading = false }: {
  id: string;
  accounts: JournalAccountOption[];
  value: string;
  onChange: (id: string) => void;
  loading?: boolean;
}) {
  if (!accounts.length) return null;
  return <div className="min-w-0 w-full">
    <label htmlFor={id} className="sr-only">Broker account</label>
    <select id={id} value={value} onChange={event => onChange(event.target.value)} aria-busy={loading}
      className="block w-full min-w-0 max-w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-primary">
      {accounts.map(account => <option key={account.id} value={account.id}>
        {accountOptionLabel(account)}{accounts.filter(other => accountOptionLabel(other) === accountOptionLabel(account)).length > 1 ? ` (${accounts.indexOf(account) + 1})` : ''}
      </option>)}
    </select>
    {loading && <p role="status" className="mt-1 text-xs text-muted-foreground">Loading selected account…</p>}
  </div>;
}
