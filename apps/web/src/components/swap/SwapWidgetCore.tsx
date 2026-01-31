import { useState, useEffect, useCallback, useMemo, useRef, useTransition } from 'react';
import { useAccount, useSignTypedData } from 'wagmi';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { SuiClient } from '@mysten/sui/client';
import { compareMexcRoute } from '@/services/mexcService';
import { PLATFORM_FEES } from '@/config/fees';
import { getChainRpc } from '@/lib/chain-config';

// Services
import { getTokenPrice, type TokenPrice } from '../../services/priceService';
import { estimateSwapGas, formatGasCost, type GasEstimate } from '../../services/gasService';
import { getTokenSecurity, type TokenAuditResult } from '../../services/goPlusService';

// Config
import { CHAINS, getTokensByChainId, sortTokensByBalance } from '../../config';
import type { Chain, Token } from '../../types';

// Local imports
import { useSuiWallet, useEvmTokenBalances } from './hooks';
import {
  isNativeToken,
  formatBalance,
  formatUsd,
  recordSwapTransaction,
  getDirectSwapTime,
  ROUTE_THRESHOLD_USD,
  ALTERNATE_ROUTE_TIME,
} from './utils';
import type { TokenBalances, RouteOption } from './types';

// Components
import {
  ChainLogo,
  TokenLogo,
  NativeTokenBadge,
  RiskBadge,
  RouteComparisonPanel,
  StatsPopup,
  NativeTokenInfoModal,
  TokenAuditModal,
  ChainSelectModal,
  TokenSelectModal,
} from './components';

// Icons
import { Plus, Trash2, AlertTriangle, Info, X } from 'lucide-react';

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
  priceUsd?: number;
}

// ============================================================================
// DELEGATED SWAP CONSTANTS
// ============================================================================

const DELEGATED_SERVICE_FEE_PERCENT = 1;
const DELEGATED_MIN_USD = 10;
const DELEGATED_MAX_USD = 500000;
const DELEGATED_SUPPORTED_CHAINS = [1, 56, 137, 42161, 10, 8453, 43114];
const DELEGATED_ROUTE_TIME = { display: '~30s - 2min', seconds: 60 };

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchCustomTokenInfo(address: string, chainId: string): Promise<CustomToken | null> {
  try {
    const isEvm = !['solana-mainnet', 'sui-mainnet'].includes(chainId);
    
    let tokenInfo: CustomToken | null = null;
    
    if (isEvm) {
      const rpcUrl = getChainRpc(chainId);
      
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          {
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_call',
            params: [{ to: address, data: '0x06fdde03' }, 'latest']
          },
          {
            jsonrpc: '2.0',
            id: 2,
            method: 'eth_call',
            params: [{ to: address, data: '0x95d89b41' }, 'latest']
          },
          {
            jsonrpc: '2.0',
            id: 3,
            method: 'eth_call',
            params: [{ to: address, data: '0x313ce567' }, 'latest']
          }
        ])
      });
      
      const results = await response.json();
      
      const decodeString = (hex: string) => {
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
        throw new Error('Could not read token contract');
      }
      
      tokenInfo = {
        address,
        symbol,
        name: name || symbol,
        decimals,
        chainId,
        isCustom: true,
        isVerified: false,
      };
    } else if (chainId === 'solana-mainnet') {
      tokenInfo = {
        address,
        symbol: address.slice(0, 6).toUpperCase(),
        name: `Token ${address.slice(0, 8)}...`,
        decimals: 9,
        chainId,
        isCustom: true,
        isVerified: false,
      };
    } else if (chainId === 'sui-mainnet') {
      tokenInfo = {
        address,
        symbol: address.split('::')[2] || 'TOKEN',
        name: `Token ${address.slice(0, 8)}...`,
        decimals: 9,
        chainId,
        isCustom: true,
        isVerified: false,
      };
    }
    
    // Fetch price from DexScreener
    if (tokenInfo) {
      try {
        const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
        if (dexRes.ok) {
          const dexData = await dexRes.json();
          if (dexData.pairs && dexData.pairs.length > 0 && dexData.pairs[0].priceUsd) {
            tokenInfo.priceUsd = parseFloat(dexData.pairs[0].priceUsd);
          }
        }
      } catch (priceError) {
        console.warn('Failed to fetch price for custom token:', priceError);
      }
    }
    
    return tokenInfo;
  } catch (error) {
    console.error('Failed to fetch token info:', error);
    return null;
  }
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function AnimatedValue({ 
  value, 
  formatter = (v: number) => v.toFixed(2),
  prefix = '',
  className = ''
}: { 
  value: number | null | undefined;
  formatter?: (v: number) => string;
  prefix?: string;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState<string>('');
  const [isVisible, setIsVisible] = useState(false);
  const prevValue = useRef<number | null>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (value === null || value === undefined || value <= 0) {
      setIsVisible(false);
      const timer = setTimeout(() => setDisplayValue(''), 150);
      prevValue.current = null;
      return () => clearTimeout(timer);
    }

    setIsVisible(true);

    if (prevValue.current === null || Math.abs(prevValue.current - value) / value > 0.1) {
      setDisplayValue(formatter(value));
      prevValue.current = value;
      return;
    }

    const startValue = prevValue.current;
    const endValue = value;
    const duration = 200;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValue + (endValue - startValue) * easeProgress;
      setDisplayValue(formatter(currentValue));

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        prevValue.current = endValue;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, formatter]);

  if (!displayValue || !isVisible) return null;

  return (
    <span className={`transition-opacity duration-200 ${isVisible ? 'opacity-100' : 'opacity-0'} ${className}`}>
      {prefix}{displayValue}
    </span>
  );
}

function SmoothOutput({
  value,
  isLoading,
  placeholder = '0.0',
  className = ''
}: {
  value: string;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const [opacity, setOpacity] = useState(1);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!value || value === '...' || isLoading) {
      if (value === '...') {
        setDisplayValue('...');
        setOpacity(0.5);
      } else {
        setOpacity(0.5);
        timeoutRef.current = setTimeout(() => {
          setDisplayValue('');
          setOpacity(1);
        }, 100);
      }
      return;
    }

    setOpacity(0.7);
    timeoutRef.current = setTimeout(() => {
      setDisplayValue(value);
      setOpacity(1);
    }, 50);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, isLoading]);

  return (
    <input
      type="text"
      value={displayValue}
      readOnly
      placeholder={placeholder}
      className={className}
      style={{ 
        opacity, 
        transition: 'opacity 150ms ease-out' 
      }}
    />
  );
}

// ============================================================================
// CUSTOM TOKEN IMPORT MODAL
// ============================================================================

