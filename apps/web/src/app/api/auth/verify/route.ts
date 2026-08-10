// apps/web/src/app/api/auth/verify/route.ts
//
// Verifies a wallet signature over the login message and, only on success,
// issues a session. Signature checks are real per chain family - a bad or
// mismatched signature is rejected, never assumed valid.

import { NextRequest, NextResponse } from 'next/server';
import { verifyMessage } from 'viem';
import { ed25519 } from '@noble/curves/ed25519';
import { PublicKey } from '@solana/web3.js';
import {
  buildLoginMessage,
  verifyLoginNonce,
  findOrCreateUserForAddress,
  setUserSession,
  type WalletChainType,
} from '@/lib/user-auth';

async function verifySignature(params: {
  chainType: WalletChainType;
  address: string;
  message: string;
  signature: string;
}): Promise<boolean> {
  const { chainType, address, message, signature } = params;

  if (chainType === 'evm') {
    return verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
  }

  if (chainType === 'solana') {
    // Solana wallets sign raw message bytes with ed25519. PublicKey handles the
    // base58 address; the signature arrives base64 from the client (below), so
    // there's no need for a base58 lib that isn't a declared dependency.
    const publicKeyBytes = new PublicKey(address).toBytes();
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Uint8Array.from(Buffer.from(signature, 'base64'));
    return ed25519.verify(signatureBytes, messageBytes, publicKeyBytes);
  }

  // Sui personal-message signatures need the dapp-kit/Sui SDK verifier, which
  // isn't wired up here yet. Fail closed rather than accept unverified input.
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const { address, chainType, signature, nonce } = await request.json();

    if (!address || !chainType || !signature || !nonce) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!['evm', 'solana', 'sui'].includes(chainType)) {
      return NextResponse.json({ error: 'Unsupported chain type' }, { status: 400 });
    }

    const nonceCheck = verifyLoginNonce(nonce);
    if (!nonceCheck.valid) {
      return NextResponse.json({ error: nonceCheck.reason }, { status: 400 });
    }

    // Rebuild the message server-side from the nonce, so the client can't have
    // signed something different from what we think it signed.
    const message = buildLoginMessage(nonce);

    let signatureValid = false;
    try {
      signatureValid = await verifySignature({
        chainType: chainType as WalletChainType,
        address,
        message,
        signature,
      });
    } catch (error) {
      console.warn('Signature verification threw:', error);
      signatureValid = false;
    }

    if (!signatureValid) {
      return NextResponse.json(
        {
          error:
            chainType === 'sui'
              ? 'Sui wallet sign-in is not supported yet.'
              : 'Signature verification failed',
        },
        { status: 401 }
      );
    }

    const userId = await findOrCreateUserForAddress(address, chainType as WalletChainType);
    const session = {
      userId,
      address: chainType === 'evm' ? address.toLowerCase() : address,
      chainType: chainType as WalletChainType,
    };
    await setUserSession(session);

    return NextResponse.json(session);
  } catch (error: any) {
    console.error('Wallet login failed:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
