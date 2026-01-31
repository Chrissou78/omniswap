// apps/admin/src/components/dashboard/RevenueChart.tsx
'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';

export const RevenueChart: React.FC = () => {
  const [timeframe, setTimeframe] = React.useState('7d');

  const { data: revenueData, isLoading } = useQuery({
    queryKey: ['revenue-chart', timeframe],
    queryFn: () =>
      adminApi
        .get(`/api/admin/analytics/revenue?timeframe=${timeframe}`)
        .then((r) => r.data),
  });

  const chartData = useMemo(() => {
    if (!revenueData) return [];
    return revenueData.map((item: any) => ({
      date: new Date(item.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      onChain: item.onChainFees || 0,
      crossChain: item.crossChainFees || 0,
      cex: item.cexFees || 0,
      total: (item.onChainFees || 0) + (item.crossChainFees || 0) + (item.cexFees || 0),
    }));
  }, [revenueData]);

  const totalRevenue = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.total, 0);
  }, [chartData]);

  const formatYAxis = (value: number) => {
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value}`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Revenue</CardTitle>
          <p className="text-2xl font-bold text-green-500 mt-1">
            ${totalRevenue.toLocaleString()}
          </p>
        </div>
        <Tabs value={timeframe} onValueChange={setTimeframe}>
          <TabsList>
            <TabsTrigger value="24h">24h</TabsTrigger>
            <TabsTrigger value="7d">7d</TabsTrigger>
            <TabsTrigger value="30d">30d</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#888" fontSize={12} />
              <YAxis stroke="#888" fontSize={12} tickFormatter={formatYAxis} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
              />
              <Legend />
              <Bar
                dataKey="onChain"
                stackId="a"
                fill="#22c55e"
                name="On-Chain (0.4%)"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="crossChain"
                stackId="a"
                fill="#3b82f6"
                name="Cross-Chain (0.5%)"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="cex"
                stackId="a"
                fill="#f59e0b"
                name="CEX (1%)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Fee Breakdown */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-sm text-muted-foreground">On-Chain</div>
            <div className="text-lg font-bold text-green-500">
              ${chartData.reduce((sum, d) => sum + d.onChain, 0).toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">0.4% fee</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Cross-Chain</div>
            <div className="text-lg font-bold text-blue-500">
              ${chartData.reduce((sum, d) => sum + d.crossChain, 0).toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">0.5% fee</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">CEX</div>
            <div className="text-lg font-bold text-orange-500">
              ${chartData.reduce((sum, d) => sum + d.cex, 0).toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">1% fee</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
