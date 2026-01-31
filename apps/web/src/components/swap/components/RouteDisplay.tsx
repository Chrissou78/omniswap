// apps/web/src/components/swap/components/RouteDisplay.tsx

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Zap, TrendingUp } from 'lucide-react';
import { SwapRoute } from '../types';

interface RouteDisplayProps {
  routes: SwapRoute[];
  selectedRoute?: SwapRoute;
  onSelectRoute?: (route: SwapRoute) => void;
}

export const RouteDisplay: React.FC<RouteDisplayProps> = ({
  routes,
  selectedRoute,
  onSelectRoute,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!routes || routes.length === 0) return null;

  const bestRoute = selectedRoute || routes[0];

  return (
    <div className="bg-[#0d0e12] rounded-xl border border-gray-800 overflow-hidden">
      {/* Best Route Summary */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-blue-400" />
          <span className="text-sm text-white">Best Route</span>
          <span className="text-xs text-gray-500">via {bestRoute.source}</span>
        </div>
        
        <div className="flex items-center gap-2">
          {bestRoute.priceImpact !== undefined && (
            <span className={`text-xs ${
              bestRoute.priceImpact > 5 ? 'text-red-400' :
              bestRoute.priceImpact > 2 ? 'text-yellow-400' :
              'text-green-400'
            }`}>
              {bestRoute.priceImpact > 0 ? '-' : ''}{bestRoute.priceImpact.toFixed(2)}%
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Route Path */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Path visualization */}
          <div className="flex items-center gap-1 overflow-x-auto py-2">
            {bestRoute.path.map((step, index) => (
              <React.Fragment key={index}>
                <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300 whitespace-nowrap">
                  {step}
                </span>
                {index < bestRoute.path.length - 1 && (
                  <span className="text-gray-600">→</span>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Route details */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Source</span>
              <span className="text-gray-300">{bestRoute.source}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Output</span>
              <span className="text-gray-300">{bestRoute.outputAmount}</span>
            </div>
            {bestRoute.estimatedGas && (
              <div className="flex justify-between">
                <span className="text-gray-500">Est. Gas</span>
                <span className="text-gray-300">{parseInt(bestRoute.estimatedGas).toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Alternative routes */}
          {routes.length > 1 && (
            <div className="pt-3 border-t border-gray-800">
              <p className="text-xs text-gray-500 mb-2">Alternative Routes</p>
              <div className="space-y-2">
                {routes.slice(1, 4).map((route, index) => (
                  <button
                    key={index}
                    onClick={() => onSelectRoute?.(route)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors ${
                      selectedRoute?.source === route.source
                        ? 'bg-blue-500/20 border border-blue-500'
                        : 'bg-gray-800/50 hover:bg-gray-800'
                    }`}
                  >
                    <span className="text-xs text-gray-300">{route.source}</span>
                    <span className="text-xs text-gray-400">{route.outputAmount}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RouteDisplay;
