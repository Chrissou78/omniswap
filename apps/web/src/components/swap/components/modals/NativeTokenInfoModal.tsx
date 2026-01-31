'use client';

import type { Chain, Token } from '../../../../types';
import { TokenLogo } from '../TokenLogo';

interface NativeTokenInfoModalProps {
  token: Token;
  chain: Chain;
  onClose: () => void;
}

export function NativeTokenInfoModal({ token, chain, onClose }: NativeTokenInfoModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 dark:bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <TokenLogo token={token} size={40} />
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{token.symbol}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{token.name}</p>
              </div>
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

        <div className="p-4">
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🛡️</span>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">Native Token</span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {token.symbol} is the native gas token of {chain.name}. Native tokens are inherently
              secure as they are part of the blockchain&apos;s base protocol.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
              <span className="text-xs text-gray-500 dark:text-gray-400">Network</span>
              <p className="text-gray-900 dark:text-white font-medium">{chain.name}</p>
            </div>
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
              <span className="text-xs text-gray-500 dark:text-gray-400">Decimals</span>
              <p className="text-gray-900 dark:text-white font-medium">{token.decimals}</p>
            </div>
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
              <span className="text-xs text-gray-500 dark:text-gray-400">Type</span>
              <p className="text-gray-900 dark:text-white font-medium">Native Gas Token</p>
            </div>
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
              <span className="text-xs text-gray-500 dark:text-gray-400">Risk Level</span>
              <p className="text-green-600 dark:text-green-400 font-medium">✓ Safe</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span className="text-gray-700 dark:text-gray-300">No smart contract risk</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span className="text-gray-700 dark:text-gray-300">Cannot be a honeypot</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span className="text-gray-700 dark:text-gray-300">No transfer taxes</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span className="text-gray-700 dark:text-gray-300">Fully decentralized</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
              Native tokens are the safest tokens on any blockchain
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
