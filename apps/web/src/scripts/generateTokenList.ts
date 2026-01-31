// Token list generator that fetches from Trust Wallet and other sources
import fs from 'fs';
import path from 'path';

interface TrustWalletToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
}

interface Token {
  chainId: number | string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
  tags: string[];
  popularity: number;
  coingeckoId?: string;
}

// Chain configurations with Trust Wallet naming
const CHAIN_CONFIGS = [
  { chainId: 1, name: 'ethereum', nativeSymbol: 'ETH', nativeName: 'Ethereum' },
  { chainId: 56, name: 'smartchain', nativeSymbol: 'BNB', nativeName: 'BNB' },
  { chainId: 137, name: 'polygon', nativeSymbol: 'MATIC', nativeName: 'Polygon' },
  { chainId: 42161, name: 'arbitrum', nativeSymbol: 'ETH', nativeName: 'Ethereum' },
  { chainId: 10, name: 'optimism', nativeSymbol: 'ETH', nativeName: 'Ethereum' },
  { chainId: 8453, name: 'base', nativeSymbol: 'ETH', nativeName: 'Ethereum' },
  { chainId: 43114, name: 'avalanchec', nativeSymbol: 'AVAX', nativeName: 'Avalanche' },
  { chainId: 324, name: 'zksync', nativeSymbol: 'ETH', nativeName: 'Ethereum' },
  { chainId: 59144, name: 'linea', nativeSymbol: 'ETH', nativeName: 'Ethereum' },
  { chainId: 534352, name: 'scroll', nativeSymbol: 'ETH', nativeName: 'Ethereum' },
  { chainId: 81457, name: 'blast', nativeSymbol: 'ETH', nativeName: 'Ethereum' },
  { chainId: 5000, name: 'mantle', nativeSymbol: 'MNT', nativeName: 'Mantle' },
];

// Token popularity rankings (higher = more popular)
const TOKEN_POPULARITY: Record<string, number> = {
  ETH: 100, BTC: 99, WBTC: 98, USDT: 97, USDC: 96, DAI: 95,
  WETH: 94, BNB: 93, MATIC: 92, AVAX: 91, SOL: 90,
  LINK: 85, UNI: 84, AAVE: 83, MKR: 82, SNX: 81,
  CRV: 80, COMP: 79, YFI: 78, SUSHI: 77, GRT: 76,
  '1INCH': 75, BAT: 74, ZRX: 73, ENJ: 72, MANA: 71,
  SAND: 70, SHIB: 69, PEPE: 68, WIF: 67, BONK: 66,
  ARB: 65, OP: 64, GMX: 63, DYDX: 62, LDO: 61,
};

