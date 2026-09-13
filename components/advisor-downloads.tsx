'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function AdvisorDownloads({ generatedToken, hasToken, onManage }: {
  generatedToken: string; hasToken: boolean; onManage: () => void;
}) {
  const { getToken, isSignedIn } = useAuth();
  const [savedToken, setSavedToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const bridgeToken = generatedToken || savedToken.trim();
  async function download(format: 'package' | 'source') {
    if (busy || !isSignedIn || !hasToken || !bridgeToken) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true); setMessage('');
    try {
      const sessionToken = await getToken();
      if (controller.signal.aborted) return;
      if (!sessionToken) throw new Error('Please sign in again.');
      const response = await fetch('/api/advisor-download', {
        method: 'POST', cache: 'no-store', signal: controller.signal,
        headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: bridgeToken, format }),
      });
      if (!response.ok) throw new Error(response.status === 403 ? 'This token belongs to another account or was replaced. Use your current saved key, or explicitly replace it in Manage account.' : response.status === 401 ? 'Please sign in again.' : 'Download unavailable. Check your key and try again.');
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = format === 'package' ? 'Asheparte-personal-advisor.zip' : 'AurumGuardAnalysisAdvisor-personal.mq5';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSavedToken('');
      setMessage('Download ready. Keep this file private—it contains your journal credential.');
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Download unavailable.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return <div className="space-y-3 rounded-xl border border-border p-4">
    <p className="text-sm font-medium">Your personal advisor · v3.26</p>
    {!hasToken ? <>
      <p className="text-sm text-muted-foreground">Generate your journal bridge key to unlock personal downloads.</p>
      <Button variant="outline" onClick={onManage}>Manage account · generate key</Button>
    </> : <>
      {!generatedToken && <label className="grid gap-2 text-sm">Your saved bridge key
        <Input type="password" autoComplete="off" spellCheck={false} value={savedToken} onChange={event => setSavedToken(event.target.value)} placeholder="Paste your current bridge key" disabled={busy} maxLength={100} />
        <span className="text-xs leading-5 text-muted-foreground">We store only a hash and cannot retrieve old keys. Paste your saved key, or replace it explicitly in Manage account. It is never stored in browser storage.</span>
      </label>}
      {generatedToken && <p className="text-sm text-muted-foreground">Your newly generated key will be included automatically.</p>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !bridgeToken || !isSignedIn} onClick={() => download('package')}><Download className="size-4" /> {busy ? 'Preparing…' : 'Download advisor + personal settings'}</Button>
        <Button variant="outline" disabled={busy || !bridgeToken || !isSignedIn} onClick={() => download('source')}>Optional .mq5 source</Button>
      </div>
      <Button variant="ghost" size="sm" onClick={onManage} disabled={busy}>Manage bridge key</Button>
    </>}
    <p className="text-xs leading-5 text-muted-foreground">The ZIP contains the standard .ex5 advisor, your private .set preset and installation steps. The optional .mq5 embeds your key and needs compilation in MetaEditor. Never share either personal download. Pairing approval is still required.</p>
    {message && <p role="status" className="text-sm leading-5 text-muted-foreground">{message}</p>}
  </div>;
}
