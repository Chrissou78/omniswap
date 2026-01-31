import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useWalletStore, WalletInfo } from '../../src/stores/walletStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useTheme } from '../../src/contexts/ThemeContext';
import { configService, Chain, Token } from '../../src/services/configService';
import { priceService } from '../../src/services/priceService';
import { t } from '../../src/services/i18n';

import {
  BiometricAnimation,
  Toast,
  ToastConfig,
  TokenLogo,
  DismissibleModal,
  WalletListModal,
  ReceiveModal,
  SendModal,
  BuyModal,
  TokenGroupModal,
  CreateWalletModal,
  ImportWalletModal,
} from '../../src/components/wallet';

interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  value: number;
  price: number;
  change24h: number;
  chainId: string | number;
  chainName: string;
  chainColor?: string;
  address: string;
  logoURI?: string;
}

interface GroupedToken {
  symbol: string;
  name: string;
  totalBalance: number;
  totalValue: number;
  avgPrice: number;
  chains: {
    chainId: string | number;
    chainName: string;
    chainColor?: string;
    address: string;
    balance: string;
    value: number;
    price: number;
    logoURI?: string;
  }[];
  logoURI?: string;
}

export default function WalletScreen() {
  const { colors, isDark } = useTheme();
  const settingsStore = useSettingsStore();
  const autoLockTimeout = settingsStore.autoLockMinutes * 60 * 1000;

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);
  const [pin, setPin] = useState('');

  // Wallet state
  const walletStore = useWalletStore();
  const [activeWallet, setActiveWallet] = useState<WalletInfo | null>(null);
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Token state
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);

  // Modal state
  const [showWalletList, setShowWalletList] = useState(false);
  const [showWalletDetails, setShowWalletDetails] = useState(false);
  const [selectedWalletForDetails, setSelectedWalletForDetails] = useState<WalletInfo | null>(null);
  const [showAddresses, setShowAddresses] = useState(false);
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [showCreateWallet, setShowCreateWallet] = useState(false);
  const [showImportWallet, setShowImportWallet] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showBuy, setShowBuy] = useState(false);
  
  // Token detail modal
  const [selectedGroupedToken, setSelectedGroupedToken] = useState<GroupedToken | null>(null);
  const [showTokenDetail, setShowTokenDetail] = useState(false);

  // Toast state
  const [toast, setToast] = useState<ToastConfig>({ message: '', type: 'info', visible: false });

  // Auto-lock timer
  const lastActivityRef = useRef<number>(Date.now());
  const lockTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type, visible: true });
  };

  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Group tokens by symbol
  const groupedTokens = useMemo(() => {
    const groups: Record<string, GroupedToken> = {};

    for (const token of tokens) {
      const key = token.symbol.toUpperCase();

      if (!groups[key]) {
        groups[key] = {
          symbol: token.symbol,
          name: token.name,
          totalBalance: 0,
          totalValue: 0,
          avgPrice: token.price,
          chains: [],
          logoURI: token.logoURI,
        };
      }

      const balance = parseFloat(token.balance) || 0;
      groups[key].totalBalance += balance;
      groups[key].totalValue += token.value;
      groups[key].chains.push({
        chainId: token.chainId,
        chainName: token.chainName,
        chainColor: token.chainColor,
        address: token.address,
        balance: token.balance,
        value: token.value,
        price: token.price,
        logoURI: token.logoURI,
      });

      if (!groups[key].logoURI && token.logoURI) {
        groups[key].logoURI = token.logoURI;
      }
    }

    const groupedArray = Object.values(groups).map(group => {
      if (group.totalBalance > 0) {
        group.avgPrice = group.totalValue / group.totalBalance;
      }
      group.chains.sort((a, b) => b.value - a.value);
      return group;
    });

    groupedArray.sort((a, b) => {
      if (b.totalValue !== a.totalValue) return b.totalValue - a.totalValue;
      return b.avgPrice - a.avgPrice;
    });

    return groupedArray;
  }, [tokens]);

  // Filter grouped tokens by search
  const filteredGroupedTokens = useMemo(() => {
    if (!searchQuery) return groupedTokens;
    
    const query = searchQuery.toLowerCase();
    return groupedTokens.filter(token =>
      token.symbol.toLowerCase().includes(query) ||
      token.name.toLowerCase().includes(query) ||
      token.chains.some(c => c.chainName.toLowerCase().includes(query))
    );
  }, [groupedTokens, searchQuery]);

  // Auto-lock logic
  useEffect(() => {
    if (!isAuthenticated || autoLockTimeout === 0) return;

    const checkInactivity = () => {
      const now = Date.now();
      if (now - lastActivityRef.current > autoLockTimeout) {
        handleLock();
      }
    };

    lockTimerRef.current = setInterval(checkInactivity, 30000);

    return () => {
      if (lockTimerRef.current) {
        clearInterval(lockTimerRef.current);
      }
    };
  }, [isAuthenticated, autoLockTimeout]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        updateActivity();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  // Initialize
  useEffect(() => {
    const init = async () => {
      await configService.initialize();
      await settingsStore.loadSettings();
      walletStore.initialize();
    };
    init();
  }, []);

  // Load active wallet
  useEffect(() => {
    if (isAuthenticated) {
      const wallet = walletStore.getActiveWallet();
      setActiveWallet(wallet);
      if (wallet) {
        loadTokenBalances();
      }
    }
  }, [isAuthenticated, walletStore.activeWalletId]);

  // Handle lock
  const handleLock = useCallback(async () => {
    try {
      setIsAuthenticated(false);
      setActiveWallet(null);
      setTokens([]);
      setTotalBalance(0);
      if (walletStore.lock) {
        await walletStore.lock();
      }
    } catch (error) {
      console.warn('[Wallet] Lock error (ignored):', error);
      setIsAuthenticated(false);
    }
  }, [walletStore]);

  // Biometric authentication
  const handleBiometricAuth = async () => {
    setIsAuthenticating(true);
    try {
      const success = await walletStore.authenticate();
      if (success) {
        setIsAuthenticated(true);
        updateActivity();
        showToast(t('wallet_unlocked'), 'success');
      } else {
        setShowPinInput(true);
      }
    } catch (error) {
      console.error('[Wallet] Auth error:', error);
      setShowPinInput(true);
    } finally {
      setIsAuthenticating(false);
    }
  };

  // PIN authentication
  const handlePinAuth = async () => {
    if (pin.length < 6) {
      showToast('PIN must be at least 6 digits', 'error');
      return;
    }
    setIsAuthenticated(true);
    setShowPinInput(false);
    setPin('');
    updateActivity();
  };

  // Load ALL tokens (filtered by visible chains)
  const loadTokenBalances = async () => {
    setIsLoadingTokens(true);
    updateActivity();

    try {
      const allTokens: TokenBalance[] = [];
      let total = 0;

      const allChains = configService.getChains();
      const chains = settingsStore.getVisibleChains(allChains);

      if (chains && chains.length > 0) {
        const tokenInfos: Array<{
          chain: Chain;
          token: Token;
          chainId: string | number;
          address: string;
          symbol: string;
        }> = [];

        for (const chain of chains) {
          const chainTokens = configService.getTokens(chain.id);

          for (const token of chainTokens) {
            tokenInfos.push({
              chain,
              token,
              chainId: chain.id,
              address: token.address,
              symbol: token.symbol,
            });
          }
        }

        let prices: Record<string, number> = {};

        try {
          prices = await priceService.getPricesByContracts(
            tokenInfos.map(t => ({
              chainId: t.chainId,
              address: t.address,
              symbol: t.symbol,
            }))
          );
        } catch (error) {
          console.warn('[Wallet] Price fetch error:', error);
          const symbols = [...new Set(tokenInfos.map(t => t.symbol.toUpperCase()))];
          prices = await priceService.getPrices(symbols);
        }

        for (const { chain, token } of tokenInfos) {
          const price = prices[token.symbol.toUpperCase()] || 0;
          const balance = '0';
          const value = parseFloat(balance) * price;
          total += value;

          allTokens.push({
            symbol: token.symbol,
            name: token.name,
            balance,
            value,
            price,
            change24h: priceService.getChange24h(token.symbol),
            chainId: chain.id,
            chainName: chain.name,
            chainColor: chain.color,
            address: token.address,
            logoURI: token.logoURI,
          });
        }
      }

      setTokens(allTokens);
      setTotalBalance(total);
    } catch (error) {
      console.error('Failed to load tokens:', error);
    } finally {
      setIsLoadingTokens(false);
    }
  };

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    updateActivity();
    await loadTokenBalances();
    setRefreshing(false);
  }, []);

  // Handle token press
  const handleTokenPress = (groupedToken: GroupedToken) => {
    updateActivity();
    setSelectedGroupedToken(groupedToken);
    setShowTokenDetail(true);
  };

  // Wallet creation handler
  const handleWalletCreated = async (name: string, mnemonic: string): Promise<boolean> => {
    try {
      const wallet = await walletStore.importWallet(name, mnemonic);
      if (wallet) {
        setActiveWallet(walletStore.getActiveWallet());
        showToast(t('wallet_created'), 'success');
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Wallet] Create wallet error:', error);
      return false;
    }
  };

  // Wallet import handler
  const handleWalletImported = async (name: string, mnemonic: string): Promise<boolean> => {
    try {
      const wallet = await walletStore.importWallet(name, mnemonic);
      if (wallet) {
        setActiveWallet(walletStore.getActiveWallet());
        showToast(t('wallet_imported'), 'success');
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Wallet] Import wallet error:', error);
      return false;
    }
  };

  // Copy address helper
  const copyAddress = async (address: string, label: string) => {
    await Clipboard.setStringAsync(address);
    showToast(`${label} address copied`, 'success');
  };

  // Dynamic styles based on theme
  const dynamicStyles = {
    container: { flex: 1, backgroundColor: colors.bg },
    card: { backgroundColor: colors.card, borderColor: colors.cardBorder },
    text: { color: colors.text },
    textSecondary: { color: colors.textSecondary },
    textMuted: { color: colors.textMuted },
    input: { backgroundColor: colors.cardLight, borderColor: colors.border, color: colors.text },
  };

  // Unlock Screen
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, dynamicStyles.container]} edges={['top', 'left', 'right']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
        <View style={styles.unlockContainer}>
          <BiometricAnimation isAnimating={isAuthenticating} />
          <Text style={[styles.unlockTitle, dynamicStyles.text]}>{t('unlock_wallet')}</Text>
          <Text style={[styles.unlockSubtitle, dynamicStyles.textSecondary]}>{t('use_biometrics')}</Text>

          {showPinInput ? (
            <View style={styles.pinContainer}>
              <TextInput
                style={[styles.pinInput, dynamicStyles.input]}
                placeholder="Enter PIN"
                placeholderTextColor={colors.textMuted}
                value={pin}
                onChangeText={setPin}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={8}
              />
              <TouchableOpacity style={styles.unlockButton} onPress={handlePinAuth}>
                <Text style={styles.unlockButtonText}>{t('unlock')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.unlockButton, isAuthenticating && styles.unlockButtonDisabled]}
              onPress={handleBiometricAuth}
              disabled={isAuthenticating}
            >
              {isAuthenticating ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Ionicons name="finger-print" size={24} color="#000" />
                  <Text style={styles.unlockButtonText}>{t('authenticate')}</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => setShowPinInput(!showPinInput)}>
            <Text style={styles.switchAuthText}>
              {showPinInput ? t('use_biometrics') : t('use_pin')}
            </Text>
          </TouchableOpacity>
        </View>

        <Toast config={toast} onHide={() => setToast((prev) => ({ ...prev, visible: false }))} />
      </SafeAreaView>
    );
  }

  // Main Wallet Screen
  return (
    <SafeAreaView style={[styles.container, dynamicStyles.container]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={[styles.walletSelector, { backgroundColor: colors.card }]} 
          onPress={() => setShowWalletList(true)}
        >
          <View style={[styles.walletIcon, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="wallet" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.walletName, dynamicStyles.text]}>{activeWallet?.name || 'No Wallet'}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={[styles.headerButton, { backgroundColor: colors.card }]} 
            onPress={() => setShowAddresses(true)}
          >
            <Ionicons name="qr-code-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.headerButton, { backgroundColor: colors.card }]} 
            onPress={handleLock}
          >
            <Ionicons name="lock-closed-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={updateActivity}
      >
        {/* Balance Card */}
        <View style={[styles.balanceCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.balanceHeader}>
            <Text style={[styles.balanceLabel, dynamicStyles.textSecondary]}>{t('total_balance')}</Text>
            <TouchableOpacity onPress={() => { setBalanceHidden(!balanceHidden); updateActivity(); }}>
              <Ionicons name={balanceHidden ? 'eye-off' : 'eye'} size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.balanceAmount, dynamicStyles.text]}>
            {balanceHidden ? '••••••' : `$${totalBalance.toFixed(2)}`}
          </Text>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={() => { setShowSend(true); updateActivity(); }}>
              <View style={styles.actionIconContainer}>
                <Ionicons name="arrow-up" size={24} color="#fff" />
              </View>
              <Text style={[styles.actionButtonText, dynamicStyles.text]}>{t('send')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => { setShowReceive(true); updateActivity(); }}>
              <View style={styles.actionIconContainer}>
                <Ionicons name="arrow-down" size={24} color="#fff" />
              </View>
              <Text style={[styles.actionButtonText, dynamicStyles.text]}>{t('receive')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => { setShowBuy(true); updateActivity(); }}>
              <View style={[styles.actionIconContainer, { backgroundColor: '#9B59B6' }]}>
                <Ionicons name="card" size={24} color="#fff" />
              </View>
              <Text style={[styles.actionButtonText, dynamicStyles.text]}>{t('buy')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, dynamicStyles.text]}
            placeholder={t('search_tokens')}
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={(text) => { setSearchQuery(text); updateActivity(); }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Token Count */}
        <View style={styles.tokenListHeader}>
          <Text style={[styles.sectionTitle, dynamicStyles.textSecondary]}>{t('tokens')}</Text>
          <Text style={[styles.tokenCount, dynamicStyles.textMuted]}>
            {filteredGroupedTokens.length} unique • {tokens.length} total across chains
          </Text>
        </View>

        {/* Grouped Token List */}
        <View style={styles.tokenList}>
          {isLoadingTokens ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : filteredGroupedTokens.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="wallet-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyStateText, dynamicStyles.textMuted]}>
                {searchQuery ? 'No tokens found' : 'No tokens yet'}
              </Text>
            </View>
          ) : (
            filteredGroupedTokens.map((groupedToken) => (
              <TouchableOpacity
                key={groupedToken.symbol}
                style={[styles.tokenItem, { backgroundColor: colors.card }]}
                onPress={() => handleTokenPress(groupedToken)}
                activeOpacity={0.7}
              >
                <TokenLogo
                  symbol={groupedToken.symbol}
                  size={48}
                  logoURI={groupedToken.logoURI}
                />
                <View style={styles.tokenInfo}>
                  <View style={styles.tokenMainInfo}>
                    <Text style={[styles.tokenSymbol, dynamicStyles.text]}>{groupedToken.symbol}</Text>
                    {groupedToken.chains.length > 1 && (
                      <View style={[styles.chainCountBadge, { backgroundColor: colors.primary + '20' }]}>
                        <Text style={[styles.chainCountText, { color: colors.primary }]}>
                          {groupedToken.chains.length} chains
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.tokenName, dynamicStyles.textSecondary]} numberOfLines={1}>
                    {groupedToken.name}
                  </Text>
                </View>
                <View style={styles.tokenValues}>
                  <Text style={[styles.tokenBalance, dynamicStyles.text]}>
                    {balanceHidden ? '••••' : groupedToken.totalBalance.toFixed(4)}
                  </Text>
                  <Text style={[styles.tokenPrice, dynamicStyles.textSecondary]}>
                    ${groupedToken.avgPrice > 0 
                      ? groupedToken.avgPrice.toFixed(groupedToken.avgPrice < 1 ? 4 : 2) 
                      : '0.00'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Token Detail Modal */}
      <TokenGroupModal
        visible={showTokenDetail}
        onClose={() => setShowTokenDetail(false)}
        token={selectedGroupedToken}
        balanceHidden={balanceHidden}
        onSend={(chainId, address) => {
          setShowTokenDetail(false);
          setShowSend(true);
        }}
        onReceive={(chainId) => {
          setShowTokenDetail(false);
          setShowReceive(true);
        }}
      />

      {/* Wallet List Modal */}
      <WalletListModal
        visible={showWalletList}
        onClose={() => setShowWalletList(false)}
        wallets={walletStore.wallets}
        activeWalletId={walletStore.activeWalletId}
        onSelectWallet={(id) => { 
          walletStore.setActiveWallet(id); 
          setActiveWallet(walletStore.getActiveWallet());
          updateActivity(); 
        }}
        onWalletDetails={(wallet) => {
          setSelectedWalletForDetails(wallet);
          setShowWalletDetails(true);
        }}
        onCreateWallet={() => {
          setShowWalletList(false);
          setShowAddWallet(true);
        }}
        onDeleteWallet={async (id) => {
          const success = await walletStore.removeWallet(id);
          if (success) {
            showToast('Wallet deleted', 'success');
            setActiveWallet(walletStore.getActiveWallet());
          } else {
            showToast('Failed to delete wallet', 'error');
          }
        }}
      />

      {/* Addresses Modal */}
      <DismissibleModal visible={showAddresses} onClose={() => setShowAddresses(false)}>
        <View style={styles.addressesModal}>
          <Text style={[styles.modalTitle, dynamicStyles.text]}>Wallet Addresses</Text>
          <Text style={[styles.modalSubtitle, dynamicStyles.textSecondary]}>
            {activeWallet?.name || 'No wallet selected'}
          </Text>

          {!activeWallet ? (
            <View style={styles.noAddressContainer}>
              <Ionicons name="wallet-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.noAddressText, dynamicStyles.textSecondary]}>No wallet selected</Text>
            </View>
          ) : (
            <>
              {activeWallet.evmAddress ? (
                <TouchableOpacity 
                  style={[styles.addressItem, { backgroundColor: colors.cardLight }]}
                  onPress={() => copyAddress(activeWallet.evmAddress, 'EVM')}
                  activeOpacity={0.7}
                >
                  <View style={styles.addressHeader}>
                    <View style={[styles.addressIcon, { backgroundColor: '#627EEA20' }]}>
                      <Ionicons name="logo-ethereum" size={20} color="#627EEA" />
                    </View>
                    <Text style={[styles.addressLabel, dynamicStyles.text]}>EVM Networks</Text>
                    <View style={styles.copyHint}>
                      <Ionicons name="copy-outline" size={16} color={colors.primary} />
                    </View>
                  </View>
                  <Text style={[styles.addressValue, dynamicStyles.textSecondary]} numberOfLines={1} ellipsizeMode="middle">
                    {activeWallet.evmAddress}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {activeWallet.solanaAddress ? (
                <TouchableOpacity 
                  style={[styles.addressItem, { backgroundColor: colors.cardLight }]}
                  onPress={() => copyAddress(activeWallet.solanaAddress, 'Solana')}
                  activeOpacity={0.7}
                >
                  <View style={styles.addressHeader}>
                    <View style={[styles.addressIcon, { backgroundColor: '#00FFA320' }]}>
                      <Ionicons name="flash" size={20} color="#00FFA3" />
                    </View>
                    <Text style={[styles.addressLabel, dynamicStyles.text]}>Solana</Text>
                    <View style={styles.copyHint}>
                      <Ionicons name="copy-outline" size={16} color={colors.primary} />
                    </View>
                  </View>
                  <Text style={[styles.addressValue, dynamicStyles.textSecondary]} numberOfLines={1} ellipsizeMode="middle">
                    {activeWallet.solanaAddress}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {activeWallet.suiAddress ? (
                <TouchableOpacity 
                  style={[styles.addressItem, { backgroundColor: colors.cardLight }]}
                  onPress={() => copyAddress(activeWallet.suiAddress, 'SUI')}
                  activeOpacity={0.7}
                >
                  <View style={styles.addressHeader}>
                    <View style={[styles.addressIcon, { backgroundColor: '#6FBCF020' }]}>
                      <Ionicons name="water" size={20} color="#6FBCF0" />
                    </View>
                    <Text style={[styles.addressLabel, dynamicStyles.text]}>SUI</Text>
                    <View style={styles.copyHint}>
                      <Ionicons name="copy-outline" size={16} color={colors.primary} />
                    </View>
                  </View>
                  <Text style={[styles.addressValue, dynamicStyles.textSecondary]} numberOfLines={1} ellipsizeMode="middle">
                    {activeWallet.suiAddress}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {activeWallet.tronAddress ? (
                <TouchableOpacity 
                  style={[styles.addressItem, { backgroundColor: colors.cardLight }]}
                  onPress={() => copyAddress(activeWallet.tronAddress, 'TRON')}
                  activeOpacity={0.7}
                >
                  <View style={styles.addressHeader}>
                    <View style={[styles.addressIcon, { backgroundColor: '#FF001320' }]}>
                      <Ionicons name="flash" size={20} color="#FF0013" />
                    </View>
                    <Text style={[styles.addressLabel, dynamicStyles.text]}>TRON</Text>
                    <View style={styles.copyHint}>
                      <Ionicons name="copy-outline" size={16} color={colors.primary} />
                    </View>
                  </View>
                  <Text style={[styles.addressValue, dynamicStyles.textSecondary]} numberOfLines={1} ellipsizeMode="middle">
                    {activeWallet.tronAddress}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {!activeWallet.evmAddress && !activeWallet.solanaAddress && 
               !activeWallet.suiAddress && !activeWallet.tronAddress && (
                <View style={styles.noAddressContainer}>
                  <Ionicons name="alert-circle" size={48} color="#FF4757" />
                  <Text style={[styles.noAddressText, dynamicStyles.textSecondary]}>No addresses found</Text>
                  <Text style={[styles.noAddressHint, dynamicStyles.textMuted]}>Try creating a new wallet</Text>
                </View>
              )}
            </>
          )}
        </View>
      </DismissibleModal>

      {/* Receive Modal */}
      <ReceiveModal
        visible={showReceive}
        onClose={() => setShowReceive(false)}
        wallet={activeWallet}
        onShowToast={showToast}
      />

      {/* Send Modal */}
      <SendModal
        visible={showSend}
        onClose={() => setShowSend(false)}
        wallet={activeWallet}
        onShowToast={showToast}
      />

      {/* Buy Modal */}
      <BuyModal
        visible={showBuy}
        onClose={() => setShowBuy(false)}
        wallet={activeWallet}
        onShowToast={showToast}
      />

      {/* Add Wallet Options Modal */}
      <DismissibleModal visible={showAddWallet} onClose={() => setShowAddWallet(false)}>
        <View style={styles.addWalletContent}>
          <Text style={[styles.modalTitle, dynamicStyles.text]}>{t('add_wallet')}</Text>

          <TouchableOpacity 
            style={[styles.optionButton, { backgroundColor: colors.cardLight }]}
            onPress={() => {
              setShowAddWallet(false);
              setShowCreateWallet(true);
            }}
          >
            <View style={[styles.optionIcon, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="add-circle" size={28} color={colors.primary} />
            </View>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, dynamicStyles.text]}>{t('create_wallet')}</Text>
              <Text style={[styles.optionSubtitle, dynamicStyles.textSecondary]}>
                Generate a new wallet with seed phrase
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.optionButton, { backgroundColor: colors.cardLight }]}
            onPress={() => {
              setShowAddWallet(false);
              setShowImportWallet(true);
            }}
          >
            <View style={[styles.optionIcon, { backgroundColor: '#3498db20' }]}>
              <Ionicons name="download" size={28} color="#3498db" />
            </View>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, dynamicStyles.text]}>{t('import_wallet')}</Text>
              <Text style={[styles.optionSubtitle, dynamicStyles.textSecondary]}>
                Import using seed phrase
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </DismissibleModal>

      {/* Create Wallet Modal */}
      <CreateWalletModal
        visible={showCreateWallet}
        onClose={() => setShowCreateWallet(false)}
        onWalletCreated={handleWalletCreated}
        existingWalletNames={walletStore.wallets.map(w => w.name)}
      />

      {/* Import Wallet Modal */}
      <ImportWalletModal
        visible={showImportWallet}
        onClose={() => setShowImportWallet(false)}
        onWalletImported={handleWalletImported}
        existingWalletNames={walletStore.wallets.map(w => w.name)}
      />

      <Toast config={toast} onHide={() => setToast((prev) => ({ ...prev, visible: false }))} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  unlockContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  unlockTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 32,
    marginBottom: 8,
  },
  unlockSubtitle: {
    fontSize: 16,
    marginBottom: 40,
  },
  pinContainer: {
    width: '100%',
    maxWidth: 300,
  },
  pinInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 16,
    borderWidth: 1,
  },
  unlockButton: {
    flexDirection: 'row',
    backgroundColor: '#00D4AA',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  unlockButtonDisabled: {
    opacity: 0.6,
  },
  unlockButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchAuthText: {
    color: '#00D4AA',
    marginTop: 20,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  walletSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    paddingRight: 12,
    borderRadius: 20,
    gap: 8,
  },
  walletIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletName: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  balanceCard: {
    margin: 16,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 14,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00D4AA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  tokenListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  tokenCount: {
    fontSize: 12,
  },
  tokenList: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  tokenItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
  },
  tokenInfo: {
    flex: 1,
    marginLeft: 12,
  },
  tokenMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tokenSymbol: {
    fontSize: 17,
    fontWeight: '700',
  },
  chainCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  chainCountText: {
    fontSize: 10,
    fontWeight: '600',
  },
  tokenName: {
    fontSize: 13,
    marginTop: 2,
  },
  tokenValues: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  tokenBalance: {
    fontSize: 15,
    fontWeight: '600',
  },
  tokenPrice: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 14,
  },
  addressesModal: {
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  addressItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  addressIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  copyHint: {
    marginLeft: 'auto',
  },
  addressValue: {
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  noAddressContainer: {
    alignItems: 'center',
    padding: 40,
  },
  noAddressText: {
    fontSize: 16,
    marginTop: 12,
  },
  noAddressHint: {
    fontSize: 12,
    marginTop: 4,
  },
  addWalletContent: {
    padding: 20,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
