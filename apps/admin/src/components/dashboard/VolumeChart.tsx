// apps/admin/src/components/dashboard/VolumeChart.tsx
'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';

export const VolumeChart: React.FC = () => {
  const [timeframe, setTimeframe] = React.useState('7d');
  const [groupBy, setGroupBy] = React.useState<'chain' | 'type'>('chain');

  const { data: volumeData, isLoading } = useQuery({
    queryKey: ['volume-chart', timeframe],
    queryFn: () =>
      adminApi
        .get(`/api/admin/analytics/volume?timeframe=${timeframe}`)
        .then((r) => r.data),
  });

  const chartData = useMemo(() => {
    if (!volumeData) return [];
    return volumeData.map((item: any) => ({
      date: new Date(item.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      ethereum: item.ethereum || 0,
      polygon: item.polygon || 0,
      arbitrum: item.arbitrum || 0,
      solana: item.solana || 0,
      sui: item.sui || 0,
      crossChain: item.crossChain || 0,
      cex: item.cex || 0,
      total: item.total || 0,
    }));
  }, [volumeData]);

  const formatYAxis = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Trading Volume</CardTitle>
        <div className="flex gap-2">
          <Tabs value={timeframe} onValueChange={setTimeframe}>
            <TabsList>
              <TabsTrigger value="24h">24h</TabsTrigger>
              <TabsTrigger value="7d">7d</TabsTrigger>
              <TabsTrigger value="30d">30d</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorEthereum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#627EEA" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#627EEA" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorPolygon" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8247E5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8247E5" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorArbitrum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#28A0F0" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#28A0F0" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorSolana" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14F195" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#14F195" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorSui" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4DA2FF" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4DA2FF" stopOpacity={0} />
                </linearGradient>
              </defs>
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
              <Area
                type="monotone"
                dataKey="ethereum"
                stackId="1"
                stroke="#627EEA"
                fill="url(#colorEthereum)"
                name="Ethereum"
              />
              <Area
                type="monotone"
                dataKey="polygon"
                stackId="1"
                stroke="#8247E5"
                fill="url(#colorPolygon)"
                name="Polygon"
              />
              <Area
                type="monotone"
                dataKey="arbitrum"
                stackId="1"
                stroke="#28A0F0"
                fill="url(#colorArbitrum)"
                name="Arbitrum"
              />
              <Area
                type="monotone"
                dataKey="solana"
                stackId="1"
                stroke="#14F195"
                fill="url(#colorSolana)"
                name="Solana"
              />
              <Area
                type="monotone"
                dataKey="sui"
                stackId="1"
                stroke="#4DA2FF"
                fill="url(#colorSui)"
                name="Sui"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
