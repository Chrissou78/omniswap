// apps/admin/src/components/dashboard/RecentSwaps.tsx
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import {
  CheckCircle,
  XCircle,
  Loader2,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

export const RecentSwaps: React.FC = () => {
  const { data: swaps, isLoading } = useQuery({
    queryKey: ['recent-swaps'],
    queryFn: () =>
      adminApi.get('/api/admin/swaps/recent?limit=10').then((r) => r.data),
    refetchInterval: 10000, // Refresh every 10s
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'FAILED':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'PENDING':
      case 'PROCESSING':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      COMPLETED: 'bg-green-500/10 text-green-500',
      FAILED: 'bg-red-500/10 text-red-500',
      PENDING: 'bg-yellow-500/10 text-yellow-500',
      PROCESSING: 'bg-blue-500/10 text-blue-500',
    };
    return variants[status] || 'bg-gray-500/10 text-gray-500';
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Swaps</CardTitle>
        <Link href="/admin/swaps">
          <Button variant="ghost" size="sm">
            View all
            <ExternalLink className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : swaps?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No recent swaps
            </div>
          ) : (
            swaps?.map((swap: any) => (
              <Link
                key={swap.id}
                href={`/admin/swaps/${swap.id}`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
              >
                {/* Status */}
                {getStatusIcon(swap.status)}

                {/* Swap Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 text-sm">
                    <span>{getChainIcon(swap.fromChainId)}</span>
                    <span className="font-medium">{swap.fromToken}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <span>{getChainIcon(swap.toChainId)}</span>
                    <span className="font-medium">{swap.toToken}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(swap.createdAt), {
                      addSuffix: true,
                    })}
                  </div>
                </div>

                {/* Amount */}
                <div className="text-right">
                  <div className="text-sm font-medium">
                    ${swap.volumeUsd?.toLocaleString() || '0'}
                  </div>
                  <Badge className={`text-xs ${getStatusBadge(swap.status)}`}>
                    {swap.status}
                  </Badge>
                </div>
              </Link>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
