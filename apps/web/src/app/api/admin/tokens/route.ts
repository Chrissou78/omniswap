// apps/web/src/app/api/admin/tokens/route.ts
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
  // Use the same findConfigFile to ensure we write to the same location we read from
  const tokensPath = await findConfigFile('tokens.json');
  await fs.writeFile(tokensPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log('Wrote tokens to:', tokensPath);
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

export async function GET(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const chainId = searchParams.get('chainId');
  const search = searchParams.get('search');

  try {
    const tokensData = await readTokensFile();
    const chainsData = await readChainsFile();

    let tokens = (tokensData.tokens || []).map((token: any) => {
      const chain = chainsData.chains.find((c: any) =>
        String(c.id) === String(token.chainId)
      );
      return {
        id: `${token.chainId}-${token.address}`,
        chainId: String(token.chainId),
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals || 18,
        logoUrl: token.logoURI || '',
        isActive: token.isActive !== false,
        isNative: token.tags?.includes('native') || token.address === 'native',
        isStablecoin: token.tags?.includes('stablecoin'),
        popularity: token.popularity || 0,
        tags: token.tags || [],
        chain: chain ? { name: chain.name, symbol: chain.symbol } : { name: 'Unknown', symbol: '?' },
      };
    });

    if (chainId && chainId !== 'all') {
      tokens = tokens.filter((t: any) => t.chainId === chainId);
    }

    if (search) {
      const s = search.toLowerCase();
      tokens = tokens.filter((t: any) =>
        t.symbol.toLowerCase().includes(s) ||
        t.name.toLowerCase().includes(s) ||
        t.address.toLowerCase().includes(s)
      );
    }

    return NextResponse.json(tokens);
  } catch (error) {
    console.error('Failed to fetch tokens:', error);
    return NextResponse.json({ error: 'Failed to fetch tokens' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const input = await request.json();
    const data = await readTokensFile();

    // Check if token already exists
    const exists = data.tokens.some((t: any) =>
      String(t.chainId) === String(input.chainId) &&
      t.address?.toLowerCase() === input.address?.toLowerCase()
    );

    if (exists) {
      return NextResponse.json({ error: 'Token already exists on this chain' }, { status: 400 });
    }

    // Build tags array
    const tags: string[] = [];
    if (input.isNative || input.address === 'native') tags.push('native');
    if (input.isStablecoin) tags.push('stablecoin');
    if (input.tags) {
      const inputTags = Array.isArray(input.tags) ? input.tags : input.tags.split(',').map((t: string) => t.trim());
      inputTags.forEach((t: string) => {
        if (t && !tags.includes(t)) tags.push(t);
      });
    }

    // Match the exact JSON structure
    const tokenToAdd: any = {
      chainId: parseInt(input.chainId) || input.chainId,
      address: input.address || 'native',
      symbol: input.symbol,
      name: input.name,
      decimals: input.decimals || 18,
      logoURI: input.logoUrl || '',
      tags,
      popularity: input.popularity || 0,
    };

    // Optional fields
    if (input.coingeckoId) tokenToAdd.coingeckoId = input.coingeckoId;

    data.tokens.push(tokenToAdd);
    await writeTokensFile(data);

    console.log('Created token:', tokenToAdd);

    return NextResponse.json({
      id: `${tokenToAdd.chainId}-${tokenToAdd.address}`,
      ...tokenToAdd,
    });
  } catch (error) {
    console.error('Failed to create token:', error);
    return NextResponse.json({ error: 'Failed to create token' }, { status: 500 });
  }
}
