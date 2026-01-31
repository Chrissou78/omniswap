// apps/admin/src/app/api-keys/page.tsx
'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Key,
  Plus,
  Copy,
  Check,
  MoreHorizontal,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw,
  Shield,
  Activity,
  AlertTriangle,
  Clock,
  Globe,
  Lock,
  Unlock,
  BarChart3,
  Settings,
} from 'lucide-react';
import { cn, formatNumber, formatDate } from '@/lib/utils';
import { toast } from 'sonner';

// Types
interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  tenantId?: string;
  tenant?: { name: string; slug: string };
  permissions: string[];
  rateLimit: number;
  rateLimitWindow: number;
  allowedIps: string[];
  allowedOrigins: string[];
  isActive: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
  usageCount: number;
  usageToday: number;
  createdAt: string;
  createdBy: string;
}

interface ApiKeyStats {
  totalKeys: number;
  activeKeys: number;
  totalRequestsToday: number;
  totalRequestsMonth: number;
  rateLimitedToday: number;
}

interface CreateApiKeyInput {
  name: string;
  tenantId?: string;
  permissions: string[];
  rateLimit: number;
  rateLimitWindow: number;
  allowedIps: string[];
  allowedOrigins: string[];
  expiresAt?: string;
}

const PERMISSIONS = [
  { value: 'quote:read', label: 'Read Quotes', description: 'Get swap quotes' },
  { value: 'quote:create', label: 'Create Quotes', description: 'Request new quotes' },
  { value: 'swap:read', label: 'Read Swaps', description: 'View swap history' },
  { value: 'swap:create', label: 'Execute Swaps', description: 'Execute swap transactions' },
  { value: 'token:read', label: 'Read Tokens', description: 'View token information' },
  { value: 'portfolio:read', label: 'Read Portfolio', description: 'View portfolio data' },
  { value: 'limit-order:read', label: 'Read Limit Orders', description: 'View limit orders' },
  { value: 'limit-order:create', label: 'Create Limit Orders', description: 'Create limit orders' },
  { value: 'limit-order:delete', label: 'Delete Limit Orders', description: 'Cancel limit orders' },
  { value: 'dca:read', label: 'Read DCA', description: 'View DCA strategies' },
  { value: 'dca:create', label: 'Create DCA', description: 'Create DCA strategies' },
  { value: 'dca:delete', label: 'Delete DCA', description: 'Cancel DCA strategies' },
  { value: 'alert:read', label: 'Read Alerts', description: 'View price alerts' },
  { value: 'alert:create', label: 'Create Alerts', description: 'Create price alerts' },
  { value: 'alert:delete', label: 'Delete Alerts', description: 'Delete price alerts' },
  { value: 'webhook:manage', label: 'Manage Webhooks', description: 'Configure webhooks' },
];

const RATE_LIMIT_PRESETS = [
  { value: 60, label: '60/min (Basic)' },
  { value: 300, label: '300/min (Standard)' },
  { value: 1000, label: '1000/min (Pro)' },
  { value: 5000, label: '5000/min (Enterprise)' },
  { value: -1, label: 'Unlimited' },
];

