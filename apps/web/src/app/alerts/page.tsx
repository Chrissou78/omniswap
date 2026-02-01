'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  BellRing,
  Plus,
  TrendingUp,
  TrendingDown,
  Percent,
  Mail,
  Smartphone,
  MessageCircle,
  Clock,
  Trash2,
  Edit,
  MoreVertical,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Copy,
  ExternalLink,
  ChevronDown,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Info,
  Zap,
  History,
  Target,
  DollarSign,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useWallet } from '@/hooks/useWallet';
import { TokenSelector } from '@/components/swap/TokenSelector';
import { cn, formatCurrency, formatNumber, formatPercent, truncateAddress } from '@/lib/utils';

// ============================================================================
// Types & Interfaces
// ============================================================================

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  chainId: number | string;
  price?: number;
  priceChange24h?: number;
}

interface PriceAlert {
  id: string;
  userId: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  tokenLogoURI?: string;
  chainId: number | string;
  alertType: 'above' | 'below' | 'percent_change';
  targetPrice?: number;
  targetPercentChange?: number;
  currentPrice: number;
  priceAtCreation: number;
  isEnabled: boolean;
  isRecurring: boolean;
  cooldownMinutes: number;
  lastTriggeredAt?: string;
  triggerCount: number;
  notifyEmail: boolean;
  notifyPush: boolean;
  notifyTelegram: boolean;
  telegramChatId?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

interface AlertHistory {
  id: string;
  alertId: string;
  tokenSymbol: string;
  tokenLogoURI?: string;
  chainId: number | string;
  alertType: 'above' | 'below' | 'percent_change';
  targetPrice?: number;
  targetPercentChange?: number;
  triggeredPrice: number;
  notificationsSent: string[];
  triggeredAt: string;
}

interface AlertStats {
  totalAlerts: number;
  activeAlerts: number;
  triggeredToday: number;
  triggeredTotal: number;
}

interface CreateAlertInput {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  tokenLogoURI?: string;
  chainId: number | string;
  alertType: 'above' | 'below' | 'percent_change';
  targetPrice?: number;
  targetPercentChange?: number;
  isRecurring: boolean;
  cooldownMinutes: number;
  notifyEmail: boolean;
  notifyPush: boolean;
  notifyTelegram: boolean;
  telegramChatId?: string;
  note?: string;
}

// ============================================================================
// Constants
// ============================================================================

const CHAIN_INFO: Record<number | string, { name: string; icon: string; color: string }> = {
  1: { name: 'Ethereum', icon: '/chains/ethereum.svg', color: '#627EEA' },
  56: { name: 'BNB Chain', icon: '/chains/bnb.svg', color: '#F0B90B' },
  137: { name: 'Polygon', icon: '/chains/polygon.svg', color: '#8247E5' },
  42161: { name: 'Arbitrum', icon: '/chains/arbitrum.svg', color: '#28A0F0' },
  10: { name: 'Optimism', icon: '/chains/optimism.svg', color: '#FF0420' },
  8453: { name: 'Base', icon: '/chains/base.svg', color: '#0052FF' },
  43114: { name: 'Avalanche', icon: '/chains/avalanche.svg', color: '#E84142' },
  101: { name: 'Solana', icon: '/chains/solana.svg', color: '#9945FF' },
  784: { name: 'Sui', icon: '/chains/sui.svg', color: '#6FBCF0' },
};

const ALERT_TYPE_OPTIONS = [
  {
    value: 'above',
    label: 'Price Above',
    icon: TrendingUp,
    description: 'Alert when price rises above target',
    color: 'text-green-500',
  },
  {
    value: 'below',
    label: 'Price Below',
    icon: TrendingDown,
    description: 'Alert when price falls below target',
    color: 'text-red-500',
  },
  {
    value: 'percent_change',
    label: 'Percent Change',
    icon: Percent,
    description: 'Alert on 24h percent change',
    color: 'text-blue-500',
  },
] as const;

const COOLDOWN_OPTIONS = [
  { value: 0, label: 'No cooldown' },
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 60, label: '1 hour' },
  { value: 240, label: '4 hours' },
  { value: 1440, label: '24 hours' },
];

