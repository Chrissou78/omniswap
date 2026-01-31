'use client';

import type { TokenAuditResult } from '../../../../services/goPlusService';
import { formatVolume, shortenAddress } from '../../utils';

interface TokenAuditModalProps {
  audit: TokenAuditResult;
  onClose: () => void;
}

export function TokenAuditModal({ audit, onClose }: TokenAuditModalProps) {
  const getRiskColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30';
      case 'high':
        return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30';
      case 'low':
        return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-500/10 border-gray-200 dark:border-gray-500/30';
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'text-red-600 dark:text-red-400';
      case 'high':
        return 'text-orange-600 dark:text-orange-400';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-green-600 dark:text-green-400';
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 dark:bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Token Security Audit
                <span className={`text-sm ${getLevelColor(audit.riskLevel)}`}>
                  ({audit.riskScore}/100)
                </span>
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {audit.name} ({audit.symbol})
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg
                className="w-5 h-5 text-gray-500 dark:text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(85vh-80px)]">
          <div
            className={`p-4 rounded-xl border mb-4 ${
              audit.riskLevel === 'critical'
                ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30'
                : audit.riskLevel === 'high'
                  ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30'
                  : audit.riskLevel === 'medium'
                    ? 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30'
                    : 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Risk Level</span>
                <p className={`text-xl font-bold capitalize ${getLevelColor(audit.riskLevel)}`}>
                  {audit.riskLevel}
                </p>
              </div>
              <div className="text-right">
                <span className="text-sm text-gray-500 dark:text-gray-400">Score</span>
                <p className={`text-xl font-bold ${getLevelColor(audit.riskLevel)}`}>
                  {audit.riskScore}/100
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
              <span className="text-xs text-gray-500 dark:text-gray-400">Holders</span>
              <p className="text-gray-900 dark:text-white font-medium">
                {audit.holderCount.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
              <span className="text-xs text-gray-500 dark:text-gray-400">Liquidity</span>
              <p className="text-gray-900 dark:text-white font-medium">
                {formatVolume(audit.totalLiquidityUsd)}
              </p>
            </div>
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
              <span className="text-xs text-gray-500 dark:text-gray-400">Buy Tax</span>
              <p
                className={`font-medium ${
                  audit.buyTax > 10
                    ? 'text-red-600 dark:text-red-400'
                    : audit.buyTax > 5
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-green-600 dark:text-green-400'
                }`}
              >
                {audit.buyTax.toFixed(1)}%
              </p>
            </div>
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
              <span className="text-xs text-gray-500 dark:text-gray-400">Sell Tax</span>
              <p
                className={`font-medium ${
                  audit.sellTax > 10
                    ? 'text-red-600 dark:text-red-400'
                    : audit.sellTax > 5
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-green-600 dark:text-green-400'
                }`}
              >
                {audit.sellTax.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <span
              className={`px-2 py-1 text-xs rounded ${
                audit.isHoneypot
                  ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
                  : 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
              }`}
            >
              {audit.isHoneypot ? '⚠ Honeypot' : '✓ Not Honeypot'}
            </span>
            <span
              className={`px-2 py-1 text-xs rounded ${
                audit.isOpenSource
                  ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                  : 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
              }`}
            >
              {audit.isOpenSource ? '✓ Verified' : '⚠ Unverified'}
            </span>
            <span
              className={`px-2 py-1 text-xs rounded ${
                audit.isTrusted
                  ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-gray-500/20 text-gray-600 dark:text-gray-400'
              }`}
            >
              {audit.isTrusted ? '✓ Trusted' : '○ Not Listed'}
            </span>
            {audit.isProxy && (
              <span className="px-2 py-1 text-xs rounded bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400">
                ⚠ Proxy
              </span>
            )}
            {audit.isMintable && (
              <span className="px-2 py-1 text-xs rounded bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400">
                ⚠ Mintable
              </span>
            )}
          </div>

          {audit.risks.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Risk Details</h4>
              <div className="space-y-2">
                {audit.risks.map((risk, index) => (
                  <div key={index} className={`p-3 rounded-lg border ${getRiskColor(risk.severity)}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-medium text-sm">{risk.name}</span>
                        <p className="text-xs opacity-80 mt-0.5">{risk.description}</p>
                      </div>
                      <span className="text-xs uppercase font-medium opacity-60">{risk.severity}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {audit.topHolders.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Top Holders</h4>
              <div className="space-y-2">
                {audit.topHolders.slice(0, 5).map((holder, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">#{index + 1}</span>
                      <span className="text-sm text-gray-900 dark:text-white font-mono">
                        {shortenAddress(holder.address)}
                      </span>
                      {holder.tag && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded">
                          {holder.tag}
                        </span>
                      )}
                      {holder.isContract && (
                        <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded">
                          Contract
                        </span>
                      )}
                      {holder.isLocked && (
                        <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 rounded">
                          Locked
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {holder.percent.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {audit.liquidity.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                Liquidity Pools
              </h4>
              <div className="space-y-2">
                {audit.liquidity.slice(0, 5).map((pool, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded-lg"
                  >
                    <span className="text-sm text-gray-900 dark:text-white">{pool.dex}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {formatVolume(pool.liquidityUsd)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
              Powered by GoPlus Security API • Data may be delayed
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
