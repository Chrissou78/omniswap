import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const KEY_LENGTH = 64;

/** Hash a password as `<saltHex>:<hashHex>` using scrypt (Node's built-in, no extra dependency). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `${salt}:${hash}`;
}

/** Verify a password against a hash produced by hashPassword(). Constant-time comparison. */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;

  const hashBuf = Buffer.from(hash, 'hex');
  const candidateBuf = scryptSync(password, salt, hashBuf.length);
  return hashBuf.length === candidateBuf.length && timingSafeEqual(hashBuf, candidateBuf);
}
