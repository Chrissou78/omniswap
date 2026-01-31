// apps/web/src/components/swap/components/modals/TokenSelectModal.tsx
'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  X,
  Search,
  Plus,
  AlertTriangle,
  Trash2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Loader2,
  DollarSign,
  RefreshCw,
} from 'lucide-react';
import { getTokenSecurity, type TokenAuditResult } from '@/services/goPlusService';
import { getTokenPrice } from '@/services/priceService';
import { useTokens } from '@/hooks/useTokens';
import { useChains } from '@/hooks/useChains';
import type { Chain, Token } from '@omniswap/shared';
import type { TokenBalances } from '../../types';
import { TokenLogo } from '../TokenLogo';
import { formatBalance, isNativeToken } from '../../utils';

// ============================================================================
// TYPES
// ============================================================================

interface CustomToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: string;
  logoUrl?: string;
  isCustom: true;
  isVerified: false;
}

interface CustomTokenData {
  token: CustomToken;
  addedAt: number;
  priceUsd?: number;
  security?: TokenAuditResult;
}

interface TokenSelectModalProps {
  chain: Chain;
  selectedToken: Token | null;
  otherSelectedToken?: Token | null;
  balances: TokenBalances;
  onSelect: (token: Token) => void;
  onClose: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CUSTOM_TOKENS_STORAGE_KEY = 'omniswap_custom_tokens';
const RPC_TIMEOUT_MS = 5000;
const SEARCH_DEBOUNCE_MS = 300;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Fetch token info from contract with timeout
 */
async function fetchTokenFromContract(
  address: string,
  chainId: string | number,
  rpcUrl: string
): Promise<CustomToken | null> {
  const isEvm = !['solana-mainnet', 'sui-mainnet'].includes(String(chainId));

  if (isEvm) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);

    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify([
          {
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_call',
            params: [{ to: address, data: '0x06fdde03' }, 'latest'],
          },
          {
            jsonrpc: '2.0',
            id: 2,
            method: 'eth_call',
            params: [{ to: address, data: '0x95d89b41' }, 'latest'],
          },
          {
            jsonrpc: '2.0',
            id: 3,
            method: 'eth_call',
            params: [{ to: address, data: '0x313ce567' }, 'latest'],
          },
        ]),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`RPC error: ${response.status}`);
      }

      const results = await response.json();

      const decodeString = (hex: string): string => {
        try {
          if (!hex || hex === '0x') return '';
          const stripped = hex.slice(2);
          if (stripped.length < 128) return '';
          const length = parseInt(stripped.slice(64, 128), 16);
          const data = stripped.slice(128, 128 + length * 2);
          let str = '';
          for (let i = 0; i < data.length; i += 2) {
            const charCode = parseInt(data.slice(i, i + 2), 16);
            if (charCode === 0) break;
            str += String.fromCharCode(charCode);
          }
          return str;
        } catch {
          return '';
        }
      };

      const name = decodeString(results[0]?.result || '');
      const symbol = decodeString(results[1]?.result || '');
      const decimals = results[2]?.result ? parseInt(results[2].result, 16) : 18;

      if (!symbol) {
        throw new Error('Invalid token contract - no symbol');
      }

      return {
        address,
        symbol,
        name: name || symbol,
        decimals,
        chainId: String(chainId),
        isCustom: true,
        isVerified: false,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('RPC request timed out');
      }
      throw error;
    }
  }

  // Solana
  if (String(chainId) === 'solana-mainnet') {
    return {
      address,
      symbol: address.slice(0, 6).toUpperCase(),
      name: `Token ${address.slice(0, 8)}...`,
      decimals: 9,
      chainId: String(chainId),
      isCustom: true,
      isVerified: false,
    };
  }

  // Sui
  if (String(chainId) === 'sui-mainnet') {
    return {
      address,
      symbol: address.split('::')[2] || 'TOKEN',
      name: `Token ${address.slice(0, 8)}...`,
      decimals: 9,
      chainId: String(chainId),
      isCustom: true,
      isVerified: false,
    };
  }

  return null;
}

