'use client';

import { ClerkProvider } from '@clerk/react';

export function AsheparteClerkProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: '#22d3ee',
          colorBackground: '#071525',
          borderRadius: '0.75rem',
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
