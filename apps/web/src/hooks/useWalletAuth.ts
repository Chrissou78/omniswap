// apps/web/src/hooks/useWalletAuth.ts
//
// Client-side wallet sign-in. Asks the server for a nonce, has the connected
// wallet sign it, and posts the signature back for verification.
//
// Non-custodial: this only signs a plain login message to prove address
// ownership. It never signs a transaction and never touches a private key.

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';

export interface AuthedUser {
  userId: string;
  address: string;
  chainType: 'evm' | 'solana' | 'sui';
}

export function useWalletAuth() {
  const [user, setUser] = useState<AuthedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { address: evmAddress } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { publicKey: solanaPublicKey, signMessage: signSolanaMessage } = useSolanaWallet();

  // Restore an existing session on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!cancelled) setUser(res.ok ? await res.json() : null);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    setIsSigningIn(true);
    try {
      const nonceRes = await fetch('/api/auth/nonce');
      if (!nonceRes.ok) throw new Error('Could not start sign-in');
      const { nonce, message } = await nonceRes.json();

      let address: string;
      let chainType: 'evm' | 'solana';
      let signature: string;

      if (evmAddress) {
        address = evmAddress;
        chainType = 'evm';
        signature = await signMessageAsync({ message });
      } else if (solanaPublicKey && signSolanaMessage) {
        address = solanaPublicKey.toString();
        chainType = 'solana';
        const signed = await signSolanaMessage(new TextEncoder().encode(message));
        // Server verifies a base64 signature (see /api/auth/verify).
        signature = Buffer.from(signed).toString('base64');
      } else {
        throw new Error('Connect an Ethereum or Solana wallet first');
      }

      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, chainType, signature, nonce }),
      });

      if (!verifyRes.ok) {
        const body = await verifyRes.json().catch(() => ({}));
        throw new Error(body.error || 'Sign-in failed');
      }

      setUser(await verifyRes.json());
    } catch (err: any) {
      setError(err?.shortMessage || err?.message || 'Sign-in failed');
    } finally {
      setIsSigningIn(false);
    }
  }, [evmAddress, signMessageAsync, solanaPublicKey, signSolanaMessage]);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  return { user, isLoading, isSigningIn, error, signIn, signOut };
}

export default useWalletAuth;