function CustomTokenModal({
  isOpen,
  onClose,
  chainId,
  chainName,
  tokens,
  customTokens,
  onImport,
  onRemove,
}: {
  isOpen: boolean;
  onClose: () => void;
  chainId: string;
  chainName: string;
  tokens: Token[];
  customTokens: CustomToken[];
  onImport: (token: CustomToken) => void;
  onRemove: (address: string) => void;
}) {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleImport = async () => {
    if (!address.trim()) return;
    
    setLoading(true);
    setError('');
    
    try {
      const isEvm = !['solana-mainnet', 'sui-mainnet'].includes(chainId);
      
      if (isEvm && !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        throw new Error('Invalid EVM address format');
      }
      
      const existingListed = tokens.find(
        t => t.address?.toLowerCase() === address.toLowerCase()
      );
      if (existingListed) {
        throw new Error('Token is already listed');
      }
      
      const existingCustom = customTokens.find(
        t => t.address.toLowerCase() === address.toLowerCase() && t.chainId === chainId
      );
      if (existingCustom) {
        throw new Error('Token already imported');
      }
      
      const tokenInfo = await fetchCustomTokenInfo(address, chainId);
      
      if (!tokenInfo) {
        throw new Error('Could not read token contract. Make sure the address is correct.');
      }
      
      onImport(tokenInfo);
      setAddress('');
      onClose();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import token');
    } finally {
      setLoading(false);
    }
  };

  const chainCustomTokens = customTokens.filter(t => t.chainId === chainId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Import Custom Token</h3>
          <button
            onClick={() => {
              onClose();
              setAddress('');
              setError('');
            }}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Warning Banner */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-500 font-medium text-sm">Trade at your own risk</p>
              <p className="text-yellow-500/80 text-xs mt-1">
                Anyone can create a token with any name. Make sure you verify the token address 
                from official sources. Scam tokens may steal your funds.
              </p>
            </div>
          </div>
        </div>
        
        {/* Restrictions Notice */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
          <p className="text-blue-400 text-xs">
            <Info className="w-4 h-4 inline mr-1" />
            Custom tokens can only use <strong>Direct DEX</strong> swaps. 
            Gasless and CEX routes are not available for unverified tokens.
          </p>
        </div>
        
        {/* Chain Display */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">Network</label>
          <div className="px-4 py-2 bg-gray-800 rounded-lg text-white text-sm">
            {chainName}
          </div>
        </div>
        
        {/* Address Input */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">Token Contract Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value.trim())}
            placeholder={
              chainId === 'solana-mainnet' 
                ? 'Token mint address...' 
                : chainId === 'sui-mainnet'
                  ? '0x...::module::COIN'
                  : '0x...'
            }
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
          />
        </div>
        
        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
        
        {/* Import Button */}
        <button
          onClick={handleImport}
          disabled={!address || loading}
          className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Fetching token info...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Import Token
            </>
          )}
        </button>
        
        {/* Previously Imported */}
        {chainCustomTokens.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-800">
            <h4 className="text-sm text-gray-400 mb-3">Previously Imported</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {chainCustomTokens.map(token => (
                <div 
                  key={token.address}
                  className="flex items-center justify-between p-2 bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center">
                      <span className="text-xs text-gray-400">?</span>
                    </div>
                    <div>
                      <p className="text-sm text-white">{token.symbol}</p>
                      <p className="text-xs text-gray-500">{token.address.slice(0, 8)}...{token.address.slice(-6)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onRemove(token.address)}
                    className="text-gray-500 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SwapWidgetCore() {
  // State
  const [inputChain, setInputChain] = useState<Chain>(CHAINS[0]);
  const [outputChain, setOutputChain] = useState<Chain>(CHAINS[1]);
  const [inputToken, setInputToken] = useState<Token | null>(null);
  const [outputToken, setOutputToken] = useState<Token | null>(null);
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [isSwapping, setIsSwapping] = useState(false);

  // Custom Token State
  const [customTokens, setCustomTokens] = useState<CustomToken[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('omniswap_custom_tokens');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [showCustomTokenModal, setShowCustomTokenModal] = useState(false);
  const [customTokenModalType, setCustomTokenModalType] = useState<'input' | 'output'>('input');

  // Price & Gas State
  const [inputPrice, setInputPrice] = useState<TokenPrice | null>(null);
  const [outputPrice, setOutputPrice] = useState<TokenPrice | null>(null);
  const [gasEstimate, setGasEstimate] = useState<GasEstimate | null>(null);

  // Route Selection State
  const [selectedRoute, setSelectedRoute] = useState<'direct' | 'delegated' | 'alternate'>('direct');
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [directRouteOption, setDirectRouteOption] = useState<RouteOption | null>(null);
  const [delegatedRouteOption, setDelegatedRouteOption] = useState<RouteOption | null>(null);
  const [alternateRouteOption, setAlternateRouteOption] = useState<RouteOption | null>(null);

  // Audit State
  const [inputAudit, setInputAudit] = useState<TokenAuditResult | null>(null);
  const [outputAudit, setOutputAudit] = useState<TokenAuditResult | null>(null);
  const [isLoadingInputAudit, setIsLoadingInputAudit] = useState(false);
  const [isLoadingOutputAudit, setIsLoadingOutputAudit] = useState(false);

  // Modal States
  const [showInputAuditModal, setShowInputAuditModal] = useState(false);
  const [showOutputAuditModal, setShowOutputAuditModal] = useState(false);
  const [showNativeInfoModal, setShowNativeInfoModal] = useState(false);
  const [nativeInfoToken, setNativeInfoToken] = useState<Token | null>(null);
  const [nativeInfoChain, setNativeInfoChain] = useState<Chain | null>(null);
  const [showStatsPopup, setShowStatsPopup] = useState(false);
  const [showInputChainModal, setShowInputChainModal] = useState(false);
  const [showOutputChainModal, setShowOutputChainModal] = useState(false);
  const [showInputTokenModal, setShowInputTokenModal] = useState(false);
  const [showOutputTokenModal, setShowOutputTokenModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const statsButtonRef = useRef<HTMLButtonElement>(null);

  // Smooth transition states
  const [isPending, startTransition] = useTransition();
  const [debouncedInputAmount, setDebouncedInputAmount] = useState('');
  const [displayInputValueUsd, setDisplayInputValueUsd] = useState<number | null>(null);
  const [displayOutputValueUsd, setDisplayOutputValueUsd] = useState<number | null>(null);
  const [isCalculatingOutput, setIsCalculatingOutput] = useState(false);

  // Refs
  const prevInputValueUsd = useRef<number>(0);
  const prevOutputValueUsd = useRef<number>(0);
  const outputCalculationTimer = useRef<NodeJS.Timeout>();

  // Wallets
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const { publicKey: solanaPublicKey, connected: solanaConnected } = useSolanaWallet();
  const { suiAddress, suiConnected } = useSuiWallet();
  const { signTypedDataAsync } = useSignTypedData();

  // Non-EVM Balances
  const [solanaBalances, setSolanaBalances] = useState<TokenBalances>({});
  const [suiBalances, setSuiBalances] = useState<TokenBalances>({});

  // Get tokens for current chains (including custom tokens)
  const inputTokens = useMemo(() => {
    const listed = getTokensByChainId(inputChain.id);
    const custom = customTokens
      .filter(t => t.chainId === String(inputChain.id))
      .map(t => ({
        id: t.address,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        address: t.address,
        chainId: String(inputChain.id),
        logoUrl: '/tokens/unknown.png',
        isCustom: true as const,
        isVerified: false as const,
        priceUsd: t.priceUsd,
      }));
    return [...listed, ...custom];
  }, [inputChain.id, customTokens]);

  const outputTokens = useMemo(() => {
    const listed = getTokensByChainId(outputChain.id);
    const custom = customTokens
      .filter(t => t.chainId === String(outputChain.id))
      .map(t => ({
        id: t.address,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        address: t.address,
        chainId: String(outputChain.id),
        logoUrl: '/tokens/unknown.png',
        isCustom: true as const,
        isVerified: false as const,
        priceUsd: t.priceUsd,
      }));
    return [...listed, ...custom];
  }, [outputChain.id, customTokens]);

  // Check if current tokens are custom (unverified)
  const hasCustomToken = useMemo(() => {
    const inputIsCustom = (inputToken as any)?.isCustom === true;
    const outputIsCustom = (outputToken as any)?.isCustom === true;
    return inputIsCustom || outputIsCustom;
  }, [inputToken, outputToken]);

  // Get EVM balances
  const evmInputBalances = useEvmTokenBalances(
    inputChain.id,
    inputTokens,
    evmConnected ? evmAddress : undefined
  );
  const evmOutputBalances = useEvmTokenBalances(
    outputChain.id,
    outputTokens,
    evmConnected ? evmAddress : undefined
  );

  // Determine which balances to use based on chain type
  const inputBalances = useMemo(() => {
    if (inputChain.type === 'solana') return solanaBalances;
    if (inputChain.type === 'sui') return suiBalances;
    return evmInputBalances;
  }, [inputChain.type, solanaBalances, suiBalances, evmInputBalances]);

  const outputBalances = useMemo(() => {
    if (outputChain.type === 'solana') return solanaBalances;
    if (outputChain.type === 'sui') return suiBalances;
    return evmOutputBalances;
  }, [outputChain.type, solanaBalances, suiBalances, evmOutputBalances]);

  // Sort tokens by balance
  const sortedInputTokens = useMemo(
    () => sortTokensByBalance(inputTokens, inputBalances),
    [inputTokens, inputBalances]
  );
  const sortedOutputTokens = useMemo(
    () => sortTokensByBalance(outputTokens, outputBalances),
    [outputTokens, outputBalances]
  );

  // Custom token handlers
  const handleImportCustomToken = useCallback((token: CustomToken) => {
    const newCustomTokens = [...customTokens, token];
    setCustomTokens(newCustomTokens);
    localStorage.setItem('omniswap_custom_tokens', JSON.stringify(newCustomTokens));
    
    // Select the imported token
    const tokenForSelection = {
      id: token.address,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      address: token.address,
      chainId: token.chainId,
      logoUrl: '/tokens/unknown.png',
      isCustom: true as const,
      isVerified: false as const,
      priceUsd: token.priceUsd,
    };
    
    if (customTokenModalType === 'input') {
      setInputToken(tokenForSelection as any);
    } else {
      setOutputToken(tokenForSelection as any);
    }
  }, [customTokens, customTokenModalType]);

  const handleRemoveCustomToken = useCallback((address: string) => {
    const newCustomTokens = customTokens.filter(t => t.address.toLowerCase() !== address.toLowerCase());
    setCustomTokens(newCustomTokens);
    localStorage.setItem('omniswap_custom_tokens', JSON.stringify(newCustomTokens));
    
    // If the removed token was selected as input, reset to first available token
    if (inputToken?.address?.toLowerCase() === address.toLowerCase()) {
      const availableInputTokens = getTokensByChainId(inputChain.id);
      if (availableInputTokens.length > 0) {
        setInputToken(availableInputTokens[0]);
      } else {
        setInputToken(null);
      }
    }
    
    // If the removed token was selected as output, reset to first available token
    if (outputToken?.address?.toLowerCase() === address.toLowerCase()) {
      const availableOutputTokens = getTokensByChainId(outputChain.id);
      if (availableOutputTokens.length > 0) {
        setOutputToken(availableOutputTokens[0]);
      } else {
        setOutputToken(null);
      }
    }
  }, [customTokens, inputToken, outputToken, inputChain.id, outputChain.id]);

  const openCustomTokenModal = (type: 'input' | 'output') => {
    setCustomTokenModalType(type);
    setShowCustomTokenModal(true);
  };

  // Debounce input amount
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedInputAmount(inputAmount);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputAmount]);

  // Initialize tokens
  useEffect(() => {
    if (sortedInputTokens.length > 0) {
      // Only set token if there's no token selected OR if the current token doesn't exist in the new chain's list
      const currentTokenExistsInChain = inputToken && sortedInputTokens.some(
        t => t.address?.toLowerCase() === inputToken.address?.toLowerCase() && 
            t.symbol === inputToken.symbol
      );
      
      if (!inputToken || !currentTokenExistsInChain) {
        setInputToken(sortedInputTokens[0]);
      }
    }
  }, [inputChain.id, sortedInputTokens]); // Removed inputToken from deps to prevent loop

  useEffect(() => {
    if (sortedOutputTokens.length > 0) {
      // Only set token if there's no token selected OR if the current token doesn't exist in the new chain's list
      const currentTokenExistsInChain = outputToken && sortedOutputTokens.some(
        t => t.address?.toLowerCase() === outputToken.address?.toLowerCase() && 
            t.symbol === outputToken.symbol
      );
      
      if (!outputToken || !currentTokenExistsInChain) {
        setOutputToken(sortedOutputTokens[0]);
      }
    }
  }, [outputChain.id, sortedOutputTokens]); // Removed outputToken from deps to prevent loop

  // Fetch prices
  useEffect(() => {
    if (!inputToken) return;
    
    // For custom tokens, use stored price or try to fetch
    if ((inputToken as any)?.isCustom) {
      const customToken = customTokens.find(
        t => t.address.toLowerCase() === inputToken.address?.toLowerCase() && t.chainId === String(inputChain.id)
      );
      if (customToken?.priceUsd) {
        setInputPrice({ priceUsd: customToken.priceUsd, source: 'dexscreener' });
      } else {
        // Try to fetch price for custom token
        fetch(`https://api.dexscreener.com/latest/dex/tokens/${inputToken.address}`)
          .then(res => res.json())
          .then(data => {
            if (data.pairs?.[0]?.priceUsd) {
              setInputPrice({ priceUsd: parseFloat(data.pairs[0].priceUsd), source: 'dexscreener' });
            } else {
              setInputPrice(null);
            }
          })
          .catch(() => setInputPrice(null));
      }
      return;
    }
    
    getTokenPrice(inputChain.id, inputToken.address, inputToken.symbol).then(setInputPrice);
  }, [inputToken, inputChain.id, customTokens]);

  useEffect(() => {
    if (!outputToken) return;
    
    // For custom tokens, use stored price or try to fetch
    if ((outputToken as any)?.isCustom) {
      const customToken = customTokens.find(
        t => t.address.toLowerCase() === outputToken.address?.toLowerCase() && t.chainId === String(outputChain.id)
      );
      if (customToken?.priceUsd) {
        setOutputPrice({ priceUsd: customToken.priceUsd, source: 'dexscreener' });
      } else {
        // Try to fetch price for custom token
        fetch(`https://api.dexscreener.com/latest/dex/tokens/${outputToken.address}`)
          .then(res => res.json())
          .then(data => {
            if (data.pairs?.[0]?.priceUsd) {
              setOutputPrice({ priceUsd: parseFloat(data.pairs[0].priceUsd), source: 'dexscreener' });
            } else {
              setOutputPrice(null);
            }
          })
          .catch(() => setOutputPrice(null));
      }
      return;
    }
    
    getTokenPrice(outputChain.id, outputToken.address, outputToken.symbol).then(setOutputPrice);
  }, [outputToken, outputChain.id, customTokens]);

  // Fetch token audits
  useEffect(() => {
    if (!inputToken || isNativeToken(inputToken) || (inputToken as any)?.isCustom) {
      setInputAudit(null);
      return;
    }
    setIsLoadingInputAudit(true);
    getTokenSecurity(inputChain.id, inputToken.address)
      .then(setInputAudit)
      .finally(() => setIsLoadingInputAudit(false));
  }, [inputToken, inputChain.id]);

  useEffect(() => {
    if (!outputToken || isNativeToken(outputToken) || (outputToken as any)?.isCustom) {
      setOutputAudit(null);
      return;
    }
    setIsLoadingOutputAudit(true);
    getTokenSecurity(outputChain.id, outputToken.address)
      .then(setOutputAudit)
      .finally(() => setIsLoadingOutputAudit(false));
  }, [outputToken, outputChain.id]);

  // Estimate gas
  useEffect(() => {
    if (!inputToken || !outputToken || !debouncedInputAmount || typeof inputChain.id !== 'number') {
      setGasEstimate(null);
      return;
    }

    const amount = parseFloat(debouncedInputAmount);
    if (isNaN(amount) || amount <= 0) {
      setGasEstimate(null);
      return;
    }

    const isCrossChain = inputChain.id !== outputChain.id;
    const nativePriceUsd = inputPrice?.priceUsd || 0;

    const timer = setTimeout(() => {
      estimateSwapGas(
        inputChain.id as number,
        inputToken.address,
        outputToken.address,
        BigInt(Math.floor(amount * 10 ** inputToken.decimals)),
        isCrossChain,
        nativePriceUsd
      ).then(setGasEstimate);
    }, 300);

    return () => clearTimeout(timer);
  }, [inputToken, outputToken, debouncedInputAmount, inputChain, outputChain, inputPrice]);

  // Calculate output
  useEffect(() => {
    if (outputCalculationTimer.current) {
      clearTimeout(outputCalculationTimer.current);
    }

    if (!debouncedInputAmount || parseFloat(debouncedInputAmount) <= 0) {
      startTransition(() => {
        setOutputAmount('');
        setDisplayInputValueUsd(null);
        setDisplayOutputValueUsd(null);
      });
      setIsCalculatingOutput(false);
      return;
    }

    const amount = parseFloat(debouncedInputAmount);

    // Check if we have prices (works for both regular and custom tokens now)
    if (inputPrice?.priceUsd && outputPrice?.priceUsd && outputPrice.priceUsd > 0) {
      const inputValueUsd = amount * inputPrice.priceUsd;
      const outputValueUsd = inputValueUsd * 0.997;
      const outputAmt = outputValueUsd / outputPrice.priceUsd;

      const inputUsdChanged = prevInputValueUsd.current === 0 || 
        Math.abs(prevInputValueUsd.current - inputValueUsd) / inputValueUsd > 0.0001;
      const outputUsdChanged = prevOutputValueUsd.current === 0 || 
        Math.abs(prevOutputValueUsd.current - outputValueUsd) / outputValueUsd > 0.0001;

      outputCalculationTimer.current = setTimeout(() => {
        startTransition(() => {
          setOutputAmount(outputAmt.toFixed(6));
          
          if (inputUsdChanged) {
            setDisplayInputValueUsd(inputValueUsd);
            prevInputValueUsd.current = inputValueUsd;
          }
          
          if (outputUsdChanged) {
            setDisplayOutputValueUsd(outputValueUsd);
            prevOutputValueUsd.current = outputValueUsd;
          }
        });
        setIsCalculatingOutput(false);
      }, 50);
    } else if ((inputToken as any)?.isCustom || (outputToken as any)?.isCustom) {
      // Custom token without price - show estimate
      setIsCalculatingOutput(true);
      outputCalculationTimer.current = setTimeout(() => {
        startTransition(() => {
          setOutputAmount('~' + (amount * 0.997).toFixed(6));
          setDisplayInputValueUsd(null);
          setDisplayOutputValueUsd(null);
        });
        setIsCalculatingOutput(false);
      }, 100);
    } else {
      if (!inputPrice || !outputPrice) {
        setIsCalculatingOutput(true);
        setOutputAmount('...');
      }
    }

    return () => {
      if (outputCalculationTimer.current) {
        clearTimeout(outputCalculationTimer.current);
      }
    };
  }, [debouncedInputAmount, inputPrice, outputPrice, inputToken, outputToken]);

  // Calculate routes - restrict for custom tokens
  useEffect(() => {
    const calculateRoutes = async () => {
      if (!inputToken || !outputToken || !debouncedInputAmount || !inputPrice) {
        setDirectRouteOption(null);
        setDelegatedRouteOption(null);
        setAlternateRouteOption(null);
        return;
      }

      const amount = parseFloat(debouncedInputAmount);
      if (isNaN(amount) || amount <= 0) {
        setDirectRouteOption(null);
        setDelegatedRouteOption(null);
        setAlternateRouteOption(null);
        return;
      }

      const valueUsd = amount * inputPrice.priceUsd;
      const chainTiming = getDirectSwapTime(typeof inputChain.id === 'number' ? inputChain.id : 1);
      const gasUsd = gasEstimate?.estimatedCostUsd || 0;

      // DIRECT ROUTE (always available)
      const platformFeeDirect = valueUsd * PLATFORM_FEES.direct;
      const dexFee = valueUsd * 0.003;
      const directCostUsd = dexFee + gasUsd + platformFeeDirect;

      const direct: RouteOption = {
        type: 'direct',
        label: 'Direct (DEX)',
        description: '',
        estimatedTime: chainTiming.display,
        estimatedTimeSeconds: chainTiming.seconds,
        totalFeeUsd: directCostUsd,
        platformFeeUsd: platformFeeDirect,
        netOutputUsd: valueUsd - directCostUsd,
        steps: [],
        recommended: true,
      };

      startTransition(() => {
        setDirectRouteOption(direct);
      });

      // CUSTOM TOKEN RESTRICTION: Only direct route available
      if (hasCustomToken) {
        startTransition(() => {
          setDelegatedRouteOption(null);
          setAlternateRouteOption(null);
        });
        return;
      }

      // DELEGATED/GASLESS ROUTE
      const chainIdNum = typeof inputChain.id === 'number' ? inputChain.id : parseInt(inputChain.id as string);
      const canUseDelegated =
        DELEGATED_SUPPORTED_CHAINS.includes(chainIdNum) &&
        valueUsd >= DELEGATED_MIN_USD &&
        valueUsd <= DELEGATED_MAX_USD &&
        outputPrice;

      if (canUseDelegated && outputPrice) {
        const serviceFeeUsd = valueUsd * PLATFORM_FEES.delegated;
        const netOutputValueUsd = valueUsd - serviceFeeUsd;
        const isGaslessBetter = gasUsd > serviceFeeUsd;

        const delegated: RouteOption = {
          type: 'delegated',
          label: 'Gasless Route',
          description: `No gas fees • ${DELEGATED_SERVICE_FEE_PERCENT}% service fee`,
          estimatedTime: DELEGATED_ROUTE_TIME.display,
          estimatedTimeSeconds: DELEGATED_ROUTE_TIME.seconds,
          totalFeeUsd: serviceFeeUsd,
          netOutputUsd: netOutputValueUsd,
          steps: ['Sign', 'Relay'],
          gasSponsored: true,
          gasSavedUsd: gasUsd,
          serviceFeePercent: DELEGATED_SERVICE_FEE_PERCENT,
          recommended: isGaslessBetter,
        };

        startTransition(() => {
          setDelegatedRouteOption(delegated);
          if (isGaslessBetter) {
            setDirectRouteOption((prev) =>
              prev ? { ...prev, recommended: false } : null
            );
          }
        });
      } else {
        startTransition(() => {
          setDelegatedRouteOption(null);
        });
      }

      // MEXC/CEX ROUTE
      if (valueUsd >= ROUTE_THRESHOLD_USD) {
        setIsLoadingRoutes(true);
        
        try {
          const result = await compareMexcRoute(
            inputToken.symbol,
            outputToken.symbol,
            amount,
            inputChain.id,
            outputChain.id,
            directCostUsd
          );

          if (result.route) {
            const alternate: RouteOption = {
              type: 'alternate',
              label: 'CEX Route',
              description: result.route.description,
              estimatedTime: result.route.estimatedTime,
              estimatedTimeSeconds: ALTERNATE_ROUTE_TIME.total.max,
              totalFeeUsd: result.route.totalFeeUsd,
              netOutputUsd: valueUsd - result.route.totalFeeUsd,
              steps: result.route.path,
              savings: result.savings,
              recommended: result.useMexc,
            };
            
            startTransition(() => {
              setAlternateRouteOption(alternate);
              if (result.useMexc) {
                setDirectRouteOption((prev) =>
                  prev ? { ...prev, recommended: false } : null
                );
                setDelegatedRouteOption((prev) =>
                  prev ? { ...prev, recommended: false } : null
                );
              }
            });
          } else {
            startTransition(() => {
              setAlternateRouteOption(null);
            });
          }
        } catch (error) {
          console.error('[Routes] Error calculating alternate route:', error);
          startTransition(() => {
            setAlternateRouteOption(null);
          });
        } finally {
          setIsLoadingRoutes(false);
        }
      } else {
        startTransition(() => {
          setAlternateRouteOption(null);
        });
      }
    };

    calculateRoutes();
  }, [inputToken, outputToken, debouncedInputAmount, inputPrice, outputPrice, gasEstimate, inputChain.id, outputChain.id, hasCustomToken]);

  // Auto-select direct route when custom token is used
  useEffect(() => {
    if (hasCustomToken && selectedRoute !== 'direct') {
      setSelectedRoute('direct');
    }
  }, [hasCustomToken, selectedRoute]);

  // Fetch Solana balances
  useEffect(() => {
    if (!solanaConnected || !solanaPublicKey) {
      setSolanaBalances({});
      return;
    }

    const fetchSolanaBalances = async () => {
      try {
        const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://solana.publicnode.com';
        const connection = new Connection(rpcUrl);
        const balance = await connection.getBalance(solanaPublicKey);
        setSolanaBalances({ native: { balance: (balance / LAMPORTS_PER_SOL).toString() } });
      } catch (error) {
        console.error('Failed to fetch Solana balances:', error);
      }
    };

    fetchSolanaBalances();
  }, [solanaConnected, solanaPublicKey]);

  // Fetch Sui balances
  useEffect(() => {
    if (!suiConnected || !suiAddress) {
      setSuiBalances({});
      return;
    }

    const fetchSuiBalances = async () => {
      try {
        const rpcUrl = process.env.NEXT_PUBLIC_SUI_RPC || 'https://fullnode.mainnet.sui.io';
        const client = new SuiClient({ url: rpcUrl });

        let normalizedAddress = suiAddress;
        if (!normalizedAddress.startsWith('0x')) {
          normalizedAddress = `0x${normalizedAddress}`;
        }

        const balance = await client.getBalance({
          owner: normalizedAddress,
          coinType: '0x2::sui::SUI',
        });
        const newBalances: TokenBalances = {
          native: { balance: (Number(balance.totalBalance) / 1e9).toString() },
        };

        try {
          const allBalances = await client.getAllBalances({ owner: normalizedAddress });
          for (const coinBalance of allBalances) {
            if (coinBalance.coinType === '0x2::sui::SUI') continue;
            newBalances[coinBalance.coinType.toLowerCase()] = {
              balance: (Number(coinBalance.totalBalance) / 1e9).toString(),
            };
          }
        } catch {}

        setSuiBalances(newBalances);
      } catch (error) {
        console.error('Failed to fetch Sui balances:', error);
        setSuiBalances({});
      }
    };

    fetchSuiBalances();
    const interval = setInterval(fetchSuiBalances, 30000);
    return () => clearInterval(interval);
  }, [suiConnected, suiAddress]);

  const getCurrentBalance = useCallback(() => {
    if (!inputToken) return '0';
    const key = isNativeToken(inputToken) ? 'native' : inputToken.address.toLowerCase();
    return inputBalances[key]?.balance || '0';
  }, [inputToken, inputBalances]);

  const getOutputBalance = useCallback(() => {
    if (!outputToken) return '0';
    const key = isNativeToken(outputToken) ? 'native' : outputToken.address.toLowerCase();
    return outputBalances[key]?.balance || '0';
  }, [outputToken, outputBalances]);

  const handleSwapDirection = () => {
    startTransition(() => {
      setInputChain(outputChain);
      setInputToken(outputToken);
      setOutputChain(inputChain);
      setOutputToken(inputToken);
      setInputAmount(outputAmount);
      setOutputAmount(inputAmount);
      setInputPrice(outputPrice);
      setOutputPrice(inputPrice);
      setDisplayInputValueUsd(displayOutputValueUsd);
      setDisplayOutputValueUsd(displayInputValueUsd);
    });
  };

  const handleMax = () => setInputAmount(getCurrentBalance());

  const handleRouteSelect = (route: 'direct' | 'delegated' | 'alternate') => {
    // Block non-direct routes for custom tokens
    if (hasCustomToken && route !== 'direct') {
      return;
    }
    setSelectedRoute(route);
  };

  const handleSwap = async () => {
    if (!inputToken || !outputToken || !inputAmount || !outputAmount) return;

    setIsSwapping(true);

    try {
      if (selectedRoute === 'delegated' && delegatedRouteOption) {
        console.log('[Swap] Executing delegated/gasless swap...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
        console.log('[Swap] Delegated swap completed (demo)');
        
      } else if (selectedRoute === 'alternate' && alternateRouteOption) {
        console.log('[Swap] Executing CEX route...');
        await new Promise((resolve) => setTimeout(resolve, 3000));
        
      } else {
        console.log('[Swap] Executing direct route...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      let userAddress = '';
      if (inputChain.type === 'solana' && solanaPublicKey) {
        userAddress = solanaPublicKey.toString();
      } else if (inputChain.type === 'sui' && suiAddress) {
        userAddress = suiAddress;
      } else if (evmAddress) {
        userAddress = evmAddress;
      }

      const fromAmountUsd = parseFloat(inputAmount) * (inputPrice?.priceUsd || 1);
      const toAmountUsd = parseFloat(outputAmount.replace('~', '')) * (outputPrice?.priceUsd || 1);

      recordSwapTransaction({
        fromChainId: inputChain.id,
        toChainId: outputChain.id,
        fromToken: inputToken.address,
        toToken: outputToken.address,
        fromAmount: inputAmount,
        toAmount: outputAmount,
        fromAmountUsd,
        toAmountUsd,
        userAddress,
        txHash: `0x${Math.random().toString(16).slice(2)}`,
        status: 'completed',
        route: selectedRoute,
        platformFeeUsd: selectedRoute === 'direct' 
          ? directRouteOption?.platformFeeUsd 
          : selectedRoute === 'delegated'
          ? delegatedRouteOption?.totalFeeUsd
          : alternateRouteOption?.platformFeeUsd,
        timestamp: Date.now(),
      });

      startTransition(() => {
        setInputAmount('');
        setOutputAmount('');
        setSelectedRoute('direct');
        setDisplayInputValueUsd(null);
        setDisplayOutputValueUsd(null);
      });
    } catch (error) {
      console.error('Swap failed:', error);
    } finally {
      setIsSwapping(false);
    }
  };

  const handleShowNativeInfo = (token: Token, chain: Chain) => {
    setNativeInfoToken(token);
    setNativeInfoChain(chain);
    setShowNativeInfoModal(true);
  };

  const isConnected = useMemo(() => {
    if (inputChain.type === 'solana') return solanaConnected;
    if (inputChain.type === 'sui') return suiConnected;
    return evmConnected;
  }, [inputChain.type, solanaConnected, suiConnected, evmConnected]);

  const getButtonText = () => {
    if (!isConnected) return 'Connect Wallet';
    if (!inputAmount) return 'Enter Amount';
    if (isSwapping) {
      if (selectedRoute === 'delegated') return 'Signing...';
      if (selectedRoute === 'alternate') return 'Processing...';
      return 'Swapping...';
    }
    if (selectedRoute === 'delegated') return 'Sign & Swap (Gasless)';
    if (selectedRoute === 'alternate') return 'Execute Trade';
    return 'Swap';
  };

  const getButtonClass = () => {
    const base = 'w-full mt-4 py-4 font-bold rounded-xl transition-all duration-200 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white transform active:scale-[0.98]';
    if (selectedRoute === 'delegated') {
      return `${base} bg-green-600 hover:bg-green-700`;
    }
    if (selectedRoute === 'alternate') {
      return `${base} bg-purple-600 hover:bg-purple-700`;
    }
    return `${base} bg-blue-600 hover:bg-blue-700`;
  };

  const inputValueUsd = displayInputValueUsd ?? (
    inputAmount && inputPrice ? parseFloat(inputAmount) * inputPrice.priceUsd : 0
  );
  const outputValueUsd = displayOutputValueUsd ?? (
    outputAmount && outputPrice && outputAmount !== '...' && !outputAmount.startsWith('~') 
      ? parseFloat(outputAmount) * outputPrice.priceUsd 
      : 0
  );

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-xl border border-gray-200 dark:border-gray-800">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="relative flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Swap</h2>
            <button
              ref={statsButtonRef}
              onClick={() => setShowStatsPopup(!showStatsPopup)}
              className={`p-1.5 rounded-lg transition-colors ${
                showStatsPopup
                  ? 'bg-blue-100 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              title="Platform Statistics"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
            <StatsPopup
              isOpen={showStatsPopup}
              onClose={() => setShowStatsPopup(false)}
              anchorRef={statsButtonRef}
            />
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
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
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>

        {/* Settings Panel */}
        <div 
          className={`overflow-hidden transition-all duration-300 ease-out ${
            showSettings ? 'max-h-40 opacity-100 mb-4' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                Slippage Tolerance
              </span>
              <div className="flex items-center gap-2">
                {['0.1', '0.5', '1.0'].map((val) => (
                  <button
                    key={val}
                    onClick={() => setSlippage(val)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-all duration-200 ${
                      slippage === val
                        ? 'bg-blue-600 text-white scale-105'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {val}%
                  </button>
                ))}
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={!['0.1', '0.5', '1.0'].includes(slippage) ? slippage : ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        setSlippage('');
                        return;
                      }
                      const numValue = parseFloat(value);
                      if (!isNaN(numValue) && numValue >= 0 && numValue <= 49) setSlippage(value);
                    }}
                    onBlur={() => {
                      if (!slippage || parseFloat(slippage) <= 0) setSlippage('0.5');
                    }}
                    placeholder="Custom"
                    className={`w-16 px-2 py-1.5 text-sm text-center bg-gray-200 dark:bg-gray-700 rounded-lg outline-none transition-all duration-200
                      [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                      ${
                        !['0.1', '0.5', '1.0'].includes(slippage) && slippage !== ''
                          ? 'ring-2 ring-blue-500 text-gray-900 dark:text-white'
                          : 'text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500'
                      }`}
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">%</span>
                </div>
              </div>
            </div>

            <div 
              className={`overflow-hidden transition-all duration-300 ${
                parseFloat(slippage) > 5 ? 'max-h-20 opacity-100 mt-3' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="flex items-center gap-2 p-2 bg-yellow-100 dark:bg-yellow-500/10 border border-yellow-300 dark:border-yellow-500/30 rounded-lg">
                <svg
                  className="w-4 h-4 text-yellow-600 dark:text-yellow-500 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span className="text-xs text-yellow-700 dark:text-yellow-500">
                  High slippage ({slippage}%). Your transaction may be frontrun.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Custom Token Warning Banner */}
        {hasCustomToken && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-yellow-500 text-xs font-medium">Unverified Token</p>
                <p className="text-yellow-500/80 text-xs mt-0.5">
                  Only Direct DEX swaps available. Gasless and CEX routes disabled for safety.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* INPUT */}
        <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 mb-2 transition-colors duration-200">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">From</span>
              {(inputToken as any)?.isCustom ? (
                <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-500 text-[10px] rounded uppercase font-medium">
                  Unverified
                </span>
              ) : isNativeToken(inputToken) ? (
                <NativeTokenBadge
                  symbol={inputToken!.symbol}
                  onClick={() => handleShowNativeInfo(inputToken!, inputChain)}
                />
              ) : inputAudit ? (
                <RiskBadge level={inputAudit.riskLevel} onClick={() => setShowInputAuditModal(true)} />
              ) : isLoadingInputAudit ? (
                <span className="w-12 h-5 bg-gray-300 dark:bg-gray-700 animate-pulse rounded" />
              ) : null}
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400 tabular-nums">
              Balance: {formatBalance(getCurrentBalance())}
            </span>
          </div>

          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setShowInputChainModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-xl transition-colors duration-200"
            >
              <ChainLogo chainId={inputChain.id} size={20} />
              <span className="text-gray-900 dark:text-white text-sm font-medium">
                {inputChain.name}
              </span>
              <svg
                className="w-4 h-4 text-gray-500 dark:text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <button
              onClick={() => setShowInputTokenModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-xl flex-1 transition-colors duration-200"
            >
              {inputToken && <TokenLogo token={inputToken} size={20} />}
              <span className="text-gray-900 dark:text-white font-medium">
                {inputToken?.symbol || 'Select'}
              </span>
              {(inputToken as any)?.isCustom && (
                <span className="text-yellow-500 text-xs">⚠</span>
              )}
              <svg
                className="w-4 h-4 text-gray-500 dark:text-gray-400 ml-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              placeholder="0.0"
              className="flex-1 bg-transparent text-2xl text-gray-900 dark:text-white outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              onClick={handleMax}
              className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-600/30 transition-colors duration-200"
            >
              MAX
            </button>
          </div>

          <div className="mt-1 h-4">
            {(inputToken as any)?.isCustom && !inputPrice ? (
              <span className="text-xs text-gray-500 dark:text-gray-400">Price unavailable</span>
            ) : (
              <AnimatedValue
                value={inputValueUsd > 0 ? inputValueUsd : null}
                formatter={formatUsd}
                prefix="≈ "
                className="text-xs text-gray-500 dark:text-gray-400 tabular-nums"
              />
            )}
          </div>
        </div>

        {/* Swap Direction */}
        <div className="flex justify-center -my-2 relative z-10">
          <button
            onClick={handleSwapDirection}
            className="p-2 bg-gray-100 dark:bg-gray-800 border-4 border-white dark:border-gray-900 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 hover:rotate-180"
          >
            <svg
              className="w-5 h-5 text-blue-600 dark:text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
              />
            </svg>
          </button>
        </div>

        {/* OUTPUT */}
        <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 mt-2 transition-colors duration-200">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">To</span>
              {(outputToken as any)?.isCustom ? (
                <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-500 text-[10px] rounded uppercase font-medium">
                  Unverified
                </span>
              ) : isNativeToken(outputToken) ? (
                <NativeTokenBadge
                  symbol={outputToken!.symbol}
                  onClick={() => handleShowNativeInfo(outputToken!, outputChain)}
                />
              ) : outputAudit ? (
                <RiskBadge
                  level={outputAudit.riskLevel}
                  onClick={() => setShowOutputAuditModal(true)}
                />
              ) : isLoadingOutputAudit ? (
                <span className="w-12 h-5 bg-gray-300 dark:bg-gray-700 animate-pulse rounded" />
              ) : null}
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400 tabular-nums">
              Balance: {formatBalance(getOutputBalance())}
            </span>
          </div>

          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setShowOutputChainModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-xl transition-colors duration-200"
            >
              <ChainLogo chainId={outputChain.id} size={20} />
              <span className="text-gray-900 dark:text-white text-sm font-medium">
                {outputChain.name}
              </span>
              <svg
                className="w-4 h-4 text-gray-500 dark:text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <button
              onClick={() => setShowOutputTokenModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-xl flex-1 transition-colors duration-200"
            >
              {outputToken && <TokenLogo token={outputToken} size={20} />}
              <span className="text-gray-900 dark:text-white font-medium">
                {outputToken?.symbol || 'Select'}
              </span>
              {(outputToken as any)?.isCustom && (
                <span className="text-yellow-500 text-xs">⚠</span>
              )}
              <svg
                className="w-4 h-4 text-gray-500 dark:text-gray-400 ml-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          <SmoothOutput
            value={outputAmount}
            isLoading={isCalculatingOutput}
            placeholder="0.0"
            className="w-full bg-transparent text-2xl text-gray-900 dark:text-white outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />

          <div className="mt-1 h-4">
            {(outputToken as any)?.isCustom && !outputPrice ? (
              <span className="text-xs text-gray-500 dark:text-gray-400">Price unavailable</span>
            ) : (
              <AnimatedValue
                value={outputValueUsd > 0 ? outputValueUsd : null}
                formatter={formatUsd}
                prefix="≈ "
                className="text-xs text-gray-500 dark:text-gray-400 tabular-nums"
              />
            )}
          </div>
        </div>

        {/* Route Comparison Panel */}
        <div 
          className={`transition-all duration-300 ease-out ${
            inputAmount && parseFloat(inputAmount) > 0 && inputToken && outputToken
              ? 'opacity-100 max-h-96'
              : 'opacity-0 max-h-0 overflow-hidden'
          }`}
        >
          <RouteComparisonPanel
            directRoute={directRouteOption}
            delegatedRoute={hasCustomToken ? null : delegatedRouteOption}
            alternateRoute={hasCustomToken ? null : alternateRouteOption}
            selectedRoute={selectedRoute}
            onSelectRoute={handleRouteSelect}
            isLoading={isLoadingRoutes}
            valueUsd={inputValueUsd}
            threshold={ROUTE_THRESHOLD_USD}
          />
        </div>

        {/* Route Info */}
        <div 
          className={`transition-all duration-300 ease-out ${
            inputAmount && outputAmount && inputToken && outputToken && outputAmount !== '...'
              ? 'opacity-100 max-h-96 mt-4'
              : 'opacity-0 max-h-0 overflow-hidden'
          }`}
        >
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Rate</span>
              <span className="text-gray-900 dark:text-white tabular-nums">
                {inputToken && outputToken && inputAmount && outputAmount && parseFloat(inputAmount) > 0 ? (
                  <>1 {inputToken.symbol} ≈ {(parseFloat(outputAmount.replace('~', '')) / parseFloat(inputAmount)).toFixed(6)} {outputToken.symbol}</>
                ) : '-'}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Route</span>
              <div className="flex items-center gap-1 text-gray-900 dark:text-white">
                <ChainLogo chainId={inputChain.id} size={16} />
                <span>{inputChain.name}</span>
                <svg
                  className="w-4 h-4 text-gray-400 dark:text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <ChainLogo chainId={outputChain.id} size={16} />
                <span>{outputChain.name}</span>
              </div>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Slippage</span>
              <span
                className={`tabular-nums ${parseFloat(slippage) > 5 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-900 dark:text-white'}`}
              >
                {slippage}%
                {parseFloat(slippage) > 5 && <span className="ml-1">⚠️</span>}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Minimum Received</span>
              <span className="text-gray-900 dark:text-white tabular-nums">
                {outputToken && outputAmount && outputAmount !== '...' ? (
                  <>{(parseFloat(outputAmount.replace('~', '')) * (1 - parseFloat(slippage) / 100)).toFixed(6)} {outputToken.symbol}</>
                ) : '-'}
              </span>
            </div>

            {selectedRoute === 'delegated' && delegatedRouteOption ? (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Service Fee</span>
                  <span className="text-gray-900 dark:text-white tabular-nums">
                    {DELEGATED_SERVICE_FEE_PERCENT}% (~${delegatedRouteOption.totalFeeUsd.toFixed(2)})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Gas</span>
                  <span className="text-green-600 dark:text-green-400">
                    Sponsored (save ~${delegatedRouteOption.gasSavedUsd?.toFixed(2)})
                  </span>
                </div>
              </>
            ) : gasEstimate && selectedRoute === 'direct' ? (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Est. Gas</span>
                <span className="text-gray-900 dark:text-white tabular-nums">
                  {formatGasCost(
                    gasEstimate.estimatedCostNative,
                    gasEstimate.estimatedCostUsd,
                    inputChain.symbol
                  )}
                </span>
              </div>
            ) : selectedRoute === 'alternate' && alternateRouteOption ? (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">CEX Fees</span>
                <span className="text-gray-900 dark:text-white tabular-nums">
                  ~${alternateRouteOption.totalFeeUsd.toFixed(2)}
                </span>
              </div>
            ) : null}

            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Type</span>
              <span
                className={
                  selectedRoute === 'delegated'
                    ? 'text-green-600 dark:text-green-400'
                    : selectedRoute === 'alternate'
                    ? 'text-purple-600 dark:text-purple-400'
                    : inputChain.id !== outputChain.id
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-green-600 dark:text-green-400'
                }
              >
                {selectedRoute === 'delegated'
                  ? 'Gasless Swap'
                  : selectedRoute === 'alternate'
                  ? 'CEX Route'
                  : inputChain.id !== outputChain.id
                  ? 'Cross-chain Swap'
                  : 'Same-chain Swap'}
              </span>
            </div>
          </div>
        </div>

        {/* Swap Button */}
        <button
          onClick={handleSwap}
          disabled={!isConnected || !inputAmount || !outputAmount || isSwapping || outputAmount === '...'}
          className={getButtonClass()}
        >
          {isSwapping ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {getButtonText()}
            </span>
          ) : (
            getButtonText()
          )}
        </button>
      </div>


      {/* Other Modals */}
      {showInputAuditModal && inputAudit && (
        <TokenAuditModal audit={inputAudit} onClose={() => setShowInputAuditModal(false)} />
      )}
      {showOutputAuditModal && outputAudit && (
        <TokenAuditModal audit={outputAudit} onClose={() => setShowOutputAuditModal(false)} />
      )}
      {showNativeInfoModal && nativeInfoToken && nativeInfoChain && (
        <NativeTokenInfoModal
          token={nativeInfoToken}
          chain={nativeInfoChain}
          onClose={() => {
            setShowNativeInfoModal(false);
            setNativeInfoToken(null);
            setNativeInfoChain(null);
          }}
        />
      )}
      {showInputChainModal && (
        <ChainSelectModal
          title="Select Source Network"
          selectedChain={inputChain}
          onSelect={setInputChain}
          onClose={() => setShowInputChainModal(false)}
        />
      )}
      {showOutputChainModal && (
        <ChainSelectModal
          title="Select Destination Network"
          selectedChain={outputChain}
          onSelect={setOutputChain}
          onClose={() => setShowOutputChainModal(false)}
        />
      )}
      {showInputTokenModal && (
        <TokenSelectModal
          chain={inputChain}
          selectedToken={inputToken}
          otherSelectedToken={outputToken}
          balances={inputBalances}
          onSelect={(token) => {
            // Update chain if token is from a different chain
            const tokenChainId = String(token.chainId);
            const currentChainId = String(inputChain.id);
            
            if (tokenChainId !== currentChainId) {
              const newChain = CHAINS.find(c => String(c.id) === tokenChainId);
              if (newChain) {
                setInputChain(newChain);
              }
            }
            setInputToken(token);
          }}
          onClose={() => setShowInputTokenModal(false)}
        />
      )}
      {showOutputTokenModal && (
        <TokenSelectModal
          chain={outputChain}
          selectedToken={outputToken}
          otherSelectedToken={inputToken}
          balances={outputBalances}
          onSelect={(token) => {
            // Update chain if token is from a different chain
            const tokenChainId = String(token.chainId);
            const currentChainId = String(outputChain.id);
            
            if (tokenChainId !== currentChainId) {
              const newChain = CHAINS.find(c => String(c.id) === tokenChainId);
              if (newChain) {
                setOutputChain(newChain);
              }
            }
            setOutputToken(token);
          }}
          onClose={() => setShowOutputTokenModal(false)}
        />
      )}
    </div>
  );
}
