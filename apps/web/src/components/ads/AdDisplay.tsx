'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Ad {
  id: string;
  imageUrl: string;
  targetUrl: string;
  altText?: string;
  companyName?: string;
}

interface AdDisplayProps {
  slotId: string;
  position: 'header' | 'sidebar' | 'swap' | 'footer';
  dimensions: { width: number; height: number };
  className?: string;
  fallbackSize?: 'small' | 'medium' | 'large';
}

export function AdDisplay({ 
  slotId, 
  position, 
  dimensions, 
  className = '',
  fallbackSize = 'medium' 
}: AdDisplayProps) {
  const [ad, setAd] = useState<Ad | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    async function fetchAd() {
      try {
        const res = await fetch(`/api/ads/active?slotId=${slotId}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.imageUrl) {
            setAd(data);
          }
        }
      } catch (err) {
        console.error('Failed to fetch ad:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchAd();
  }, [slotId]);

  // Track impression
  useEffect(() => {
    if (ad) {
      fetch(`/api/ads/impression`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: ad.id }),
      }).catch(() => {});
    }
  }, [ad]);

  // Track click
  const handleClick = () => {
    if (ad) {
      fetch(`/api/ads/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: ad.id }),
      }).catch(() => {});
    }
  };

  const sizeClasses = {
    small: 'min-h-[100px]',
    medium: 'min-h-[250px]',
    large: 'min-h-[400px]',
  };

  // Show placeholder if no active ad
  if (loading || error || !ad || imageError) {
    return (
      <div className={`ad-display ad-${position} ${className}`}>
        <div
          className={`bg-gray-100 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700/50 rounded-xl p-4 h-full flex flex-col items-center justify-center ${sizeClasses[fallbackSize]}`}
          style={{ width: dimensions.width, maxWidth: '100%' }}
        >
          <div className="text-center">
            <div className="text-gray-400 dark:text-gray-500 text-xs mb-2 uppercase tracking-wider">
              Advertisement
            </div>
            <div className="w-full bg-gradient-to-br from-gray-200 dark:from-gray-800/50 to-gray-300 dark:to-gray-900/50 rounded-lg flex items-center justify-center p-6">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-gray-300 dark:bg-gray-700/50 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-gray-400 dark:text-gray-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <span className="text-gray-400 dark:text-gray-500 text-sm">Your Ad Here</span>
                <Link 
                  href="/ads/order" 
                  className="block text-blue-500 hover:text-blue-400 text-xs mt-1"
                >
                  Advertise with us →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show active ad
  return (
    <div className={`ad-display ad-${position} ${className}`}>
      <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700/50">
        <div className="absolute top-1 right-1 z-10">
          <span className="text-[10px] text-gray-400 bg-black/50 px-1.5 py-0.5 rounded">
            Ad
          </span>
        </div>
        <a
          href={ad.targetUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={handleClick}
          className="block"
        >
          <img
            src={ad.imageUrl}
            alt={ad.altText || 'Advertisement'}
            width={dimensions.width}
            height={dimensions.height}
            className="w-full h-auto object-cover hover:opacity-90 transition-opacity"
            onError={() => setImageError(true)}
          />
        </a>
      </div>
    </div>
  );
}
