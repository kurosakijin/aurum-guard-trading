import { createRoot } from 'react-dom/client';

import '../app/globals.css';
import { AsheparteClerkProvider } from '../app/clerk-provider';
import Home from '../app/page';

document.documentElement.classList.add('dark');
document.body.classList.add('antialiased');

createRoot(document.getElementById('root')!).render(
  <AsheparteClerkProvider>
    <Home />
  </AsheparteClerkProvider>,
);
