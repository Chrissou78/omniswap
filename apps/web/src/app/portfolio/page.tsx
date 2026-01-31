// apps/web/src/app/portfolio/page.tsx
'use client';

import React, { useState, useMemo } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Plus,
  Eye,
  EyeOff,
  ExternalLink,
  Copy,
  Check,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  MoreHorizontal,
  ArrowRightLeft,
  History,
  Bell,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
} from 'lucide-react';
import { cn, formatNumber, formatCurrency, shortenAddress } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { useWallet } from '@/hooks/useWallet';
import { Input } from '@/components/ui/input';

// Types
interface PortfolioHolding {
  id: string;
  token: {
    address: string;
    symbol: string;
    name: string;
    logoURI?: string;
    chainId: string;
    decimals: number;
    audit?: {
      riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
      riskScore: number;
    };
  };
  balance: string;
  balanceUsd: string;
  price: string;
  priceChange24h: number;
  avgCostBasis: string;
  totalCost: string;
  unrealizedPnl: string;
  unrealizedPnlPercent: number;
  allocation: number;
}

interface PortfolioSummary {
  totalValueUsd: string;
  totalCostBasis: string;
  totalUnrealizedPnl: string;
  totalUnrealizedPnlPercent: number;
  change24h: string;
  change24hPercent: number;
  holdings: PortfolioHolding[];
}

interface HistoricalData {
  timestamp: string;
  value: number;
}

interface Transaction {
  id: string;
  type: 'swap' | 'send' | 'receive' | 'bridge';
  status: 'completed' | 'pending' | 'failed';
  fromToken: { symbol: string; logoURI?: string; amount: string };
  toToken?: { symbol: string; logoURI?: string; amount: string };
  valueUsd: string;
  timestamp: string;
  txHash: string;
  chainId: string;
}

const TIMEFRAME_OPTIONS = [
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'All' },
];

const CHAIN_INFO: Record<string, { name: string; color: string; icon: string }> = {
  '1': { name: 'Ethereum', color: '#627EEA', icon: '/chains/ethereum.svg' },
  '56': { name: 'BNB Chain', color: '#F0B90B', icon: '/chains/bsc.svg' },
  '137': { name: 'Polygon', color: '#8247E5', icon: '/chains/polygon.svg' },
  '42161': { name: 'Arbitrum', color: '#28A0F0', icon: '/chains/arbitrum.svg' },
  '10': { name: 'Optimism', color: '#FF0420', icon: '/chains/optimism.svg' },
  '8453': { name: 'Base', color: '#0052FF', icon: '/chains/base.svg' },
  '43114': { name: 'Avalanche', color: '#E84142', icon: '/chains/avalanche.svg' },
  'solana-mainnet': { name: 'Solana', color: '#14F195', icon: '/chains/solana.svg' },
  'sui-mainnet': { name: 'Sui', color: '#4DA2FF', icon: '/chains/sui.svg' },
};

const RISK_CONFIG = {
  safe: { color: 'text-green-500', bg: 'bg-green-500/10', icon: ShieldCheck },
  low: { color: 'text-blue-500', bg: 'bg-blue-500/10', icon: Shield },
  medium: { color: 'text-yellow-500', bg: 'bg-yellow-500/10', icon: ShieldAlert },
  high: { color: 'text-orange-500', bg: 'bg-orange-500/10', icon: ShieldAlert },
  critical: { color: 'text-red-500', bg: 'bg-red-500/10', icon: ShieldX },
};

const EXPLORER_URLS: Record<string, string> = {
  '1': 'https://etherscan.io',
  '56': 'https://bscscan.com',
  '137': 'https://polygonscan.com',
  '42161': 'https://arbiscan.io',
  '10': 'https://optimistic.etherscan.io',
  '8453': 'https://basescan.org',
  '43114': 'https://snowtrace.io',
  'solana-mainnet': 'https://solscan.io',
  'sui-mainnet': 'https://suiscan.xyz',
};

