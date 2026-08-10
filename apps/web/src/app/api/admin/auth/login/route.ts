// apps/web/src/app/api/admin/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { setAdminSession } from '@/lib/admin-auth';
import { verifyPassword } from '@/lib/password';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

    if (!adminEmail || !adminPasswordHash) {
      console.error('Admin login misconfigured: ADMIN_EMAIL / ADMIN_PASSWORD_HASH not set');
      return NextResponse.json({ error: 'Admin login is not configured' }, { status: 503 });
    }

    const emailMatches = email.toLowerCase() === adminEmail.toLowerCase();
    // Always run verifyPassword, even on email mismatch, so response timing doesn't
    // reveal whether the email was valid.
    const passwordMatches = verifyPassword(password, adminPasswordHash);

    if (!emailMatches || !passwordMatches) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const session = {
      id: '1',
      email: adminEmail,
      role: 'SUPER_ADMIN' as const,
      name: 'Admin',
    };

    await setAdminSession(session);

    return NextResponse.json(session);
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
