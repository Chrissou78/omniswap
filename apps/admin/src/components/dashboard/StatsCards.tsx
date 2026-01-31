// apps/admin/src/components/dashboard/StatsCards.tsx
'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import {
  DollarSign,
  ArrowLeftRight,
  Users,
  TrendingUp,
  TrendingDown,
  Building2,
} from 'lucide-react';

interface Stat {
  label: string;
  value: string;
  change: number;
  changeLabel: string;
  icon: React.ReactNode;
  color: string;
}

export const StatsCards: React.FC = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => adminApi.get('/api/admin/stats').then((r) => r.data),
    refetchInterval: 30000, // Refresh every 30s
  });

  const cards: Stat[] = [
    {
      label: 'Total Volume (24h)',
      value: `$${(stats?.volume24h || 0).toLocaleString()}`,
      change: stats?.volumeChange || 0,
      changeLabel: 'vs yesterday',
      icon: <DollarSign className="w-6 h-6" />,
      color: 'bg-blue-500/10 text-blue-500',
    },
    {
      label: 'Total Swaps (24h)',
      value: (stats?.swaps24h || 0).toLocaleString(),
      change: stats?.swapsChange || 0,
      changeLabel: 'vs yesterday',
      icon: <ArrowLeftRight className="w-6 h-6" />,
      color: 'bg-green-500/10 text-green-500',
    },
    {
      label: 'Revenue (24h)',
      value: `$${(stats?.revenue24h || 0).toLocaleString()}`,
      change: stats?.revenueChange || 0,
      changeLabel: 'vs yesterday',
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'bg-purple-500/10 text-purple-500',
    },
    {
      label: 'Active Users (24h)',
      value: (stats?.activeUsers24h || 0).toLocaleString(),
      change: stats?.usersChange || 0,
      changeLabel: 'vs yesterday',
      icon: <Users className="w-6 h-6" />,
      color: 'bg-orange-500/10 text-orange-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
                <div className="flex items-center gap-1 mt-2">
                  {stat.change >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                  <span
                    className={`text-sm ${
                      stat.change >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}
                  >
                    {stat.change >= 0 ? '+' : ''}
                    {stat.change.toFixed(1)}%
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {stat.changeLabel}
                  </span>
                </div>
              </div>
              <div className={`p-3 rounded-lg ${stat.color}`}>{stat.icon}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
