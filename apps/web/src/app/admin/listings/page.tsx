// apps/web/src/app/admin/listings/page.tsx
'use client';

import { useState, useEffect } from 'react';

interface TokenListing {
  id: string;
  email: string;
  telegramHandle?: string | null;
  projectRole?: string | null;
  chainId: number;
  contractAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string | null;
  description?: string | null;
  websiteUrl?: string | null;
  twitterUrl?: string | null;
  telegramUrl?: string | null;
  isAudited: boolean;
  auditUrl?: string | null;
  listingFee: number;
  status: string;
  paymentStatus: string;
  paymentTxHash?: string | null;
  paymentChainId?: string | null;
  rejectedReason?: string | null;
  adminNotes?: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_PAYMENT: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  PENDING_REVIEW: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  UNDER_REVIEW: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  APPROVED: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
  LISTED: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  REJECTED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  CANCELLED: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400',
  REFUNDED: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
};

export default function AdminListingsPage() {
  const [listings, setListings] = useState<TokenListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<TokenListing | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    loadListings();
  }, []);

  async function loadListings() {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/listings');
      if (!res.ok) throw new Error('Failed to fetch listings');
      const rows = await res.json();
      setListings(Array.isArray(rows) ? rows : []);
      setError('');
    } catch (err) {
      console.error('Failed to load listings:', err);
      setError('Could not load token listing requests.');
    } finally {
      setIsLoading(false);
    }
  }

  async function updateStatus(id: string, status: string, reason?: string) {
    setProcessingId(id);
    setError('');
    try {
      const res = await fetch(`/api/admin/listings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, rejectionReason: reason }),
      });
      if (!res.ok) throw new Error('Update failed');
      const updated = await res.json();
      setListings((prev) => prev.map((l) => (l.id === id ? { ...l, ...updated } : l)));
      setRejectTarget(null);
      setRejectionReason('');
    } catch (err) {
      console.error('Failed to update listing:', err);
      setError('Failed to update this listing. Please try again.');
    } finally {
      setProcessingId(null);
    }
  }

  const filtered = listings.filter(
    (l) => statusFilter === 'all' || l.status === statusFilter
  );

  const stats = {
    total: listings.length,
    pending: listings.filter((l) => l.status === 'PENDING_REVIEW').length,
    listed: listings.filter((l) => l.status === 'LISTED').length,
    revenue: listings
      .filter((l) => l.paymentStatus === 'PAID')
      .reduce((sum, l) => sum + (l.listingFee ?? 0), 0),
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Token Listings</h1>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Token Listings</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
        >
          <option value="all">All Status</option>
          <option value="PENDING_PAYMENT">Pending Payment</option>
          <option value="PENDING_REVIEW">Pending Review</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="APPROVED">Approved</option>
          <option value="LISTED">Listed</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Requests', value: stats.total },
          { label: 'Pending Review', value: stats.pending },
          { label: 'Listed', value: stats.listed },
          { label: 'Revenue (paid)', value: `$${stats.revenue.toLocaleString()}` },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
          >
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            No listing requests
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Token listing submissions will appear here for review.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((listing) => (
            <div
              key={listing.id}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {listing.name} ({listing.symbol})
                  </h3>
                  <p className="text-xs text-gray-500 font-mono break-all">
                    chain {listing.chainId} &middot; {listing.contractAddress}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">{listing.email}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`px-3 py-1 text-xs font-medium rounded-full ${
                      STATUS_COLORS[listing.status] ?? STATUS_COLORS.CANCELLED
                    }`}
                  >
                    {listing.status}
                  </span>
                  <span
                    className={`text-xs ${
                      listing.paymentStatus === 'PAID' ? 'text-green-600' : 'text-gray-500'
                    }`}
                  >
                    ${listing.listingFee} &middot; {listing.paymentStatus}
                  </span>
                </div>
              </div>

              {listing.description && (
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{listing.description}</p>
              )}

              <div className="flex flex-wrap gap-3 text-xs mb-4">
                {listing.websiteUrl && (
                  <a href={listing.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Website
                  </a>
                )}
                {listing.twitterUrl && (
                  <a href={listing.twitterUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Twitter
                  </a>
                )}
                {listing.telegramUrl && (
                  <a href={listing.telegramUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Telegram
                  </a>
                )}
                {listing.isAudited && listing.auditUrl && (
                  <a href={listing.auditUrl} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                    Audit
                  </a>
                )}
                {listing.paymentTxHash && (
                  <span className="text-gray-400 font-mono truncate max-w-[220px]">
                    tx: {listing.paymentTxHash}
                  </span>
                )}
              </div>

              {listing.rejectedReason && (
                <p className="text-xs text-red-600 dark:text-red-400 mb-3">
                  Rejected: {listing.rejectedReason}
                </p>
              )}

              <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 flex-wrap">
                <button
                  onClick={() => updateStatus(listing.id, 'LISTED')}
                  disabled={listing.paymentStatus !== 'PAID' || processingId === listing.id}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
                >
                  Mark Listed
                </button>
                <button
                  onClick={() => updateStatus(listing.id, 'UNDER_REVIEW')}
                  disabled={processingId === listing.id}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm transition-colors"
                >
                  Under Review
                </button>
                <button
                  onClick={() => setRejectTarget(listing)}
                  disabled={processingId === listing.id}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg text-sm transition-colors"
                >
                  Reject
                </button>
                {listing.paymentStatus !== 'PAID' && (
                  <span className="text-xs text-gray-500">
                    Cannot list until payment is verified
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Reject {rejectTarget.symbol}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              This reason is stored on the request so the submitter can be told why.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              placeholder="Reason for rejection..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setRejectTarget(null);
                  setRejectionReason('');
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => updateStatus(rejectTarget.id, 'REJECTED', rejectionReason)}
                disabled={!rejectionReason.trim() || processingId === rejectTarget.id}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg text-sm"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
