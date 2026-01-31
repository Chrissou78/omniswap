import { cookies } from 'next/headers';

export interface AdminSession {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR';
  name?: string;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('admin_session');
    if (!session?.value) return null;
    return JSON.parse(session.value);
  } catch {
    return null;
  }
}

export async function setAdminSession(admin: AdminSession): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('admin_session', JSON.stringify(admin), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
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