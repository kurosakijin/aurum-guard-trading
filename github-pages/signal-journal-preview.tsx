// Local component harness only; not an entry in the production build.
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import '../app/globals.css';
import { SignalJournal } from '../components/signal-journal';
function Preview() {
  const [dark, setDark] = useState(false);
  return <main className={`${dark ? 'workspace-dark' : 'workspace-light'} min-h-screen bg-background p-3 text-foreground sm:p-8`}>
    <button className="mb-4 rounded border border-border px-3 py-2" onClick={() => { document.documentElement.classList.toggle('dark', !dark); setDark(!dark); }}>{dark ? 'Test light theme' : 'Test dark theme'}</button>
    <p className="mb-4 text-sm">Isolated component preview — use synthetic journal files only.</p>
    <SignalJournal />
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
