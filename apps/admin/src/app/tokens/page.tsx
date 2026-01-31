// apps/admin/src/app/tokens/page.tsx
'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/Tabs';
import {
  Plus,
  Search,
  RefreshCw,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ExternalLink,
  Edit,
  Trash2,
  Upload,
  Download,
  Filter,
} from 'lucide-react';
import Link from 'next/link';

interface Token {
  id: string;
  chainId: number | string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string | null;
  isVerified: boolean;
  isActive: boolean;
  source: string;
  audit: {
    riskLevel: string;
    riskScore: number;
    isHoneypot: boolean;
  } | null;
  stats: {
    volume24h: number;
    swaps24h: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface SyncStatus {
  source: string;
  lastSync: string;
  tokenCount: number;
  status: 'success' | 'failed' | 'running';
  error?: string;
}

export default function TokensPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [chainFilter, setChainFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('tokens');

  const { data: tokens, isLoading } = useQuery<Token[]>({
    queryKey: ['admin-tokens', searchQuery, chainFilter, statusFilter],
    queryFn: () =>
      adminApi
        .get('/api/admin/tokens', {
          params: {
            search: searchQuery,
            chainId: chainFilter !== 'all' ? chainFilter : undefined,
            status: statusFilter !== 'all' ? statusFilter : undefined,
          },
        })
        .then((r) => r.data),
  });

  const { data: syncStatuses } = useQuery<SyncStatus[]>({
    queryKey: ['token-sync-status'],
    queryFn: () => adminApi.get('/api/admin/tokens/sync/status').then((r) => r.data),
    refetchInterval: 30000,
  });

  const syncMutation = useMutation({
    mutationFn: (source: string) =>
      adminApi.post(`/api/admin/tokens/sync/${source}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['token-sync-status'] });
    },
  });

  const toggleTokenMutation = useMutation({
    mutationFn: ({ tokenId, isActive }: { tokenId: string; isActive: boolean }) =>
      adminApi.patch(`/api/admin/tokens/${tokenId}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tokens'] });
    },
  });

  const deleteTokenMutation = useMutation({
    mutationFn: (tokenId: string) =>
      adminApi.delete(`/api/admin/tokens/${tokenId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tokens'] });
    },
  });

  const getChainName = (chainId: number | string): string => {
    const names: Record<number | string, string> = {
      1: 'Ethereum',
      56: 'BNB Chain',
      137: 'Polygon',
      42161: 'Arbitrum',
      10: 'Optimism',
      8453: 'Base',
      'solana-mainnet': 'Solana',
      'sui-mainnet': 'Sui',
    };
    return names[chainId] || String(chainId);
  };

  const getChainIcon = (chainId: number | string): string => {
    const icons: Record<number | string, string> = {
      1: '🔷',
      56: '🟡',
      137: '🟣',
      42161: '🔵',
      10: '🔴',
      8453: '🔵',
      'solana-mainnet': '🟢',
      'sui-mainnet': '🌊',
    };
    return icons[chainId] || '⛓️';
  };

  const getRiskBadge = (audit: Token['audit']) => {
    if (!audit) return null;
    
    const variants: Record<string, string> = {
      low: 'bg-green-500/10 text-green-500',
      medium: 'bg-yellow-500/10 text-yellow-500',
      high: 'bg-orange-500/10 text-orange-500',
      critical: 'bg-red-500/10 text-red-500',
    };
    
    return (
      <Badge className={variants[audit.riskLevel] || 'bg-gray-500/10 text-gray-500'}>
        {audit.isHoneypot ? '⚠️ Honeypot' : audit.riskLevel}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Token Registry</h1>
          <p className="text-muted-foreground">
            Manage tokens across all supported chains
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => syncMutation.mutate('all')}>
            <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Sync All
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Token
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{tokens?.length || 0}</div>
            <p className="text-sm text-muted-foreground">Total Tokens</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">
              {tokens?.filter((t) => t.isVerified).length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Verified</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-500">
              {tokens?.filter((t) => t.isActive).length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-500">
              {tokens?.filter((t) => t.audit?.riskLevel === 'medium' || t.audit?.riskLevel === 'high').length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Risky Tokens</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-500">
              {tokens?.filter((t) => t.audit?.isHoneypot).length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Honeypots</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tokens">Tokens</TabsTrigger>
          <TabsTrigger value="sync">Sync Status</TabsTrigger>
          <TabsTrigger value="audit">Audit Queue</TabsTrigger>
        </TabsList>

        {/* Tokens Tab */}
        <TabsContent value="tokens" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, symbol, or address..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <select
                  value={chainFilter}
                  onChange={(e) => setChainFilter(e.target.value)}
                  className="border rounded-lg px-3 py-2 bg-background"
                >
                  <option value="all">All Chains</option>
                  <option value="1">Ethereum</option>
                  <option value="56">BNB Chain</option>
                  <option value="137">Polygon</option>
                  <option value="42161">Arbitrum</option>
                  <option value="solana-mainnet">Solana</option>
                  <option value="sui-mainnet">Sui</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border rounded-lg px-3 py-2 bg-background"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="verified">Verified</option>
                  <option value="unverified">Unverified</option>
                  <option value="risky">Risky</option>
                </select>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tokens Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Token</TableHead>
                    <TableHead>Chain</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Volume (24h)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : tokens?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        No tokens found
                      </TableCell>
                    </TableRow>
                  ) : (
                    tokens?.map((token) => (
                      <TableRow key={token.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {token.logoURI ? (
                              <img
                                src={token.logoURI}
                                alt={token.symbol}
                                className="w-8 h-8 rounded-full"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs">
                                {token.symbol.slice(0, 2)}
                              </div>
                            )}
                            <div>
                              <div className="font-medium flex items-center gap-1">
                                {token.symbol}
                                {token.isVerified && (
                                  <CheckCircle className="w-4 h-4 text-blue-500" />
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                                {token.name}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1">
                            {getChainIcon(token.chainId)}
                            {getChainName(token.chainId)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{token.source}</Badge>
                        </TableCell>
                        <TableCell>{getRiskBadge(token.audit)}</TableCell>
                        <TableCell>
                          ${(token.stats?.volume24h || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {token.isActive ? (
                            <Badge className="bg-green-500/10 text-green-500">
                              Active
                            </Badge>
                          ) : (
                            <Badge className="bg-gray-500/10 text-gray-500">
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Link href={`/admin/tokens/${token.chainId}/${token.address}`}>
                              <Button variant="ghost" size="sm">
                                <Shield className="w-4 h-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                toggleTokenMutation.mutate({
                                  tokenId: token.id,
                                  isActive: !token.isActive,
                                })
                              }
                            >
                              {token.isActive ? (
                                <XCircle className="w-4 h-4" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sync Status Tab */}
        <TabsContent value="sync" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {syncStatuses?.map((status) => (
              <Card key={status.source}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">{status.source}</CardTitle>
                  {status.status === 'success' && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                  {status.status === 'failed' && (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  {status.status === 'running' && (
                    <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tokens</span>
                      <span>{status.tokenCount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Sync</span>
                      <span>
                        {new Date(status.lastSync).toLocaleString()}
                      </span>
                    </div>
                    {status.error && (
                      <div className="text-red-500 text-xs mt-2">
                        {status.error}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-4"
                    onClick={() => syncMutation.mutate(status.source)}
                    disabled={status.status === 'running'}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync Now
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Audit Queue Tab */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Pending Audits</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Tokens awaiting GoPlus security audit...
              </p>
              {/* Audit queue table would go here */}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Token Dialog */}
      <AddTokenDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
      />
    </div>
  );
}

// Add Token Dialog
interface AddTokenDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddTokenDialog: React.FC<AddTokenDialogProps> = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    chainId: '1',
    address: '',
    symbol: '',
    name: '',
    decimals: 18,
    logoURI: '',
  });
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);

  const validateMutation = useMutation({
    mutationFn: (data: { chainId: string; address: string }) =>
      adminApi.post('/api/admin/tokens/validate', data),
    onSuccess: (response) => {
      setValidationResult(response.data);
      if (response.data.token) {
        setFormData((prev) => ({
          ...prev,
          symbol: response.data.token.symbol,
          name: response.data.token.name,
          decimals: response.data.token.decimals,
          logoURI: response.data.token.logoURI || '',
        }));
      }
    },
  });

  const addMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      adminApi.post('/api/admin/tokens', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tokens'] });
      onClose();
      resetForm();
    },
  });

  const resetForm = () => {
    setFormData({
      chainId: '1',
      address: '',
      symbol: '',
      name: '',
      decimals: 18,
      logoURI: '',
    });
    setValidationResult(null);
  };

  const handleValidate = () => {
    if (formData.address) {
      validateMutation.mutate({
        chainId: formData.chainId,
        address: formData.address,
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Custom Token</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Chain</label>
            <select
              value={formData.chainId}
              onChange={(e) => {
                setFormData({ ...formData, chainId: e.target.value });
                setValidationResult(null);
              }}
              className="w-full border rounded-lg px-3 py-2 bg-background"
            >
              <option value="1">Ethereum</option>
              <option value="56">BNB Chain</option>
              <option value="137">Polygon</option>
              <option value="42161">Arbitrum</option>
              <option value="10">Optimism</option>
              <option value="8453">Base</option>
              <option value="solana-mainnet">Solana</option>
              <option value="sui-mainnet">Sui</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Contract Address</label>
            <div className="flex gap-2">
              <Input
                value={formData.address}
                onChange={(e) => {
                  setFormData({ ...formData, address: e.target.value });
                  setValidationResult(null);
                }}
                placeholder="0x..."
              />
              <Button
                variant="outline"
                onClick={handleValidate}
                disabled={!formData.address || validateMutation.isPending}
              >
                {validateMutation.isPending ? 'Validating...' : 'Validate'}
              </Button>
            </div>
          </div>

          {/* Validation Result */}
          {validationResult && (
            <div
              className={`p-3 rounded-lg ${
                validationResult.isValid
                  ? 'bg-green-500/10 border border-green-500/20'
                  : 'bg-red-500/10 border border-red-500/20'
              }`}
            >
              {validationResult.isValid ? (
                <div className="flex items-center gap-2 text-green-500">
                  <CheckCircle className="w-4 h-4" />
                  Token verified on-chain
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-500">
                  <XCircle className="w-4 h-4" />
                  {validationResult.error || 'Invalid token'}
                </div>
              )}
              {validationResult.audit && (
                <div className="mt-2 text-sm">
                  <span>Risk Level: </span>
                  <Badge
                    className={
                      validationResult.audit.riskLevel === 'low'
                        ? 'bg-green-500/10 text-green-500'
                        : validationResult.audit.riskLevel === 'critical'
                        ? 'bg-red-500/10 text-red-500'
                        : 'bg-yellow-500/10 text-yellow-500'
                    }
                  >
                    {validationResult.audit.riskLevel}
                  </Badge>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Symbol</label>
              <Input
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                placeholder="TOKEN"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Decimals</label>
              <Input
                type="number"
                value={formData.decimals}
                onChange={(e) =>
                  setFormData({ ...formData, decimals: parseInt(e.target.value) || 18 })
                }
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Name</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Token Name"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Logo URL (optional)</label>
            <Input
              value={formData.logoURI}
              onChange={(e) => setFormData({ ...formData, logoURI: e.target.value })}
              placeholder="https://..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => addMutation.mutate(formData)}
            disabled={
              !formData.address ||
              !formData.symbol ||
              !validationResult?.isValid ||
              addMutation.isPending
            }
          >
            {addMutation.isPending ? 'Adding...' : 'Add Token'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
