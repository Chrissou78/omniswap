'use client';

import { ReactNode, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';

// Solana
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';

// Sui
import { SuiClientProvider, WalletProvider as SuiWalletProvider } from '@mysten/dapp-kit';

// Config - all from chains.json
import { wagmiConfig } from '@/lib/wagmi';
import { getSolanaRpc, getSuiRpc } from '@/lib/chain-config';
import { TenantProvider } from '@/hooks/useTenant';

import '@rainbow-me/rainbowkit/styles.css';
import '@solana/wallet-adapter-react-ui/styles.css';
import '@mysten/dapp-kit/dist/index.css';

// RPC Endpoints from chains.json
const SOLANA_RPC = getSolanaRpc();
const SUI_RPC = getSuiRpc();

// Sui networks configuration
const suiNetworks = {
  mainnet: { url: SUI_RPC },
};

// QueryClient singleton
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      refetchOnWindowFocus: false,
    },
  },
});

export function WalletProviders({ children }: { children: ReactNode }) {
  const solanaWallets = useMemo(() => [], []);

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <RainbowKitProvider
          theme={{
            lightMode: lightTheme({ accentColor: 'hsl(245, 58%, 51%)', borderRadius: 'medium' }),
            darkMode: darkTheme({ accentColor: 'hsl(245, 58%, 61%)', borderRadius: 'medium' }),
          }}
        >
          <ConnectionProvider endpoint={SOLANA_RPC}>
            <SolanaWalletProvider wallets={solanaWallets} autoConnect={false}>
              <WalletModalProvider>
                <SuiClientProvider networks={suiNetworks} defaultNetwork="mainnet">
                  <SuiWalletProvider autoConnect={false}>
                    <TenantProvider>
                      {children}
                    </TenantProvider>
                  </SuiWalletProvider>
                </SuiClientProvider>
              </WalletModalProvider>
            </SolanaWalletProvider>
          </ConnectionProvider>
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
