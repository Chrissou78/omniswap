'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface AdStats {
  totalSlots: number;
  activeSlots: number;
  pendingRequests: number;
  activeBookings: number;
  completedBookings: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalImpressions: number;
  totalClicks: number;
}

export default function AdsPage() {
  const [stats, setStats] = useState<AdStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        // In production, fetch from API
        await new Promise((r) => setTimeout(r, 500));
        setStats({
          totalSlots: 5,
          activeSlots: 4,
          pendingRequests: 3,
          activeBookings: 8,
          completedBookings: 45,
          totalRevenue: 125000,
          monthlyRevenue: 12500,
          totalImpressions: 2500000,
          totalClicks: 62500,
        });
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadStats();
  }, []);

  const formatNumber = (n: number) => {
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return n.toString();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Advertising</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    { label: 'Total Slots', value: stats.totalSlots, color: 'blue' },
    { label: 'Active Slots', value: stats.activeSlots, color: 'green' },
    { label: 'Pending Requests', value: stats.pendingRequests, color: 'yellow', href: '/admin/ads/requests' },
    { label: 'Active Bookings', value: stats.activeBookings, color: 'purple', href: '/admin/ads/bookings' },
    { label: 'Total Revenue', value: `$${formatNumber(stats.totalRevenue)}`, color: 'emerald' },
    { label: 'Monthly Revenue', value: `$${formatNumber(stats.monthlyRevenue)}`, color: 'cyan' },
    { label: 'Total Impressions', value: formatNumber(stats.totalImpressions), color: 'indigo' },
    { label: 'Avg CTR', value: `${((stats.totalClicks / stats.totalImpressions) * 100).toFixed(2)}%`, color: 'pink' },
  ];

  const colorClasses: Record<string, string> = {
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    purple: 'text-purple-600 dark:text-purple-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    cyan: 'text-cyan-600 dark:text-cyan-400',
    indigo: 'text-indigo-600 dark:text-indigo-400',
    pink: 'text-pink-600 dark:text-pink-400',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Advertising</h1>
        <div className="flex gap-2">
          {stats.pendingRequests > 0 && (
            <Link
              href="/admin/ads/requests"
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              {stats.pendingRequests} Pending
            </Link>
          )}
          <Link
            href="/admin/ads/slots"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Manage Slots
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const content = (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
              <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
              <p className={`text-2xl font-bold mt-1 ${colorClasses[card.color]}`}>{card.value}</p>
            </div>
          );
          return card.href ? (
            <Link key={card.label} href={card.href}>{content}</Link>
          ) : (
            <div key={card.label}>{content}</div>
          );
        })}
      </div>

      {/* Quick Links */}
      <div className="grid md:grid-cols-3 gap-6">
        <Link
          href="/admin/ads/requests"
          className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:border-yellow-500 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Review Requests</h3>
              <p className="text-sm text-gray-500">{stats.pendingRequests} pending approval</p>
            </div>
          </div>
        </Link>

        <Link
          href="/admin/ads/bookings"
          className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:border-purple-500 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">All Bookings</h3>
              <p className="text-sm text-gray-500">{stats.activeBookings} active campaigns</p>
            </div>
          </div>
        </Link>

        <Link
          href="/admin/ads/slots"
          className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:border-blue-500 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Ad Slots</h3>
              <p className="text-sm text-gray-500">{stats.activeSlots} active slots</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