async function fetchTrustWalletTokens(chainName: string): Promise<TrustWalletToken[]> {
  try {
    const response = await fetch(
      `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chainName}/tokenlist.json`
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.tokens || [];
  } catch (error) {
    console.error(`Failed to fetch tokens for ${chainName}:`, error);
    return [];
  }
}

function getPopularity(symbol: string): number {
  const upperSymbol = symbol.toUpperCase().replace(/\.[A-Z]+$/, ''); // Remove .e, .b suffixes
  return TOKEN_POPULARITY[upperSymbol] || 10;
}

function getTags(symbol: string, address: string): string[] {
  const tags: string[] = [];
  const upperSymbol = symbol.toUpperCase();
  
  if (address === 'native') tags.push('native');
  if (['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'USDD', 'UST'].some(s => upperSymbol.includes(s))) {
    tags.push('stablecoin');
  }
  if (upperSymbol.startsWith('W') && ['WETH', 'WBTC', 'WMATIC', 'WAVAX', 'WBNB'].includes(upperSymbol)) {
    tags.push('wrapped');
  }
  
  return tags;
}

async function generateTokenList(): Promise<void> {
  const allTokens: Token[] = [];
  
  for (const chain of CHAIN_CONFIGS) {
    console.log(`Fetching tokens for ${chain.name}...`);
    
    // Add native token first
    allTokens.push({
      chainId: chain.chainId,
      address: 'native',
      symbol: chain.nativeSymbol,
      name: chain.nativeName,
      decimals: 18,
      logoURI: `https://assets-cdn.trustwallet.com/blockchains/${chain.name}/info/logo.png`,
      tags: ['native'],
      popularity: getPopularity(chain.nativeSymbol) + 5, // Boost native tokens
    });
    
    // Fetch Trust Wallet tokens
    const tokens = await fetchTrustWalletTokens(chain.name);
    
    for (const token of tokens) {
      allTokens.push({
        chainId: chain.chainId,
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        logoURI: token.logoURI,
        tags: getTags(token.symbol, token.address),
        popularity: getPopularity(token.symbol),
      });
    }
  }
  
  // Add Solana tokens
  console.log('Fetching Solana tokens...');
  const solanaTokens = await fetchSolanaTokens();
  allTokens.push(...solanaTokens);
  
  // Add SUI tokens
  console.log('Adding SUI tokens...');
  allTokens.push(...getSuiTokens());
  
  // Sort by chainId then popularity
  allTokens.sort((a, b) => {
    if (a.chainId !== b.chainId) {
      return typeof a.chainId === 'string' ? 1 : typeof b.chainId === 'string' ? -1 : a.chainId - b.chainId;
    }
    return b.popularity - a.popularity;
  });
  
  // Write to file
  const outputPath = path.join(__dirname, '../config/tokens.json');
  fs.writeFileSync(outputPath, JSON.stringify(allTokens, null, 2));
  console.log(`Generated ${allTokens.length} tokens to ${outputPath}`);
}

async function fetchSolanaTokens(): Promise<Token[]> {
  const tokens: Token[] = [
    // Native SOL
    {
      chainId: 'solana',
      address: 'native',
      symbol: 'SOL',
      name: 'Solana',
      decimals: 9,
      logoURI: 'https://assets-cdn.trustwallet.com/blockchains/solana/info/logo.png',
      tags: ['native'],
      popularity: 95,
    },
    // USDC
    {
      chainId: 'solana',
      address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      logoURI: 'https://assets-cdn.trustwallet.com/blockchains/solana/assets/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
      tags: ['stablecoin'],
      popularity: 96,
    },
    // USDT
    {
      chainId: 'solana',
      address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      logoURI: 'https://assets-cdn.trustwallet.com/blockchains/solana/assets/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png',
      tags: ['stablecoin'],
      popularity: 95,
    },
    // Popular Solana tokens
    {
      chainId: 'solana',
      address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
      symbol: 'WIF',
      name: 'dogwifhat',
      decimals: 6,
      logoURI: 'https://assets-cdn.trustwallet.com/blockchains/solana/assets/EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm/logo.png',
      tags: ['meme'],
      popularity: 70,
    },
    {
      chainId: 'solana',
      address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      symbol: 'JUP',
      name: 'Jupiter',
      decimals: 6,
      logoURI: 'https://static.jup.ag/jup/icon.png',
      tags: ['defi'],
      popularity: 80,
    },
    {
      chainId: 'solana',
      address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
      symbol: 'RAY',
      name: 'Raydium',
      decimals: 6,
      logoURI: 'https://assets-cdn.trustwallet.com/blockchains/solana/assets/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png',
      tags: ['defi'],
      popularity: 75,
    },
    {
      chainId: 'solana',
      address: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
      symbol: 'PYTH',
      name: 'Pyth Network',
      decimals: 6,
      logoURI: 'https://assets-cdn.trustwallet.com/blockchains/solana/assets/HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3/logo.png',
      tags: ['oracle'],
      popularity: 72,
    },
    {
      chainId: 'solana',
      address: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
      symbol: 'JitoSOL',
      name: 'Jito Staked SOL',
      decimals: 9,
      logoURI: 'https://assets-cdn.trustwallet.com/blockchains/solana/assets/J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn/logo.png',
      tags: ['lsd'],
      popularity: 73,
    },
    {
      chainId: 'solana',
      address: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof',
      symbol: 'RNDR',
      name: 'Render Token',
      decimals: 8,
      logoURI: 'https://assets-cdn.trustwallet.com/blockchains/solana/assets/rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof/logo.png',
      tags: ['ai'],
      popularity: 74,
    },
  ];
  
  return tokens;
}

function getSuiTokens(): Token[] {
  return [
    {
      chainId: 'sui',
      address: 'native',
      symbol: 'SUI',
      name: 'Sui',
      decimals: 9,
      logoURI: 'https://assets-cdn.trustwallet.com/blockchains/sui/info/logo.png',
      tags: ['native'],
      popularity: 85,
    },
    {
      chainId: 'sui',
      address: '0x2::sui::SUI',
      symbol: 'SUI',
      name: 'Sui (Coin Type)',
      decimals: 9,
      logoURI: 'https://assets-cdn.trustwallet.com/blockchains/sui/info/logo.png',
      tags: ['native'],
      popularity: 85,
    },
    {
      chainId: 'sui',
      address: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      logoURI: 'https://coin-logos.simplr.sh/usdc.png',
      tags: ['stablecoin'],
      popularity: 90,
    },
    {
      chainId: 'sui',
      address: '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      logoURI: 'https://coin-logos.simplr.sh/usdt.png',
      tags: ['stablecoin'],
      popularity: 89,
    },
  ];
}

// Run the generator
generateTokenList().catch(console.error);