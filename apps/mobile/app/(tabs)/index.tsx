// apps/mobile/app/(tabs)/index.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWalletStore } from '../../src/stores/walletStore';
import { configService } from '../../src/services/configService';
import { priceService } from '../../src/services/priceService';
import { quoteService, Quote } from '../../src/services/quoteService';
import { t } from '../../src/services/i18n';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useTheme } from '../../src/contexts/ThemeContext';

const COLORS = {
  bg: '#0a0a0f',
  card: '#12121a',
  cardLight: '#1a1a24',
  cardBorder: '#2a2a3e',
  primary: '#00D4AA',
  primaryDark: '#00A88A',
  secondary: '#6366F1',
  text: '#ffffff',
  textSecondary: '#888',
  textMuted: '#666',
  success: '#00D4AA',
  error: '#FF6B6B',
  warning: '#FF9500',
};

// Providers configuration - All supported providers
const PROVIDERS = [
  // DEX Aggregators
  { id: 'lifi', name: 'LI.FI', logo: '🔗', description: 'Cross-chain DEX aggregator', color: '#9B59B6', type: 'bridge' },
  { id: '1inch', name: '1inch', logo: '🦄', description: 'DEX aggregator', color: '#1C86EE', type: 'dex' },
  { id: 'jupiter', name: 'Jupiter', logo: '🪐', description: 'Solana DEX aggregator', color: '#00D18C', type: 'dex' },
  
  // Bridge Aggregators
  { id: 'socket', name: 'Socket', logo: '🔌', description: 'Bridge aggregator', color: '#7B3FE4', type: 'bridge' },
  { id: 'rango', name: 'Rango', logo: '🦎', description: '70+ chains supported', color: '#FF6B35', type: 'bridge' },
  
  // CEX Aggregators
  { id: 'mexc', name: 'MEXC', logo: '🟡', description: 'CEX liquidity', color: '#00D4AA', type: 'cex' },
  { id: 'changelly', name: 'Changelly', logo: '💚', description: 'Fixed & floating rates', color: '#00C26F', type: 'cex' },
  { id: 'changenow', name: 'ChangeNOW', logo: '⚡', description: 'No KYC exchange', color: '#00C8FF', type: 'cex' },
  
  // Fallback
  { id: 'estimate', name: 'Estimated', logo: '📊', description: 'Price-based estimate', color: '#888888', type: 'estimate' },
];

// Get provider config by ID
const getProviderConfig = (id: string) => PROVIDERS.find(p => p.id === id) || PROVIDERS[0];

