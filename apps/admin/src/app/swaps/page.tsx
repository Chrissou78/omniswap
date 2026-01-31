// apps/admin/src/app/swaps/page.tsx
'use client';

import React, { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  ArrowRightLeft,
  Search,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Activity,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { cn, formatNumber, formatCurrency, formatDate, shortenAddress } from '@/lib/utils';
import Image from 'next/image';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

// Types
interface Swap {
  id: string;
  userId: string;
  userEmail?: string;
  tenantId?: string;
  tenant?: { name: string };
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  fromChainId: string;
  toChainId: string;
  fromToken: {
    address: string;
    symbol: string;
    name: string;
    logoURI?: string;
  };
  toToken: {
    address: string;
    symbol: string;
    name: string;
    logoURI?: string;
  };
  inputAmount: string;
  outputAmount: string;
  inputAmountUsd: string;
  outputAmountUsd: string;
  priceImpact: number;
  slippage: number;
  platformFeeUsd: string;
  gasCostUsd: string;
  route: {
    type: 'single' | 'multi' | 'cross-chain' | 'cex';
    steps: any[];
    protocols: string[];
  };
  txHashes: string[];
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

interface SwapStats {
  totalSwaps24h: number;
  totalVolume24h: string;
  totalRevenue24h: string;
  averageSwapSize: string;
  successRate: number;
  pendingSwaps: number;
  failedSwaps24h: number;
}

interface VolumeDataPoint {
  timestamp: string;
  volume: number;
  count: number;
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ElementType }> = {
  pending: { color: 'text-yellow-500', icon: Clock },
  processing: { color: 'text-blue-500', icon: RefreshCw },
  completed: { color: 'text-green-500', icon: CheckCircle2 },
  failed: { color: 'text-red-500', icon: XCircle },
  refunded: { color: 'text-orange-500', icon: AlertTriangle },
};

const CHAIN_INFO: Record<string, { name: string; icon: string }> = {
  '1': { name: 'Ethereum', icon: '/chains/ethereum.svg' },
  '56': { name: 'BNB Chain', icon: '/chains/bsc.svg' },
  '137': { name: 'Polygon', icon: '/chains/polygon.svg' },
  '42161': { name: 'Arbitrum', icon: '/chains/arbitrum.svg' },
  '10': { name: 'Optimism', icon: '/chains/optimism.svg' },
  '8453': { name: 'Base', icon: '/chains/base.svg' },
  '43114': { name: 'Avalanche', icon: '/chains/avalanche.svg' },
  'solana-mainnet': { name: 'Solana', icon: '/chains/solana.svg' },
  'sui-mainnet': { name: 'Sui', icon: '/chains/sui.svg' },
};

const EXPLORER_URLS: Record<string, string> = {
  '1': 'https://etherscan.io/tx/',
  '56': 'https://bscscan.com/tx/',
  '137': 'https://polygonscan.com/tx/',
  '42161': 'https://arbiscan.io/tx/',
  '10': 'https://optimistic.etherscan.io/tx/',
  '8453': 'https://basescan.org/tx/',
  '43114': 'https://snowtrace.io/tx/',
  'solana-mainnet': 'https://solscan.io/tx/',
  'sui-mainnet': 'https://suiscan.xyz/tx/',
};

export default function SwapsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [chainFilter, setChainFilter] = useState<string>('all');
  const [timeframe, setTimeframe] = useState<string>('24h');
  const [page, setPage] = useState(1);
  const [selectedSwap, setSelectedSwap] = useState<Swap | null>(null);
  const pageSize = 20;

  // Fetch swap stats
  const { data: statsData, isLoading: isLoadingStats } = useQuery({
    queryKey: ['admin', 'swaps', 'stats', timeframe],
    queryFn: async () => {
      const res = await fetch(`/api/admin/swaps/stats?timeframe=${timeframe}`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json() as Promise<{ stats: SwapStats }>;
    },
  });

  // Fetch volume chart data
  const { data: volumeData, isLoading: isLoadingVolume } = useQuery({
    queryKey: ['admin', 'swaps', 'volume', timeframe],
    queryFn: async () => {
      const res = await fetch(`/api/admin/swaps/volume?timeframe=${timeframe}`);
      if (!res.ok) throw new Error('Failed to fetch volume');
      return res.json() as Promise<{ data: VolumeDataPoint[] }>;
    },
  });

  // Fetch swaps list
  const { data: swapsData, isLoading: isLoadingSwaps, refetch } = useQuery({
    queryKey: ['admin', 'swaps', 'list', statusFilter, chainFilter, searchQuery, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String((page - 1) * pageSize),
      });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (chainFilter !== 'all') params.set('chainId', chainFilter);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/admin/swaps?${params}`);
      if (!res.ok) throw new Error('Failed to fetch swaps');
      return res.json() as Promise<{ swaps: Swap[]; total: number }>;
    },
  });

  const stats = statsData?.stats;
  const swaps = swapsData?.swaps || [];
  const totalPages = Math.ceil((swapsData?.total || 0) / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Swaps</h1>
          <p className="text-muted-foreground">
            Monitor and manage swap transactions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <ArrowRightLeft className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Swaps</p>
                <p className="text-xl font-bold">
                  {isLoadingStats ? <Skeleton className="h-6 w-16" /> : formatNumber(stats?.totalSwaps24h || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Volume</p>
                <p className="text-xl font-bold">
                  {isLoadingStats ? <Skeleton className="h-6 w-20" /> : formatCurrency(parseFloat(stats?.totalVolume24h || '0'))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="text-xl font-bold">
                  {isLoadingStats ? <Skeleton className="h-6 w-16" /> : formatCurrency(parseFloat(stats?.totalRevenue24h || '0'))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Activity className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Size</p>
                <p className="text-xl font-bold">
                  {isLoadingStats ? <Skeleton className="h-6 w-16" /> : formatCurrency(parseFloat(stats?.averageSwapSize || '0'))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-xl font-bold">
                  {isLoadingStats ? <Skeleton className="h-6 w-12" /> : `${stats?.successRate.toFixed(1)}%`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-xl font-bold">
                  {isLoadingStats ? <Skeleton className="h-6 w-8" /> : stats?.pendingSwaps || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-xl font-bold">
                  {isLoadingStats ? <Skeleton className="h-6 w-8" /> : stats?.failedSwaps24h || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Volume Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Volume & Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingVolume ? (
            <Skeleton className="h-[250px] w-full" />
          ) : (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volumeData?.data || []}>
                  <defs>
                    <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
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
                        ? date.toLocaleTimeString([], { hour: '2-digit' })
                        : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                    }}
                    className="text-xs"
                  />
                  <YAxis
                    yAxisId="left"
                    tickFormatter={(val) => `$${formatNumber(val)}`}
                    className="text-xs"
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={(val) => formatNumber(val)}
                    className="text-xs"
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === 'volume' ? formatCurrency(value) : formatNumber(value),
                      name === 'volume' ? 'Volume' : 'Transactions',
                    ]}
                    labelFormatter={(label) => new Date(label).toLocaleString()}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="volume"
                    stroke="#3B82F6"
                    fillOpacity={1}
                    fill="url(#colorVolume)"
                  />
                  <Bar yAxisId="right" dataKey="count" fill="#10B981" opacity={0.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID, user, token, or tx hash..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
        <Select value={chainFilter} onValueChange={(v) => { setChainFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Chain" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Chains</SelectItem>
            {Object.entries(CHAIN_INFO).map(([id, info]) => (
              <SelectItem key={id} value={id}>
                {info.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Swaps Table */}
      <Card>
        <CardContent className="p-0">
          {isLoadingSwaps ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-48 mb-2" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : swaps.length === 0 ? (
            <div className="p-12 text-center">
              <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No Swaps Found</h3>
              <p className="text-muted-foreground">
                {searchQuery || statusFilter !== 'all' || chainFilter !== 'all'
                  ? 'No swaps match your filters'
                  : 'Swaps will appear here once users start trading'}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Swap</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {swaps.map((swap) => {
                    const statusConfig = STATUS_CONFIG[swap.status];
                    const StatusIcon = statusConfig?.icon || Clock;
                    const isCrossChain = swap.fromChainId !== swap.toChainId;

                    return (
                      <TableRow key={swap.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {swap.id.slice(0, 8)}
                            </code>
                            {isCrossChain && (
                              <Badge variant="outline" className="text-xs">
                                Cross-chain
                              </Badge>
                            )}
                            {swap.route.type === 'cex' && (
                              <Badge variant="secondary" className="text-xs">
                                CEX
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{swap.userEmail || shortenAddress(swap.userId)}</p>
                            {swap.tenant && (
                              <Badge variant="outline" className="text-xs">
                                {swap.tenant.name}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              {swap.fromToken.logoURI && (
                                <Image
                                  src={swap.fromToken.logoURI}
                                  alt=""
                                  width={24}
                                  height={24}
                                  className="rounded-full"
                                />
                              )}
                              {CHAIN_INFO[swap.fromChainId]?.icon && (
                                <Image
                                  src={CHAIN_INFO[swap.fromChainId].icon}
                                  alt=""
                                  width={12}
                                  height={12}
                                  className="absolute -bottom-1 -right-1 rounded-full border border-background"
                                />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {formatNumber(parseFloat(swap.inputAmount))} {swap.fromToken.symbol}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(parseFloat(swap.inputAmountUsd))}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              {swap.toToken.logoURI && (
                                <Image
                                  src={swap.toToken.logoURI}
                                  alt=""
                                  width={24}
                                  height={24}
                                  className="rounded-full"
                                />
                              )}
                              {CHAIN_INFO[swap.toChainId]?.icon && (
                                <Image
                                  src={CHAIN_INFO[swap.toChainId].icon}
                                  alt=""
                                  width={12}
                                  height={12}
                                  className="absolute -bottom-1 -right-1 rounded-full border border-background"
                                />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {formatNumber(parseFloat(swap.outputAmount))} {swap.toToken.symbol}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(parseFloat(swap.outputAmountUsd))}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
                            {formatCurrency(parseFloat(swap.inputAmountUsd))}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-green-500">
                            {formatCurrency(parseFloat(swap.platformFeeUsd))}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              swap.status === 'completed'
                                ? 'default'
                                : swap.status === 'failed'
                                ? 'destructive'
                                : 'secondary'
                            }
                            className="gap-1"
                          >
                            <StatusIcon className="h-3 w-3" />
                            {swap.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(swap.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedSwap(swap)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, swapsData?.total || 0)} of {swapsData?.total || 0} swaps
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Swap Detail Sheet */}
      <Sheet open={!!selectedSwap} onOpenChange={() => setSelectedSwap(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedSwap && (
            <>
              <SheetHeader>
                <SheetTitle>Swap Details</SheetTitle>
                <SheetDescription>
                  ID: {selectedSwap.id}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                {/* Status */}
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <span className="text-muted-foreground">Status</span>
                  <Badge
                    variant={
                      selectedSwap.status === 'completed'
                        ? 'default'
                        : selectedSwap.status === 'failed'
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {selectedSwap.status}
                  </Badge>
                </div>

                {/* From / To */}
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">From</p>
                    <div className="flex items-center gap-3">
                      {selectedSwap.fromToken.logoURI && (
                        <Image
                          src={selectedSwap.fromToken.logoURI}
                          alt=""
                          width={40}
                          height={40}
                          className="rounded-full"
                        />
                      )}
                      <div>
                        <p className="font-medium">
                          {formatNumber(parseFloat(selectedSwap.inputAmount))} {selectedSwap.fromToken.symbol}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(parseFloat(selectedSwap.inputAmountUsd))} on {CHAIN_INFO[selectedSwap.fromChainId]?.name}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
                  </div>

                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">To</p>
                    <div className="flex items-center gap-3">
                      {selectedSwap.toToken.logoURI && (
                        <Image
                          src={selectedSwap.toToken.logoURI}
                          alt=""
                          width={40}
                          height={40}
                          className="rounded-full"
                        />
                      )}
                      <div>
                        <p className="font-medium">
                          {formatNumber(parseFloat(selectedSwap.outputAmount))} {selectedSwap.toToken.symbol}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(parseFloat(selectedSwap.outputAmountUsd))} on {CHAIN_INFO[selectedSwap.toChainId]?.name}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-3">
                  <h4 className="font-medium">Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Price Impact</span>
                      <span className={selectedSwap.priceImpact > 3 ? 'text-red-500' : ''}>
                        {selectedSwap.priceImpact.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Slippage</span>
                      <span>{selectedSwap.slippage}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Platform Fee</span>
                      <span className="text-green-500">
                        {formatCurrency(parseFloat(selectedSwap.platformFeeUsd))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gas Cost</span>
                      <span>{formatCurrency(parseFloat(selectedSwap.gasCostUsd))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Route Type</span>
                      <Badge variant="outline">{selectedSwap.route.type}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Protocols</span>
                      <span>{selectedSwap.route.protocols.join(', ')}</span>
                    </div>
                  </div>
                </div>

                {/* User Info */}
                <div className="space-y-3">
                  <h4 className="font-medium">User</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">User ID</span>
                      <code className="text-xs">{shortenAddress(selectedSwap.userId)}</code>
                    </div>
                    {selectedSwap.userEmail && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email</span>
                        <span>{selectedSwap.userEmail}</span>
                      </div>
                    )}
                    {selectedSwap.tenant && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tenant</span>
                        <span>{selectedSwap.tenant.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Transactions */}
                {selectedSwap.txHashes.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium">Transactions</h4>
                    <div className="space-y-2">
                      {selectedSwap.txHashes.map((hash, i) => (
                        <div key={hash} className="flex items-center justify-between p-2 bg-muted rounded">
                          <code className="text-xs">{shortenAddress(hash)}</code>
                          <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                            <a
                              href={`${EXPLORER_URLS[selectedSwap.fromChainId]}${hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {selectedSwap.errorMessage && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-sm font-medium text-red-500 mb-1">Error</p>
                    <p className="text-sm">{selectedSwap.errorMessage}</p>
                  </div>
                )}

                {/* Timestamps */}
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Created</span>
                    <span>{new Date(selectedSwap.createdAt).toLocaleString()}</span>
                  </div>
                  {selectedSwap.completedAt && (
                    <div className="flex justify-between">
                      <span>Completed</span>
                      <span>{new Date(selectedSwap.completedAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
