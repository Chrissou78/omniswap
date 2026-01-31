// apps/web/src/components/swap/components/modals/SettingsModal.tsx

import React, { useState } from 'react';
import { X, Info } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  slippage: number;
  onSlippageChange: (slippage: number) => void;
  deadline: number;
  onDeadlineChange: (deadline: number) => void;
}

const SLIPPAGE_PRESETS = [0.1, 0.5, 1.0];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  slippage,
  onSlippageChange,
  deadline,
  onDeadlineChange,
}) => {
  const [customSlippage, setCustomSlippage] = useState('');
  const [showSlippageWarning, setShowSlippageWarning] = useState(false);

  const handleSlippageChange = (value: number) => {
    onSlippageChange(value);
    setCustomSlippage('');
    setShowSlippageWarning(value > 5);
  };

  const handleCustomSlippageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.]/g, '');
    setCustomSlippage(value);
    
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0 && numValue <= 50) {
      onSlippageChange(numValue);
      setShowSlippageWarning(numValue > 5);
    }
  };

  const handleDeadlineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0 && value <= 60) {
      onDeadlineChange(value);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-[#1a1b23] rounded-2xl w-full max-w-sm border border-gray-800 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">Settings</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Slippage Tolerance */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium text-white">Slippage Tolerance</span>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-500 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 rounded-lg text-xs text-gray-300 w-48 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  Your transaction will revert if the price changes unfavorably by more than this percentage.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {SLIPPAGE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => handleSlippageChange(preset)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    slippage === preset && !customSlippage
                      ? 'bg-blue-500 text-white'
                      : 'bg-[#0d0e12] text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  {preset}%
                </button>
              ))}
              
              <div className="relative flex-1">
                <input
                  type="text"
                  value={customSlippage}
                  onChange={handleCustomSlippageChange}
                  placeholder="Custom"
                  className={`w-full px-3 py-2 rounded-xl text-sm bg-[#0d0e12] border outline-none transition-colors ${
                    customSlippage
                      ? 'border-blue-500 text-white'
                      : 'border-gray-800 text-gray-400'
                  }`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                  %
                </span>
              </div>
            </div>

            {showSlippageWarning && (
              <p className="mt-2 text-xs text-yellow-400">
                High slippage increases the risk of front-running and unfavorable trades.
              </p>
            )}
          </div>

          {/* Transaction Deadline */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium text-white">Transaction Deadline</span>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-500 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 rounded-lg text-xs text-gray-300 w-48 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  Your transaction will revert if it is pending for more than this period of time.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                value={deadline}
                onChange={handleDeadlineChange}
                min="1"
                max="60"
                className="w-20 px-3 py-2 rounded-xl text-sm bg-[#0d0e12] border border-gray-800 text-white outline-none focus:border-blue-500 transition-colors"
              />
              <span className="text-gray-400 text-sm">minutes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;