export default function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [newKeyRevealed, setNewKeyRevealed] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [formData, setFormData] = useState<CreateApiKeyInput>({
    name: '',
    tenantId: undefined,
    permissions: ['quote:read', 'quote:create', 'token:read'],
    rateLimit: 300,
    rateLimitWindow: 60,
    allowedIps: [],
    allowedOrigins: [],
    expiresAt: undefined,
  });
  const [ipInput, setIpInput] = useState('');
  const [originInput, setOriginInput] = useState('');

  // Fetch API keys
  const { data: keysData, isLoading: isLoadingKeys } = useQuery({
    queryKey: ['admin', 'api-keys', filterStatus, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (searchQuery) params.set('search', searchQuery);
      const res = await fetch(`/api/admin/api-keys?${params}`);
      if (!res.ok) throw new Error('Failed to fetch API keys');
      return res.json() as Promise<{ keys: ApiKey[]; stats: ApiKeyStats }>;
    },
  });

  // Fetch tenants for dropdown
  const { data: tenantsData } = useQuery({
    queryKey: ['admin', 'tenants', 'list'],
    queryFn: async () => {
      const res = await fetch('/api/admin/tenants?limit=100');
      if (!res.ok) throw new Error('Failed to fetch tenants');
      return res.json();
    },
  });

  // Create API key mutation
  const createKeyMutation = useMutation({
    mutationFn: async (data: CreateApiKeyInput) => {
      const res = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create API key');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'api-keys'] });
      setNewKeyRevealed(data.key);
      toast.success('API key created successfully');
    },
    onError: () => {
      toast.error('Failed to create API key');
    },
  });

  // Toggle key status mutation
  const toggleKeyMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/admin/api-keys/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error('Failed to update API key');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'api-keys'] });
      toast.success('API key updated');
    },
    onError: () => {
      toast.error('Failed to update API key');
    },
  });

  // Regenerate key mutation
  const regenerateKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/api-keys/${id}/regenerate`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to regenerate API key');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'api-keys'] });
      setNewKeyRevealed(data.key);
      toast.success('API key regenerated');
    },
    onError: () => {
      toast.error('Failed to regenerate API key');
    },
  });

  // Delete key mutation
  const deleteKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/api-keys/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete API key');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'api-keys'] });
      setDeleteDialogOpen(false);
      setSelectedKey(null);
      toast.success('API key deleted');
    },
    onError: () => {
      toast.error('Failed to delete API key');
    },
  });

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    toast.success('API key copied to clipboard');
  };

  const handleCreateKey = () => {
    createKeyMutation.mutate(formData);
  };

  const handleAddIp = () => {
    if (ipInput && !formData.allowedIps.includes(ipInput)) {
      setFormData({ ...formData, allowedIps: [...formData.allowedIps, ipInput] });
      setIpInput('');
    }
  };

  const handleAddOrigin = () => {
    if (originInput && !formData.allowedOrigins.includes(originInput)) {
      setFormData({ ...formData, allowedOrigins: [...formData.allowedOrigins, originInput] });
      setOriginInput('');
    }
  };

  const handleRemoveIp = (ip: string) => {
    setFormData({ ...formData, allowedIps: formData.allowedIps.filter((i) => i !== ip) });
  };

  const handleRemoveOrigin = (origin: string) => {
    setFormData({ ...formData, allowedOrigins: formData.allowedOrigins.filter((o) => o !== origin) });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      tenantId: undefined,
      permissions: ['quote:read', 'quote:create', 'token:read'],
      rateLimit: 300,
      rateLimitWindow: 60,
      allowedIps: [],
      allowedOrigins: [],
      expiresAt: undefined,
    });
    setNewKeyRevealed(null);
  };

  const stats = keysData?.stats;
  const keys = keysData?.keys || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Keys</h1>
          <p className="text-muted-foreground">
            Manage API keys for programmatic access
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            {newKeyRevealed ? (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-green-500">
                    <Check className="h-5 w-5" />
                    API Key Created
                  </DialogTitle>
                  <DialogDescription>
                    Copy your API key now. You won't be able to see it again!
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center justify-between gap-4">
                      <code className="text-sm font-mono break-all flex-1">
                        {newKeyRevealed}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleCopyKey(newKeyRevealed)}
                      >
                        {copiedKey === newKeyRevealed ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-yellow-500">Important</p>
                      <p className="text-muted-foreground">
                        Store this key securely. It provides access to the API based on the permissions you configured.
                      </p>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => {
                    setCreateDialogOpen(false);
                    resetForm();
                  }}>
                    Done
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Create API Key</DialogTitle>
                  <DialogDescription>
                    Generate a new API key with specific permissions and rate limits
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Key Name *</Label>
                      <Input
                        id="name"
                        placeholder="e.g., Production API Key"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tenant">Tenant (Optional)</Label>
                      <Select
                        value={formData.tenantId || 'none'}
                        onValueChange={(v) => setFormData({ ...formData, tenantId: v === 'none' ? undefined : v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select tenant" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No specific tenant (Platform-wide)</SelectItem>
                          {tenantsData?.tenants?.map((tenant: any) => (
                            <SelectItem key={tenant.id} value={tenant.id}>
                              {tenant.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Permissions */}
                  <div className="space-y-3">
                    <Label>Permissions</Label>
                    <div className="grid grid-cols-2 gap-3 p-4 border rounded-lg max-h-[200px] overflow-y-auto">
                      {PERMISSIONS.map((perm) => (
                        <div key={perm.value} className="flex items-start space-x-2">
                          <Checkbox
                            id={perm.value}
                            checked={formData.permissions.includes(perm.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFormData({
                                  ...formData,
                                  permissions: [...formData.permissions, perm.value],
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  permissions: formData.permissions.filter((p) => p !== perm.value),
                                });
                              }
                            }}
                          />
                          <div className="grid gap-0.5 leading-none">
                            <label
                              htmlFor={perm.value}
                              className="text-sm font-medium cursor-pointer"
                            >
                              {perm.label}
                            </label>
                            <p className="text-xs text-muted-foreground">
                              {perm.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Rate Limiting */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Rate Limit</Label>
                      <Select
                        value={String(formData.rateLimit)}
                        onValueChange={(v) => setFormData({ ...formData, rateLimit: parseInt(v) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RATE_LIMIT_PRESETS.map((preset) => (
                            <SelectItem key={preset.value} value={String(preset.value)}>
                              {preset.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expiry">Expiry (Optional)</Label>
                      <Input
                        id="expiry"
                        type="date"
                        value={formData.expiresAt || ''}
                        onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value || undefined })}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  </div>

                  {/* IP Whitelist */}
                  <div className="space-y-2">
                    <Label>Allowed IPs (Optional)</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g., 192.168.1.1 or 10.0.0.0/24"
                        value={ipInput}
                        onChange={(e) => setIpInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddIp())}
                      />
                      <Button type="button" variant="outline" onClick={handleAddIp}>
                        Add
                      </Button>
                    </div>
                    {formData.allowedIps.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.allowedIps.map((ip) => (
                          <Badge key={ip} variant="secondary" className="gap-1">
                            {ip}
                            <button
                              type="button"
                              onClick={() => handleRemoveIp(ip)}
                              className="ml-1 hover:text-destructive"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Leave empty to allow all IPs
                    </p>
                  </div>

                  {/* Origin Whitelist */}
                  <div className="space-y-2">
                    <Label>Allowed Origins (Optional)</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g., https://myapp.com"
                        value={originInput}
                        onChange={(e) => setOriginInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOrigin())}
                      />
                      <Button type="button" variant="outline" onClick={handleAddOrigin}>
                        Add
                      </Button>
                    </div>
                    {formData.allowedOrigins.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.allowedOrigins.map((origin) => (
                          <Badge key={origin} variant="secondary" className="gap-1">
                            {origin}
                            <button
                              type="button"
                              onClick={() => handleRemoveOrigin(origin)}
                              className="ml-1 hover:text-destructive"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Leave empty to allow all origins
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateKey}
                    disabled={!formData.name || formData.permissions.length === 0 || createKeyMutation.isPending}
                  >
                    {createKeyMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Key className="h-4 w-4 mr-2" />
                    )}
                    Create Key
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Key className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Keys</p>
                <p className="text-2xl font-bold">{stats?.totalKeys || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Unlock className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Keys</p>
                <p className="text-2xl font-bold">{stats?.activeKeys || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Activity className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Requests Today</p>
                <p className="text-2xl font-bold">{formatNumber(stats?.totalRequestsToday || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <BarChart3 className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold">{formatNumber(stats?.totalRequestsMonth || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rate Limited</p>
                <p className="text-2xl font-bold">{stats?.rateLimitedToday || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or key prefix..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* API Keys Table */}
      <Card>
        <CardContent className="p-0">
          {isLoadingKeys ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-48 mb-2" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          ) : keys.length === 0 ? (
            <div className="p-12 text-center">
              <Key className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No API Keys</h3>
              <p className="text-muted-foreground mb-4">
                Create your first API key to get started
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create API Key
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Rate Limit</TableHead>
                  <TableHead>Usage Today</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-lg">
                          <Key className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">{key.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Created {formatDate(key.createdAt)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {key.keyPrefix}...
                      </code>
                    </TableCell>
                    <TableCell>
                      {key.tenant ? (
                        <Badge variant="outline">{key.tenant.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">Platform</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {key.permissions.slice(0, 3).map((perm) => (
                          <Badge key={perm} variant="secondary" className="text-xs">
                            {perm.split(':')[0]}
                          </Badge>
                        ))}
                        {key.permissions.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{key.permissions.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {key.rateLimit === -1 ? (
                        <span className="text-muted-foreground">Unlimited</span>
                      ) : (
                        <span>{key.rateLimit}/min</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        key.usageToday > key.rateLimit * 0.8 && key.rateLimit !== -1
                          ? 'text-yellow-500'
                          : ''
                      )}>
                        {formatNumber(key.usageToday)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={key.isActive}
                          onCheckedChange={(checked) =>
                            toggleKeyMutation.mutate({ id: key.id, isActive: checked })
                          }
                        />
                        <Badge variant={key.isActive ? 'default' : 'secondary'}>
                          {key.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {key.lastUsedAt ? (
                        <span className="text-sm text-muted-foreground">
                          {formatDate(key.lastUsedAt)}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => regenerateKeyMutation.mutate(key.id)}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Regenerate
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Settings className="h-4 w-4 mr-2" />
                            Edit Settings
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <BarChart3 className="h-4 w-4 mr-2" />
                            View Usage
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setSelectedKey(key);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedKey?.name}"? This action cannot be undone
              and any applications using this key will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => selectedKey && deleteKeyMutation.mutate(selectedKey.id)}
            >
              {deleteKeyMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
