// Legacy bridge milliseconds encode the MT5-reported clock, not a declared
// IANA timezone. Keep these clock fields unchanged everywhere in the journal.
export function journalDateKey(closed: string) {
  return /^\d{4}-\d{2}-\d{2}T/.test(closed) ? closed.slice(0, 10) : '';
}

export function journalDateLabel(closed: string) {
  const date = new Date(closed);
  if (!Number.isFinite(date.getTime())) return 'Unknown time';
  return date.toLocaleString('en-GB', { timeZone: 'UTC', year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}
