// apps/web/src/app/limit-orders/page.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ArrowRightLeft,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  Plus,
  MoreHorizontal,
  Trash2,
  Edit,
  Pause,
  Play,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  ChevronDown,
  ArrowUpDown,
  Calendar,
  Percent,
  DollarSign,
  Zap,
} from 'lucide-react';
import { cn, formatNumber, formatCurrency, formatDate, shortenAddress } from '@/lib/utils';
import Image from 'next/image';
import { useWallet } from '@/hooks/useWallet';
import { useTokenStore } from '@/stores/tokenStore';
import { TokenSelector } from '@/components/swap/TokenSelector';
import { ChainSelector } from '@/components/wallet/ChainSelector';
import { toast } from 'sonner';

// Types
interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId?: number | string;
  logoURI?: string;
  logoUrl?: string;
  price?: number;
  priceUsd?: number;
  verified?: boolean;
}

interface LimitOrder {
  id: string;
  type: 'buy' | 'sell';
  status: 'active' | 'filled' | 'cancelled' | 'expired' | 'partially_filled';
  fromChainId: string;
  toChainId: string;
  fromToken: Token;
  toToken: Token;
  inputAmount: string;
  targetPrice: string;
  currentPrice: string;
  minOutputAmount: string;
  filledAmount: string;
  filledPercent: number;
  slippage: number;
  expiresAt: string;
  createdAt: string;
  executedAt?: string;
  executedTxHash?: string;
  outputAmount?: string;
}

interface LimitOrderStats {
  totalOrders: number;
  activeOrders: number;
  filledOrders: number;
  totalVolume: string;
  successRate: number;
}

interface CreateLimitOrderInput {
  type: 'buy' | 'sell';
  fromChainId: string;
  toChainId: string;
  fromTokenAddress: string;
  toTokenAddress: string;
  inputAmount: string;
  targetPrice: string;
  slippage: number;
  expiresIn: number; // hours
}

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'text-blue-500', bg: 'bg-blue-500/10', icon: Clock },
  filled: { label: 'Filled', color: 'text-green-500', bg: 'bg-green-500/10', icon: CheckCircle2 },
  partially_filled: { label: 'Partial', color: 'text-yellow-500', bg: 'bg-yellow-500/10', icon: Zap },
  cancelled: { label: 'Cancelled', color: 'text-gray-500', bg: 'bg-gray-500/10', icon: XCircle },
  expired: { label: 'Expired', color: 'text-red-500', bg: 'bg-red-500/10', icon: AlertTriangle },
};

const CHAIN_INFO: Record<string, { name: string; icon: string }> = {
  '1': { name: 'Ethereum', icon: '/chains/ethereum.svg' },
  '56': { name: 'BNB Chain', icon: '/chains/bsc.svg' },
  '137': { name: 'Polygon', icon: '/chains/polygon.svg' },
  '42161': { name: 'Arbitrum', icon: '/chains/arbitrum.svg' },
  '10': { name: 'Optimism', icon: '/chains/optimism.svg' },
  '8453': { name: 'Base', icon: '/chains/base.svg' },
  'solana-mainnet': { name: 'Solana', icon: '/chains/solana.svg' },
  'sui-mainnet': { name: 'Sui', icon: '/chains/sui.svg' },
};

const EXPIRY_OPTIONS = [
  { value: 1, label: '1 Hour' },
  { value: 6, label: '6 Hours' },
  { value: 24, label: '24 Hours' },
  { value: 72, label: '3 Days' },
  { value: 168, label: '7 Days' },
  { value: 720, label: '30 Days' },
];

