// apps/web/src/app/api/admin/tokens/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-auth';
import { promises as fs } from 'fs';
import path from 'path';

// Try multiple possible paths
async function findConfigFile(filename: string) {
  const possiblePaths = [
    path.join(process.cwd(), 'src/config', filename),
    path.join(process.cwd(), 'apps/web/src/config', filename),
  ];

  for (const p of possiblePaths) {
    try {
      await fs.access(p);
      return p;
    } catch {
      // continue to next path
    }
  }

  throw new Error(`Could not find ${filename}`);
}

async function readTokensFile() {
  try {
    const tokensPath = await findConfigFile('tokens.json');
    const data = await fs.readFile(tokensPath, 'utf-8');
    // Remove BOM and any leading whitespace/invisible characters
    const cleanData = data.replace(/^\uFEFF/, '').replace(/^\s+/, '').trim();
    return JSON.parse(cleanData);
  } catch (error) {
    console.error('Error reading tokens file:', error);
    return { tokens: [] };
  }
}

async function writeTokensFile(data: any) {
  const tokensPath = await findConfigFile('tokens.json');
  await fs.writeFile(tokensPath, JSON.stringify(data, null, 2), 'utf-8');
}

async function readChainsFile() {
  try {
    const chainsPath = await findConfigFile('chains.json');
    const data = await fs.readFile(chainsPath, 'utf-8');
    const cleanData = data.replace(/^\uFEFF/, '').replace(/^\s+/, '').trim();
    return JSON.parse(cleanData);
  } catch (error) {
    console.error('Error reading chains file:', error);
    return { chains: [] };
  }
}

function findTokenIndex(tokens: any[], id: string): number {
  const decodedId = decodeURIComponent(id);
  
  // Parse "chainId-address" format
  const firstDash = decodedId.indexOf('-');
  if (firstDash === -1) return -1;
  
  const chainId = decodedId.substring(0, firstDash);
  const address = decodedId.substring(firstDash + 1);
  
  return tokens.findIndex((t: any) => 
    String(t.chainId) === chainId && 
    t.address?.toLowerCase() === address.toLowerCase()
  );
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
    const tokensData = await readTokensFile();
    const chainsData = await readChainsFile();
    
    const index = findTokenIndex(tokensData.tokens, id);
    
    if (index === -1) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    const token = tokensData.tokens[index];
    const chain = chainsData.chains.find((c: any) => String(c.id) === String(token.chainId));

    return NextResponse.json({
      id: `${token.chainId}-${token.address}`,
      chainId: String(token.chainId),
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals || 18,
      logoUrl: token.logoURI || '',
      coingeckoId: token.coingeckoId || '',
      isActive: token.isActive !== false,
      isNative: token.tags?.includes('native'),
      isStablecoin: token.tags?.includes('stablecoin'),
      popularity: token.popularity || 0,
      tags: token.tags || [],
      chain: chain ? { id: String(chain.id), name: chain.name, symbol: chain.symbol } : null,
    });
  } catch (error) {
    console.error('Failed to fetch token:', error);
    return NextResponse.json({ error: 'Failed to fetch token' }, { status: 500 });
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
    const data = await readTokensFile();
    
    const index = findTokenIndex(data.tokens, id);
    if (index === -1) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    const existing = data.tokens[index];
    
    // Build updated tags
    let tags = existing.tags || [];
    if (updates.isNative === true && !tags.includes('native')) tags.push('native');
    if (updates.isNative === false) tags = tags.filter((t: string) => t !== 'native');
    if (updates.isStablecoin === true && !tags.includes('stablecoin')) tags.push('stablecoin');
    if (updates.isStablecoin === false) tags = tags.filter((t: string) => t !== 'stablecoin');

    // Update token
    data.tokens[index] = {
      chainId: existing.chainId,
      address: existing.address,
      symbol: updates.symbol ?? existing.symbol,
      name: updates.name ?? existing.name,
      decimals: updates.decimals ?? existing.decimals,
      logoURI: updates.logoUrl ?? existing.logoURI,
      tags,
      popularity: updates.popularity ?? existing.popularity,
    };

    if (updates.coingeckoId || existing.coingeckoId) {
      data.tokens[index].coingeckoId = updates.coingeckoId ?? existing.coingeckoId;
    }

    await writeTokensFile(data);
    
    return NextResponse.json(data.tokens[index]);
  } catch (error) {
    console.error('Failed to update token:', error);
    return NextResponse.json({ error: 'Failed to update token' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return PUT(request, { params });
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
    const data = await readTokensFile();
    
    const index = findTokenIndex(data.tokens, id);
    if (index === -1) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    data.tokens.splice(index, 1);
    await writeTokensFile(data);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete token:', error);
    return NextResponse.json({ error: 'Failed to delete token' }, { status: 500 });
  }
}
