'use client';

import { useState } from 'react';
import { useSession, useUser } from '@clerk/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ChangePassword() {
  const { user } = useUser();
  const { session } = useSession();
  const [open, setOpen] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function clear() {
    setSentTo(''); setCode(''); setCurrentPassword('');
    setPassword(''); setConfirmation(''); setError('');
  }

  function showError(cause: unknown) {
    const details = cause as { errors?: { longMessage?: string; message?: string }[]; message?: string };
    setError(details.errors?.[0]?.longMessage ?? details.errors?.[0]?.message ?? details.message ?? 'Unable to change password. Please try again.');
  }

  async function sendCode() {
    if (!session || !user || busy) return;
    setBusy(true); setError(''); setCode(''); setSentTo('');
    try {
      const email = user.primaryEmailAddress;
      if (!email || email.verification.status !== 'verified') throw new Error('A verified primary email is required.');
      const verification = await session.startVerification({ level: 'first_factor' });
      const factor = verification.supportedFirstFactors?.find((item) => item.strategy === 'email_code' && item.emailAddressId === email.id);
      if (!factor || factor.strategy !== 'email_code') throw new Error('Email-code verification is not enabled for this account. Enable email verification codes in Clerk before changing your password here.');
      await session.prepareFirstFactorVerification({ strategy: 'email_code', emailAddressId: factor.emailAddressId });
      setSentTo(email.emailAddress);
    } catch (cause) { showError(cause); }
    finally { setBusy(false); }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!session || !user || busy || !sentTo) return;
    setError('');
    if (password.length < 8) { setError('Use at least 8 characters.'); return; }
    if (password !== confirmation) { setError('The new passwords do not match.'); return; }
    if (user.primaryEmailAddress?.emailAddress !== sentTo) { clear(); setError('Your email changed. Request a new verification code.'); return; }
    setBusy(true);
    let verified = false;
    try {
      const verification = await session.attemptFirstFactorVerification({ strategy: 'email_code', code: code.trim() });
      if (verification.status !== 'complete') throw new Error('Email verification is incomplete. Password was not changed.');
      verified = true;
      await user.updatePassword({ newPassword: password, ...(user.passwordEnabled ? { currentPassword } : {}), signOutOfOtherSessions: true });
      clear(); setOpen(false); setSuccess(true);
    } catch (cause) {
      showError(cause);
      // A successfully consumed code must not authorize a later retry.
      if (verified) { setSentTo(''); setCode(''); }
    } finally { setBusy(false); }
  }

  return (
    <section className="mt-3" aria-label="Change password">
      {!open && <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { clear(); setSuccess(false); setOpen(true); }}>Change password</Button>}
      {success && <p role="status" className="mt-2 text-xs text-emerald-300">Password changed. Other sessions have been signed out.</p>}
      {open && <form className="grid gap-3 border-t border-white/10 pt-3" onSubmit={save}>
        <p className="text-xs leading-5 text-muted-foreground">Verify your current email before changing your password. Other sessions will be signed out.</p>
        {sentTo && <>
          <p role="status" className="text-xs text-muted-foreground">Code sent to {sentTo}.</p>
          <label className="grid gap-1.5 text-xs">Email verification code<Input autoComplete="one-time-code" inputMode="numeric" required value={code} onChange={(event) => setCode(event.target.value)} disabled={busy} /></label>
          {user?.passwordEnabled && <label className="grid gap-1.5 text-xs">Current password<Input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} disabled={busy} /></label>}
          <label className="grid gap-1.5 text-xs">New password<Input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} /></label>
          <label className="grid gap-1.5 text-xs">Confirm new password<Input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} /></label>
          <Button type="submit" size="sm" disabled={busy}>{busy ? 'Verifying…' : 'Verify email & change password'}</Button>
        </>}
        {error && <p role="alert" className="text-xs leading-5 text-red-300">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={sendCode}>{busy ? 'Please wait…' : sentTo ? 'Resend code' : 'Send email verification code'}</Button>
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => { clear(); setOpen(false); }}>Cancel</Button>
        </div>
      </form>}
    </section>
  );
}