// Token Logo Component
const TokenLogo = ({ token, size = 40 }: { token: any; size?: number }) => {
  const [imageError, setImageError] = useState(false);
  const logoUri = token?.logoURI;

  if (logoUri && !imageError) {
    return (
      <Image
        source={{ uri: logoUri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#12121a' }}
        onError={() => setImageError(true)}
      />
    );
  }

  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
  const colorIndex = (token?.symbol?.charCodeAt(0) || 0) % colors.length;

  return (
    <View style={[staticStyles.tokenLogoFallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors[colorIndex] }]}>
      <Text style={[staticStyles.tokenLogoText, { fontSize: size * 0.4 }]}>
        {token?.symbol?.slice(0, 2) || '??'}
      </Text>
    </View>
  );
};

// Chain Logo Component
const ChainLogo = ({ chain, size = 24 }: { chain: any; size?: number }) => {
  const [imageError, setImageError] = useState(false);

  if (chain?.logoURI && !imageError) {
    return (
      <Image
        source={{ uri: chain.logoURI }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <View style={[staticStyles.chainLogoFallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: chain?.color || '#666' }]}>
      <Text style={{ color: '#fff', fontSize: size * 0.5, fontWeight: 'bold' }}>
        {chain?.symbol?.charAt(0) || '?'}
      </Text>
    </View>
  );
};

export default function SwapScreen() {
  // Wallet Store
  const {
    wallets,
    activeWalletId,
    getActiveWallet,
    setActiveWallet,
    getAddressForChain,
    shortenAddress
  } = useWalletStore();

  const activeWallet = getActiveWallet();
  const settingsStore = useSettingsStore();
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);

  // State
  const [chains, setChains] = useState<any[]>([]);
  const [inputChain, setInputChain] = useState<any>(null);
  const [outputChain, setOutputChain] = useState<any>(null);
  const [inputToken, setInputToken] = useState<any>(null);
  const [outputToken, setOutputToken] = useState<any>(null);
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [inputTokens, setInputTokens] = useState<any[]>([]);
  const [outputTokens, setOutputTokens] = useState<any[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});

  // Quote State - Updated for multi-provider
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showChainModal, setShowChainModal] = useState<'input' | 'output' | null>(null);
  const [showTokenModal, setShowTokenModal] = useState<'input' | 'output' | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tokenSearchQuery, setTokenSearchQuery] = useState('');
  const [chainSearchQuery, setChainSearchQuery] = useState('');

  // Settings
  const [slippage, setSlippage] = useState('1');

  useEffect(() => {
    initializeData();
  }, []);

  // Fetch quotes when input changes - with debounce
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (inputAmount && inputToken && outputToken && inputChain && outputChain && parseFloat(inputAmount) > 0) {
        fetchQuotes();
      } else {
        setQuotes([]);
        setSelectedQuote(null);
        setOutputAmount('');
        setQuoteError(null);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [inputAmount, inputToken, outputToken, inputChain, outputChain]);

  const initializeData = async () => {
    setIsLoading(true);
    try {
      await configService.initialize();
      await settingsStore.loadSettings();
      
      const allChains = configService.getChains()
        .filter((c: any) => (c.popularity || 0) > 0)
        .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0));
      
      const visibleChains = settingsStore.getVisibleChains(allChains);
      setChains(visibleChains);

      if (visibleChains.length > 0) {
        // Set default chains
        const ethChain = visibleChains.find((c: any) => c.symbol === 'ETH') || visibleChains[0];
        const bscChain = visibleChains.find((c: any) => c.symbol === 'BNB') || visibleChains[1] || visibleChains[0];
        
        setInputChain(ethChain);
        setOutputChain(bscChain);

        // Load tokens for default chains
        if (ethChain) {
          const tokens = configService.getTokens(ethChain.id);
          setInputTokens(tokens);
          const native = tokens.find((t: any) => t.isNative) || tokens[0];
          if (native) setInputToken(native);
          loadPrices(tokens.slice(0, 10));
        }

        if (bscChain) {
          const tokens = configService.getTokens(bscChain.id);
          setOutputTokens(tokens);
          const native = tokens.find((t: any) => t.isNative) || tokens[0];
          if (native) setOutputToken(native);
          loadPrices(tokens.slice(0, 10));
        }
      }
    } catch (error) {
      console.error('[Swap] Init error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPrices = async (tokenList: any[]) => {
    const symbols = [...new Set(tokenList.map(t => t.symbol.toUpperCase()))];
    try {
      const fetchedPrices = await priceService.getPrices(symbols);
      const priceMap: Record<string, number> = {};
      
      for (const token of tokenList) {
        priceMap[`${token.chainId}-${token.address}`] = fetchedPrices[token.symbol.toUpperCase()] || 0;
      }
      
      setPrices(prev => ({ ...prev, ...priceMap }));
    } catch (error) {
      console.error('[Swap] Price fetch error:', error);
    }
  };

  // Fetch quotes from all providers
  const fetchQuotes = async () => {
    if (!inputToken || !outputToken || !inputChain || !outputChain || !inputAmount) {
      return;
    }

    setIsLoadingQuotes(true);
    setQuoteError(null);

    try {
      const userAddress = activeWallet ? getAddressForChain(inputChain.id) : undefined;

      console.log('[Swap] Fetching quotes...', {
        from: `${inputToken.symbol} on ${inputChain.name}`,
        to: `${outputToken.symbol} on ${outputChain.name}`,
        amount: inputAmount,
      });

      const fetchedQuotes = await quoteService.getQuotes({
        inputToken,
        outputToken,
        inputChain,
        outputChain,
        inputAmount,
        userAddress,
        slippage: parseFloat(slippage),
      });

      console.log('[Swap] Got quotes:', fetchedQuotes.length);

      setQuotes(fetchedQuotes);

      // Auto-select the best quote
      if (fetchedQuotes.length > 0) {
        const bestQuote = fetchedQuotes[0];
        setSelectedQuote(bestQuote);
        setOutputAmount(bestQuote.outputAmountDisplay);
      } else {
        setQuoteError('No quotes available for this pair');
        setOutputAmount('');
        setSelectedQuote(null);
      }
    } catch (error: any) {
      console.error('[Swap] Quote fetch error:', error);
      setQuoteError(error.message || 'Failed to fetch quotes');
      setQuotes([]);
      setSelectedQuote(null);
      setOutputAmount('');
    } finally {
      setIsLoadingQuotes(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await initializeData();
    if (inputAmount && parseFloat(inputAmount) > 0) {
      await fetchQuotes();
    }
    setIsRefreshing(false);
  };

  const handleChainSelect = (chain: any, type: 'input' | 'output') => {
    if (type === 'input') {
      setInputChain(chain);
      const tokens = configService.getTokens(chain.id);
      setInputTokens(tokens);
      const native = tokens.find((t: any) => t.isNative) || tokens[0];
      if (native) setInputToken(native);
      loadPrices(tokens.slice(0, 10));
    } else {
      setOutputChain(chain);
      const tokens = configService.getTokens(chain.id);
      setOutputTokens(tokens);
      const native = tokens.find((t: any) => t.isNative) || tokens[0];
      if (native) setOutputToken(native);
      loadPrices(tokens.slice(0, 10));
    }
    setShowChainModal(null);
    setChainSearchQuery('');
  };

  const handleTokenSelect = (token: any, type: 'input' | 'output') => {
    if (type === 'input') {
      setInputToken(token);
    } else {
      setOutputToken(token);
    }
    setShowTokenModal(null);
    setTokenSearchQuery('');
  };

  const handleSwapDirection = () => {
    const tempChain = inputChain;
    const tempToken = inputToken;
    const tempTokens = inputTokens;

    setInputChain(outputChain);
    setInputToken(outputToken);
    setInputTokens(outputTokens);

    setOutputChain(tempChain);
    setOutputToken(tempToken);
    setOutputTokens(tempTokens);

    setInputAmount(outputAmount);
    setOutputAmount(inputAmount);
    
    // Clear quotes when swapping
    setQuotes([]);
    setSelectedQuote(null);
  };

  const handleQuoteSelect = (quote: Quote) => {
    setSelectedQuote(quote);
    setOutputAmount(quote.outputAmountDisplay);
    setShowProviderModal(false);
  };

  const getInputPrice = () => {
    if (!inputToken) return 0;
    return prices[`${inputToken.chainId}-${inputToken.address}`] || 0;
  };

  const getOutputPrice = () => {
    if (!outputToken) return 0;
    return prices[`${outputToken.chainId}-${outputToken.address}`] || 0;
  };

  const filteredTokens = (tokens: any[]) => {
    if (!tokenSearchQuery) return tokens;
    const query = tokenSearchQuery.toLowerCase();
    return tokens.filter(t =>
      t.symbol?.toLowerCase().includes(query) ||
      t.name?.toLowerCase().includes(query)
    );
  };

  const filteredChains = chains.filter(c => {
    if (!chainSearchQuery) return true;
    const query = chainSearchQuery.toLowerCase();
    return c.name?.toLowerCase().includes(query) || c.symbol?.toLowerCase().includes(query);
  });

  const getCurrentAddress = () => {
    if (!activeWallet || !inputChain) return null;
    
    const chainType = inputChain.type || 'evm';
    
    switch (chainType) {
      case 'solana':
        return activeWallet.solanaAddress;
      case 'sui':
        return activeWallet.suiAddress;
      case 'tron':
        return activeWallet.tronAddress;
      default:
        return activeWallet.evmAddress;
    }
  };

  const isCrossChain = inputChain?.id !== outputChain?.id;

  // Get selected provider config
  const selectedProviderConfig = selectedQuote 
    ? getProviderConfig(selectedQuote.provider) 
    : null;

  // ==================== RENDER ====================
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="time-outline" size={22} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.walletSelector}
          onPress={() => setShowWalletModal(true)}
        >
          <Ionicons name="wallet-outline" size={18} color={colors.primary} />
          <Text style={styles.walletSelectorText} numberOfLines={1}>
            {activeWallet ? shortenAddress(getCurrentAddress() || '') : 'Connect'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => setShowSettingsModal(true)}
        >
          <Ionicons name="options-outline" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Cross-chain indicator */}
        {isCrossChain && (
          <View style={styles.crossChainBadge}>
            <Ionicons name="git-branch-outline" size={14} color={colors.primary} />
            <Text style={styles.crossChainText}>Cross-Chain Swap</Text>
          </View>
        )}

        {/* Input Card */}
        <View style={styles.swapCard}>
          <View style={styles.swapCardHeader}>
            <Text style={styles.swapCardLabel}>{t('you_pay')}</Text>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceText}>Balance: 0.00</Text>
              <TouchableOpacity style={styles.maxButton}>
                <Text style={styles.maxButtonText}>MAX</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Chain Selector */}
          <TouchableOpacity
            style={styles.chainSelector}
            onPress={() => setShowChainModal('input')}
          >
            <ChainLogo chain={inputChain} size={20} />
            <Text style={styles.chainSelectorText}>{inputChain?.name || 'Select Chain'}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.swapInputRow}>
            <TouchableOpacity
              style={styles.tokenSelector}
              onPress={() => setShowTokenModal('input')}
            >
              <TokenLogo token={inputToken} size={36} />
              <Text style={styles.tokenSymbol}>{inputToken?.symbol || 'Select'}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={inputAmount}
              onChangeText={setInputAmount}
            />
          </View>

          <Text style={styles.usdValue}>
            ≈ ${inputAmount ? (parseFloat(inputAmount) * getInputPrice()).toFixed(2) : '0.00'}
          </Text>
        </View>

        {/* Swap Direction Button */}
        <TouchableOpacity style={styles.swapDirectionButton} onPress={handleSwapDirection}>
          <Ionicons name="swap-vertical" size={20} color={colors.primary} />
        </TouchableOpacity>

        {/* Output Card */}
        <View style={styles.swapCard}>
          <View style={styles.swapCardHeader}>
            <Text style={styles.swapCardLabel}>{t('you_receive')}</Text>
            <Text style={styles.balanceText}>Balance: 0.00</Text>
          </View>

          {/* Chain Selector */}
          <TouchableOpacity
            style={styles.chainSelector}
            onPress={() => setShowChainModal('output')}
          >
            <ChainLogo chain={outputChain} size={20} />
            <Text style={styles.chainSelectorText}>{outputChain?.name || 'Select Chain'}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.swapInputRow}>
            <TouchableOpacity
              style={styles.tokenSelector}
              onPress={() => setShowTokenModal('output')}
            >
              <TokenLogo token={outputToken} size={36} />
              <Text style={styles.tokenSymbol}>{outputToken?.symbol || 'Select'}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.outputAmountContainer}>
              {isLoadingQuotes ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.outputAmount}>{outputAmount || '0.00'}</Text>
              )}
            </View>
          </View>

          <Text style={styles.usdValue}>
            ≈ ${outputAmount ? (parseFloat(outputAmount) * getOutputPrice()).toFixed(2) : '0.00'}
          </Text>
        </View>

        {/* Provider Selection Card - Updated */}
        <TouchableOpacity 
          style={styles.providerCard}
          onPress={() => setShowProviderModal(true)}
        >
          <View style={styles.providerInfo}>
            {selectedProviderConfig ? (
              <>
                <Text style={styles.providerEmoji}>{selectedProviderConfig.logo}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.providerName}>{selectedProviderConfig.name}</Text>
                    {selectedQuote?.isBestRate && (
                      <View style={styles.bestBadge}>
                        <Text style={styles.bestBadgeText}>BEST</Text>
                      </View>
                    )}
                    {selectedQuote?.isEstimated && (
                      <View style={[styles.bestBadge, { backgroundColor: colors.warning }]}>
                        <Text style={styles.bestBadgeText}>EST</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.providerDesc}>
                    {selectedProviderConfig.type.toUpperCase()} • {selectedProviderConfig.description}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Ionicons name="swap-horizontal" size={24} color={colors.textMuted} />
                <View>
                  <Text style={styles.providerName}>
                    {isLoadingQuotes ? 'Finding best rate...' : 'Select Route'}
                  </Text>
                  <Text style={styles.providerDesc}>
                    {quotes.length > 0 ? `${quotes.length} routes available` : 'Enter amount to see routes'}
                  </Text>
                </View>
              </>
            )}
          </View>
          <View style={styles.providerRight}>
            {quotes.length > 1 && (
              <View style={styles.routeCountBadge}>
                <Text style={styles.routeCountText}>{quotes.length}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </TouchableOpacity>

        {/* Swap Details */}
        {selectedQuote && (
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Rate</Text>
              <Text style={styles.detailValue}>
                {selectedQuote.exchangeRateDisplay}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Slippage</Text>
              <Text style={styles.detailValue}>{slippage}%</Text>
            </View>
            {selectedQuote.estimatedGasUsd !== undefined && selectedQuote.estimatedGasUsd > 0 && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Est. Gas</Text>
                <Text style={styles.detailValue}>~${selectedQuote.estimatedGasUsd.toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Est. Time</Text>
              <Text style={styles.detailValue}>
                ~{selectedQuote.estimatedTimeSeconds 
                  ? Math.ceil(selectedQuote.estimatedTimeSeconds / 60) 
                  : isCrossChain ? '2-5'
                  : '0.5'} min
              </Text>
            </View>
            {selectedQuote.priceImpact > 0.5 && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.warning }]}>Price Impact</Text>
                <Text style={[styles.detailValue, { color: colors.warning }]}>
                  -{selectedQuote.priceImpact.toFixed(2)}%
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Quote Error */}
        {quoteError && !isLoadingQuotes && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <Text style={styles.errorText}>{quoteError}</Text>
          </View>
        )}

        {/* Swap Button */}
        <TouchableOpacity
          style={[
            styles.swapButton, 
            (!inputAmount || parseFloat(inputAmount) <= 0 || !selectedQuote) && styles.swapButtonDisabled
          ]}
          disabled={!inputAmount || parseFloat(inputAmount) <= 0 || !selectedQuote}
        >
          <Text style={[
            styles.swapButtonText,
            (!inputAmount || parseFloat(inputAmount) <= 0 || !selectedQuote) && { color: colors.textMuted }
          ]}>
            {!activeWallet 
              ? 'Connect Wallet' 
              : !inputAmount || parseFloat(inputAmount) <= 0
                ? t('enter_amount')
                : isLoadingQuotes
                  ? 'Finding Best Rate...'
                  : !selectedQuote
                    ? 'No Route Available'
                    : t('swap')
            }
          </Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ==================== MODALS ==================== */}

      {/* Chain Selection Modal */}
      <Modal
        visible={showChainModal !== null}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowChainModal(null); setChainSearchQuery(''); }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => { setShowChainModal(null); setChainSearchQuery(''); }}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalDragHandle} />
            <Text style={styles.modalTitle}>Select Chain</Text>

            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search chains"
                placeholderTextColor={colors.textMuted}
                value={chainSearchQuery}
                onChangeText={setChainSearchQuery}
              />
            </View>

            <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
              {filteredChains.map((chain) => {
                const isSelected = showChainModal === 'input' 
                  ? chain.id === inputChain?.id 
                  : chain.id === outputChain?.id;
                
                return (
                  <TouchableOpacity
                    key={chain.id}
                    style={[styles.listItem, isSelected && styles.listItemSelected]}
                    onPress={() => handleChainSelect(chain, showChainModal!)}
                  >
                    <ChainLogo chain={chain} size={36} />
                    <View style={styles.listItemInfo}>
                      <Text style={styles.listItemTitle}>{chain.name}</Text>
                      <Text style={styles.listItemSubtitle}>{chain.symbol}</Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Token Selection Modal */}
      <Modal
        visible={showTokenModal !== null}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowTokenModal(null); setTokenSearchQuery(''); }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => { setShowTokenModal(null); setTokenSearchQuery(''); }}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalDragHandle} />
            <Text style={styles.modalTitle}>
              Select Token on {showTokenModal === 'input' ? inputChain?.name : outputChain?.name}
            </Text>

            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search tokens"
                placeholderTextColor={colors.textMuted}
                value={tokenSearchQuery}
                onChangeText={setTokenSearchQuery}
              />
            </View>

            <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
              {filteredTokens(showTokenModal === 'input' ? inputTokens : outputTokens).map((token, i) => {
                const price = prices[`${token.chainId}-${token.address}`] || 0;
                const isSelected = showTokenModal === 'input'
                  ? token.address === inputToken?.address
                  : token.address === outputToken?.address;

                return (
                  <TouchableOpacity
                    key={`${token.chainId}-${token.address}-${i}`}
                    style={[styles.listItem, isSelected && styles.listItemSelected]}
                    onPress={() => handleTokenSelect(token, showTokenModal!)}
                  >
                    <TokenLogo token={token} size={40} />
                    <View style={styles.listItemInfo}>
                      <Text style={styles.listItemTitle}>{token.symbol}</Text>
                      <Text style={styles.listItemSubtitle}>{token.name}</Text>
                    </View>
                    <View style={styles.listItemRight}>
                      <Text style={styles.listItemBalance}>0.00</Text>
                      <Text style={styles.listItemPrice}>${price.toFixed(2)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Provider/Quote Selection Modal - Updated */}
      <Modal
        visible={showProviderModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProviderModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowProviderModal(false)}
        >
          <View style={[styles.modalContent, { maxHeight: '85%' }]} onStartShouldSetResponder={() => true}>
            <View style={styles.modalDragHandle} />
            <Text style={styles.modalTitle}>Select Route</Text>

            {isLoadingQuotes ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Fetching best rates from {PROVIDERS.length - 1} providers...</Text>
              </View>
            ) : quotes.length === 0 ? (
              <View style={styles.noQuotes}>
                <Ionicons name="swap-horizontal" size={48} color={colors.textMuted} />
                <Text style={styles.noQuotesText}>
                  {quoteError || 'Enter an amount to see quotes'}
                </Text>
                {inputAmount && parseFloat(inputAmount) > 0 && (
                  <TouchableOpacity style={styles.retryButton} onPress={fetchQuotes}>
                    <Ionicons name="refresh" size={18} color={colors.primary} />
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <>
                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                  {quotes.map((quote, index) => {
                    const providerConfig = getProviderConfig(quote.provider);
                    const isSelected = selectedQuote?.id === quote.id;
                    const isBest = index === 0;

                    return (
                      <TouchableOpacity
                        key={quote.id}
                        style={[
                          styles.quoteOption,
                          isSelected && styles.quoteOptionSelected,
                          { borderLeftColor: providerConfig.color, borderLeftWidth: 3 }
                        ]}
                        onPress={() => handleQuoteSelect(quote)}
                      >
                        {/* Provider Header */}
                        <View style={styles.quoteHeader}>
                          <View style={styles.quoteProviderInfo}>
                            <Text style={styles.quoteProviderLogo}>{providerConfig.logo}</Text>
                            <View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.quoteProviderName}>{providerConfig.name}</Text>
                                {isBest && (
                                  <View style={styles.bestBadge}>
                                    <Text style={styles.bestBadgeText}>BEST</Text>
                                  </View>
                                )}
                                {quote.isEstimated && (
                                  <View style={[styles.bestBadge, { backgroundColor: colors.warning }]}>
                                    <Text style={styles.bestBadgeText}>EST</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={styles.quoteProviderType}>
                                {providerConfig.type.toUpperCase()}
                              </Text>
                            </View>
                          </View>
                          {isSelected && (
                            <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                          )}
                        </View>

                        {/* Quote Details */}
                        <View style={styles.quoteDetails}>
                          <View style={styles.quoteMainRow}>
                            <Text style={styles.quoteOutputLabel}>You receive</Text>
                            <Text style={styles.quoteOutputAmount}>
                              {quote.outputAmountDisplay} {outputToken?.symbol}
                            </Text>
                          </View>
                          
                          <View style={styles.quoteMetaRow}>
                            <View style={styles.quoteMetaItem}>
                              <Ionicons name="trending-up" size={12} color={colors.textMuted} />
                              <Text style={styles.quoteMetaText}>
                                {quote.exchangeRateDisplay}
                              </Text>
                            </View>
                            
                            {quote.estimatedGasUsd !== undefined && quote.estimatedGasUsd > 0 && (
                              <View style={styles.quoteMetaItem}>
                                <Ionicons name="flame" size={12} color={colors.textMuted} />
                                <Text style={styles.quoteMetaText}>
                                  ~${quote.estimatedGasUsd.toFixed(2)}
                                </Text>
                              </View>
                            )}
                            
                            {quote.estimatedTimeSeconds !== undefined && (
                              <View style={styles.quoteMetaItem}>
                                <Ionicons name="time" size={12} color={colors.textMuted} />
                                <Text style={styles.quoteMetaText}>
                                  ~{Math.ceil(quote.estimatedTimeSeconds / 60)}m
                                </Text>
                              </View>
                            )}
                          </View>

                          {/* Price Impact Warning */}
                          {quote.priceImpact > 1 && (
                            <View style={styles.priceImpactWarning}>
                              <Ionicons name="warning" size={14} color={colors.warning} />
                              <Text style={styles.priceImpactText}>
                                {quote.priceImpact.toFixed(2)}% price impact
                              </Text>
                            </View>
                          )}

                          {/* Route Steps */}
                          {quote.route && quote.route.length > 0 && (
                            <View style={styles.routeSteps}>
                              <Text style={styles.routeStepsLabel}>Route:</Text>
                              <View style={styles.routeStepsRow}>
                                {quote.route.slice(0, 3).map((step, stepIndex) => (
                                  <View key={stepIndex} style={styles.routeStep}>
                                    <View style={[styles.routeStepDot, { backgroundColor: providerConfig.color }]} />
                                    <Text style={styles.routeStepText} numberOfLines={1}>
                                      {step.protocol}
                                    </Text>
                                    {stepIndex < Math.min(quote.route!.length - 1, 2) && (
                                      <Ionicons name="arrow-forward" size={10} color={colors.textMuted} style={{ marginHorizontal: 4 }} />
                                    )}
                                  </View>
                                ))}
                                {quote.route.length > 3 && (
                                  <Text style={styles.routeStepText}>+{quote.route.length - 3}</Text>
                                )}
                              </View>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Refresh Button */}
                <TouchableOpacity
                  style={styles.refreshQuotesButton}
                  onPress={fetchQuotes}
                  disabled={isLoadingQuotes}
                >
                  <Ionicons name="refresh" size={18} color={colors.primary} />
                  <Text style={styles.refreshQuotesText}>Refresh Quotes</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Wallet Selection Modal */}
      <Modal
        visible={showWalletModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWalletModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowWalletModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalDragHandle} />
            <Text style={styles.modalTitle}>Select Wallet</Text>

            {wallets.length === 0 ? (
              <View style={styles.noWalletView}>
                <Ionicons name="wallet-outline" size={48} color={colors.textMuted} />
                <Text style={styles.noWalletText}>No wallets available</Text>
                <Text style={styles.noWalletSubtext}>Create a wallet in the Wallet tab</Text>
              </View>
            ) : (
              <ScrollView style={styles.listContainer}>
                {wallets.map(wallet => (
                  <TouchableOpacity
                    key={wallet.id}
                    style={[
                      styles.listItem,
                      wallet.id === activeWalletId && styles.listItemSelected
                    ]}
                    onPress={() => {
                      setActiveWallet(wallet.id);
                      setShowWalletModal(false);
                    }}
                  >
                    <View style={styles.walletIcon}>
                      <Ionicons name="wallet" size={20} color={wallet.id === activeWalletId ? colors.primary : colors.textSecondary} />
                    </View>
                    <View style={styles.listItemInfo}>
                      <Text style={[styles.listItemTitle, wallet.id === activeWalletId && { color: colors.primary }]}>
                        {wallet.name}
                      </Text>
                      <Text style={styles.listItemSubtitle}>
                        {shortenAddress(wallet.evmAddress)}
                      </Text>
                    </View>
                    {wallet.id === activeWalletId && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Settings Modal */}
      <Modal
        visible={showSettingsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSettingsModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalDragHandle} />
            <Text style={styles.modalTitle}>Swap Settings</Text>

            <View style={styles.settingsSection}>
              <Text style={styles.settingsLabel}>Slippage Tolerance</Text>
              <View style={styles.slippageOptions}>
                {['0.5', '1', '3'].map(value => (
                  <TouchableOpacity
                    key={value}
                    style={[styles.slippageOption, slippage === value && styles.slippageOptionActive]}
                    onPress={() => setSlippage(value)}
                  >
                    <Text style={[styles.slippageOptionText, slippage === value && styles.slippageOptionTextActive]}>
                      {value}%
                    </Text>
                  </TouchableOpacity>
                ))}
                <View style={styles.slippageCustom}>
                  <TextInput
                    style={styles.slippageCustomInput}
                    placeholder="Custom"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    value={!['0.5', '1', '3'].includes(slippage) ? slippage : ''}
                    onChangeText={setSlippage}
                  />
                  <Text style={styles.slippageCustomPercent}>%</Text>
                </View>
              </View>
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.settingsLabel}>Connected Address</Text>
              <View style={styles.addressDisplay}>
                <Text style={styles.addressText} numberOfLines={1}>
                  {getCurrentAddress() || 'Not connected'}
                </Text>
              </View>
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.settingsLabel}>Available Providers</Text>
              <View style={styles.providersGrid}>
                {PROVIDERS.filter(p => p.id !== 'estimate').map(provider => (
                  <View key={provider.id} style={styles.providerChip}>
                    <Text style={styles.providerChipEmoji}>{provider.logo}</Text>
                    <Text style={styles.providerChipName}>{provider.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.bg 
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: { 
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  walletSelectorText: { 
    color: colors.text, 
    fontSize: 14, 
    fontWeight: '600',
  },

  // Content
  content: { 
    flex: 1, 
    paddingHorizontal: 16 
  },

  // Cross-chain badge
  crossChainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 16,
    gap: 6,
  },
  crossChainText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },

  // Swap Card
  swapCard: { 
    backgroundColor: colors.card, 
    borderRadius: 20, 
    padding: 16, 
    marginBottom: 8 
  },
  swapCardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  swapCardLabel: { 
    color: colors.textSecondary, 
    fontSize: 14,
    fontWeight: '500',
  },
  balanceRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  balanceText: { 
    color: colors.textMuted, 
    fontSize: 12 
  },
  maxButton: { 
    backgroundColor: colors.primary + '20', 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 6 
  },
  maxButtonText: { 
    color: colors.primary, 
    fontSize: 11, 
    fontWeight: '700' 
  },

  // Chain Selector
  chainSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardLight,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
    gap: 6,
  },
  chainSelectorText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },

  // Token Selector
  swapInputRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between' 
  },
  tokenSelector: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10,
    backgroundColor: colors.cardLight,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
  },
  tokenSymbol: { 
    color: colors.text, 
    fontSize: 18, 
    fontWeight: '700' 
  },
  amountInput: { 
    flex: 1, 
    textAlign: 'right', 
    color: colors.text, 
    fontSize: 28, 
    fontWeight: '600' 
  },
  outputAmountContainer: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    minHeight: 40,
  },
  outputAmount: { 
    color: colors.text, 
    fontSize: 28, 
    fontWeight: '600' 
  },
  usdValue: { 
    color: colors.textMuted, 
    fontSize: 13, 
    textAlign: 'right', 
    marginTop: 8 
  },

  // Swap Direction
  swapDirectionButton: {
    alignSelf: 'center',
    backgroundColor: colors.card,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: -18,
    zIndex: 1,
    borderWidth: 4,
    borderColor: colors.bg,
  },

  // Provider Card
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 16,
    marginTop: 16,
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  providerEmoji: {
    fontSize: 24,
  },
  providerName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  providerDesc: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  providerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeCountBadge: {
    backgroundColor: colors.primary + '30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  routeCountText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },

  // Details Card
  detailsCard: {
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 16,
    marginTop: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  detailValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
  },

  // Error Card
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error + '20',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    flex: 1,
  },

  // Swap Button
  swapButton: { 
    backgroundColor: colors.primary, 
    paddingVertical: 18, 
    borderRadius: 16, 
    alignItems: 'center', 
    marginTop: 20 
  },
  swapButtonDisabled: { 
    backgroundColor: colors.cardLight,
  },
  swapButtonText: { 
    color: '#000', 
    fontSize: 17, 
    fontWeight: '700' 
  },

  // Modal
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.7)', 
    justifyContent: 'flex-end' 
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalDragHandle: { 
    width: 40, 
    height: 4, 
    backgroundColor: colors.cardBorder, 
    borderRadius: 2, 
    alignSelf: 'center', 
    marginBottom: 16 
  },
  modalTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: colors.text, 
    textAlign: 'center', 
    marginBottom: 20 
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },

  // List
  listContainer: {
    maxHeight: 400,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  listItemSelected: {
    backgroundColor: colors.primary + '15',
  },
  listItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  listItemTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  listItemSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  listItemRight: {
    alignItems: 'flex-end',
  },
  listItemBalance: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  listItemPrice: {
    color: colors.textMuted,
    fontSize: 12,
  },

  // Quote Options - New
  quoteOption: {
    backgroundColor: colors.cardLight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  quoteOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  quoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  quoteProviderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quoteProviderLogo: {
    fontSize: 28,
  },
  quoteProviderName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  quoteProviderType: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  quoteDetails: {
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingTop: 12,
  },
  quoteMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quoteOutputLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  quoteOutputAmount: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  quoteMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  quoteMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quoteMetaText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  priceImpactWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.warning + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  priceImpactText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '500',
  },
  routeSteps: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  routeStepsLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 6,
  },
  routeStepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  routeStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeStepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  routeStepText: {
    color: colors.textSecondary,
    fontSize: 11,
  },

  // Loading
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },

  // No Quotes
  noQuotes: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noQuotesText: {
    color: colors.textMuted,
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  retryButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },

  // Refresh Quotes Button
  refreshQuotesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    marginTop: 12,
  },
  refreshQuotesText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },

  // Best Badge
  bestBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bestBadgeText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '700',
  },

  // Wallet
  walletIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cardLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noWalletView: { 
    alignItems: 'center', 
    paddingVertical: 40 
  },
  noWalletText: { 
    color: colors.text, 
    fontSize: 16, 
    fontWeight: '600', 
    marginTop: 16 
  },
  noWalletSubtext: { 
    color: colors.textMuted, 
    fontSize: 14, 
    marginTop: 4 
  },

  // Settings
  settingsSection: { 
    marginBottom: 24 
  },
  settingsLabel: { 
    color: colors.textSecondary, 
    fontSize: 14, 
    marginBottom: 12,
    fontWeight: '500',
  },
  slippageOptions: { 
    flexDirection: 'row', 
    gap: 10 
  },
  slippageOption: { 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    backgroundColor: colors.cardLight, 
    borderRadius: 10 
  },
  slippageOptionActive: { 
    backgroundColor: colors.primary 
  },
  slippageOptionText: { 
    color: colors.textSecondary, 
    fontSize: 14, 
    fontWeight: '600' 
  },
  slippageOptionTextActive: { 
    color: '#000' 
  },
  slippageCustom: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: colors.cardLight, 
    borderRadius: 10, 
    paddingHorizontal: 14 
  },
  slippageCustomInput: { 
    flex: 1, 
    color: colors.text, 
    fontSize: 14 
  },
  slippageCustomPercent: { 
    color: colors.textMuted, 
    fontSize: 14 
  },
  addressDisplay: { 
    backgroundColor: colors.cardLight, 
    padding: 14, 
    borderRadius: 10 
  },
  addressText: { 
    color: colors.text, 
    fontSize: 13,
    fontFamily: 'monospace',
  },
  providersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  providerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.cardLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  providerChipEmoji: {
    fontSize: 14,
  },
  providerChipName: {
    color: colors.textSecondary,
    fontSize: 12,
  },
});

const staticStyles = StyleSheet.create({
  tokenLogoFallback: { 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  tokenLogoText: { 
    color: '#fff', 
    fontWeight: 'bold' 
  },
  chainLogoFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
