'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface AdSlotProps {
  position: 'header' | 'sidebar' | 'swap' | 'footer';
  slotId: string;
  dimensions: string; // "728x90" format
}

interface ActiveAd {
  id: string;
  imageUrl: string;
  targetUrl: string;
  altText: string;
}

export default function AdSlot({ position, slotId, dimensions }: AdSlotProps) {
  const [ad, setAd] = useState<ActiveAd | null>(null);
  const [loading, setLoading] = useState(true);

  // Parse dimensions
  const [width, height] = dimensions.split('x').map(Number);

  useEffect(() => {
    async function fetchActiveAd() {
      try {
        const res = await fetch(`/api/ads/active?slotId=${slotId}`);
        if (res.ok) {
          const data = await res.json();
          setAd(data);
          
          // Track impression
          if (data?.id) {
            fetch('/api/ads/impression', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bookingId: data.id }),
            }).catch(() => {});
          }
        }
      } catch (error) {
        console.error('Failed to fetch ad:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchActiveAd();
  }, [slotId]);

  const handleClick = () => {
    if (ad?.id) {
      fetch('/api/ads/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: ad.id }),
      }).catch(() => {});
    }
  };

  const positionLabels: Record<string, string> = {
    header: 'Header Banner',
    sidebar: 'Sidebar',
    swap: 'Swap Widget',
    footer: 'Footer Banner',
  };

  const positionColors: Record<string, string> = {
    header: 'from-purple-500/20 to-blue-500/20 border-purple-500/30',
    sidebar: 'from-green-500/20 to-teal-500/20 border-green-500/30',
    swap: 'from-orange-500/20 to-yellow-500/20 border-orange-500/30',
    footer: 'from-pink-500/20 to-red-500/20 border-pink-500/30',
  };

  // Show placeholder when no ad
  if (!loading && !ad) {
    return (
      <Link href="/ads/order" className="block">
        <div 
          className={`
            relative overflow-hidden rounded-lg border-2 border-dashed
            bg-gradient-to-br ${positionColors[position]}
            hover:scale-[1.02] transition-transform cursor-pointer
            flex flex-col items-center justify-center gap-2
          `}
          style={{ width, height }}
        >
          {/* Corner Label */}
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/50 rounded text-[10px] text-gray-400 uppercase tracking-wider">
            {positionLabels[position]}
          </div>
          
          {/* Size indicator */}
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/50 rounded text-[10px] text-gray-500">
            {dimensions}
          </div>

          {/* Main content */}
          <div className="text-center">
            <div className="text-2xl mb-1">📢</div>
            <div className="text-sm font-medium text-white/80">
              Advertise Here
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Click to book this space
            </div>
          </div>

          {/* Animated border */}
          <div className="absolute inset-0 rounded-lg animate-pulse opacity-30 border border-white/20" />
        </div>
      </Link>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div 
        className="bg-gray-800/50 rounded-lg animate-pulse"
        style={{ width, height }}
      />
    );
  }

  // Active ad
  return (
    <a 
      href={ad!.targetUrl} 
      target="_blank" 
      rel="noopener noreferrer sponsored"
      onClick={handleClick}
      className="block relative group"
    >
      <div 
        className="relative overflow-hidden rounded-lg"
        style={{ width, height }}
      >
        <Image
          src={ad!.imageUrl}
          alt={ad!.altText || 'Advertisement'}
          fill
          className="object-cover"
        />
        
        {/* Ad label */}
        <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/70 rounded text-[9px] text-gray-400 uppercase">
          Ad
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
      </div>
    </a>
  );
}
