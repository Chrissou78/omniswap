// apps/web/src/components/swap/components/StatsPopup.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { CHAINS, ALL_TOKENS } from '../../../config';
import { SmoothValue } from './SmoothValue';
import { SkeletonLoader } from './SkeletonLoader';

interface StatsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

interface Stats {
  chainsCount: number;
  tokensCount: number;
  totalSwaps: number;
  volume24h: number;
  volume7d: number;
  volume30d: number;
  totalVolume: number;
}

// Get swap history from localStorage
function getSwapStats(): { totalSwaps: number; volume24h: number; volume7d: number; volume30d: number; totalVolume: number } {
  try {
    const history = JSON.parse(localStorage.getItem('omniswap_history') || '[]');
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    
    let volume24h = 0;
    let volume7d = 0;
    let volume30d = 0;
    let totalVolume = 0;

    for (const tx of history) {
      const txTime = tx.timestamp || 0;
      const amount = tx.fromAmountUsd || 0;
      
      totalVolume += amount;
      
      if (now - txTime < day) {
        volume24h += amount;
      }
      if (now - txTime < 7 * day) {
        volume7d += amount;
      }
      if (now - txTime < 30 * day) {
        volume30d += amount;
      }
    }

    return {
      totalSwaps: history.length,
      volume24h,
      volume7d,
      volume30d,
      totalVolume,
    };
  } catch {
    return {
      totalSwaps: 0,
      volume24h: 0,
      volume7d: 0,
      volume30d: 0,
      totalVolume: 0,
    };
  }
}

export function StatsPopup({ isOpen, onClose, anchorRef }: StatsPopupProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  // Handle open/close animations
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Fetch stats
  useEffect(() => {
    if (!isOpen) return;

    const fetchStats = async () => {
      setLoading(true);
      try {
        // Small delay for smooth UX
        await new Promise((resolve) => setTimeout(resolve, 200));
        
        // Get real counts from config
        const chainsCount = CHAINS?.length || 0;
        const tokensCount = ALL_TOKENS?.length || 0;
        
        // Get swap history stats
        const swapStats = getSwapStats();

        setStats({
          chainsCount,
          tokensCount,
          ...swapStats,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, anchorRef]);

  if (!shouldRender) return null;

  const formatVolume = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  return (
    <div
      ref={popupRef}
      className={`absolute top-full left-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden transition-all duration-200 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3">
        <h3 className="text-white font-semibold">Platform Statistics</h3>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {loading ? (
          <>
            <StatRowSkeleton />
            <StatRowSkeleton />
            <StatRowSkeleton />
            <StatRowSkeleton />
          </>
        ) : stats ? (
          <>
            <StatRow label="Supported Chains" value={stats.chainsCount} />
            <StatRow label="Tokens Listed" value={stats.tokensCount.toLocaleString()} />
            <StatRow label="Total Swaps" value={stats.totalSwaps.toLocaleString()} />
            
            {stats.totalVolume > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Volume</div>
                <StatRow label="24h" valueNum={stats.volume24h} format={formatVolume} />
                <StatRow label="7d" valueNum={stats.volume7d} format={formatVolume} />
                <StatRow label="30d" valueNum={stats.volume30d} format={formatVolume} />
                <StatRow
                  label="All Time"
                  valueNum={stats.totalVolume}
                  format={formatVolume}
                  highlight
                />
              </div>
            )}
          </>
        ) : (
          <div className="text-center text-gray-500 py-4">Failed to load stats</div>
        )}
      </div>
    </div>
  );
}

interface StatRowProps {
  label: string;
  value?: string | number;
  valueNum?: number;
  format?: (value: number) => string;
  highlight?: boolean;
}

function StatRow({ label, value, valueNum, format, highlight }: StatRowProps) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      {valueNum !== undefined && format ? (
        <SmoothValue
          value={valueNum}
          format={format}
          className={`text-sm font-medium ${
            highlight ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
          }`}
          duration={400}
        />
      ) : (
        <span
          className={`text-sm font-medium ${
            highlight ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
          }`}
        >
          {value}
        </span>
      )}
    </div>
  );
}

function StatRowSkeleton() {
  return (
    <div className="flex justify-between items-center">
      <SkeletonLoader width={80} height={16} />
      <SkeletonLoader width={60} height={16} />
    </div>
  );
}
