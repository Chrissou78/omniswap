// apps/web/src/app/api/admin/chains/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-auth';
import { promises as fs } from 'fs';
import path from 'path';

const CHAINS_FILE = path.join(process.cwd(), 'src/config/chains.json');

async function readChainsFile() {
  try {
    const data = await fs.readFile(CHAINS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return { chains: [] };
  }
}

async function writeChainsFile(data: any) {
  await fs.writeFile(CHAINS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const data = await readChainsFile();
    const chain = data.chains.find((c: any) => String(c.id) === id);
    
    if (!chain) {
      return NextResponse.json({ error: 'Chain not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: String(chain.id),
      name: chain.name,
      symbol: chain.symbol,
      type: chain.type?.toUpperCase() || 'EVM',
      color: chain.color || '',
      rpcUrl: chain.rpcDefault || '',
      rpcEnvKey: chain.rpcEnvKey || '',
      explorerUrl: chain.explorerUrl || '',
      explorerName: chain.explorerName || '',
      logoUrl: chain.logoUrl || '',
      trustwalletId: chain.trustwalletId || '',
      isActive: chain.isActive !== false,
      isTestnet: chain.isTestnet || false,
      popularity: chain.popularity || 0,
      _count: { tokens: 0 },
    });
  } catch (error) {
    console.error('Failed to fetch chain:', error);
    return NextResponse.json({ error: 'Failed to fetch chain' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const updates = await request.json();
    const data = await readChainsFile();
    
    const index = data.chains.findIndex((c: any) => String(c.id) === id);
    if (index === -1) {
      return NextResponse.json({ error: 'Chain not found' }, { status: 404 });
    }

    // Update while preserving structure
    const existing = data.chains[index];
    data.chains[index] = {
      ...existing,
      name: updates.name ?? existing.name,
      symbol: updates.symbol ?? existing.symbol,
      type: updates.type?.toLowerCase() ?? existing.type,
      color: updates.color ?? existing.color,
      rpcDefault: updates.rpcUrl ?? existing.rpcDefault,
      explorerUrl: updates.explorerUrl ?? existing.explorerUrl,
      explorerName: updates.explorerName ?? existing.explorerName,
      logoUrl: updates.logoUrl ?? existing.logoUrl,
      trustwalletId: updates.trustwalletId ?? existing.trustwalletId,
      isTestnet: updates.isTestnet ?? existing.isTestnet,
      popularity: updates.popularity ?? existing.popularity,
    };

    await writeChainsFile(data);
    
    return NextResponse.json(data.chains[index]);
  } catch (error) {
    console.error('Failed to update chain:', error);
    return NextResponse.json({ error: 'Failed to update chain' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const data = await readChainsFile();
    
    const index = data.chains.findIndex((c: any) => String(c.id) === id);
    if (index === -1) {
      return NextResponse.json({ error: 'Chain not found' }, { status: 404 });
    }

    data.chains.splice(index, 1);
    await writeChainsFile(data);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete chain:', error);
    return NextResponse.json({ error: 'Failed to delete chain' }, { status: 500 });
  }
}