/**
 * Check if input looks like a token address
 */
function isAddressFormat(input: string, chainId: string): boolean {
  if (['solana-mainnet'].includes(chainId)) {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input);
  }
  if (['sui-mainnet'].includes(chainId)) {
    return input.includes('::') || /^0x[a-fA-F0-9]{64}/.test(input);
  }
  // EVM address
  return /^0x[a-fA-F0-9]{40}$/.test(input);
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function RiskBadge({ level, small = false }: { level: string; small?: boolean }) {
  const config: Record<string, { color: string; icon: typeof Shield; label: string }> = {
    low: { color: 'text-green-500 bg-green-500/10', icon: ShieldCheck, label: 'Safe' },
    medium: { color: 'text-yellow-500 bg-yellow-500/10', icon: ShieldAlert, label: 'Caution' },
    high: { color: 'text-red-500 bg-red-500/10', icon: ShieldX, label: 'Risky' },
    critical: { color: 'text-red-600 bg-red-600/10', icon: ShieldX, label: 'Critical' },
  };

  const { color, icon: Icon, label } = config[level] || config.medium;

  if (small) {
    return (
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${color}`}>{label}</span>
    );
  }

  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${color}`}>
      <Icon className="w-3 h-3" />
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function TokenSelectModal({
  chain,
  selectedToken,
  otherSelectedToken,
  balances,
  onSelect,
  onClose,
}: TokenSelectModalProps) {
  // Hooks for data fetching
  const {
    tokens: baseTokens,
    isLoading: isLoadingTokens,
    refetch: refetchTokens,
  } = useTokens(chain.id);
  const { getChainById } = useChains();

  // Local state
  const [search, setSearch] = useState('');
  const [customTokens, setCustomTokens] = useState<CustomTokenData[]>([]);
  const [isSearchingContract, setIsSearchingContract] = useState(false);
  const [contractSearchResult, setContractSearchResult] = useState<CustomToken | null>(null);
  const [contractSearchError, setContractSearchError] = useState('');
  const [contractAudit, setContractAudit] = useState<TokenAuditResult | null>(null);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [contractPrice, setContractPrice] = useState<number | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);

  // Refs for cleanup
  const searchAbortRef = useRef<AbortController | null>(null);

  // Load custom tokens from localStorage on mount and chain change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`${CUSTOM_TOKENS_STORAGE_KEY}_${chain.id}`);
      if (saved) {
        try {
          setCustomTokens(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to parse custom tokens:', e);
          setCustomTokens([]);
        }
      } else {
        setCustomTokens([]);
      }
    }
  }, [chain.id]);

  // Save custom tokens to localStorage
  const saveCustomTokens = useCallback(
    (tokens: CustomTokenData[]) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`${CUSTOM_TOKENS_STORAGE_KEY}_${chain.id}`, JSON.stringify(tokens));
      }
    },
    [chain.id]
  );

  // Combine base tokens with custom tokens
  const allTokens = useMemo(() => {
    const chainCustomTokens = customTokens.map((ct) => ({
      ...ct.token,
      chainId: chain.id,
      logoURI: '/tokens/unknown.png',
      tags: [] as string[],
      popularity: 0,
      isCustom: true as const,
      isVerified: false as const,
      priceUsd: ct.priceUsd,
    }));

    return [...baseTokens, ...chainCustomTokens];
  }, [baseTokens, customTokens, chain.id]);

  // Filter tokens by search query
  const filteredTokens = useMemo(() => {
    if (!search) return allTokens;

    const searchLower = search.toLowerCase().trim();

    // If searching by address, filter by exact match
    if (isAddressFormat(search, String(chain.id))) {
      return allTokens.filter((token) => token.address?.toLowerCase() === searchLower);
    }

    // Otherwise search by name/symbol
    return allTokens.filter(
      (token) =>
        token.symbol.toLowerCase().includes(searchLower) ||
        token.name.toLowerCase().includes(searchLower) ||
        token.address?.toLowerCase().includes(searchLower)
    );
  }, [allTokens, search, chain.id]);

  // Check if token already exists in the list
  const tokenExists = useCallback(
    (address: string) => {
      return allTokens.some((t) => t.address?.toLowerCase() === address.toLowerCase());
    },
    [allTokens]
  );

  // Contract search effect - optimized for speed
  useEffect(() => {
    // Cancel previous search
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }

    const searchContract = async () => {
      // Reset states
      setContractSearchResult(null);
      setContractSearchError('');
      setContractAudit(null);
      setContractPrice(null);
      setShowImportConfirm(false);
      setIsLoadingPrice(false);
      setIsLoadingAudit(false);

      const trimmedSearch = search.trim();

      // Check if it looks like an address
      if (!trimmedSearch || !isAddressFormat(trimmedSearch, String(chain.id))) {
        setIsSearchingContract(false);
        return;
      }

      // Check if already in list - user can just select it
      if (tokenExists(trimmedSearch)) {
        setIsSearchingContract(false);
        return;
      }

      setIsSearchingContract(true);

      // Create abort controller for this search
      const abortController = new AbortController();
      searchAbortRef.current = abortController;

      try {
        const currentChain = getChainById(chain.id);
        if (!currentChain?.rpcDefault) {
          throw new Error('RPC not available for this chain');
        }

        // Step 1: Fetch token info from contract (FAST - show result immediately)
        const tokenInfo = await fetchTokenFromContract(
          trimmedSearch,
          String(chain.id),
          currentChain.rpcDefault
        );

        // Check if search was cancelled
        if (abortController.signal.aborted) return;

        if (!tokenInfo) {
          setContractSearchError('Could not read token contract. Verify the address is correct.');
          setIsSearchingContract(false);
          return;
        }

        // Show token info immediately
        setContractSearchResult(tokenInfo);
        setIsSearchingContract(false);

        // Step 2: Fetch price and audit in PARALLEL (non-blocking, background)
        const isEvmChain = !['solana-mainnet', 'sui-mainnet'].includes(String(chain.id));

        setIsLoadingPrice(true);
        if (isEvmChain) setIsLoadingAudit(true);

        // Start both requests simultaneously
        const pricePromise = getTokenPrice(chain.id, trimmedSearch, tokenInfo.symbol)
          .then((price) => {
            if (!abortController.signal.aborted) {
              setContractPrice(price?.priceUsd || null);
            }
          })
          .catch((e) => {
            console.warn('Price fetch failed:', e);
            if (!abortController.signal.aborted) {
              setContractPrice(null);
            }
          })
          .finally(() => {
            if (!abortController.signal.aborted) {
              setIsLoadingPrice(false);
            }
          });

        const auditPromise = isEvmChain
          ? getTokenSecurity(chain.id, trimmedSearch)
              .then((audit) => {
                if (!abortController.signal.aborted) {
                  setContractAudit(audit);
                }
              })
              .catch((e) => {
                console.warn('Audit fetch failed:', e);
                if (!abortController.signal.aborted) {
                  setContractAudit(null);
                }
              })
              .finally(() => {
                if (!abortController.signal.aborted) {
                  setIsLoadingAudit(false);
                }
              })
          : Promise.resolve();

        // Wait for both to complete (but UI already shows token)
        await Promise.allSettled([pricePromise, auditPromise]);
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error('Contract search failed:', error);
          setContractSearchError('Failed to fetch token info. Check the contract address.');
          setIsSearchingContract(false);
          setIsLoadingPrice(false);
          setIsLoadingAudit(false);
        }
      }
    };

    // Debounce the search
    const debounceTimer = setTimeout(searchContract, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(debounceTimer);
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
    };
  }, [search, chain.id, tokenExists, getChainById]);

  // Import custom token
  const handleImportToken = useCallback(() => {
    if (!contractSearchResult) return;

    const newCustomToken: CustomTokenData = {
      token: contractSearchResult,
      addedAt: Date.now(),
      priceUsd: contractPrice || undefined,
      security: contractAudit || undefined,
    };

    const updatedCustomTokens = [...customTokens, newCustomToken];
    setCustomTokens(updatedCustomTokens);
    saveCustomTokens(updatedCustomTokens);

    // Create the token object for selection
    const importedToken = {
      address: contractSearchResult.address,
      symbol: contractSearchResult.symbol,
      name: contractSearchResult.name,
      decimals: contractSearchResult.decimals,
      chainId: chain.id,
      logoURI: '/tokens/unknown.png',
      tags: [],
      popularity: 0,
      isCustom: true,
      isVerified: false,
      priceUsd: contractPrice || undefined,
    } as Token;

    // Select the token and close modal
    onSelect(importedToken);
    onClose();
  }, [
    contractSearchResult,
    contractPrice,
    contractAudit,
    customTokens,
    saveCustomTokens,
    chain.id,
    onSelect,
    onClose,
  ]);

  // Remove custom token
  const handleRemoveCustomToken = useCallback(
    (address: string, e: React.MouseEvent) => {
      e.stopPropagation();

      const updatedCustomTokens = customTokens.filter(
        (ct) => ct.token.address.toLowerCase() !== address.toLowerCase()
      );
      setCustomTokens(updatedCustomTokens);
      saveCustomTokens(updatedCustomTokens);

      // If the removed token was the selected token, reset to first available
      if (selectedToken?.address?.toLowerCase() === address.toLowerCase()) {
        const remainingTokens = [
          ...baseTokens,
          ...updatedCustomTokens.map((ct) => ({
            ...ct.token,
            chainId: chain.id,
            logoURI: '/tokens/unknown.png',
            tags: [] as string[],
            popularity: 0,
            isCustom: true as const,
            isVerified: false as const,
            priceUsd: ct.priceUsd,
          })),
        ].filter((t) => t.address?.toLowerCase() !== otherSelectedToken?.address?.toLowerCase());

        if (remainingTokens.length > 0) {
          onSelect(remainingTokens[0] as Token);
        }
      }
    },
    [customTokens, saveCustomTokens, selectedToken, baseTokens, chain.id, otherSelectedToken, onSelect]
  );

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    await refetchTokens();
  }, [refetchTokens]);

  // Get balance for a token
  const getBalance = useCallback(
    (token: Token) => {
      if (!token) return '0';
      const key = isNativeToken(token) ? 'native' : token.address?.toLowerCase();
      return key ? balances[key]?.balance || '0' : '0';
    },
    [balances]
  );

  // Handle token selection
  const handleTokenSelect = useCallback(
    (token: Token) => {
      onSelect(token);
      onClose();
    },
    [onSelect, onClose]
  );

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearch('');
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Select Token</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isLoadingTokens}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh tokens"
            >
              <RefreshCw
                className={`w-4 h-4 text-gray-500 ${isLoadingTokens ? 'animate-spin' : ''}`}
              />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Chain Info */}
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: chain.color }}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">{chain.name}</span>
          </div>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, symbol, or paste address"
              className="w-full pl-10 pr-10 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {isSearchingContract && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 animate-spin" />
            )}
            {search && !isSearchingContract && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>

          {/* Contract Search Result - Found New Token */}
          {contractSearchResult && !showImportConfirm && (
            <div className="mt-3 p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                    <span className="text-sm text-gray-400">?</span>
                  </div>
                  <div>
                    <p className="text-gray-900 dark:text-white font-medium">
                      {contractSearchResult.symbol}
                    </p>
                    <p className="text-gray-500 dark:text-gray-400 text-xs">
                      {contractSearchResult.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Price display */}
                  {isLoadingPrice ? (
                    <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
                  ) : contractPrice ? (
                    <span className="text-xs text-green-500 flex items-center gap-0.5">
                      <DollarSign className="w-3 h-3" />
                      {contractPrice < 0.01
                        ? contractPrice.toExponential(2)
                        : contractPrice.toFixed(4)}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">No price</span>
                  )}
                  {/* Audit badge */}
                  {isLoadingAudit ? (
                    <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                  ) : contractAudit ? (
                    <RiskBadge level={contractAudit.riskLevel} />
                  ) : null}
                </div>
              </div>

              <p className="text-xs text-gray-500 mb-3 font-mono break-all">
                {contractSearchResult.address}
              </p>

              {/* Quick stats */}
              {contractAudit && (
                <div className="flex flex-wrap gap-2 mb-3 text-xs">
                  {contractAudit.holderCount > 0 && (
                    <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
                      {contractAudit.holderCount.toLocaleString()} holders
                    </span>
                  )}
                  {contractAudit.totalLiquidityUsd > 0 && (
                    <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
                      ${contractAudit.totalLiquidityUsd.toLocaleString()} liquidity
                    </span>
                  )}
                  {(contractAudit.buyTax > 0 || contractAudit.sellTax > 0) && (
                    <span
                      className={`px-2 py-1 rounded ${
                        contractAudit.buyTax > 10 || contractAudit.sellTax > 10
                          ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      Tax: {contractAudit.buyTax.toFixed(1)}%/{contractAudit.sellTax.toFixed(1)}%
                    </span>
                  )}
                </div>
              )}

              <button
                onClick={() => setShowImportConfirm(true)}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Import Token
              </button>
            </div>
          )}

          {/* Import Confirmation with Warnings */}
          {showImportConfirm && contractSearchResult && (
            <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-yellow-600 dark:text-yellow-500 font-medium text-sm">
                    Trade at your own risk
                  </p>
                  <p className="text-yellow-600/80 dark:text-yellow-500/80 text-xs mt-1">
                    This token is not verified. Anyone can create a token with any name. Verify the
                    contract address from official sources.
                  </p>
                </div>
              </div>

              {/* Audit Info */}
              {contractAudit && (
                <div className="mb-3 p-2 bg-black/10 dark:bg-black/20 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    GoPlus Security Scan:
                  </p>
                  <div className="flex items-center gap-2">
                    <RiskBadge level={contractAudit.riskLevel} small />
                    {(contractAudit.riskLevel === 'high' ||
                      contractAudit.riskLevel === 'critical') && (
                      <span className="text-xs text-red-500 dark:text-red-400">
                        {contractAudit.risks?.length || 0} risks detected
                      </span>
                    )}
                  </div>

                  {/* Honeypot Warning */}
                  {contractAudit.isHoneypot && (
                    <div className="mt-2 p-2 bg-red-500/20 rounded text-xs text-red-500 font-medium">
                      🚨 HONEYPOT DETECTED - DO NOT BUY
                    </div>
                  )}

                  {/* Risk List */}
                  {contractAudit.risks && contractAudit.risks.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {contractAudit.risks.slice(0, 4).map((risk, i) => (
                        <li
                          key={i}
                          className={`text-xs flex items-start gap-1 ${
                            risk.severity === 'critical'
                              ? 'text-red-500'
                              : risk.severity === 'high'
                                ? 'text-orange-500'
                                : risk.severity === 'medium'
                                  ? 'text-yellow-500'
                                  : 'text-gray-500'
                          }`}
                        >
                          <span>•</span>
                          <span>
                            <strong>{risk.name}:</strong> {risk.description}
                          </span>
                        </li>
                      ))}
                      {contractAudit.risks.length > 4 && (
                        <li className="text-xs text-gray-500">
                          +{contractAudit.risks.length - 4} more risks
                        </li>
                      )}
                    </ul>
                  )}

                  {/* Tax Info */}
                  {(contractAudit.buyTax > 5 || contractAudit.sellTax > 5) && (
                    <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-500">
                      💰 Tax: Buy {contractAudit.buyTax.toFixed(1)}% / Sell{' '}
                      {contractAudit.sellTax.toFixed(1)}%
                    </div>
                  )}
                </div>
              )}

              <div className="text-xs text-blue-600 dark:text-blue-400 mb-3 p-2 bg-blue-500/10 rounded-lg">
                ℹ️ Only <strong>Direct DEX</strong> swaps available for custom tokens. Gasless and
                CEX routes are disabled for safety.
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowImportConfirm(false)}
                  className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-gray-900 dark:text-white text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportToken}
                  disabled={contractAudit?.isHoneypot}
                  className={`flex-1 py-2 rounded-lg text-white text-sm font-medium transition-colors ${
                    contractAudit?.isHoneypot
                      ? 'bg-gray-500 cursor-not-allowed'
                      : 'bg-yellow-600 hover:bg-yellow-700'
                  }`}
                >
                  {contractAudit?.isHoneypot ? 'Blocked (Honeypot)' : 'I Understand, Import'}
                </button>
              </div>
            </div>
          )}

          {/* Contract Search Error */}
          {contractSearchError && (
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
              <p className="text-red-500 dark:text-red-400 text-sm">{contractSearchError}</p>
            </div>
          )}
        </div>

        {/* Loading Indicator */}
        {isLoadingTokens && (
          <div className="flex items-center justify-center gap-2 py-4">
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
            <span className="text-sm text-gray-500">Loading tokens...</span>
          </div>
        )}

        {/* Token List */}
        <div className="flex-1 overflow-y-auto p-2">
          {filteredTokens.length === 0 && !contractSearchResult && !isSearchingContract ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">No tokens found</p>
              {search && (
                <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                  {isAddressFormat(search, String(chain.id))
                    ? 'Searching for contract...'
                    : 'Try searching by name or symbol, or paste a contract address'}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredTokens.map((token) => {
                const balance = getBalance(token as Token);
                const isSelected =
                  selectedToken?.address === token.address &&
                  selectedToken?.symbol === token.symbol;
                const isCustomToken = (token as any).isCustom === true;

                return (
                  <button
                    key={`${token.address || token.chainId}-${token.symbol}`}
                    onClick={() => handleTokenSelect(token as Token)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                      isSelected
                        ? 'bg-blue-100 dark:bg-blue-600/20 ring-1 ring-blue-500'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <TokenLogo token={token as Token} size={40} />

                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900 dark:text-white font-medium">
                          {token.symbol}
                        </span>
                        {isCustomToken && (
                          <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-600 dark:text-yellow-500 text-[10px] rounded uppercase font-medium">
                            Custom
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 text-sm truncate">
                        {token.name}
                      </p>
                    </div>

                    <div className="text-right flex items-center gap-2 flex-shrink-0">
                      <div>
                        <p className="text-gray-900 dark:text-white font-medium tabular-nums">
                          {formatBalance(balance)}
                        </p>
                        {isCustomToken && (
                          <p className="text-gray-500 text-xs font-mono">
                            {token.address?.slice(0, 6)}...{token.address?.slice(-4)}
                          </p>
                        )}
                        {token.priceUsd && (
                          <p className="text-gray-400 text-xs">
                            $
                            {token.priceUsd < 0.0001
                              ? token.priceUsd.toExponential(2)
                              : token.priceUsd.toFixed(4)}
                          </p>
                        )}
                      </div>

                      {/* Remove button for custom tokens */}
                      {isCustomToken && (
                        <button
                          onClick={(e) => handleRemoveCustomToken(token.address!, e)}
                          className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors group"
                          title="Remove custom token"
                        >
                          <Trash2 className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
                        </button>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            💡 Paste a token contract address to import custom tokens
          </p>
        </div>
      </div>
    </div>
  );
}

export default TokenSelectModal;
