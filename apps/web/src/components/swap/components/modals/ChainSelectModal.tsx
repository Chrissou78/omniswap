'use client';

import { useState } from 'react';
import { CHAINS, searchChains } from '../../../../config';
import type { Chain } from '../../../../types';
import { ChainLogo } from '../ChainLogo';

interface ChainSelectModalProps {
  title: string;
  selectedChain: Chain;
  onSelect: (chain: Chain) => void;
  onClose: () => void;
}

export function ChainSelectModal({ title, selectedChain, onSelect, onClose }: ChainSelectModalProps) {
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  const getFilteredChains = () => {
    const filtered = search ? searchChains(search) : CHAINS;
    return showAll || search ? filtered : filtered.slice(0, 15);
  };

  const remainingChains = CHAINS.length - 15;

  const handleSelect = (chain: Chain) => {
    onSelect(chain);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 dark:bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
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
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search networks..."
            className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {getFilteredChains().map((chain) => (
            <button
              key={chain.id}
              onClick={() => handleSelect(chain)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl mb-2 transition-colors ${
                selectedChain.id === chain.id
                  ? 'bg-blue-100 dark:bg-blue-600/20 border border-blue-500'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <ChainLogo chainId={chain.id} size={32} />
              <div className="text-left">
                <div className="text-gray-900 dark:text-white font-medium">{chain.name}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{chain.symbol}</div>
              </div>
            </button>
          ))}
          {!search && !showAll && remainingChains > 0 && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400 font-medium rounded-xl transition-colors"
            >
              +{remainingChains} more networks
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