const EXPLORER_URLS: Record<number | string, string> = {
  1: 'https://etherscan.io/token/',
  56: 'https://bscscan.com/token/',
  137: 'https://polygonscan.com/token/',
  42161: 'https://arbiscan.io/token/',
  10: 'https://optimistic.etherscan.io/token/',
  8453: 'https://basescan.org/token/',
  43114: 'https://snowtrace.io/token/',
  101: 'https://solscan.io/token/',
  784: 'https://suiscan.xyz/token/',
};

// ============================================================================
// API Functions
// ============================================================================

async function fetchAlerts(): Promise<PriceAlert[]> {
  const response = await fetch('/api/v1/alerts', {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to fetch alerts');
  const data = await response.json();
  return data.alerts;
}

async function fetchAlertStats(): Promise<AlertStats> {
  const response = await fetch('/api/v1/alerts/stats', {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to fetch alert stats');
  return response.json();
}

async function fetchAlertHistory(): Promise<AlertHistory[]> {
  const response = await fetch('/api/v1/alerts/history', {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to fetch alert history');
  const data = await response.json();
  return data.history;
}

async function fetchTokenPrice(chainId: number, address: string): Promise<{ price: number; priceChange24h: number }> {
  const response = await fetch(`/api/v1/tokens/${chainId}/${address}`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to fetch token price');
  const data = await response.json();
  return { price: data.price, priceChange24h: data.priceChange24h };
}

async function createAlert(input: CreateAlertInput): Promise<PriceAlert> {
  const response = await fetch('/api/v1/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create alert');
  }
  return response.json();
}

async function updateAlert(id: string, updates: Partial<CreateAlertInput & { isEnabled: boolean }>): Promise<PriceAlert> {
  const response = await fetch(`/api/v1/alerts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update alert');
  }
  return response.json();
}

async function deleteAlert(id: string): Promise<void> {
  const response = await fetch(`/api/v1/alerts/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete alert');
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateDistance(currentPrice: number, targetPrice: number, alertType: 'above' | 'below'): { distance: number; percent: number; willTrigger: boolean } {
  const distance = alertType === 'above' 
    ? targetPrice - currentPrice 
    : currentPrice - targetPrice;
  const percent = (distance / currentPrice) * 100;
  const willTrigger = alertType === 'above' 
    ? currentPrice >= targetPrice 
    : currentPrice <= targetPrice;
  return { distance, percent, willTrigger };
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ============================================================================
// Sub-Components
// ============================================================================

function StatsCard({ stats, isLoading }: { stats?: AlertStats; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statItems = [
    { label: 'Total Alerts', value: stats?.totalAlerts || 0, icon: Bell, color: 'text-blue-500' },
    { label: 'Active', value: stats?.activeAlerts || 0, icon: Zap, color: 'text-green-500' },
    { label: 'Triggered Today', value: stats?.triggeredToday || 0, icon: BellRing, color: 'text-orange-500' },
    { label: 'Total Triggered', value: stats?.triggeredTotal || 0, icon: History, color: 'text-purple-500' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {statItems.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <item.icon className={cn('h-4 w-4', item.color)} />
            </div>
            <p className="text-2xl font-bold mt-1">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AlertCard({
  alert,
  onEdit,
  onDelete,
  onToggle,
}: {
  alert: PriceAlert;
  onEdit: (alert: PriceAlert) => void;
  onDelete: (alert: PriceAlert) => void;
  onToggle: (alert: PriceAlert, enabled: boolean) => void;
}) {
  const chainInfo = CHAIN_INFO[alert.chainId];
  const alertTypeInfo = ALERT_TYPE_OPTIONS.find((t) => t.value === alert.alertType);
  const AlertIcon = alertTypeInfo?.icon || Bell;

  const distanceInfo = alert.alertType !== 'percent_change' && alert.targetPrice
    ? calculateDistance(alert.currentPrice, alert.targetPrice, alert.alertType)
    : null;

  return (
    <Card className={cn('transition-all', !alert.isEnabled && 'opacity-60')}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              {alert.tokenLogoURI ? (
                <img
                  src={alert.tokenLogoURI}
                  alt={alert.tokenSymbol}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-sm font-medium">{alert.tokenSymbol.slice(0, 2)}</span>
                </div>
              )}
              {chainInfo && (
                <img
                  src={chainInfo.icon}
                  alt={chainInfo.name}
                  className="w-4 h-4 absolute -bottom-1 -right-1 rounded-full border-2 border-background"
                />
              )}
            </div>
            <div>
              <p className="font-semibold">{alert.tokenSymbol}</p>
              <p className="text-xs text-muted-foreground">{alert.tokenName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={alert.isEnabled}
              onCheckedChange={(checked) => onToggle(alert, checked)}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(alert)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => window.open(`${EXPLORER_URLS[alert.chainId]}${alert.tokenAddress}`, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Token
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDelete(alert)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={alertTypeInfo?.color}>
              <AlertIcon className="h-3 w-3 mr-1" />
              {alertTypeInfo?.label}
            </Badge>
            {alert.isRecurring && (
              <Badge variant="secondary">
                <RefreshCw className="h-3 w-3 mr-1" />
                Recurring
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Current Price</p>
              <p className="font-medium">{formatCurrency(alert.currentPrice)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Target</p>
              <p className="font-medium">
                {alert.alertType === 'percent_change'
                  ? `${alert.targetPercentChange! > 0 ? '+' : ''}${alert.targetPercentChange}%`
                  : formatCurrency(alert.targetPrice!)}
              </p>
            </div>
          </div>

          {distanceInfo && (
            <div className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className={cn(
                distanceInfo.willTrigger ? 'text-orange-500 font-medium' : 'text-muted-foreground'
              )}>
                {distanceInfo.willTrigger
                  ? 'Would trigger now!'
                  : `${formatPercent(Math.abs(distanceInfo.percent))} away (${formatCurrency(Math.abs(distanceInfo.distance))})`}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground">Notify via:</span>
            <div className="flex gap-1">
              {alert.notifyEmail && (
                <Badge variant="outline" className="h-6 px-2">
                  <Mail className="h-3 w-3" />
                </Badge>
              )}
              {alert.notifyPush && (
                <Badge variant="outline" className="h-6 px-2">
                  <Smartphone className="h-3 w-3" />
                </Badge>
              )}
              {alert.notifyTelegram && (
                <Badge variant="outline" className="h-6 px-2">
                  <MessageCircle className="h-3 w-3" />
                </Badge>
              )}
            </div>
            {alert.triggerCount > 0 && (
              <span className="text-xs text-muted-foreground ml-auto">
                Triggered {alert.triggerCount}x
              </span>
            )}
          </div>

          {alert.note && (
            <p className="text-xs text-muted-foreground italic truncate" title={alert.note}>
              Note: {alert.note}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AlertHistoryItem({ item }: { item: AlertHistory }) {
  const chainInfo = CHAIN_INFO[item.chainId];
  const alertTypeInfo = ALERT_TYPE_OPTIONS.find((t) => t.value === item.alertType);
  const AlertIcon = alertTypeInfo?.icon || Bell;

  return (
    <div className="flex items-center justify-between p-4 border-b last:border-0">
      <div className="flex items-center gap-3">
        <div className="relative">
          {item.tokenLogoURI ? (
            <img
              src={item.tokenLogoURI}
              alt={item.tokenSymbol}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <span className="text-xs font-medium">{item.tokenSymbol.slice(0, 2)}</span>
            </div>
          )}
          {chainInfo && (
            <img
              src={chainInfo.icon}
              alt={chainInfo.name}
              className="w-3 h-3 absolute -bottom-0.5 -right-0.5 rounded-full border border-background"
            />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{item.tokenSymbol}</span>
            <Badge variant="outline" className={cn('text-xs', alertTypeInfo?.color)}>
              <AlertIcon className="h-3 w-3 mr-1" />
              {item.alertType === 'percent_change'
                ? `${item.targetPercentChange! > 0 ? '+' : ''}${item.targetPercentChange}%`
                : item.alertType === 'above'
                ? `Above ${formatCurrency(item.targetPrice!)}`
                : `Below ${formatCurrency(item.targetPrice!)}`}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Triggered at {formatCurrency(item.triggeredPrice)}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm">{formatTimeAgo(item.triggeredAt)}</p>
        <div className="flex gap-1 mt-1">
          {item.notificationsSent.map((method) => (
            <Badge key={method} variant="secondary" className="text-xs">
              {method}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ type, onCreateClick }: { type: 'active' | 'history'; onCreateClick?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        {type === 'active' ? (
          <Bell className="h-8 w-8 text-muted-foreground" />
        ) : (
          <History className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <h3 className="text-lg font-semibold mb-2">
        {type === 'active' ? 'No Active Alerts' : 'No Alert History'}
      </h3>
      <p className="text-muted-foreground mb-4 max-w-sm">
        {type === 'active'
          ? 'Create your first price alert to get notified when tokens reach your target prices.'
          : 'Your triggered alerts will appear here once you have active alerts that get triggered.'}
      </p>
      {type === 'active' && onCreateClick && (
        <Button onClick={onCreateClick}>
          <Plus className="h-4 w-4 mr-2" />
          Create Alert
        </Button>
      )}
    </div>
  );
}

function ConnectWalletPrompt() {
  const { connect } = useWallet();

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
        <Bell className="h-10 w-10 text-muted-foreground" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        Connect your wallet to create and manage price alerts for your favorite tokens across all supported chains.
      </p>
      <Button size="lg" onClick={() => connect()}>
        Connect Wallet
      </Button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function PriceAlertsPage() {
  const queryClient = useQueryClient();
  const { isConnected, address } = useWallet();

  // State
  const [activeTab, setActiveTab] = useState('create');
  const [selectedChainId, setSelectedChainId] = useState<number | string>(1);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [alertType, setAlertType] = useState<'above' | 'below' | 'percent_change'>('above');
  const [targetPrice, setTargetPrice] = useState('');
  const [targetPercent, setTargetPercent] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [cooldownMinutes, setCooldownMinutes] = useState(0);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyPush, setNotifyPush] = useState(true);
  const [notifyTelegram, setNotifyTelegram] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState('');
  const [note, setNote] = useState('');
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [editingAlert, setEditingAlert] = useState<PriceAlert | null>(null);
  const [deleteConfirmAlert, setDeleteConfirmAlert] = useState<PriceAlert | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [chainFilter, setChainFilter] = useState<number | 'all'>('all');

  // Queries
  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: fetchAlerts,
    enabled: isConnected,
    refetchInterval: 30000, // Refresh every 30s
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['alertStats'],
    queryFn: fetchAlertStats,
    enabled: isConnected,
    refetchInterval: 30000,
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['alertHistory'],
    queryFn: fetchAlertHistory,
    enabled: isConnected,
  });

  const { data: tokenPrice, isLoading: priceLoading } = useQuery({
    queryKey: ['tokenPrice', selectedChainId, selectedToken?.address],
    queryFn: () => fetchTokenPrice(selectedChainId, selectedToken!.address),
    enabled: !!selectedToken,
    refetchInterval: 10000, // Refresh every 10s
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alertStats'] });
      toast.success('Alert created successfully');
      resetForm();
      setActiveTab('active');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CreateAlertInput & { isEnabled: boolean }> }) =>
      updateAlert(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alertStats'] });
      toast.success('Alert updated successfully');
      setEditingAlert(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alertStats'] });
      toast.success('Alert deleted successfully');
      setDeleteConfirmAlert(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Computed values
  const currentPrice = tokenPrice?.price || selectedToken?.price || 0;
  const priceChange24h = tokenPrice?.priceChange24h || selectedToken?.priceChange24h || 0;

  const distanceInfo = useMemo(() => {
    if (alertType === 'percent_change' || !targetPrice || !currentPrice) return null;
    return calculateDistance(currentPrice, parseFloat(targetPrice), alertType);
  }, [alertType, targetPrice, currentPrice]);

  const filteredAlerts = useMemo(() => {
    if (!alerts) return [];
    return alerts.filter((alert) => {
      const matchesSearch =
        !searchQuery ||
        alert.tokenSymbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        alert.tokenName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesChain = chainFilter === 'all' || alert.chainId === chainFilter;
      return matchesSearch && matchesChain;
    });
  }, [alerts, searchQuery, chainFilter]);

  const activeAlerts = useMemo(() => filteredAlerts.filter((a) => a.isEnabled), [filteredAlerts]);
  const inactiveAlerts = useMemo(() => filteredAlerts.filter((a) => !a.isEnabled), [filteredAlerts]);

  // Functions
  function resetForm() {
    setSelectedToken(null);
    setAlertType('above');
    setTargetPrice('');
    setTargetPercent('');
    setIsRecurring(false);
    setCooldownMinutes(0);
    setNotifyEmail(true);
    setNotifyPush(true);
    setNotifyTelegram(false);
    setTelegramChatId('');
    setNote('');
    setEditingAlert(null);
  }

  function handleEdit(alert: PriceAlert) {
    setSelectedChainId(alert.chainId);
    setSelectedToken({
      address: alert.tokenAddress,
      symbol: alert.tokenSymbol,
      name: alert.tokenName,
      decimals: 18,
      logoURI: alert.tokenLogoURI,
      chainId: alert.chainId,
      price: alert.currentPrice,
    });
    setAlertType(alert.alertType);
    setTargetPrice(alert.targetPrice?.toString() || '');
    setTargetPercent(alert.targetPercentChange?.toString() || '');
    setIsRecurring(alert.isRecurring);
    setCooldownMinutes(alert.cooldownMinutes);
    setNotifyEmail(alert.notifyEmail);
    setNotifyPush(alert.notifyPush);
    setNotifyTelegram(alert.notifyTelegram);
    setTelegramChatId(alert.telegramChatId || '');
    setNote(alert.note || '');
    setEditingAlert(alert);
    setActiveTab('create');
  }

  function handleToggle(alert: PriceAlert, enabled: boolean) {
    updateMutation.mutate({ id: alert.id, updates: { isEnabled: enabled } });
  }

  function handleSubmit() {
    if (!selectedToken) {
      toast.error('Please select a token');
      return;
    }

    if (alertType === 'percent_change') {
      if (!targetPercent || isNaN(parseFloat(targetPercent))) {
        toast.error('Please enter a valid percent change');
        return;
      }
    } else {
      if (!targetPrice || isNaN(parseFloat(targetPrice)) || parseFloat(targetPrice) <= 0) {
        toast.error('Please enter a valid target price');
        return;
      }
    }

    if (notifyTelegram && !telegramChatId.trim()) {
      toast.error('Please enter your Telegram Chat ID');
      return;
    }

    if (!notifyEmail && !notifyPush && !notifyTelegram) {
      toast.error('Please select at least one notification method');
      return;
    }

    const input: CreateAlertInput = {
      tokenAddress: selectedToken.address,
      tokenSymbol: selectedToken.symbol,
      tokenName: selectedToken.name,
      tokenLogoURI: selectedToken.logoURI,
      chainId: selectedChainId,
      alertType,
      targetPrice: alertType !== 'percent_change' ? parseFloat(targetPrice) : undefined,
      targetPercentChange: alertType === 'percent_change' ? parseFloat(targetPercent) : undefined,
      isRecurring,
      cooldownMinutes: isRecurring ? cooldownMinutes : 0,
      notifyEmail,
      notifyPush,
      notifyTelegram,
      telegramChatId: notifyTelegram ? telegramChatId : undefined,
      note: note.trim() || undefined,
    };

    if (editingAlert) {
      updateMutation.mutate({ id: editingAlert.id, updates: input });
    } else {
      createMutation.mutate(input);
    }
  }

  function handleUseCurrentPrice() {
    if (currentPrice) {
      setTargetPrice(currentPrice.toString());
    }
  }

  // Effects
  useEffect(() => {
    if (!isConnected) {
      resetForm();
    }
  }, [isConnected]);

  // Render
  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <ConnectWalletPrompt />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Price Alerts</h1>
          <p className="text-muted-foreground">
            Get notified when tokens reach your target prices
          </p>
        </div>
      </div>

      {/* Stats */}
      <StatsCard stats={stats} isLoading={statsLoading} />

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="create">
            <Plus className="h-4 w-4 mr-2" />
            {editingAlert ? 'Edit Alert' : 'Create Alert'}
          </TabsTrigger>
          <TabsTrigger value="active">
            <Bell className="h-4 w-4 mr-2" />
            Active ({stats?.activeAlerts || 0})
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Create/Edit Tab */}
        <TabsContent value="create">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Form */}
            <Card>
              <CardHeader>
                <CardTitle>{editingAlert ? 'Edit Price Alert' : 'Create Price Alert'}</CardTitle>
                <CardDescription>
                  Set up notifications for when a token reaches your target price
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Chain Selection */}
                <div className="space-y-2">
                  <Label>Chain</Label>
                  <Select
                    value={selectedChainId.toString()}
                    onValueChange={(value) => {
                      setSelectedChainId(parseInt(value));
                      setSelectedToken(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CHAIN_INFO).map(([chainId, info]) => (
                        <SelectItem key={chainId} value={chainId}>
                          <div className="flex items-center gap-2">
                            <img src={info.icon} alt={info.name} className="w-5 h-5" />
                            <span>{info.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Token Selection */}
                <div className="space-y-2">
                  <Label>Token</Label>
                  <Button
                    variant="outline"
                    className="w-full justify-between h-auto py-3"
                    onClick={() => setShowTokenSelector(true)}
                  >
                    {selectedToken ? (
                      <div className="flex items-center gap-3">
                        {selectedToken.logoURI ? (
                          <img
                            src={selectedToken.logoURI}
                            alt={selectedToken.symbol}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <span className="text-sm font-medium">
                              {selectedToken.symbol.slice(0, 2)}
                            </span>
                          </div>
                        )}
                        <div className="text-left">
                          <p className="font-medium">{selectedToken.symbol}</p>
                          <p className="text-xs text-muted-foreground">{selectedToken.name}</p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Select a token</span>
                    )}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  {selectedToken && currentPrice > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Current:</span>
                      <span className="font-medium">{formatCurrency(currentPrice)}</span>
                      <span
                        className={cn(
                          'flex items-center gap-1',
                          priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'
                        )}
                      >
                        {priceChange24h >= 0 ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" />
                        )}
                        {formatPercent(Math.abs(priceChange24h))}
                      </span>
                    </div>
                  )}
                </div>

                {/* Alert Type */}
                <div className="space-y-2">
                  <Label>Alert Type</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {ALERT_TYPE_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        variant={alertType === option.value ? 'default' : 'outline'}
                        className="flex flex-col h-auto py-3"
                        onClick={() => setAlertType(option.value)}
                      >
                        <option.icon className={cn('h-5 w-5 mb-1', option.color)} />
                        <span className="text-xs">{option.label}</span>
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {ALERT_TYPE_OPTIONS.find((t) => t.value === alertType)?.description}
                  </p>
                </div>

                {/* Target Input */}
                <div className="space-y-2">
                  <Label>
                    {alertType === 'percent_change' ? 'Target % Change (24h)' : 'Target Price (USD)'}
                  </Label>
                  {alertType === 'percent_change' ? (
                    <div className="relative">
                      <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        placeholder="e.g. 10 or -5"
                        value={targetPercent}
                        onChange={(e) => setTargetPercent(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={targetPrice}
                          onChange={(e) => setTargetPrice(e.target.value)}
                          className="pl-10 pr-20"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7"
                          onClick={handleUseCurrentPrice}
                          disabled={!currentPrice}
                        >
                          Use Current
                        </Button>
                      </div>
                      {distanceInfo && (
                        <p
                          className={cn(
                            'text-sm flex items-center gap-1',
                            distanceInfo.willTrigger
                              ? 'text-orange-500'
                              : 'text-muted-foreground'
                          )}
                        >
                          {distanceInfo.willTrigger ? (
                            <>
                              <AlertCircle className="h-4 w-4" />
                              This alert would trigger immediately at current price
                            </>
                          ) : (
                            <>
                              <Target className="h-4 w-4" />
                              {formatPercent(Math.abs(distanceInfo.percent))} away from current price
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Notification Methods */}
                <div className="space-y-3">
                  <Label>Notification Methods</Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>Email</span>
                      </div>
                      <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-muted-foreground" />
                        <span>Push Notification</span>
                      </div>
                      <Switch checked={notifyPush} onCheckedChange={setNotifyPush} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-muted-foreground" />
                        <span>Telegram</span>
                      </div>
                      <Switch checked={notifyTelegram} onCheckedChange={setNotifyTelegram} />
                    </div>
                    {notifyTelegram && (
                      <Input
                        placeholder="Telegram Chat ID"
                        value={telegramChatId}
                        onChange={(e) => setTelegramChatId(e.target.value)}
                      />
                    )}
                  </div>
                </div>

                {/* Recurring */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Recurring Alert</Label>
                      <p className="text-xs text-muted-foreground">
                        Keep alerting each time the condition is met
                      </p>
                    </div>
                    <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
                  </div>
                  {isRecurring && (
                    <div className="space-y-2">
                      <Label>Cooldown Period</Label>
                      <Select
                        value={cooldownMinutes.toString()}
                        onValueChange={(value) => setCooldownMinutes(parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COOLDOWN_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value.toString()}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Minimum time between notifications to avoid spam
                      </p>
                    </div>
                  )}
                </div>

                {/* Note */}
                <div className="space-y-2">
                  <Label>Note (optional)</Label>
                  <Textarea
                    placeholder="Add a note to remember why you set this alert..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  {editingAlert && (
                    <Button variant="outline" className="flex-1" onClick={resetForm}>
                      Cancel
                    </Button>
                  )}
                  <Button
                    className="flex-1"
                    onClick={handleSubmit}
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {editingAlert ? 'Update Alert' : 'Create Alert'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Alert Preview</CardTitle>
                <CardDescription>Preview how your alert will appear</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedToken ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        {selectedToken.logoURI ? (
                          <img
                            src={selectedToken.logoURI}
                            alt={selectedToken.symbol}
                            className="w-12 h-12 rounded-full"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                            <span className="font-medium">{selectedToken.symbol.slice(0, 2)}</span>
                          </div>
                        )}
                        <img
                          src={CHAIN_INFO[selectedChainId]?.icon}
                          alt={CHAIN_INFO[selectedChainId]?.name}
                          className="w-5 h-5 absolute -bottom-1 -right-1 rounded-full border-2 border-background"
                        />
                      </div>
                      <div>
                        <p className="text-lg font-semibold">{selectedToken.symbol}</p>
                        <p className="text-sm text-muted-foreground">{selectedToken.name}</p>
                      </div>
                    </div>

                    <div className="p-4 bg-muted rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Current Price</span>
                        <span className="font-medium">
                          {priceLoading ? (
                            <Skeleton className="h-5 w-20" />
                          ) : (
                            formatCurrency(currentPrice)
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Alert Type</span>
                        <Badge variant="outline" className={ALERT_TYPE_OPTIONS.find((t) => t.value === alertType)?.color}>
                          {ALERT_TYPE_OPTIONS.find((t) => t.value === alertType)?.label}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Target</span>
                        <span className="font-medium">
                          {alertType === 'percent_change'
                            ? targetPercent
                              ? `${parseFloat(targetPercent) > 0 ? '+' : ''}${targetPercent}%`
                              : '—'
                            : targetPrice
                            ? formatCurrency(parseFloat(targetPrice))
                            : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Recurring</span>
                        <span>{isRecurring ? `Yes (${COOLDOWN_OPTIONS.find((c) => c.value === cooldownMinutes)?.label})` : 'No'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Notifications</span>
                        <div className="flex gap-1">
                          {notifyEmail && (
                            <Badge variant="secondary">
                              <Mail className="h-3 w-3" />
                            </Badge>
                          )}
                          {notifyPush && (
                            <Badge variant="secondary">
                              <Smartphone className="h-3 w-3" />
                            </Badge>
                          )}
                          {notifyTelegram && (
                            <Badge variant="secondary">
                              <MessageCircle className="h-3 w-3" />
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <p className="text-sm">
                        <span className="font-medium">Sample notification:</span>
                        <br />
                        <span className="text-muted-foreground">
                          🔔 {selectedToken.symbol} {alertType === 'above' ? 'rose above' : alertType === 'below' ? 'fell below' : 'changed by'}{' '}
                          {alertType === 'percent_change'
                            ? `${targetPercent || '—'}%`
                            : formatCurrency(parseFloat(targetPrice) || 0)}
                          ! Current price: {formatCurrency(currentPrice)}
                        </span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <Bell className="h-12 w-12 mb-4 opacity-50" />
                    <p>Select a token to preview your alert</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Active Alerts Tab */}
        <TabsContent value="active">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search alerts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={chainFilter.toString()}
              onValueChange={(value) => setChainFilter(value === 'all' ? 'all' : parseInt(value))}
            >
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by chain" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Chains</SelectItem>
                {Object.entries(CHAIN_INFO).map(([chainId, info]) => (
                  <SelectItem key={chainId} value={chainId}>
                    <div className="flex items-center gap-2">
                      <img src={info.icon} alt={info.name} className="w-4 h-4" />
                      <span>{info.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {alertsLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div>
                        <Skeleton className="h-4 w-20 mb-1" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                    <Skeleton className="h-6 w-24" />
                    <div className="grid grid-cols-2 gap-4">
                      <Skeleton className="h-10" />
                      <Skeleton className="h-10" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredAlerts.length === 0 ? (
            <EmptyState type="active" onCreateClick={() => setActiveTab('create')} />
          ) : (
            <div className="space-y-6">
              {activeAlerts.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-green-500" />
                    Active Alerts ({activeAlerts.length})
                  </h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeAlerts.map((alert) => (
                      <AlertCard
                        key={alert.id}
                        alert={alert}
                        onEdit={handleEdit}
                        onDelete={setDeleteConfirmAlert}
                        onToggle={handleToggle}
                      />
                    ))}
                  </div>
                </div>
              )}

              {inactiveAlerts.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-muted-foreground">
                    <XCircle className="h-5 w-5" />
                    Disabled Alerts ({inactiveAlerts.length})
                  </h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {inactiveAlerts.map((alert) => (
                      <AlertCard
                        key={alert.id}
                        alert={alert}
                        onEdit={handleEdit}
                        onDelete={setDeleteConfirmAlert}
                        onToggle={handleToggle}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          {historyLoading ? (
            <Card>
              <CardContent className="p-0">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-4 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <div>
                        <Skeleton className="h-4 w-32 mb-1" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : !history || history.length === 0 ? (
            <EmptyState type="history" />
          ) : (
            <Card>
              <CardContent className="p-0">
                {history.map((item) => (
                  <AlertHistoryItem key={item.id} item={item} />
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Token Selector Modal */}
      <Dialog open={showTokenSelector} onOpenChange={setShowTokenSelector}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Token</DialogTitle>
            <DialogDescription>
              Choose a token from {CHAIN_INFO[selectedChainId]?.name || 'the selected chain'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <TokenSelector
              chainId={selectedChainId}
              onSelect={(token) => {
                setSelectedToken({ ...token, chainId: token.chainId ?? selectedChainId } as Token);
                setShowTokenSelector(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmAlert} onOpenChange={() => setDeleteConfirmAlert(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Alert</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this price alert? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteConfirmAlert && (
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              {deleteConfirmAlert.tokenLogoURI ? (
                <img
                  src={deleteConfirmAlert.tokenLogoURI}
                  alt={deleteConfirmAlert.tokenSymbol}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center">
                  <span className="font-medium">{deleteConfirmAlert.tokenSymbol.slice(0, 2)}</span>
                </div>
              )}
              <div>
                <p className="font-medium">{deleteConfirmAlert.tokenSymbol}</p>
                <p className="text-sm text-muted-foreground">
                  {deleteConfirmAlert.alertType === 'percent_change'
                    ? `${deleteConfirmAlert.targetPercentChange! > 0 ? '+' : ''}${deleteConfirmAlert.targetPercentChange}% change`
                    : `${deleteConfirmAlert.alertType === 'above' ? 'Above' : 'Below'} ${formatCurrency(deleteConfirmAlert.targetPrice!)}`}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmAlert(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmAlert && deleteMutation.mutate(deleteConfirmAlert.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}







