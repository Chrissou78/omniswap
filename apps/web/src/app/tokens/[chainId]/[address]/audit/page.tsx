// apps/web/src/app/tokens/[chainId]/[address]/audit/page.tsx
'use client';

import React, { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  Info,
  TrendingUp,
  Users,
  Lock,
  Unlock,
  Code,
  FileCode,
  Activity,
  BarChart3,
  Wallet,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { cn, formatNumber, shortenAddress, formatDate } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useState } from 'react';

// Types from TokenSelector
interface TokenAudit {
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  risks: TokenRisk[];
  isHoneypot: boolean;
  isMintable: boolean;
  isProxy: boolean;
  hasBlacklist: boolean;
  hasWhitelist: boolean;
  canTakeBackOwnership: boolean;
  ownerChangeBalance: boolean;
  hiddenOwner: boolean;
  selfDestruct: boolean;
  externalCall: boolean;
  buyTax: string;
  sellTax: string;
  holders: number;
  lpHolders: number;
  totalSupply: string;
  creatorAddress: string;
  creatorPercent: string;
  ownerAddress: string;
  ownerPercent: string;
  lpTotalSupply: string;
  lpLockedPercent: string;
  dexInfo: DexInfo[];
  topHolders?: TopHolder[];
  antiWhale?: AntiWhaleInfo;
  tradingCooldown?: string;
  slippageModifiable?: boolean;
  personalSlippageModifiable?: boolean;
  transferPausable?: boolean;
  cannotBuy?: boolean;
  cannotSellAll?: boolean;
  lastUpdated: string;
}

interface TokenRisk {
  code: string;
  name: string;
  description: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
}

interface DexInfo {
  name: string;
  liquidity: string;
  pair: string;
}

interface TopHolder {
  address: string;
  balance: string;
  percent: string;
  isContract: boolean;
  isLocked: boolean;
  tag?: string;
}

interface AntiWhaleInfo {
  isAntiWhale: boolean;
  antiWhaleModifiable: boolean;
  maxTxAmount?: string;
  maxTxPercent?: string;
  maxHoldAmount?: string;
  maxHoldPercent?: string;
}

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: string;
  logoURI?: string;
  price?: number;
  priceChange24h?: number;
  marketCap?: number;
  volume24h?: number;
  isVerified?: boolean;
}

// Risk config
const RISK_CONFIG = {
  safe: { color: 'text-green-500', bg: 'bg-green-500', label: 'Safe', icon: ShieldCheck },
  low: { color: 'text-blue-500', bg: 'bg-blue-500', label: 'Low Risk', icon: Shield },
  medium: { color: 'text-yellow-500', bg: 'bg-yellow-500', label: 'Medium Risk', icon: ShieldAlert },
  high: { color: 'text-orange-500', bg: 'bg-orange-500', label: 'High Risk', icon: AlertTriangle },
  critical: { color: 'text-red-500', bg: 'bg-red-500', label: 'Critical Risk', icon: ShieldX },
};

