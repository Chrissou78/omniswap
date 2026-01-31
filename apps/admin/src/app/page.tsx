// apps/admin/src/app/page.tsx
import { Suspense } from 'react';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { VolumeChart } from '@/components/dashboard/VolumeChart';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { RecentSwaps } from '@/components/dashboard/RecentSwaps';
import { TopTokens } from '@/components/dashboard/TopTokens';
import { TopTenants } from '@/components/dashboard/TopTenants';
import { SystemHealth } from '@/components/dashboard/SystemHealth';
import { Skeleton } from '@/components/ui/Skeleton';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening with OmniSwap.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select className="border rounded-lg px-3 py-2 text-sm bg-background">
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <Suspense fallback={<StatsCardsSkeleton />}>
        <StatsCards />
      </Suspense>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Suspense fallback={<ChartSkeleton />}>
          <VolumeChart />
        </Suspense>
        <Suspense fallback={<ChartSkeleton />}>
          <RevenueChart />
        </Suspense>
      </div>

      {/* Data Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Suspense fallback={<TableSkeleton />}>
          <RecentSwaps />
        </Suspense>
        <Suspense fallback={<TableSkeleton />}>
          <TopTokens />
        </Suspense>
        <Suspense fallback={<TableSkeleton />}>
          <TopTenants />
        </Suspense>
      </div>

      {/* System Health */}
      <Suspense fallback={<Skeleton className="h-32" />}>
        <SystemHealth />
      </Suspense>
    </div>
  );
}

function StatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-32" />
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return <Skeleton className="h-80" />;
}

function TableSkeleton() {
  return <Skeleton className="h-96" />;
}