export default function LimitOrdersPage() {
  const queryClient = useQueryClient();
  const { isConnected, address } = useWallet();
  const { getTokensByChain } = useTokenStore();
  const [activeTab, setActiveTab] = useState<'create' | 'active' | 'history'>('create');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<LimitOrder | null>(null);

  // Create order form state
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [fromChainId, setFromChainId] = useState('1');
  const [toChainId, setToChainId] = useState('1');
  const [inputAmount, setInputAmount] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  const [expiresIn, setExpiresIn] = useState(24);
  const [showFromTokenSelector, setShowFromTokenSelector] = useState(false);
  const [showToTokenSelector, setShowToTokenSelector] = useState(false);

  // Fetch current price
  const { data: priceData } = useQuery({
    queryKey: ['token-price', fromToken?.address, toToken?.address, fromChainId],
    queryFn: async () => {
      if (!fromToken || !toToken) return null;
      const res = await fetch(
        `/api/v1/tokens/price?fromToken=${fromToken.address}&toToken=${toToken.address}&chainId=${fromChainId}`
      );
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!fromToken && !!toToken,
    refetchInterval: 10000,
  });

  // Fetch orders
  const { data: ordersData, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['limit-orders', activeTab],
    queryFn: async () => {
      const status = activeTab === 'active' ? 'active' : activeTab === 'history' ? 'all' : undefined;
      const res = await fetch(`/api/v1/limit-orders${status ? `?status=${status}` : ''}`);
      if (!res.ok) throw new Error('Failed to fetch orders');
      return res.json() as Promise<{ orders: LimitOrder[]; stats: LimitOrderStats }>;
    },
    enabled: isConnected && activeTab !== 'create',
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (data: CreateLimitOrderInput) => {
      const res = await fetch('/api/v1/limit-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create order');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['limit-orders'] });
      toast.success('Limit order created successfully');
      resetForm();
      setActiveTab('active');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create order');
    },
  });

  // Cancel order mutation
  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/v1/limit-orders/${orderId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to cancel order');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['limit-orders'] });
      toast.success('Order cancelled');
      setCancelDialogOpen(false);
      setSelectedOrder(null);
    },
    onError: () => {
      toast.error('Failed to cancel order');
    },
  });

  const currentPrice = priceData?.price;
  const priceChange = currentPrice && targetPrice
    ? ((parseFloat(targetPrice) - currentPrice) / currentPrice) * 100
    : 0;

  const estimatedOutput = useMemo(() => {
    if (!inputAmount || !targetPrice) return '0';
    return (parseFloat(inputAmount) * parseFloat(targetPrice)).toFixed(6);
  }, [inputAmount, targetPrice]);

  const resetForm = () => {
    setFromToken(null);
    setToToken(null);
    setInputAmount('');
    setTargetPrice('');
  };

  const handleCreateOrder = () => {
    if (!fromToken || !toToken || !inputAmount || !targetPrice) {
      toast.error('Please fill all required fields');
      return;
    }

    createOrderMutation.mutate({
      type: orderType,
      fromChainId,
      toChainId,
      fromTokenAddress: fromToken.address,
      toTokenAddress: toToken.address,
      inputAmount,
      targetPrice,
      slippage,
      expiresIn,
    });
  };

  const handleSwapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    if (currentPrice) {
      setTargetPrice((1 / currentPrice).toFixed(6));
    }
  };

  const stats = ordersData?.stats;
  const orders = ordersData?.orders || [];

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Limit Orders</h1>
          <p className="text-muted-foreground">
            Set your price and let the order execute automatically
          </p>
        </div>
        {isConnected && stats && (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Active Orders</p>
              <p className="text-xl font-bold">{stats.activeOrders}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Success Rate</p>
              <p className="text-xl font-bold text-green-500">{stats.successRate.toFixed(1)}%</p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="create" className="gap-2">
            <Plus className="h-4 w-4" />
            Create Order
          </TabsTrigger>
          <TabsTrigger value="active" className="gap-2">
            <Clock className="h-4 w-4" />
            Active Orders
            {stats?.activeOrders ? (
              <Badge variant="secondary" className="ml-1">
                {stats.activeOrders}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <ArrowUpDown className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Create Order Tab */}
        <TabsContent value="create" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Order Form */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Create Limit Order</CardTitle>
                <CardDescription>
                  Your order will execute when the market price reaches your target
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Order Type */}
                <div className="flex gap-2">
                  <Button
                    variant={orderType === 'buy' ? 'default' : 'outline'}
                    className={cn(
                      'flex-1',
                      orderType === 'buy' && 'bg-green-500 hover:bg-green-600'
                    )}
                    onClick={() => setOrderType('buy')}
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Buy
                  </Button>
                  <Button
                    variant={orderType === 'sell' ? 'default' : 'outline'}
                    className={cn(
                      'flex-1',
                      orderType === 'sell' && 'bg-red-500 hover:bg-red-600'
                    )}
                    onClick={() => setOrderType('sell')}
                  >
                    <TrendingDown className="h-4 w-4 mr-2" />
                    Sell
                  </Button>
                </div>

                {/* Token Selection */}
                <div className="space-y-4">
                  {/* From Token */}
                  <div className="space-y-2">
                    <Label>You Pay</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Input
                          type="number"
                          placeholder="0.0"
                          value={inputAmount}
                          onChange={(e) => setInputAmount(e.target.value)}
                          className="text-lg"
                        />
                      </div>
                      <Button
                        variant="outline"
                        className="min-w-[140px] justify-between"
                        onClick={() => setShowFromTokenSelector(true)}
                      >
                        {fromToken ? (
                          <div className="flex items-center gap-2">
                            {fromToken.logoURI && (
                              <Image
                                src={fromToken.logoURI}
                                alt=""
                                width={20}
                                height={20}
                                className="rounded-full"
                              />
                            )}
                            {fromToken.symbol}
                          </div>
                        ) : (
                          'Select Token'
                        )}
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Swap Button */}
                  <div className="flex justify-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full"
                      onClick={handleSwapTokens}
                    >
                      <ArrowRightLeft className="h-4 w-4 rotate-90" />
                    </Button>
                  </div>

                  {/* To Token */}
                  <div className="space-y-2">
                    <Label>You Receive (estimated)</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Input
                          type="number"
                          placeholder="0.0"
                          value={estimatedOutput}
                          readOnly
                          className="text-lg bg-muted"
                        />
                      </div>
                      <Button
                        variant="outline"
                        className="min-w-[140px] justify-between"
                        onClick={() => setShowToTokenSelector(true)}
                      >
                        {toToken ? (
                          <div className="flex items-center gap-2">
                            {toToken.logoURI && (
                              <Image
                                src={toToken.logoURI}
                                alt=""
                                width={20}
                                height={20}
                                className="rounded-full"
                              />
                            )}
                            {toToken.symbol}
                          </div>
                        ) : (
                          'Select Token'
                        )}
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Target Price */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Target Price</Label>
                    {currentPrice && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Current:</span>
                        <span className="font-medium">{formatNumber(currentPrice)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => setTargetPrice(currentPrice.toString())}
                        >
                          Use
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="0.0"
                      value={targetPrice}
                      onChange={(e) => setTargetPrice(e.target.value)}
                      className="pr-20"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {fromToken?.symbol}/{toToken?.symbol}
                    </div>
                  </div>
                  {targetPrice && currentPrice && (
                    <p className={cn(
                      'text-sm',
                      priceChange > 0 ? 'text-green-500' : priceChange < 0 ? 'text-red-500' : ''
                    )}>
                      {priceChange > 0 ? '+' : ''}{priceChange.toFixed(2)}% from current price
                    </p>
                  )}
                </div>

                {/* Settings */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Slippage Tolerance</Label>
                    <Select
                      value={slippage.toString()}
                      onValueChange={(v) => setSlippage(parseFloat(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0.1">0.1%</SelectItem>
                        <SelectItem value="0.5">0.5%</SelectItem>
                        <SelectItem value="1">1%</SelectItem>
                        <SelectItem value="2">2%</SelectItem>
                        <SelectItem value="3">3%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Order Expiry</Label>
                    <Select
                      value={expiresIn.toString()}
                      onValueChange={(v) => setExpiresIn(parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPIRY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value.toString()}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Create Button */}
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleCreateOrder}
                  disabled={
                    !isConnected ||
                    !fromToken ||
                    !toToken ||
                    !inputAmount ||
                    !targetPrice ||
                    createOrderMutation.isPending
                  }
                >
                  {!isConnected ? (
                    'Connect Wallet'
                  ) : createOrderMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Creating Order...
                    </>
                  ) : (
                    <>
                      <Target className="h-4 w-4 mr-2" />
                      Create {orderType === 'buy' ? 'Buy' : 'Sell'} Order
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {fromToken && toToken && inputAmount && targetPrice ? (
                  <>
                    <div className="p-4 bg-muted rounded-lg space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Order Type</span>
                        <Badge variant={orderType === 'buy' ? 'default' : 'destructive'}>
                          {orderType === 'buy' ? 'Buy' : 'Sell'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">You Pay</span>
                        <span className="font-medium">
                          {formatNumber(parseFloat(inputAmount))} {fromToken.symbol}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">You Receive</span>
                        <span className="font-medium">
                          ~{formatNumber(parseFloat(estimatedOutput))} {toToken.symbol}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Target Price</span>
                        <span className="font-medium">{targetPrice}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Expires</span>
                        <span className="font-medium">
                          {EXPIRY_OPTIONS.find((o) => o.value === expiresIn)?.label}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-yellow-500 mt-0.5" />
                        <p className="text-sm text-yellow-500">
                          Your order will be executed when the market price reaches {targetPrice} {fromToken.symbol}/{toToken.symbol}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select tokens and enter amounts to see order summary</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Active Orders Tab */}
        <TabsContent value="active" className="mt-6">
          <Card>
            <CardContent className="p-0">
              {!isConnected ? (
                <div className="p-12 text-center">
                  <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">Connect Wallet</h3>
                  <p className="text-muted-foreground">
                    Connect your wallet to view your orders
                  </p>
                </div>
              ) : isLoadingOrders ? (
                <div className="p-6 space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : orders.filter((o) => o.status === 'active' || o.status === 'partially_filled').length === 0 ? (
                <div className="p-12 text-center">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Active Orders</h3>
                  <p className="text-muted-foreground mb-4">
                    Create a limit order to get started
                  </p>
                  <Button onClick={() => setActiveTab('create')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Order
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pair</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Target Price</TableHead>
                      <TableHead>Current Price</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders
                      .filter((o) => o.status === 'active' || o.status === 'partially_filled')
                      .map((order) => (
                        <OrderRow
                          key={order.id}
                          order={order}
                          onCancel={() => {
                            setSelectedOrder(order);
                            setCancelDialogOpen(true);
                          }}
                        />
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-6">
          <Card>
            <CardContent className="p-0">
              {!isConnected ? (
                <div className="p-12 text-center">
                  <ArrowUpDown className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">Connect Wallet</h3>
                  <p className="text-muted-foreground">
                    Connect your wallet to view order history
                  </p>
                </div>
              ) : isLoadingOrders ? (
                <div className="p-6 space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <div className="p-12 text-center">
                  <ArrowUpDown className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Order History</h3>
                  <p className="text-muted-foreground">
                    Your completed and cancelled orders will appear here
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pair</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Target Price</TableHead>
                      <TableHead>Filled</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <OrderRow key={order.id} order={order} showHistory />
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Token Selectors */}
      {showFromTokenSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowFromTokenSelector(false)}>
          <div className="bg-background rounded-lg p-4 max-w-md w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <TokenSelector
              tokens={getTokensByChain(String(fromChainId))}
              onSelect={(token) => {
                setFromToken(token);
                setShowFromTokenSelector(false);
              }}
              chainId={fromChainId}
              excludeAddresses={toToken ? [toToken.address] : []}
            />
          </div>
        </div>
      )}

      {showToTokenSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowToTokenSelector(false)}>
          <div className="bg-background rounded-lg p-4 max-w-md w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <TokenSelector
              tokens={getTokensByChain(String(toChainId))}
              onSelect={(token) => {
                setToToken(token);
                setShowToTokenSelector(false);
              }}
              chainId={toChainId}
              excludeAddresses={fromToken ? [fromToken.address] : []}
            />
          </div>
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this limit order?
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="py-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pair</span>
                  <span className="font-medium">
                    {selectedOrder.fromToken.symbol}/{selectedOrder.toToken.symbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">
                    {formatNumber(parseFloat(selectedOrder.inputAmount))} {selectedOrder.fromToken.symbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target Price</span>
                  <span className="font-medium">{selectedOrder.targetPrice}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Order
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedOrder && cancelOrderMutation.mutate(selectedOrder.id)}
              disabled={cancelOrderMutation.isPending}
            >
              {cancelOrderMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Cancel Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Order Row Component
function OrderRow({
  order,
  onCancel,
  showHistory,
}: {
  order: LimitOrder;
  onCancel?: () => void;
  showHistory?: boolean;
}) {
  const statusConfig = STATUS_CONFIG[order.status];
  const StatusIcon = statusConfig.icon;
  const priceDiff = ((parseFloat(order.currentPrice) - parseFloat(order.targetPrice)) / parseFloat(order.targetPrice)) * 100;

  return (
    <TableRow>
      {/* Pair */}
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {order.fromToken.logoURI && (
              <Image
                src={order.fromToken.logoURI}
                alt=""
                width={24}
                height={24}
                className="rounded-full border-2 border-background"
              />
            )}
            {order.toToken.logoURI && (
              <Image
                src={order.toToken.logoURI}
                alt=""
                width={24}
                height={24}
                className="rounded-full border-2 border-background"
              />
            )}
          </div>
          <span className="font-medium">
            {order.fromToken.symbol}/{order.toToken.symbol}
          </span>
        </div>
      </TableCell>

      {/* Type */}
      <TableCell>
        <Badge variant={order.type === 'buy' ? 'default' : 'destructive'}>
          {order.type === 'buy' ? 'Buy' : 'Sell'}
        </Badge>
      </TableCell>

      {/* Amount */}
      <TableCell>
        <div>
          <p className="font-medium">
            {formatNumber(parseFloat(order.inputAmount))} {order.fromToken.symbol}
          </p>
          <p className="text-sm text-muted-foreground">
            → {formatNumber(parseFloat(order.minOutputAmount))} {order.toToken.symbol}
          </p>
        </div>
      </TableCell>

      {/* Target Price */}
      <TableCell>
        <span className="font-mono">{order.targetPrice}</span>
      </TableCell>

      {/* Current Price / Filled */}
      {!showHistory ? (
        <TableCell>
          <div>
            <span className="font-mono">{order.currentPrice}</span>
            <p className={cn(
              'text-xs',
              priceDiff > 0 ? 'text-green-500' : priceDiff < 0 ? 'text-red-500' : ''
            )}>
              {priceDiff > 0 ? '+' : ''}{priceDiff.toFixed(2)}%
            </p>
          </div>
        </TableCell>
      ) : (
        <TableCell>
          {order.outputAmount ? (
            <span className="font-medium">
              {formatNumber(parseFloat(order.outputAmount))} {order.toToken.symbol}
            </span>
          ) : (
            '-'
          )}
        </TableCell>
      )}

      {/* Progress / Status */}
      {!showHistory ? (
        <TableCell>
          <div className="w-full max-w-[100px]">
            <div className="flex justify-between text-xs mb-1">
              <span>{order.filledPercent.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${order.filledPercent}%` }}
              />
            </div>
          </div>
        </TableCell>
      ) : (
        <TableCell>
          <Badge variant="secondary" className={cn(statusConfig.bg, statusConfig.color)}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusConfig.label}
          </Badge>
        </TableCell>
      )}

      {/* Expires / Date */}
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {showHistory
            ? formatDate(order.executedAt || order.createdAt)
            : formatDate(order.expiresAt)}
        </span>
      </TableCell>

      {/* Actions */}
      <TableCell>
        {!showHistory && onCancel ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onCancel} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Cancel Order
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : order.executedTxHash ? (
          <Button variant="ghost" size="icon" asChild>
            <a
              href={`https://etherscan.io/tx/${order.executedTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ArrowRightLeft className="h-4 w-4" />
            </a>
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}






