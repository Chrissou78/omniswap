// apps/web/src/app/admin/ads/bookings/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED';

interface AdBooking {
  id: string;
  advertiserName: string;
  slotName: string;
  imageUrl: string;
  targetUrl: string;
  startDate: string;
  endDate: string;
  totalPriceUsd: number;
  paymentStatus: string;
  status: BookingStatus;
  impressions: number;
  clicks: number;
  createdAt: string;
}

/** Map the real AdBooking API row onto this page's view model. */
function toViewModel(row: any): AdBooking {
  return {
    id: row.id,
    advertiserName: row.companyName || row.contactName || row.email || 'Unknown',
    slotName: row.slot?.name ?? 'Unknown slot',
    imageUrl: row.imageUrl ?? '',
    targetUrl: row.targetUrl ?? '',
    startDate: row.startDate,
    endDate: row.endDate,
    totalPriceUsd: row.finalPrice ?? 0,
    paymentStatus: row.paymentStatus ?? 'UNPAID',
    status: row.status,
    impressions: row.impressions ?? 0,
    clicks: row.clicks ?? 0,
    createdAt: row.createdAt,
  };
}

export default function AdBookingsPage() {
  const [bookings, setBookings] = useState<AdBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      const res = await fetch('/api/admin/ads/bookings');
      if (!res.ok) throw new Error('Failed to fetch bookings');
      const rows = await res.json();
      setBookings(Array.isArray(rows) ? rows.map(toViewModel) : []);
    } catch (error) {
      console.error('Failed to load bookings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    PENDING_PAYMENT: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
    PENDING_APPROVAL: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    APPROVED: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    ACTIVE: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    COMPLETED: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400',
    REJECTED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    CANCELLED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    REFUNDED: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  };

  const filteredBookings = bookings.filter((booking) => {
    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
    const matchesSearch = 
      booking.advertiserName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.slotName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const stats = {
    total: bookings.length,
    active: bookings.filter((b) => b.status === 'ACTIVE').length,
    revenue: bookings
      .filter((b) => b.paymentStatus === 'PAID')
      .reduce((sum, b) => sum + b.totalPriceUsd, 0),
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/ads" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ad Bookings</h1>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 animate-pulse h-96"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/ads" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ad Bookings</h1>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500">Total Bookings</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500">Active Now</p>
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500">Platform Revenue</p>
          <p className="text-2xl font-bold text-emerald-600">${stats.revenue.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search advertiser or slot..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="PENDING_PAYMENT">Pending Payment</option>
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="APPROVED">Approved</option>
          <option value="ACTIVE">Active</option>
          <option value="COMPLETED">Completed</option>
          <option value="REJECTED">Rejected</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="REFUNDED">Refunded</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Advertiser</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slot</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Performance</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredBookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="px-4 py-4">
                    <p className="font-medium text-gray-900 dark:text-white">{booking.advertiserName}</p>
                    <a href={booking.targetUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate block max-w-[200px]">
                      {booking.targetUrl}
                    </a>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">{booking.slotName}</td>
                  <td className="px-4 py-4">
                    <p className="text-sm text-gray-900 dark:text-white">
                      {new Date(booking.startDate).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      to {new Date(booking.endDate).toLocaleDateString()}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">${booking.totalPriceUsd}</p>
                    <p
                      className={`text-xs ${
                        booking.paymentStatus === 'PAID' ? 'text-green-600' : 'text-gray-500'
                      }`}
                    >
                      {booking.paymentStatus}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-sm text-gray-900 dark:text-white">{booking.impressions.toLocaleString()} views</p>
                    <p className="text-xs text-gray-500">
                      {booking.clicks.toLocaleString()} clicks ({booking.impressions > 0 ? ((booking.clicks / booking.impressions) * 100).toFixed(2) : 0}%)
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[booking.status]}`}>
                      {booking.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredBookings.length === 0 && (
          <div className="p-8 text-center text-gray-500">No bookings found</div>
        )}
      </div>
    </div>
  );
}
