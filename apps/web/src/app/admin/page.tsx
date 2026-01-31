// apps/web/src/app/admin/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DashboardStats {
  totalChains: number;
  activeChains: number;
  totalTokens: number;
  activeTokens: number;
  totalSwaps: number;
  volume24h: number;
  volume7d: number;
  totalVolume: number;
  pendingAds: number;
  activeAds: number;
  adRevenue: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/admin/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  const formatNumber = (n: number) => {
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return n.toLocaleString();
  };

  const formatCurrency = (n: number) => `$${formatNumber(n)}`;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-xl p-6 animate-pulse border border-gray-700">
              <div className="h-4 bg-gray-700 rounded w-1/2 mb-3"></div>
              <div className="h-8 bg-gray-700 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    { 
      label: 'Active Chains', 
      value: stats?.activeChains || 0, 
      subValue: `${stats?.totalChains || 0} total`, 
      href: '/admin/chains',
      bgClass: 'bg-gradient-to-br from-blue-900/40 to-blue-950/60 border-blue-800/50',
      iconBgClass: 'bg-blue-500/20 text-blue-400',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
    },
    { 
      label: 'Active Tokens', 
      value: stats?.activeTokens || 0, 
      subValue: `${stats?.totalTokens || 0} total`, 
      href: '/admin/tokens',
      bgClass: 'bg-gradient-to-br from-purple-900/40 to-purple-950/60 border-purple-800/50',
      iconBgClass: 'bg-purple-500/20 text-purple-400',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
    { 
      label: 'Total Swaps', 
      value: formatNumber(stats?.totalSwaps || 0), 
      subValue: 'All time',
      bgClass: 'bg-gradient-to-br from-green-900/40 to-green-950/60 border-green-800/50',
      iconBgClass: 'bg-green-500/20 text-green-400',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
    },
    { 
      label: '24h Volume', 
      value: formatCurrency(stats?.volume24h || 0), 
      subValue: 'Last 24 hours',
      bgClass: 'bg-gradient-to-br from-emerald-900/40 to-emerald-950/60 border-emerald-800/50',
      iconBgClass: 'bg-emerald-500/20 text-emerald-400',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
    },
    { 
      label: '7d Volume', 
      value: formatCurrency(stats?.volume7d || 0), 
      subValue: 'Last 7 days',
      bgClass: 'bg-gradient-to-br from-cyan-900/40 to-cyan-950/60 border-cyan-800/50',
      iconBgClass: 'bg-cyan-500/20 text-cyan-400',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
    },
    { 
      label: 'Total Volume', 
      value: formatCurrency(stats?.totalVolume || 0), 
      subValue: 'All time',
      bgClass: 'bg-gradient-to-br from-yellow-900/40 to-yellow-950/60 border-yellow-800/50',
      iconBgClass: 'bg-yellow-500/20 text-yellow-400',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
    },
    { 
      label: 'Pending Ads', 
      value: stats?.pendingAds || 0, 
      subValue: 'Awaiting review', 
      href: '/admin/ads/requests',
      bgClass: 'bg-gradient-to-br from-orange-900/40 to-orange-950/60 border-orange-800/50',
      iconBgClass: 'bg-orange-500/20 text-orange-400',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
    { 
      label: 'Ad Revenue', 
      value: formatCurrency(stats?.adRevenue || 0), 
      subValue: 'This month', 
      href: '/admin/ads',
      bgClass: 'bg-gradient-to-br from-pink-900/40 to-pink-950/60 border-pink-800/50',
      iconBgClass: 'bg-pink-500/20 text-pink-400',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
  ];

  const recentActivity = [
    { action: 'New ad request', detail: 'Banner slot - 7 days', time: '5 min ago', color: 'orange' },
    { action: 'Token added', detail: 'PEPE on Ethereum', time: '1 hour ago', color: 'purple' },
    { action: 'Chain updated', detail: 'Solana RPC changed', time: '2 hours ago', color: 'blue' },
    { action: 'Ad approved', detail: 'DeFi Protocol banner', time: '3 hours ago', color: 'green' },
  ];

  const getActivityIcon = (color: string) => {
    const icons: Record<string, JSX.Element> = {
      orange: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
      purple: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>,
      blue: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
      green: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
    };
    return icons[color] || icons.blue;
  };

  const getActivityBgClass = (color: string) => {
    const classes: Record<string, string> = {
      orange: 'bg-orange-500/20 text-orange-400',
      purple: 'bg-purple-500/20 text-purple-400',
      blue: 'bg-blue-500/20 text-blue-400',
      green: 'bg-green-500/20 text-green-400',
    };
    return classes[color] || classes.blue;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Welcome to OmniSwap Admin</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400 bg-gray-800 px-3 py-2 rounded-lg border border-gray-700">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Stats Grid - Colored backgrounds */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const content = (
            <div className={`rounded-xl p-5 border transition-all duration-200 ${card.bgClass} ${card.href ? 'cursor-pointer hover:scale-[1.02]' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-300 font-medium">{card.label}</span>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.iconBgClass}`}>
                  {card.icon}
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{card.value}</p>
              <p className="text-sm text-gray-400 mt-1">{card.subValue}</p>
            </div>
          );

          return card.href ? (
            <Link key={card.label} href={card.href}>{content}</Link>
          ) : (
            <div key={card.label}>{content}</div>
          );
        })}
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions - Keep original style */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/admin/chains/new"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Chain
            </Link>
            <Link
              href="/admin/tokens/new"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-colors font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Token
            </Link>
            <Link
              href="/admin/ads/requests"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl transition-colors font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Review Ads
            </Link>
            <Link
              href="/admin/settings"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-green-500/20 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            Recent Activity
          </h2>
          <div className="space-y-3">
            {recentActivity.map((item, i) => (
              <div 
                key={i} 
                className="flex items-center justify-between py-3 px-3 rounded-lg bg-gray-900/50 border border-gray-700/50"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getActivityBgClass(item.color)}`}>
                    {getActivityIcon(item.color)}
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">{item.action}</p>
                    <p className="text-xs text-gray-500">{item.detail}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-1 rounded">{item.time}</span>
              </div>
            ))}
          </div>
          <button className="mt-4 w-full flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white transition-colors py-2">
            View all activity
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          System Status
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'API', status: 'Operational', ok: true },
            { label: 'Database', status: 'Operational', ok: true },
            { label: 'Price Feeds', status: 'Operational', ok: true },
            { label: 'Bridge Services', status: 'Operational', ok: true },
          ].map((service) => (
            <div key={service.label} className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">{service.label}</span>
                <div className={`w-2 h-2 rounded-full ${service.ok ? 'bg-green-400' : 'bg-yellow-400'} animate-pulse`}></div>
              </div>
              <span className={`text-sm font-medium ${service.ok ? 'text-green-400' : 'text-yellow-400'}`}>
                {service.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
