import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';

export interface AdminSession {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR';
  name?: string;
}

interface SignedPayload extends AdminSession {
  exp: number; // ms since epoch
}

const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 7 * 1000; // 7 days

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET is not configured');
  }
  return secret;
}

function sign(payloadB64: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadB64).digest('hex');
}

/**
 * Verify and decode a signed admin session cookie value.
 * Returns null if the signature is invalid, the payload is malformed, or it has expired.
 */
function verifyAndDecode(cookieValue: string, secret: string): AdminSession | null {
  const separatorIndex = cookieValue.lastIndexOf('.');
  if (separatorIndex === -1) return null;

  const payloadB64 = cookieValue.slice(0, separatorIndex);
  const providedSig = cookieValue.slice(separatorIndex + 1);
  const expectedSig = sign(payloadB64, secret);

  const providedBuf = Buffer.from(providedSig, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
    return null;
  }

  const decoded: SignedPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  if (!decoded.exp || decoded.exp < Date.now()) {
    return null;
  }

  const { exp, ...session } = decoded;
  return session;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get('admin_session');
    if (!cookie?.value) return null;
    return verifyAndDecode(cookie.value, getSessionSecret());
  } catch {
    return null;
  }
}

export async function setAdminSession(admin: AdminSession): Promise<void> {
  const secret = getSessionSecret();
  const payload: SignedPayload = { ...admin, exp: Date.now() + SESSION_MAX_AGE_MS };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(payloadB64, secret);

  const cookieStore = await cookies();
  cookieStore.set('admin_session', `${payloadB64}.${signature}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_MS / 1000,
    path: '/',
  });
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('admin_session');
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new Error('Unauthorized');
  return session;
}
