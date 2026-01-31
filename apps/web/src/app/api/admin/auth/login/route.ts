// apps/web/src/app/api/admin/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Dev mode credentials - replace with DB lookup in production
const DEV_ADMINS = [
  { id: '1', email: 'admin@omniswap.io', password: 'admin123', role: 'SUPER_ADMIN', name: 'Admin' },
];

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // Dev mode: simple credential check
    const admin = DEV_ADMINS.find(
      (a) => a.email.toLowerCase() === email.toLowerCase() && a.password === password
    );

    if (!admin) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const session = {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      name: admin.name,
    };

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set('admin_session', JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
