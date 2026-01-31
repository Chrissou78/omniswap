'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import dynamic from 'next/dynamic';

// Dynamically import wallet providers with SSR disabled
const WalletProviders = dynamic(
  () => import('./wallet-providers').then((mod) => mod.WalletProviders),
  { 
    ssr: false,
    loading: () => null
  }
);

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <WalletProviders>{children}</WalletProviders>
    </ThemeProvider>
  );
}
