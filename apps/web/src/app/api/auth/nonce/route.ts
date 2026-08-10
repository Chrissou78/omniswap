// apps/web/src/app/api/auth/nonce/route.ts
import { NextResponse } from 'next/server';
import { createLoginNonce } from '@/lib/user-auth';

export async function GET() {
  try {
    const { nonce, message } = createLoginNonce();
    return NextResponse.json({ nonce, message });
  } catch (error: any) {
    console.error('Nonce generation failed:', error);
    return NextResponse.json({ error: 'Login is not configured' }, { status: 503 });
  }
}
