// apps/web/src/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { clearUserSession } from '@/lib/user-auth';

export async function POST() {
  await clearUserSession();
  return NextResponse.json({ ok: true });
}