export default function PortfolioPage() {
  const { isConnected, addresses, connect } = useWallet();
  const [timeframe, setTimeframe] = useState('30d');
  const [hideSmallBalances, setHideSmallBalances] = useState(false);
  const [showValues, setShowValues] = useState(true);
  const [sortBy, setSortBy] = useState<'value' | 'pnl' | 'change' | 'name'>('value');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChain, setSelectedChain] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('holdings');
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Fetch portfolio summary
  const {
    data: portfolioData,
    isLoading: isLoadingPortfolio,
    refetch: refetchPortfolio,
    isFetching: isRefetching,
  } = useQuery({
    queryKey: ['portfolio', addresses],
    queryFn: async () => {
      const res = await fetch('/api/v1/portfolio/summary');
      if (!res.ok) throw new Error('Failed to fetch portfolio');
      return res.json() as Promise<{ portfolio: PortfolioSummary }>;
    },
    enabled: isConnected && addresses.length > 0,
    refetchInterval: 30000,
  });

  // Fetch historical data
  const { data: historicalData, isLoading: isLoadingHistorical } = useQuery({
    queryKey: ['portfolio', 'historical', timeframe],
    queryFn: async () => {
      const res = await fetch(`/api/v1/portfolio/historical?timeframe=${timeframe}`);
      if (!res.ok) throw new Error('Failed to fetch historical data');
      return res.json() as Promise<{ data: HistoricalData[] }>;
    },
    enabled: isConnected,
  });

  // Fetch transactions
  const { data: transactionsData, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['portfolio', 'transactions'],
    queryFn: async () => {
      const res = await fetch('/api/v1/portfolio/transactions?limit=50');
      if (!res.ok) throw new Error('Failed to fetch transactions');
      return res.json() as Promise<{ transactions: Transaction[] }>;
    },
    enabled: isConnected && activeTab === 'history',
  });

  // Sort and filter holdings
  const holdings = useMemo(() => {
    if (!portfolioData?.portfolio?.holdings) return [];

    let filtered = portfolioData.portfolio.holdings;

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (h) =>
          h.token.symbol.toLowerCase().includes(query) ||
          h.token.name.toLowerCase().includes(query) ||
          h.token.address.toLowerCase().includes(query)
      );
    }

    // Filter by chain
    if (selectedChain !== 'all') {
      filtered = filtered.filter((h) => h.token.chainId === selectedChain);
    }

    // Filter small balances
    if (hideSmallBalances) {
      filtered = filtered.filter((h) => parseFloat(h.balanceUsd) >= 1);
    }

    // Sort
    return filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'value':
          comparison = parseFloat(b.balanceUsd) - parseFloat(a.balanceUsd);
          break;
        case 'pnl':
          comparison = parseFloat(b.unrealizedPnl) - parseFloat(a.unrealizedPnl);
          break;
        case 'change':
          comparison = b.priceChange24h - a.priceChange24h;
          break;
        case 'name':
          comparison = a.token.symbol.localeCompare(b.token.symbol);
          break;
      }
      return sortDirection === 'desc' ? comparison : -comparison;
    });
  }, [portfolioData, hideSmallBalances, sortBy, sortDirection, searchQuery, selectedChain]);

  // Chain distribution data
  const chainDistribution = useMemo(() => {
    if (!holdings.length) return [];

    const distribution: Record<string, number> = {};
    holdings.forEach((h) => {
      const chainId = h.token.chainId;
      distribution[chainId] = (distribution[chainId] || 0) + parseFloat(h.balanceUsd);
    });

    return Object.entries(distribution)
      .map(([chainId, value]) => ({
        chainId,
        name: CHAIN_INFO[chainId]?.name || chainId,
        value,
        color: CHAIN_INFO[chainId]?.color || '#6B7280',
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings]);

  // Allocation chart data (top assets)
  const allocationData = useMemo(() => {
    if (!holdings.length) return [];

    const topHoldings = holdings.slice(0, 5);
    const othersValue = holdings
      .slice(5)
      .reduce((sum, h) => sum + parseFloat(h.balanceUsd), 0);

    const data = topHoldings.map((h, i) => ({
      name: h.token.symbol,
      value: parseFloat(h.balanceUsd),
      color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][i],
    }));

    if (othersValue > 0) {
      data.push({
        name: 'Others',
        value: othersValue,
        color: '#6B7280',
      });
    }

    return data;
  }, [holdings]);

  // Unique chains for filter
  const uniqueChains = useMemo(() => {
    if (!portfolioData?.portfolio?.holdings) return [];
    const chains = new Set(portfolioData.portfolio.holdings.map((h) => h.token.chainId));
    return Array.from(chains);
  }, [portfolioData]);

  const summary = portfolioData?.portfolio;
  const isPositive = summary ? parseFloat(summary.change24h) >= 0 : true;
  const isPnlPositive = summary ? parseFloat(summary.totalUnrealizedPnl) >= 0 : true;

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
  };

  // Not connected state
  if (!isConnected) {
    return (
      <div className="container py-8">
        <Card className="p-12 text-center">
          <Wallet className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Connect your wallet to view your portfolio across Ethereum, Solana, Sui, and other supported chains
          </p>
          <Button size="lg" onClick={() => connect()}>
            <Wallet className="h-5 w-5 mr-2" />
            Connect Wallet
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Portfolio</h1>
          <p className="text-muted-foreground">
            Track your assets across {uniqueChains.length} chain{uniqueChains.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowValues(!showValues)}
            title={showValues ? 'Hide values' : 'Show values'}
          >
            {showValues ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            onClick={() => refetchPortfolio()}
            disabled={isRefetching}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isRefetching && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Value */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total Value</span>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </div>
            {isLoadingPortfolio ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-bold">
                {showValues
                  ? formatCurrency(parseFloat(summary?.totalValueUsd || '0'))
                  : '••••••'}
              </p>
            )}
          </CardContent>
        </Card>

        {/* 24h Change */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">24h Change</span>
              {isPositive ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </div>
            {isLoadingPortfolio ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="flex items-baseline gap-2">
                <p
                  className={cn(
                    'text-2xl font-bold',
                    isPositive ? 'text-green-500' : 'text-red-500'
                  )}
                >
                  {showValues
                    ? (isPositive ? '+' : '') +
                      formatCurrency(parseFloat(summary?.change24h || '0'))
                    : '••••••'}
                </p>
                <span
                  className={cn('text-sm', isPositive ? 'text-green-500' : 'text-red-500')}
                >
                  {isPositive ? '+' : ''}
                  {summary?.change24hPercent.toFixed(2)}%
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Unrealized P&L */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Unrealized P&L</span>
              {isPnlPositive ? (
                <ArrowUpRight className="h-4 w-4 text-green-500" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-500" />
              )}
            </div>
            {isLoadingPortfolio ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="flex items-baseline gap-2">
                <p
                  className={cn(
                    'text-2xl font-bold',
                    isPnlPositive ? 'text-green-500' : 'text-red-500'
                  )}
                >
                  {showValues
                    ? (isPnlPositive ? '+' : '') +
                      formatCurrency(parseFloat(summary?.totalUnrealizedPnl || '0'))
                    : '••••••'}
                </p>
                <span
                  className={cn('text-sm', isPnlPositive ? 'text-green-500' : 'text-red-500')}
                >
                  {isPnlPositive ? '+' : ''}
                  {summary?.totalUnrealizedPnlPercent.toFixed(2)}%
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assets Count */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Assets</span>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </div>
            {isLoadingPortfolio ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <p className="text-2xl font-bold">{holdings.length}</p>
                <p className="text-sm text-muted-foreground">
                  Across {uniqueChains.length} chain{uniqueChains.length !== 1 ? 's' : ''}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Value Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle>Portfolio Value</CardTitle>
              <div className="flex flex-wrap gap-1">
                {TIMEFRAME_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    variant={timeframe === opt.value ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setTimeframe(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingHistorical ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historicalData?.data || []}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(val) => {
                        const date = new Date(val);
                        return timeframe === '24h'
                          ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                      }}
                      className="text-xs"
                    />
                    <YAxis
                      tickFormatter={(val) => `$${formatNumber(val)}`}
                      className="text-xs"
                      width={80}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Value']}
                      labelFormatter={(label) =>
                        new Date(label).toLocaleString([], {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      }
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorValue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Allocation & Chain Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingPortfolio ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={allocationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {allocationData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [
                          showValues ? formatCurrency(value) : '••••••',
                          'Value',
                        ]}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-4">
                  {allocationData.slice(0, 5).map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm">{item.name}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {showValues
                          ? formatCurrency(item.value)
                          : `${((item.value / parseFloat(summary?.totalValueUsd || '1')) * 100).toFixed(1)}%`}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Chain Distribution */}
            <div className="mt-6 pt-6 border-t">
              <h4 className="text-sm font-medium mb-3">By Chain</h4>
              <div className="space-y-2">
                {chainDistribution.slice(0, 5).map((chain) => (
                  <div key={chain.chainId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {CHAIN_INFO[chain.chainId]?.icon && (
                        <Image
                          src={CHAIN_INFO[chain.chainId].icon}
                          alt={chain.name}
                          width={16}
                          height={16}
                          className="rounded-full"
                        />
                      )}
                      <span className="text-sm">{chain.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {showValues ? formatCurrency(chain.value) : '••••••'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Holdings & History Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <TabsList>
            <TabsTrigger value="holdings" className="gap-2">
              <Wallet className="h-4 w-4" />
              Holdings
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          {activeTab === 'holdings' && (
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tokens..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>

              {/* Chain Filter */}
              <Select value={selectedChain} onValueChange={setSelectedChain}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Chains" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Chains</SelectItem>
                  {uniqueChains.map((chainId) => (
                    <SelectItem key={chainId} value={chainId}>
                      <div className="flex items-center gap-2">
                        {CHAIN_INFO[chainId]?.icon && (
                          <Image
                            src={CHAIN_INFO[chainId].icon}
                            alt=""
                            width={16}
                            height={16}
                            className="rounded-full"
                          />
                        )}
                        {CHAIN_INFO[chainId]?.name || chainId}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Hide Small Toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id="hide-small"
                  checked={hideSmallBalances}
                  onCheckedChange={setHideSmallBalances}
                />
                <Label htmlFor="hide-small" className="text-sm cursor-pointer">
                  Hide small
                </Label>
              </div>
            </div>
          )}
        </div>

        {/* Holdings Tab */}
        <TabsContent value="holdings" className="mt-0">
          <Card>
            <CardContent className="p-0">
              {isLoadingPortfolio ? (
                <div className="p-6 space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-24 mb-2" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
              ) : holdings.length === 0 ? (
                <div className="p-12 text-center">
                  <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Holdings Found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchQuery || selectedChain !== 'all'
                      ? 'No tokens match your filters'
                      : 'Start trading to build your portfolio'}
                  </p>
                  {(searchQuery || selectedChain !== 'all') && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedChain('all');
                      }}
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[300px]">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 -ml-3"
                          onClick={() => handleSort('name')}
                        >
                          Asset
                          {sortBy === 'name' &&
                            (sortDirection === 'desc' ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronUp className="h-4 w-4" />
                            ))}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => handleSort('change')}
                        >
                          24h
                          {sortBy === 'change' &&
                            (sortDirection === 'desc' ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronUp className="h-4 w-4" />
                            ))}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => handleSort('value')}
                        >
                          Value
                          {sortBy === 'value' &&
                            (sortDirection === 'desc' ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronUp className="h-4 w-4" />
                            ))}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => handleSort('pnl')}
                        >
                          P&L
                          {sortBy === 'pnl' &&
                            (sortDirection === 'desc' ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronUp className="h-4 w-4" />
                            ))}
                        </Button>
                      </TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holdings.map((holding) => {
                      const riskConfig = holding.token.audit
                        ? RISK_CONFIG[holding.token.audit.riskLevel]
                        : null;
                      const RiskIcon = riskConfig?.icon || Shield;
                      const isPnlPositive = parseFloat(holding.unrealizedPnl) >= 0;
                      const isChangePositive = holding.priceChange24h >= 0;

                      return (
                        <TableRow key={holding.id}>
                          {/* Asset */}
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                {holding.token.logoURI ? (
                                  <Image
                                    src={holding.token.logoURI}
                                    alt={holding.token.symbol}
                                    width={40}
                                    height={40}
                                    className="rounded-full"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                    <span className="text-sm font-medium">
                                      {holding.token.symbol.slice(0, 2)}
                                    </span>
                                  </div>
                                )}
                                {CHAIN_INFO[holding.token.chainId]?.icon && (
                                  <Image
                                    src={CHAIN_INFO[holding.token.chainId].icon}
                                    alt=""
                                    width={16}
                                    height={16}
                                    className="absolute -bottom-1 -right-1 rounded-full border-2 border-background"
                                  />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{holding.token.symbol}</span>
                                  {holding.token.audit && (
                                    <Link
                                      href={`/tokens/${holding.token.chainId}/${holding.token.address}/audit`}
                                    >
                                      <Badge
                                        variant="secondary"
                                        className={cn(
                                          'text-xs cursor-pointer',
                                          riskConfig?.bg,
                                          riskConfig?.color
                                        )}
                                      >
                                        <RiskIcon className="h-3 w-3" />
                                      </Badge>
                                    </Link>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {holding.token.name}
                                </p>
                              </div>
                            </div>
                          </TableCell>

                          {/* Price */}
                          <TableCell className="text-right">
                            <span className="font-medium">
                              ${formatNumber(parseFloat(holding.price))}
                            </span>
                          </TableCell>

                          {/* 24h Change */}
                          <TableCell className="text-right">
                            <span
                              className={cn(
                                'font-medium',
                                isChangePositive ? 'text-green-500' : 'text-red-500'
                              )}
                            >
                              {isChangePositive ? '+' : ''}
                              {holding.priceChange24h.toFixed(2)}%
                            </span>
                          </TableCell>

                          {/* Balance */}
                          <TableCell className="text-right">
                            <span>
                              {showValues
                                ? formatNumber(parseFloat(holding.balance))
                                : '••••••'}
                            </span>
                          </TableCell>

                          {/* Value */}
                          <TableCell className="text-right">
                            <span className="font-medium">
                              {showValues
                                ? formatCurrency(parseFloat(holding.balanceUsd))
                                : '••••••'}
                            </span>
                          </TableCell>

                          {/* P&L */}
                          <TableCell className="text-right">
                            <div>
                              <span
                                className={cn(
                                  'font-medium',
                                  isPnlPositive ? 'text-green-500' : 'text-red-500'
                                )}
                              >
                                {showValues
                                  ? (isPnlPositive ? '+' : '') +
                                    formatCurrency(parseFloat(holding.unrealizedPnl))
                                  : '••••••'}
                              </span>
                              <p
                                className={cn(
                                  'text-xs',
                                  isPnlPositive ? 'text-green-500' : 'text-red-500'
                                )}
                              >
                                {isPnlPositive ? '+' : ''}
                                {holding.unrealizedPnlPercent.toFixed(2)}%
                              </p>
                            </div>
                          </TableCell>

                          {/* Actions */}
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/swap?inputToken=${holding.token.address}&inputChainId=${holding.token.chainId}`}
                                  >
                                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                                    Swap
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/tokens/${holding.token.chainId}/${holding.token.address}/audit`}
                                  >
                                    <Shield className="h-4 w-4 mr-2" />
                                    View Audit
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/alerts?token=${holding.token.address}`}>
                                    <Bell className="h-4 w-4 mr-2" />
                                    Set Alert
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleCopyAddress(holding.token.address)}
                                >
                                  {copiedAddress === holding.token.address ? (
                                    <Check className="h-4 w-4 mr-2 text-green-500" />
                                  ) : (
                                    <Copy className="h-4 w-4 mr-2" />
                                  )}
                                  Copy Address
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <a
                                    href={`${EXPLORER_URLS[holding.token.chainId]}/token/${holding.token.address}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    View on Explorer
                                  </a>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-0">
          <Card>
            <CardContent className="p-0">
              {isLoadingTransactions ? (
                <div className="p-6 space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-48 mb-2" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
              ) : !transactionsData?.transactions?.length ? (
                <div className="p-12 text-center">
                  <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Transactions Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Your transaction history will appear here
                  </p>
                  <Button asChild>
                    <Link href="/swap">Make Your First Swap</Link>
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="text-right">Time</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactionsData.transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                'w-10 h-10 rounded-full flex items-center justify-center',
                                tx.type === 'swap' && 'bg-blue-500/10',
                                tx.type === 'send' && 'bg-red-500/10',
                                tx.type === 'receive' && 'bg-green-500/10',
                                tx.type === 'bridge' && 'bg-purple-500/10'
                              )}
                            >
                              <ArrowRightLeft
                                className={cn(
                                  'h-5 w-5',
                                  tx.type === 'swap' && 'text-blue-500',
                                  tx.type === 'send' && 'text-red-500',
                                  tx.type === 'receive' && 'text-green-500',
                                  tx.type === 'bridge' && 'text-purple-500'
                                )}
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium capitalize">{tx.type}</span>
                                {tx.fromToken.logoURI && (
                                  <Image
                                    src={tx.fromToken.logoURI}
                                    alt=""
                                    width={16}
                                    height={16}
                                    className="rounded-full"
                                  />
                                )}
                                <span>{tx.fromToken.amount} {tx.fromToken.symbol}</span>
                                {tx.toToken && (
                                  <>
                                    <span className="text-muted-foreground">→</span>
                                    {tx.toToken.logoURI && (
                                      <Image
                                        src={tx.toToken.logoURI}
                                        alt=""
                                        width={16}
                                        height={16}
                                        className="rounded-full"
                                      />
                                    )}
                                    <span>{tx.toToken.amount} {tx.toToken.symbol}</span>
                                  </>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {shortenAddress(tx.txHash)}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              tx.status === 'completed'
                                ? 'default'
                                : tx.status === 'pending'
                                ? 'secondary'
                                : 'destructive'
                            }
                          >
                            {tx.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {showValues ? formatCurrency(parseFloat(tx.valueUsd)) : '••••••'}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {new Date(tx.timestamp).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" asChild>
                            <a
                              href={`${EXPLORER_URLS[tx.chainId]}/tx/${tx.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
