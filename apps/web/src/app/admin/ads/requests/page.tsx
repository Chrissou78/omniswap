// apps/web/src/app/admin/ads/requests/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface AdRequest {
  id: string;
  advertiser: {
    walletAddress: string;
    companyName?: string;
    email?: string;
  };
  slot: {
    name: string;
    width: number;
    height: number;
  };
  imageUrl: string;
  targetUrl: string;
  altText: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  totalPriceUsd: number;
  platformFeeUsd: number;
  paymentStatus: 'PENDING' | 'CONFIRMED';
  paymentTxHash?: string;
  createdAt: string;
}

export default function AdRequestsPage() {
  const [requests, setRequests] = useState<AdRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<AdRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      // In production, fetch from API: GET /api/admin/ads/requests
      await new Promise((r) => setTimeout(r, 500));
      setRequests([
        {
          id: '1',
          advertiser: { walletAddress: '0x1234...5678', companyName: 'DeFi Protocol', email: 'ads@defi.com' },
          slot: { name: 'Header Banner', width: 728, height: 90 },
          imageUrl: 'https://placehold.co/728x90/1a1a2e/ffffff?text=DeFi+Protocol',
          targetUrl: 'https://defiprotocol.com',
          altText: 'DeFi Protocol - Earn 10% APY',
          startDate: '2026-01-25',
          endDate: '2026-02-01',
          totalDays: 7,
          totalPriceUsd: 350,
          platformFeeUsd: 175,
          paymentStatus: 'CONFIRMED',
          paymentTxHash: '0xabc123def456...',
          createdAt: '2026-01-22T10:30:00Z',
        },
        {
          id: '2',
          advertiser: { walletAddress: '0x9876...4321', companyName: 'NFT Market' },
          slot: { name: 'Sidebar', width: 300, height: 250 },
          imageUrl: 'https://placehold.co/300x250/2d1b69/ffffff?text=NFT+Market',
          targetUrl: 'https://nftmarket.io',
          altText: 'Trade NFTs',
          startDate: '2026-01-26',
          endDate: '2026-02-02',
          totalDays: 7,
          totalPriceUsd: 210,
          platformFeeUsd: 105,
          paymentStatus: 'PENDING',
          createdAt: '2026-01-22T14:15:00Z',
        },
      ]);
    } catch (error) {
      console.error('Failed to load requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      // In production: POST /api/admin/ads/requests/{id}/approve
      await new Promise((r) => setTimeout(r, 1000));
      setRequests(requests.filter((r) => r.id !== requestId));
    } catch (error) {
      console.error('Failed to approve:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !rejectionReason.trim()) return;
    setProcessingId(selectedRequest.id);
    try {
      // In production: POST /api/admin/ads/requests/{id}/reject
      await new Promise((r) => setTimeout(r, 1000));
      setRequests(requests.filter((r) => r.id !== selectedRequest.id));
      setShowRejectModal(false);
      setSelectedRequest(null);
      setRejectionReason('');
    } catch (error) {
      console.error('Failed to reject:', error);
    } finally {
      setProcessingId(null);
    }
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ad Requests</h1>
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 animate-pulse h-48"></div>
          ))}
        </div>
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ad Requests</h1>
          {requests.length > 0 && (
            <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-sm font-medium">
              {requests.length} pending
            </span>
          )}
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">All caught up!</h3>
          <p className="text-gray-500 mt-1">No pending ad requests to review</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Ad Preview */}
                  <div className="lg:w-1/3">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Preview</p>
                    <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 flex items-center justify-center">
                      <img
                        src={request.imageUrl}
                        alt={request.altText}
                        className="max-w-full h-auto rounded"
                        style={{ maxHeight: '180px' }}
                      />
                    </div>
                    <a
                      href={request.targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-2 block truncate"
                    >
                      {request.targetUrl}
                    </a>
                  </div>

                  {/* Details */}
                  <div className="lg:w-2/3">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {request.advertiser.companyName || 'Unknown Advertiser'}
                        </h3>
                        <p className="text-sm text-gray-500 font-mono">{request.advertiser.walletAddress}</p>
                        {request.advertiser.email && (
                          <p className="text-sm text-gray-500">{request.advertiser.email}</p>
                        )}
                      </div>
                      <span
                        className={`px-3 py-1 text-xs font-medium rounded-full ${
                          request.paymentStatus === 'CONFIRMED'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                        }`}
                      >
                        Payment: {request.paymentStatus}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500">Slot</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{request.slot.name}</p>
                        <p className="text-xs text-gray-400">{request.slot.width}x{request.slot.height}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Duration</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{request.totalDays} days</p>
                        <p className="text-xs text-gray-400">{request.startDate}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">${request.totalPriceUsd}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Platform Fee</p>
                        <p className="text-sm font-medium text-green-600">${request.platformFeeUsd}</p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-xs text-gray-500">Alt Text</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{request.altText}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => handleApprove(request.id)}
                        disabled={request.paymentStatus !== 'CONFIRMED' || processingId === request.id}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
                      >
                        {processingId === request.id ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setSelectedRequest(request);
                          setShowRejectModal(true);
                        }}
                        disabled={processingId === request.id}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Reject
                      </button>
                      {request.paymentTxHash && (
                        <a
                          href={`https://etherscan.io/tx/${request.paymentTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors text-sm"
                        >
                          View Payment
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Reject Ad Request</h3>
            <p className="text-sm text-gray-500 mb-4">
              Provide a reason for rejection. This will be sent to the advertiser.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedRequest(null);
                  setRejectionReason('');
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim() || processingId !== null}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
