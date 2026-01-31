// apps/web/src/components/swap/components/AdSlot.tsx

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, ExternalLink } from 'lucide-react';

interface Ad {
  id: string;
  imageUrl: string;
  targetUrl: string;
  title: string;
  description?: string;
  sponsor: string;
}

interface AdSlotProps {
  position: 'swap-header' | 'swap-footer' | 'sidebar';
  chainId?: number;
  className?: string;
}

// Mock ads - in production, fetch from your ad server
const MOCK_ADS: Ad[] = [
  {
    id: '1',
    imageUrl: '/ads/placeholder-banner.png',
    targetUrl: 'https://example.com',
    title: 'Trade with zero fees',
    description: 'Limited time offer',
    sponsor: 'Partner DEX',
  },
];

export const AdSlot: React.FC<AdSlotProps> = ({
  position,
  chainId,
  className = '',
}) => {
  const [ad, setAd] = useState<Ad | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    // In production, fetch ads from your ad server based on position and chainId
    // For now, use mock data
    const fetchAd = async () => {
      try {
        // Simulated API call
        // const response = await fetch(`/api/ads?position=${position}&chainId=${chainId}`);
        // const data = await response.json();
        // setAd(data);
        
        // Using mock for now
        if (MOCK_ADS.length > 0) {
          setAd(MOCK_ADS[0]);
        }
      } catch (error) {
        console.error('Failed to fetch ad:', error);
      }
    };

    fetchAd();
  }, [position, chainId]);

  // Don't render if dismissed or no ad
  if (isDismissed || !ad) return null;

  // Don't render if image failed to load and no fallback
  if (imageError) return null;

  const handleClick = () => {
    // Track ad click
    console.log('Ad clicked:', ad.id);
    window.open(ad.targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
    // Track dismissal
    console.log('Ad dismissed:', ad.id);
  };

  if (position === 'swap-footer') {
    return (
      <div className={`border-t border-gray-800 ${className}`}>
        <div 
          onClick={handleClick}
          className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-800/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">AD</span>
            </div>
            <div>
              <p className="text-sm text-white">{ad.title}</p>
              <p className="text-xs text-gray-500">Sponsored by {ad.sponsor}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-gray-500" />
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
            >
              <X className="w-3 h-3 text-gray-500" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default banner style
  return (
    <div className={`relative ${className}`}>
      <div 
        onClick={handleClick}
        className="relative overflow-hidden rounded-xl cursor-pointer group"
      >
        {!imageError ? (
          <div className="relative w-full h-16 bg-gradient-to-r from-blue-500/20 to-purple-500/20 flex items-center justify-center">
            <p className="text-sm text-gray-400">{ad.title}</p>
          </div>
        ) : null}
        
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute top-1 right-1 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-3 h-3 text-white" />
        </button>
        
        {/* Sponsored label */}
        <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/50 rounded text-[10px] text-gray-400">
          Ad
        </div>
      </div>
    </div>
  );
};

export default AdSlot;
