import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DismissibleModal } from './DismissibleModal';
import { WalletInfo } from '../../stores/walletStore';
import { t } from '../../services/i18n';

interface WalletListModalProps {
  visible: boolean;
  onClose: () => void;
  wallets: WalletInfo[];
  activeWalletId: string | null;
  onSelectWallet: (id: string) => void;
  onWalletDetails: (wallet: WalletInfo) => void;
  onCreateWallet: () => void;
  onDeleteWallet?: (id: string) => void;
}

export const WalletListModal: React.FC<WalletListModalProps> = ({
  visible,
  onClose,
  wallets,
  activeWalletId,
  onSelectWallet,
  onWalletDetails,
  onCreateWallet,
  onDeleteWallet,
}) => {
  const [walletToDelete, setWalletToDelete] = useState<string | null>(null);

  const handleDeletePress = (walletId: string, walletName: string) => {
    Alert.alert(
      'Delete Wallet',
      `Are you sure you want to delete "${walletName}"? Make sure you have backed up your recovery phrase!`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDeleteWallet?.(walletId);
          },
        },
      ]
    );
  };

  return (
    <DismissibleModal visible={visible} onClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('wallets')}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.walletList} showsVerticalScrollIndicator={false}>
          {wallets.map((wallet) => (
            <View key={wallet.id} style={styles.walletItemContainer}>
              <TouchableOpacity
                style={[styles.walletItem, wallet.id === activeWalletId && styles.walletItemActive]}
                onPress={() => {
                  onSelectWallet(wallet.id);
                  onClose();
                }}
              >
                <View style={styles.walletIcon}>
                  <Ionicons name="wallet" size={24} color="#00D4AA" />
                </View>
                <View style={styles.walletInfo}>
                  <Text style={styles.walletName}>{wallet.name}</Text>
                  <Text style={styles.walletAddress}>
                    {wallet.evmAddress 
                      ? `${wallet.evmAddress.slice(0, 6)}...${wallet.evmAddress.slice(-4)}`
                      : 'No address'
                    }
                  </Text>
                </View>
                {wallet.id === activeWalletId && (
                  <Ionicons name="checkmark-circle" size={24} color="#00D4AA" />
                )}
              </TouchableOpacity>
              
              {/* Delete button */}
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeletePress(wallet.id, wallet.name)}
              >
                <Ionicons name="trash-outline" size={20} color="#FF4757" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        <TouchableOpacity style={styles.createButton} onPress={onCreateWallet}>
          <Ionicons name="add-circle-outline" size={24} color="#00D4AA" />
          <Text style={styles.createButtonText}>{t('create_wallet')}</Text>
        </TouchableOpacity>
      </View>
    </DismissibleModal>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    maxHeight: 500,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  walletList: {
    maxHeight: 300,
  },
  walletItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  walletItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  walletItemActive: {
    borderColor: '#00D4AA',
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
  },
  walletIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  walletInfo: {
    flex: 1,
  },
  walletName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  walletAddress: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  deleteButton: {
    marginLeft: 8,
    padding: 12,
    backgroundColor: 'rgba(255, 71, 87, 0.1)',
    borderRadius: 10,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00D4AA',
    borderStyle: 'dashed',
    marginTop: 12,
    gap: 8,
  },
  createButtonText: {
    color: '#00D4AA',
    fontSize: 16,
    fontWeight: '600',
  },
});
