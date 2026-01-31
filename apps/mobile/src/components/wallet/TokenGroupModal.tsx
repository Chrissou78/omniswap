import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DismissibleModal } from './DismissibleModal';
import { TokenLogo } from './TokenLogo';
import { t } from '../../services/i18n';

interface ChainBalance {
  chainId: string | number;
  chainName: string;
  chainSymbol?: string;
  chainColor?: string;
  address: string;
  balance: string;
  value: number;
  price: number;
  logoURI?: string;
}

interface GroupedToken {
  symbol: string;
  name: string;
  totalBalance: number;
  totalValue: number;
  avgPrice: number;
  chains: ChainBalance[];
  logoURI?: string;
}

interface TokenGroupModalProps {
  visible: boolean;
  onClose: () => void;
  token: GroupedToken | null;
  balanceHidden: boolean;
  onSend?: (chainId: string | number, address: string) => void;
  onReceive?: (chainId: string | number) => void;
}

export const TokenGroupModal: React.FC<TokenGroupModalProps> = ({
  visible,
  onClose,
  token,
  balanceHidden,
  onSend,
  onReceive,
}) => {
  const [expandedChain, setExpandedChain] = useState<string | number | null>(null);

  if (!token) return null;

  const toggleChain = (chainId: string | number) => {
    setExpandedChain(expandedChain === chainId ? null : chainId);
  };

  return (
    <DismissibleModal visible={visible} onClose={onClose} fullHeight>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Token Header */}
        <View style={styles.header}>
          <TokenLogo symbol={token.symbol} size={64} logoURI={token.logoURI} />
          <Text style={styles.tokenSymbol}>{token.symbol}</Text>
          <Text style={styles.tokenName}>{token.name}</Text>
        </View>

        {/* Total Balance Card */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total Balance</Text>
          <Text style={styles.totalBalance}>
            {balanceHidden ? '••••••' : `${token.totalBalance.toFixed(6)} ${token.symbol}`}
          </Text>
          <Text style={styles.totalValue}>
            {balanceHidden ? '••••' : `≈ $${token.totalValue.toFixed(2)}`}
          </Text>
          
          <View style={styles.priceInfo}>
            <Text style={styles.priceLabel}>Price</Text>
            <Text style={styles.priceValue}>
              ${token.avgPrice.toFixed(token.avgPrice < 1 ? 6 : 2)}
            </Text>
          </View>
        </View>

        {/* Chains Section */}
        <View style={styles.chainsSection}>
          <Text style={styles.sectionTitle}>
            Available on {token.chains.length} chain{token.chains.length > 1 ? 's' : ''}
          </Text>

          {token.chains.map((chain) => {
            const isExpanded = expandedChain === chain.chainId;
            
            return (
              <View key={chain.chainId} style={styles.chainCard}>
                <TouchableOpacity
                  style={styles.chainHeader}
                  onPress={() => toggleChain(chain.chainId)}
                  activeOpacity={0.7}
                >
                  <View style={styles.chainInfo}>
                    <View style={[styles.chainDot, { backgroundColor: chain.chainColor || '#666' }]} />
                    <View>
                      <Text style={styles.chainName}>{chain.chainName}</Text>
                      <Text style={styles.chainBalance}>
                        {balanceHidden ? '••••' : `${parseFloat(chain.balance).toFixed(6)} ${token.symbol}`}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.chainRight}>
                    <Text style={styles.chainValue}>
                      {balanceHidden ? '••••' : `$${chain.value.toFixed(2)}`}
                    </Text>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color="#666"
                    />
                  </View>
                </TouchableOpacity>

                {/* Expanded Details */}
                {isExpanded && (
                  <View style={styles.chainDetails}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Contract</Text>
                      <Text style={styles.detailValue} numberOfLines={1}>
                        {chain.address.slice(0, 10)}...{chain.address.slice(-8)}
                      </Text>
                    </View>
                    
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Price on {chain.chainName}</Text>
                      <Text style={styles.detailValue}>
                        ${chain.price.toFixed(chain.price < 1 ? 6 : 2)}
                      </Text>
                    </View>

                    <View style={styles.chainActions}>
                      <TouchableOpacity
                        style={styles.chainActionButton}
                        onPress={() => onSend?.(chain.chainId, chain.address)}
                      >
                        <Ionicons name="arrow-up" size={18} color="#fff" />
                        <Text style={styles.chainActionText}>{t('send')}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.chainActionButton, styles.chainActionButtonSecondary]}
                        onPress={() => onReceive?.(chain.chainId)}
                      >
                        <Ionicons name="arrow-down" size={18} color="#00D4AA" />
                        <Text style={[styles.chainActionText, styles.chainActionTextSecondary]}>
                          {t('receive')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickActionButton}>
            <Ionicons name="arrow-up" size={22} color="#fff" />
            <Text style={styles.quickActionText}>{t('send')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.quickActionButton, styles.quickActionButtonSecondary]}>
            <Ionicons name="arrow-down" size={22} color="#00D4AA" />
            <Text style={[styles.quickActionText, styles.quickActionTextSecondary]}>
              {t('receive')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.quickActionButton, styles.quickActionButtonTertiary]}>
            <Ionicons name="swap-horizontal" size={22} color="#6366F1" />
            <Text style={[styles.quickActionText, styles.quickActionTextTertiary]}>
              {t('swap')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </DismissibleModal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  tokenSymbol: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
  },
  tokenName: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  totalCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  totalLabel: {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  totalBalance: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  totalValue: {
    fontSize: 16,
    color: '#00D4AA',
    marginTop: 4,
  },
  priceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a3e',
    width: '100%',
    justifyContent: 'center',
    gap: 8,
  },
  priceLabel: {
    fontSize: 13,
    color: '#888',
  },
  priceValue: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  chainsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
    fontWeight: '600',
  },
  chainCard: {
    backgroundColor: '#12121a',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  chainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  chainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chainDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  chainName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  chainBalance: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  chainRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chainValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  chainDetails: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#1a1a2e',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 13,
    color: '#666',
  },
  detailValue: {
    fontSize: 13,
    color: '#fff',
    maxWidth: '60%',
  },
  chainActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  chainActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D4AA',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  chainActionButtonSecondary: {
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    borderWidth: 1,
    borderColor: '#00D4AA',
  },
  chainActionText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '600',
  },
  chainActionTextSecondary: {
    color: '#00D4AA',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D4AA',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  quickActionButtonSecondary: {
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    borderWidth: 1,
    borderColor: '#00D4AA',
  },
  quickActionButtonTertiary: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  quickActionText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '600',
  },
  quickActionTextSecondary: {
    color: '#00D4AA',
  },
  quickActionTextTertiary: {
    color: '#6366F1',
  },
});
