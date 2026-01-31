import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { DismissibleModal } from './DismissibleModal';
import { WalletInfo } from '../../stores/walletStore';
import { t } from '../../services/i18n';

type ChainType = 'evm' | 'solana' | 'sui' | 'tron';

interface ReceiveModalProps {
  visible: boolean;
  onClose: () => void;
  wallet: WalletInfo | null;
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const chainTypeInfo: Record<ChainType, { label: string; sublabel: string; color: string; icon: string }> = {
  evm: { label: 'EVM', sublabel: 'ETH, BSC, Polygon...', color: '#627EEA', icon: 'logo-ethereum' },
  solana: { label: 'Solana', sublabel: 'SOL Network', color: '#00FFA3', icon: 'flash' },
  sui: { label: 'SUI', sublabel: 'SUI Network', color: '#6FBCF0', icon: 'water' },
  tron: { label: 'TRON', sublabel: 'TRX Network', color: '#FF0013', icon: 'flash' },
};

const evmNetworks = ['Ethereum', 'BNB Chain', 'Polygon', 'Arbitrum', 'Optimism', 'Avalanche', 'Base'];

export const ReceiveModal: React.FC<ReceiveModalProps> = ({ visible, onClose, wallet, onShowToast }) => {
  const [selectedChain, setSelectedChain] = useState<ChainType>('evm');

  const getAddressByType = (type: ChainType): string => {
    if (!wallet) {
      console.log('[ReceiveModal] No wallet provided');
      return '';
    }
    
    console.log('[ReceiveModal] Wallet data:', {
      evmAddress: wallet.evmAddress,
      solanaAddress: wallet.solanaAddress,
      suiAddress: wallet.suiAddress,
      tronAddress: wallet.tronAddress,
    });

    switch (type) {
      case 'evm': 
        return wallet.evmAddress || '';
      case 'solana': 
        return wallet.solanaAddress || '';
      case 'sui': 
        return wallet.suiAddress || '';
      case 'tron': 
        return wallet.tronAddress || '';
      default: 
        return '';
    }
  };

  const handleCopy = async () => {
    const address = getAddressByType(selectedChain);
    if (address) {
      await Clipboard.setStringAsync(address);
      onShowToast(t('address_copied'), 'success');
    }
  };

  const address = getAddressByType(selectedChain);
  const info = chainTypeInfo[selectedChain];

  // Debug log
  React.useEffect(() => {
    if (visible) {
      console.log('[ReceiveModal] Opened, wallet:', wallet);
      console.log('[ReceiveModal] Current address:', address);
    }
  }, [visible, wallet, address]);

  return (
    <DismissibleModal visible={visible} onClose={onClose} fullHeight>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('receive')}</Text>
        <Text style={styles.subtitle}>Select network and share your address</Text>

        {/* Chain Selector */}
        <View style={styles.chainSelector}>
          {(Object.keys(chainTypeInfo) as ChainType[]).map((type) => {
            const typeAddress = getAddressByType(type);
            const hasAddress = !!typeAddress;
            
            return (
              <TouchableOpacity
                key={type}
                style={[
                  styles.chainOption, 
                  selectedChain === type && styles.chainOptionActive,
                  !hasAddress && styles.chainOptionDisabled,
                ]}
                onPress={() => hasAddress && setSelectedChain(type)}
                disabled={!hasAddress}
              >
                <View style={[styles.chainIcon, { backgroundColor: chainTypeInfo[type].color + '20' }]}>
                  <Ionicons name={chainTypeInfo[type].icon as any} size={20} color={chainTypeInfo[type].color} />
                </View>
                <Text style={[
                  styles.chainLabel, 
                  selectedChain === type && styles.chainLabelActive,
                  !hasAddress && styles.chainLabelDisabled,
                ]}>
                  {chainTypeInfo[type].label}
                </Text>
                {!hasAddress && (
                  <View style={styles.chainUnavailable}>
                    <Text style={styles.chainUnavailableText}>N/A</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {address ? (
          <View style={styles.qrContainer}>
            {/* QR Code */}
            <View style={styles.qrWrapper}>
              <QRCode
                value={address}
                size={180}
                backgroundColor="#FFFFFF"
                color="#000000"
              />
              <View style={[styles.qrBadge, { backgroundColor: info.color }]}>
                <Ionicons name={info.icon as any} size={16} color="#fff" />
              </View>
            </View>

            {/* Address Box */}
            <View style={styles.addressBox}>
              <Text style={styles.addressLabel}>{info.label} Address</Text>
              <Text style={styles.addressText} selectable>{address}</Text>
              <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
                <Ionicons name="copy-outline" size={18} color="#00D4AA" />
                <Text style={styles.copyButtonText}>{t('copy')}</Text>
              </TouchableOpacity>
            </View>

            {/* Warning */}
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={20} color="#FFB800" />
              <Text style={styles.warningText}>
                Only send {info.label} compatible tokens to this address. Sending other tokens may result in permanent loss.
              </Text>
            </View>

            {/* EVM Networks List */}
            {selectedChain === 'evm' && (
              <View style={styles.networksBox}>
                <Text style={styles.networksTitle}>Supported EVM Networks</Text>
                <View style={styles.networksList}>
                  {evmNetworks.map((network) => (
                    <View key={network} style={styles.networkTag}>
                      <Text style={styles.networkTagText}>{network}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.noAddress}>
            <Ionicons name="alert-circle" size={48} color="#666" />
            <Text style={styles.noAddressText}>No {info.label} address available</Text>
            <Text style={styles.noAddressHint}>
              This wallet may not support {info.label} networks
            </Text>
          </View>
        )}
      </ScrollView>
    </DismissibleModal>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
  },
  chainSelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  chainOption: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 70,
  },
  chainOptionActive: {
    borderColor: '#00D4AA',
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
  },
  chainOptionDisabled: {
    opacity: 0.4,
  },
  chainIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  chainLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
  },
  chainLabelActive: {
    color: '#fff',
  },
  chainLabelDisabled: {
    color: '#444',
  },
  chainUnavailable: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#333',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  chainUnavailableText: {
    color: '#666',
    fontSize: 8,
  },
  qrContainer: {
    alignItems: 'center',
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 24,
    position: 'relative',
  },
  qrBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  addressBox: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 12,
    width: '100%',
    marginBottom: 16,
  },
  addressLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addressText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'monospace',
    marginBottom: 12,
    lineHeight: 20,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    borderRadius: 8,
    gap: 8,
  },
  copyButtonText: {
    color: '#00D4AA',
    fontWeight: '600',
    fontSize: 14,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 184, 0, 0.1)',
    padding: 16,
    borderRadius: 12,
    width: '100%',
    marginBottom: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.2)',
  },
  warningText: {
    color: '#FFB800',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  networksBox: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 12,
    width: '100%',
  },
  networksTitle: {
    color: '#888',
    fontSize: 12,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  networksList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  networkTag: {
    backgroundColor: '#2a2a3e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  networkTagText: {
    color: '#fff',
    fontSize: 12,
  },
  noAddress: {
    alignItems: 'center',
    padding: 40,
  },
  noAddressText: {
    color: '#666',
    marginTop: 12,
    fontSize: 16,
  },
  noAddressHint: {
    color: '#444',
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
  },
});