const SEVERITY_CONFIG = {
  info: { color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  low: { color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  medium: { color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  high: { color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  critical: { color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
};

const CHAIN_EXPLORERS: Record<string, { name: string; url: string }> = {
  '1': { name: 'Etherscan', url: 'https://etherscan.io' },
  '56': { name: 'BscScan', url: 'https://bscscan.com' },
  '137': { name: 'PolygonScan', url: 'https://polygonscan.com' },
  '42161': { name: 'Arbiscan', url: 'https://arbiscan.io' },
  '10': { name: 'Optimistic', url: 'https://optimistic.etherscan.io' },
  '8453': { name: 'BaseScan', url: 'https://basescan.org' },
  '43114': { name: 'Snowtrace', url: 'https://snowtrace.io' },
  'solana-mainnet': { name: 'Solscan', url: 'https://solscan.io' },
  'sui-mainnet': { name: 'Sui Explorer', url: 'https://suiscan.xyz' },
};

export default function TokenAuditPage() {
  const params = useParams();
  const chainId = params.chainId as string;
  const address = params.address as string;
  const [copied, setCopied] = useState(false);

  // Fetch token info
  const { data: tokenData, isLoading: isLoadingToken } = useQuery({
    queryKey: ['token', chainId, address],
    queryFn: async () => {
      const res = await fetch(`/api/v1/tokens/${chainId}/${address}`);
      if (!res.ok) throw new Error('Failed to fetch token');
      return res.json();
    },
  });

  // Fetch audit
  const {
    data: auditData,
    isLoading: isLoadingAudit,
    refetch: refetchAudit,
    isFetching: isRefetching,
  } = useQuery({
    queryKey: ['token-audit', chainId, address],
    queryFn: async () => {
      const res = await fetch(`/api/v1/tokens/${chainId}/${address}/audit`);
      if (!res.ok) throw new Error('Failed to fetch audit');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const token: Token | undefined = tokenData?.token;
  const audit: TokenAudit | undefined = auditData?.audit;
  const riskConfig = audit ? RISK_CONFIG[audit.riskLevel] : null;
  const RiskIcon = riskConfig?.icon || Shield;
  const explorer = CHAIN_EXPLORERS[chainId];

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Holder distribution chart data
  const holderChartData = useMemo(() => {
    if (!audit?.topHolders) return [];
    const topTotal = audit.topHolders.reduce((sum, h) => sum + parseFloat(h.percent), 0);
    return [
      ...audit.topHolders.slice(0, 5).map((h, i) => ({
        name: h.tag || shortenAddress(h.address),
        value: parseFloat(h.percent),
        color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][i],
      })),
      {
        name: 'Others',
        value: Math.max(0, 100 - topTotal),
        color: '#6B7280',
      },
    ];
  }, [audit?.topHolders]);

  const isLoading = isLoadingToken || isLoadingAudit;

  if (isLoading) {
    return <TokenAuditSkeleton />;
  }

  if (!token || !audit) {
    return (
      <div className="container py-8">
        <Card className="p-8 text-center">
          <ShieldX className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Token Not Found</h2>
          <p className="text-muted-foreground mb-4">
            Unable to find token or security audit data for this address.
          </p>
          <Button asChild>
            <Link href="/swap">Back to Swap</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/swap">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          {token.logoURI && (
            <Image
              src={token.logoURI}
              alt={token.symbol}
              width={56}
              height={56}
              className="rounded-full"
            />
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{token.symbol}</h1>
              {token.isVerified && (
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-500">
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">{token.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-sm bg-muted px-2 py-0.5 rounded">
                {shortenAddress(address)}
              </code>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyAddress}>
                {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              </Button>
              {explorer && (
                <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                  <a
                    href={`${explorer.url}/token/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchAudit()}
            disabled={isRefetching}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isRefetching && 'animate-spin')} />
            Refresh
          </Button>
          <Button asChild>
            <Link href={`/swap?inputToken=${address}&chainId=${chainId}`}>
              Swap {token.symbol}
            </Link>
          </Button>
        </div>
      </div>

      {/* Risk Score Card */}
      <Card className={cn('border-2', {
        'border-green-500/50': audit.riskLevel === 'safe',
        'border-blue-500/50': audit.riskLevel === 'low',
        'border-yellow-500/50': audit.riskLevel === 'medium',
        'border-orange-500/50': audit.riskLevel === 'high',
        'border-red-500/50': audit.riskLevel === 'critical',
      })}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center',
                riskConfig?.bg + '/20'
              )}>
                <RiskIcon className={cn('h-8 w-8', riskConfig?.color)} />
              </div>
              <div>
                <h2 className={cn('text-2xl font-bold', riskConfig?.color)}>
                  {riskConfig?.label}
                </h2>
                <p className="text-muted-foreground">
                  Security Score: {100 - audit.riskScore}/100
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-4xl font-bold">{100 - audit.riskScore}</div>
              <p className="text-sm text-muted-foreground">out of 100</p>
            </div>
          </div>

          <div className="mt-4">
            <Progress
              value={100 - audit.riskScore}
              className="h-3"
            />
          </div>

          <p className="text-sm text-muted-foreground mt-4">
            Last updated: {formatDate(audit.lastUpdated)} • Powered by GoPlus Security
          </p>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="risks">
            Risks
            {audit.risks.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {audit.risks.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="contract">Contract</TabsTrigger>
          <TabsTrigger value="liquidity">Liquidity</TabsTrigger>
          <TabsTrigger value="holders">Holders</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Quick Stats */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Price & Market
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price</span>
                  <span className="font-medium">${formatNumber(token.price || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">24h Change</span>
                  <span className={cn(
                    'font-medium',
                    (token.priceChange24h || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                  )}>
                    {(token.priceChange24h || 0) >= 0 ? '+' : ''}
                    {(token.priceChange24h || 0).toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Market Cap</span>
                  <span className="font-medium">${formatNumber(token.marketCap || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Volume 24h</span>
                  <span className="font-medium">${formatNumber(token.volume24h || 0)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Tax Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Trading Taxes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Buy Tax</span>
                  <Badge variant={parseFloat(audit.buyTax) > 10 ? 'destructive' : 'secondary'}>
                    {audit.buyTax}%
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Sell Tax</span>
                  <Badge variant={parseFloat(audit.sellTax) > 10 ? 'destructive' : 'secondary'}>
                    {audit.sellTax}%
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Slippage Modifiable</span>
                  <Badge variant={audit.slippageModifiable ? 'destructive' : 'secondary'}>
                    {audit.slippageModifiable ? 'Yes' : 'No'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Transfer Pausable</span>
                  <Badge variant={audit.transferPausable ? 'destructive' : 'secondary'}>
                    {audit.transferPausable ? 'Yes' : 'No'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Key Flags */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Security Flags
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <SecurityFlag label="Honeypot" value={audit.isHoneypot} danger />
                <SecurityFlag label="Mintable" value={audit.isMintable} />
                <SecurityFlag label="Proxy Contract" value={audit.isProxy} />
                <SecurityFlag label="Blacklist" value={audit.hasBlacklist} />
                <SecurityFlag label="Whitelist" value={audit.hasWhitelist} />
                <SecurityFlag label="Hidden Owner" value={audit.hiddenOwner} danger />
                <SecurityFlag label="Can Take Back Ownership" value={audit.canTakeBackOwnership} danger />
                <SecurityFlag label="Self Destruct" value={audit.selfDestruct} danger />
              </CardContent>
            </Card>
          </div>

          {/* Quick Risk Summary */}
          {audit.risks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Risk Summary</CardTitle>
                <CardDescription>
                  {audit.risks.length} issue{audit.risks.length !== 1 ? 's' : ''} detected
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {['critical', 'high', 'medium', 'low', 'info'].map((severity) => {
                    const count = audit.risks.filter((r) => r.severity === severity).length;
                    if (count === 0) return null;
                    const config = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG];
                    return (
                      <Badge
                        key={severity}
                        variant="secondary"
                        className={cn(config.bg, config.color)}
                      >
                        {count} {severity}
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Risks Tab */}
        <TabsContent value="risks" className="space-y-4">
          {audit.risks.length === 0 ? (
            <Card className="p-8 text-center">
              <ShieldCheck className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <h3 className="text-lg font-semibold mb-2">No Risks Detected</h3>
              <p className="text-muted-foreground">
                This token passed all security checks. However, always do your own research.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {['critical', 'high', 'medium', 'low', 'info'].map((severity) => {
                const risks = audit.risks.filter((r) => r.severity === severity);
                if (risks.length === 0) return null;
                const config = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG];
                
                return (
                  <div key={severity} className="space-y-2">
                    <h3 className={cn('text-sm font-semibold uppercase', config.color)}>
                      {severity} ({risks.length})
                    </h3>
                    {risks.map((risk) => (
                      <Card key={risk.code} className={cn('border', config.border)}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className={cn('h-5 w-5 mt-0.5', config.color)} />
                            <div>
                              <h4 className="font-medium">{risk.name}</h4>
                              <p className="text-sm text-muted-foreground mt-1">
                                {risk.description}
                              </p>
                              <Badge variant="outline" className="mt-2 text-xs">
                                Code: {risk.code}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Contract Tab */}
        <TabsContent value="contract" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileCode className="h-4 w-4" />
                  Contract Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="Contract Address" value={shortenAddress(address)} copyable={address} />
                <InfoRow label="Token Decimals" value={token.decimals.toString()} />
                <InfoRow label="Total Supply" value={formatNumber(parseFloat(audit.totalSupply))} />
                <InfoRow label="Is Proxy" value={audit.isProxy ? 'Yes' : 'No'} />
                <InfoRow label="External Call" value={audit.externalCall ? 'Yes' : 'No'} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Ownership
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow
                  label="Owner"
                  value={audit.ownerAddress ? shortenAddress(audit.ownerAddress) : 'Renounced'}
                  copyable={audit.ownerAddress}
                />
                <InfoRow
                  label="Owner Balance"
                  value={audit.ownerPercent ? `${audit.ownerPercent}%` : '0%'}
                />
                <InfoRow
                  label="Creator"
                  value={audit.creatorAddress ? shortenAddress(audit.creatorAddress) : 'Unknown'}
                  copyable={audit.creatorAddress}
                />
                <InfoRow
                  label="Creator Balance"
                  value={audit.creatorPercent ? `${audit.creatorPercent}%` : '0%'}
                />
                <InfoRow
                  label="Hidden Owner"
                  value={audit.hiddenOwner ? 'Yes' : 'No'}
                  warning={audit.hiddenOwner}
                />
                <InfoRow
                  label="Can Retrieve Ownership"
                  value={audit.canTakeBackOwnership ? 'Yes' : 'No'}
                  warning={audit.canTakeBackOwnership}
                />
              </CardContent>
            </Card>
          </div>

          {/* Anti-Whale Info */}
          {audit.antiWhale && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Anti-Whale Mechanism
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Enabled</p>
                    <p className="font-medium">{audit.antiWhale.isAntiWhale ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Modifiable</p>
                    <p className="font-medium">{audit.antiWhale.antiWhaleModifiable ? 'Yes' : 'No'}</p>
                  </div>
                  {audit.antiWhale.maxTxPercent && (
                    <div>
                      <p className="text-sm text-muted-foreground">Max TX</p>
                      <p className="font-medium">{audit.antiWhale.maxTxPercent}%</p>
                    </div>
                  )}
                  {audit.antiWhale.maxHoldPercent && (
                    <div>
                      <p className="text-sm text-muted-foreground">Max Hold</p>
                      <p className="font-medium">{audit.antiWhale.maxHoldPercent}%</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Liquidity Tab */}
        <TabsContent value="liquidity" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Liquidity</p>
                    <p className="text-xl font-bold">
                      ${formatNumber(
                        audit.dexInfo.reduce((sum, d) => sum + parseFloat(d.liquidity || '0'), 0)
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Lock className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">LP Locked</p>
                    <p className="text-xl font-bold">{audit.lpLockedPercent}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">LP Holders</p>
                    <p className="text-xl font-bold">{formatNumber(audit.lpHolders)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* DEX List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Liquidity Pools</CardTitle>
              <CardDescription>
                Found on {audit.dexInfo.length} DEX{audit.dexInfo.length !== 1 ? 'es' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {audit.dexInfo.map((dex, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{dex.name}</p>
                      <p className="text-sm text-muted-foreground">{dex.pair}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${formatNumber(parseFloat(dex.liquidity))}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Holders Tab */}
        <TabsContent value="holders" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Holders</p>
                    <p className="text-xl font-bold">{formatNumber(audit.holders)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardContent className="p-6">
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={holderChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {holderChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [`${value.toFixed(2)}%`, 'Holding']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-3 mt-4">
                  {holderChartData.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-sm">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Holders List */}
          {audit.topHolders && audit.topHolders.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Holders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {audit.topHolders.map((holder, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground w-6">{i + 1}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <code className="text-sm">{shortenAddress(holder.address)}</code>
                            {holder.tag && (
                              <Badge variant="secondary" className="text-xs">
                                {holder.tag}
                              </Badge>
                            )}
                            {holder.isContract && (
                              <Badge variant="outline" className="text-xs">
                                <Code className="h-3 w-3 mr-1" />
                                Contract
                              </Badge>
                            )}
                            {holder.isLocked && (
                              <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-500">
                                <Lock className="h-3 w-3 mr-1" />
                                Locked
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{holder.percent}%</p>
                        <p className="text-sm text-muted-foreground">
                          {formatNumber(parseFloat(holder.balance))} {token.symbol}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper Components
function SecurityFlag({
  label,
  value,
  danger,
}: {
  label: string;
  value: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Badge
        variant={value ? (danger ? 'destructive' : 'secondary') : 'secondary'}
        className={cn(
          value
            ? danger
              ? 'bg-red-500/10 text-red-500'
              : 'bg-yellow-500/10 text-yellow-500'
            : 'bg-green-500/10 text-green-500'
        )}
      >
        {value ? 'Yes' : 'No'}
      </Badge>
    </div>
  );
}

function InfoRow({
  label,
  value,
  copyable,
  warning,
}: {
  label: string;
  value: string;
  copyable?: string;
  warning?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (copyable) {
      navigator.clipboard.writeText(copyable);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className={cn('text-sm font-medium', warning && 'text-red-500')}>
          {value}
        </span>
        {copyable && (
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleCopy}>
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function TokenAuditSkeleton() {
  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-14 w-14 rounded-full" />
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}
