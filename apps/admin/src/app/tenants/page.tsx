// apps/admin/src/app/tenants/page.tsx
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Copy,
  ExternalLink,
  Globe,
  Palette,
  Coins,
  BarChart3,
  Settings,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  status: 'active' | 'inactive' | 'pending';
  plan: 'starter' | 'professional' | 'enterprise';
  createdAt: string;
  stats: {
    volume24h: number;
    swaps24h: number;
    revenue24h: number;
  };
  branding: {
    primaryColor: string;
    logo: string | null;
  };
}

export default function TenantsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  const { data: tenants, isLoading } = useQuery<Tenant[]>({
    queryKey: ['tenants', searchQuery, statusFilter],
    queryFn: () =>
      adminApi
        .get('/api/admin/tenants', {
          params: { search: searchQuery, status: statusFilter },
        })
        .then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (tenantId: string) =>
      adminApi.delete(`/api/admin/tenants/${tenantId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ tenantId, status }: { tenantId: string; status: string }) =>
      adminApi.patch(`/api/admin/tenants/${tenantId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      active: 'bg-green-500/10 text-green-500',
      inactive: 'bg-gray-500/10 text-gray-500',
      pending: 'bg-yellow-500/10 text-yellow-500',
    };
    return variants[status] || 'bg-gray-500/10 text-gray-500';
  };

  const getPlanBadge = (plan: string) => {
    const variants: Record<string, string> = {
      starter: 'bg-blue-500/10 text-blue-500',
      professional: 'bg-purple-500/10 text-purple-500',
      enterprise: 'bg-orange-500/10 text-orange-500',
    };
    return variants[plan] || 'bg-gray-500/10 text-gray-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tenants</h1>
          <p className="text-muted-foreground">
            Manage white-label instances and their configurations
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Tenant
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{tenants?.length || 0}</div>
            <p className="text-sm text-muted-foreground">Total Tenants</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">
              {tenants?.filter((t) => t.status === 'active').length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              ${tenants?.reduce((sum, t) => sum + (t.stats?.volume24h || 0), 0).toLocaleString() || 0}
            </div>
            <p className="text-sm text-muted-foreground">Combined Volume (24h)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-500">
              ${tenants?.reduce((sum, t) => sum + (t.stats?.revenue24h || 0), 0).toLocaleString() || 0}
            </div>
            <p className="text-sm text-muted-foreground">Combined Revenue (24h)</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search tenants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded-lg px-3 py-2 bg-background"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Tenants Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Volume (24h)</TableHead>
                <TableHead>Revenue (24h)</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : tenants?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    No tenants found
                  </TableCell>
                </TableRow>
              ) : (
                tenants?.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: tenant.branding?.primaryColor || '#6366f1' }}
                        >
                          {tenant.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">{tenant.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {tenant.slug}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {tenant.domain ? (
                        <a
                          href={`https://${tenant.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          {tenant.domain}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={getPlanBadge(tenant.plan)}>
                        {tenant.plan}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusBadge(tenant.status)}>
                        {tenant.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      ${(tenant.stats?.volume24h || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-green-500">
                      ${(tenant.stats?.revenue24h || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(new Date(tenant.createdAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/tenants/${tenant.id}`}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/tenants/${tenant.id}/branding`}>
                              <Palette className="w-4 h-4 mr-2" />
                              Branding
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/tenants/${tenant.id}/tokens`}>
                              <Coins className="w-4 h-4 mr-2" />
                              Tokens
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/tenants/${tenant.id}/analytics`}>
                              <BarChart3 className="w-4 h-4 mr-2" />
                              Analytics
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/tenants/${tenant.id}/settings`}>
                              <Settings className="w-4 h-4 mr-2" />
                              Settings
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              toggleStatusMutation.mutate({
                                tenantId: tenant.id,
                                status: tenant.status === 'active' ? 'inactive' : 'active',
                              })
                            }
                          >
                            {tenant.status === 'active' ? (
                              <>
                                <XCircle className="w-4 h-4 mr-2" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-500"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this tenant?')) {
                                deleteMutation.mutate(tenant.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Tenant Dialog */}
      <CreateTenantDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />
    </div>
  );
}

// Create Tenant Dialog Component
interface CreateTenantDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreateTenantDialog: React.FC<CreateTenantDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    domain: '',
    plan: 'starter',
    adminEmail: '',
    primaryColor: '#6366f1',
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      adminApi.post('/api/admin/tenants', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      onClose();
      setFormData({
        name: '',
        slug: '',
        domain: '',
        plan: 'starter',
        adminEmail: '',
        primaryColor: '#6366f1',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setFormData({ ...formData, name, slug });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Tenant</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Tenant Name</label>
            <Input
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="My DEX"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Slug</label>
            <Input
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="my-dex"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              URL: {formData.slug || 'my-dex'}.omniswap.io
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">Custom Domain (optional)</label>
            <Input
              value={formData.domain}
              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              placeholder="swap.mydex.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Admin Email</label>
            <Input
              type="email"
              value={formData.adminEmail}
              onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
              placeholder="admin@mydex.com"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Plan</label>
            <select
              value={formData.plan}
              onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 bg-background"
            >
              <option value="starter">Starter - $99/month</option>
              <option value="professional">Professional - $299/month</option>
              <option value="enterprise">Enterprise - Custom</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Primary Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.primaryColor}
                onChange={(e) =>
                  setFormData({ ...formData, primaryColor: e.target.value })
                }
                className="w-10 h-10 rounded cursor-pointer"
              />
              <Input
                value={formData.primaryColor}
                onChange={(e) =>
                  setFormData({ ...formData, primaryColor: e.target.value })
                }
                className="flex-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Tenant'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
