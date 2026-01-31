// apps/web/src/components/swap/components/RouteComparisonPanel.tsx
'use client';

import { useState, useEffect } from 'react';
import type { RouteOption } from '../types';

interface RouteComparisonPanelProps {
  directRoute: RouteOption | null;
  alternateRoute: RouteOption | null;
  delegatedRoute: RouteOption | null;
  selectedRoute: 'direct' | 'alternate' | 'delegated';
  onSelectRoute: (route: 'direct' | 'alternate' | 'delegated') => void;
  isLoading: boolean;
  valueUsd: number;
  threshold: number;
}

export function RouteComparisonPanel({
  directRoute,
  alternateRoute,
  delegatedRoute,
  selectedRoute,
  onSelectRoute,
  isLoading,
  valueUsd,
  threshold,
}: RouteComparisonPanelProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (directRoute) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [directRoute]);

  if (!shouldRender) return null;

  return (
    <div
      className={`mt-3 space-y-1.5 transition-all duration-300 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
        Routes
      </div>

      {/* Direct Route */}
      {directRoute && (
        <RouteCard
          route={directRoute}
          isSelected={selectedRoute === 'direct'}
          onSelect={() => onSelectRoute('direct')}
          variant="direct"
        />
      )}

      {/* Delegated (Gasless) Route */}
      {delegatedRoute && (
        <RouteCard
          route={delegatedRoute}
          isSelected={selectedRoute === 'delegated'}
          onSelect={() => onSelectRoute('delegated')}
          variant="delegated"
        />
      )}

      {/* Loading state for CEX route */}
      {isLoading && valueUsd >= threshold && (
        <div className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Checking CEX routes...
            </span>
          </div>
        </div>
      )}

      {/* Alternate (CEX) Route */}
      {alternateRoute && !isLoading && (
        <RouteCard
          route={alternateRoute}
          isSelected={selectedRoute === 'alternate'}
          onSelect={() => onSelectRoute('alternate')}
          variant="alternate"
        />
      )}

      {/* Info messages */}
      {valueUsd < threshold && valueUsd > 0 && !delegatedRoute && (
        <div className="text-xs text-gray-400 dark:text-gray-500 text-center pt-1">
          More routes available for larger swaps
        </div>
      )}
    </div>
  );
}

interface RouteCardProps {
  route: RouteOption;
  isSelected: boolean;
  onSelect: () => void;
  variant: 'direct' | 'alternate' | 'delegated';
}

function RouteCard({ route, isSelected, onSelect, variant }: RouteCardProps) {
  const colors = {
    direct: {
      border: isSelected ? 'border-blue-500' : 'border-gray-200 dark:border-gray-700',
      bg: isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
      dot: 'bg-blue-500',
    },
    alternate: {
      border: isSelected ? 'border-purple-500' : 'border-gray-200 dark:border-gray-700',
      bg: isSelected ? 'bg-purple-50 dark:bg-purple-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
      dot: 'bg-purple-500',
    },
    delegated: {
      border: isSelected ? 'border-emerald-500' : 'border-gray-200 dark:border-gray-700',
      bg: isSelected ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
      dot: 'bg-emerald-500',
    },
  };

  const config = colors[variant];

  const getLabel = () => {
    switch (variant) {
      case 'direct':
        return 'Direct (DEX)';
      case 'delegated':
        return 'Gasless';
      case 'alternate':
        return 'CEX';
      default:
        return route.label;
    }
  };

  // Only show savings if it's greater than $1
  const showSavings = variant === 'alternate' && 
    typeof route.savings === 'number' && 
    route.savings > 1;

  return (
    <button
      onClick={onSelect}
      className={`w-full px-3 py-2 rounded-lg border transition-all duration-150 text-left 
        ${config.border} ${config.bg}`}
    >
      <div className="flex items-center justify-between">
        {/* Left side: label and badges */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${config.dot}`} />
          
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {getLabel()}
          </span>

          {route.recommended && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
              Best
            </span>
          )}

          {showSavings && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
              +${route.savings!.toFixed(2)}
            </span>
          )}
        </div>

        {/* Right side: time and fee */}
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span>{route.estimatedTime}</span>
          <span className="tabular-nums">
            ${route.totalFeeUsd.toFixed(2)}
          </span>
        </div>
      </div>
    </button>
  );
}
