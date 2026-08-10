// apps/web/src/lib/user-auth.ts
//
// Wallet-signature ("sign-in with wallet") authentication for regular users.
//
// WHY THIS EXISTS: PriceAlert / DCAStrategy / LimitOrder all hang off a
// required User row. Wallet addresses are public, so if those routes simply
// accepted an address as a parameter, anyone could read or delete anyone
// else's alerts and orders just by passing their address. Proving ownership of
// the address with a signature is the minimum bar for those features.
//
// This is NON-CUSTODIAL: the user signs a short login message to prove they
// control the address. No private key is ever sent, stored, or handled here.
//
// The session cookie reuses the same HMAC-signed-payload approach as
// apps/web/src/lib/admin-auth.ts so there's one signing scheme in the codebase.

import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';

export type WalletChainType = 'evm' | 'solana' | 'sui';

export interface UserSession {
  userId: string;
  address: string;
  chainType: WalletChainType;
}

interface SignedUserPayload extends UserSession {
  exp: number; // ms since epoch
}

const COOKIE_NAME = 'user_session';
const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 30 * 1000; // 30 days
const NONCE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

function getSessionSecret(): string {
  // Reuse the admin session secret if a dedicated one isn't configured, so
  // deployments don't silently fall back to an empty/guessable key.
  const secret = process.env.USER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('USER_SESSION_SECRET (or ADMIN_SESSION_SECRET) is not configured');
  return secret;
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// ============================================================================
// LOGIN NONCE
// ============================================================================

/**
 * Issue a signed, time-limited nonce. Kept stateless (HMAC over the nonce +
 * expiry) so it needs no extra table, while still being unforgeable and
 * expiring on its own.
 */
export function createLoginNonce(): { nonce: string; message: string } {
  const secret = getSessionSecret();
  const raw = randomBytes(16).toString('hex');
  const exp = Date.now() + NONCE_MAX_AGE_MS;
  const payload = `${raw}.${exp}`;
  const nonce = `${payload}.${sign(payload, secret)}`;

  const message = [
    'Sign in to OmniSwap',
    '',
    'Signing this message proves you control this wallet.',
    'It does not authorize any transaction and costs no gas.',
    '',
    `Nonce: ${nonce}`,
  ].join('\n');

  return { nonce, message };
}

/** Rebuild the exact message a client should have signed for a given nonce. */
export function buildLoginMessage(nonce: string): string {
  return [
    'Sign in to OmniSwap',
    '',
    'Signing this message proves you control this wallet.',
    'It does not authorize any transaction and costs no gas.',
    '',
    `Nonce: ${nonce}`,
  ].join('\n');
}

export function verifyLoginNonce(nonce: string): { valid: boolean; reason?: string } {
  try {
    const parts = nonce.split('.');
    if (parts.length !== 3) return { valid: false, reason: 'Malformed nonce' };
    const [raw, expStr, signature] = parts;

    if (!safeEqualHex(signature, sign(`${raw}.${expStr}`, getSessionSecret()))) {
      return { valid: false, reason: 'Invalid nonce signature' };
    }
    if (Number(expStr) < Date.now()) {
      return { valid: false, reason: 'Nonce expired, please try again' };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: 'Could not verify nonce' };
  }
}

// ============================================================================
// SESSION
// ============================================================================

export async function setUserSession(session: UserSession): Promise<void> {
  const secret = getSessionSecret();
  const payload: SignedUserPayload = { ...session, exp: Date.now() + SESSION_MAX_AGE_MS };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, `${payloadB64}.${sign(payloadB64, secret)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_MS / 1000,
    path: '/',
  });
}

export async function getUserSession(): Promise<UserSession | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(COOKIE_NAME);
    if (!cookie?.value) return null;

    const separatorIndex = cookie.value.lastIndexOf('.');
    if (separatorIndex === -1) return null;

    const payloadB64 = cookie.value.slice(0, separatorIndex);
    const signature = cookie.value.slice(separatorIndex + 1);

    if (!safeEqualHex(signature, sign(payloadB64, getSessionSecret()))) return null;

    const decoded: SignedUserPayload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    );
    if (!decoded.exp || decoded.exp < Date.now()) return null;

    const { exp, ...session } = decoded;
    return session;
  } catch {
    return null;
  }
}

export async function clearUserSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Find or create the User row for a verified wallet address. Only ever called
 * after a signature has been checked.
 */
export async function findOrCreateUserForAddress(
  address: string,
  chainType: WalletChainType
): Promise<string> {
  const normalized = chainType === 'evm' ? address.toLowerCase() : address;

  const existing = await prisma.user.findFirst({ where: { primaryAddress: normalized } });
  if (existing) return existing.id;

  const created = await prisma.user.create({ data: { primaryAddress: normalized } });

  // Best-effort: record the address/chain pairing if the table is present.
  try {
    await prisma.userAddress.create({
      data: { userId: created.id, address: normalized, chainType },
    });
  } catch {
    // Non-fatal - the User row is what the alert/order features need.
  }

  return created.id;
}
