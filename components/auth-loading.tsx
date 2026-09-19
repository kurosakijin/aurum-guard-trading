'use client';

import { useEffect, useState } from 'react';

export function AuthLoading({ darkMode }: { darkMode: boolean }) {
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setDelayed(true), 15_000);
    return () => window.clearTimeout(timer);
  }, []);
  return <main className={`grid min-h-dvh place-items-center p-6 ${darkMode ? 'bg-[#070b14] text-slate-100' : 'bg-[#f7f6fb] text-slate-900'}`}>
    <div className="max-w-sm text-center" role="status" aria-live="polite">
      <span aria-hidden="true" className={`mx-auto block size-9 animate-spin rounded-full border-[3px] motion-reduce:animate-none ${darkMode ? 'border-slate-700 border-t-violet-400' : 'border-violet-100 border-t-violet-600'}`} />
      <span className="sr-only">Checking your session…</span>
      {delayed && <>
        <p className="mt-5 text-sm">Signing in is taking longer than expected.</p>
        <p className={`mt-2 text-xs ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Check your connection, then retry. Your account data will not be cleared.</p>
        <button type="button" className="mt-4 rounded-lg bg-violet-700 px-4 py-2 text-sm text-white hover:bg-violet-600" onClick={() => window.location.reload()}>Retry connection</button>
      </>}
    </div>
  </main>;
}
