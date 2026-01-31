'use client';

import { useState, useEffect } from 'react';
import { useCurrentAccount as useSuiAccount } from '@mysten/dapp-kit';

export function useSuiWallet() {
  const [suiAddress, setSuiAddress] = useState<string | null>(null);
  const [suiConnected, setSuiConnected] = useState(false);
  const dappKitAccount = useSuiAccount();

  useEffect(() => {
    const checkSuiWallets = async () => {
      if (dappKitAccount?.address) {
        setSuiAddress(dappKitAccount.address);
        setSuiConnected(true);
        return;
      }

      try {
        const phantom = (window as any)?.phantom?.sui;
        if (phantom && phantom.isPhantom) {
          try {
            const response = await phantom.request({ method: 'getAccounts' });
            if (response && response.length > 0) {
              const address = response[0]?.address || response[0];
              if (address) {
                setSuiAddress(address);
                setSuiConnected(true);
                return;
              }
            }
          } catch {
            try {
              const account = await phantom.requestAccount();
              if (account?.address) {
                setSuiAddress(account.address);
                setSuiConnected(true);
                return;
              }
            } catch {}
          }
        }
      } catch {}

      if (!dappKitAccount?.address) {
        setSuiAddress(null);
        setSuiConnected(false);
      }
    };

    checkSuiWallets();
    const interval = setInterval(checkSuiWallets, 3000);
    return () => clearInterval(interval);
  }, [dappKitAccount]);

  return { suiAddress, suiConnected };
}
