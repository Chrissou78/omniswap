// apps/web/src/app/api/admin/chains/route.ts
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
    console.error('Failed to read chains.json:', error);
    return { chains: [] };
  }
}

async function writeChainsFile(data: any) {
  await fs.writeFile(CHAINS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await readChainsFile();
    const chains = (data.chains || []).map((chain: any) => ({
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
    }));

    return NextResponse.json(chains);
  } catch (error) {
    console.error('Failed to fetch chains:', error);
    return NextResponse.json({ error: 'Failed to fetch chains' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const input = await request.json();
    const data = await readChainsFile();
    
    // Check if chain already exists
    const exists = data.chains.some((c: any) => String(c.id) === String(input.id));
    if (exists) {
      return NextResponse.json({ error: 'Chain with this ID already exists' }, { status: 400 });
    }

    // Match the exact JSON structure
    const chainToAdd: any = {
      id: input.type?.toLowerCase() === 'evm' ? parseInt(input.id) : input.id,
      name: input.name,
      symbol: input.symbol,
      type: (input.type || 'evm').toLowerCase(),
      popularity: input.popularity || 0,
    };

    // Optional fields - only add if provided
    if (input.color) chainToAdd.color = input.color;
    if (input.trustwalletId) chainToAdd.trustwalletId = input.trustwalletId;
    if (input.rpcUrl) {
      chainToAdd.rpcDefault = input.rpcUrl;
      chainToAdd.rpcEnvKey = `NEXT_PUBLIC_${input.symbol.toUpperCase()}_RPC`;
    }
    if (input.explorerUrl) chainToAdd.explorerUrl = input.explorerUrl;
    if (input.explorerName) chainToAdd.explorerName = input.explorerName;
    if (input.logoUrl) chainToAdd.logoUrl = input.logoUrl;
    if (input.isTestnet) chainToAdd.isTestnet = true;

    data.chains.push(chainToAdd);
    await writeChainsFile(data);
    
    console.log('Created chain:', chainToAdd);
    
    return NextResponse.json({
      ...chainToAdd,
      id: String(chainToAdd.id),
    });
  } catch (error) {
    console.error('Failed to create chain:', error);
    return NextResponse.json({ error: 'Failed to create chain' }, { status: 500 });
  }
}
