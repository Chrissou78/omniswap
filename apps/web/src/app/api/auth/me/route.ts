// apps/web/src/app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { getUserSession } from '@/lib/user-auth';

export async function GET() {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  return NextResponse.json(session);
}
