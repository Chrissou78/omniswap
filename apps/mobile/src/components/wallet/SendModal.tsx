import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { DismissibleModal } from './DismissibleModal';
import { TokenLogo } from './TokenLogo';
import { WalletInfo } from '../../stores/walletStore';
import { configService, Chain, Token } from '../../services/configService';
import { t } from '../../services/i18n';

interface SendModalProps {
  visible: boolean;
  onClose: () => void;
  wallet: WalletInfo | null;
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const SendModal: React.FC<SendModalProps> = ({ visible, onClose, wallet, onShowToast }) => {
  const [step, setStep] = useState<'select' | 'amount' | 'confirm'>('select');
  const [selectedChain, setSelectedChain] = useState<Chain | null>(null);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [isSending, setIsSending] = useState(false);

  const chains = configService.getChains().filter(c => (c.popularity || 0) > 0).slice(0, 10);

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setRecipientAddress(text);
      onShowToast(t('copied'), 'success');
    }
  };

  const handleSelectToken = (chain: Chain, token: Token) => {
    setSelectedChain(chain);
    setSelectedToken(token);
    setStep('amount');
  };

  const handleContinue = () => {
    if (!recipientAddress) {
      onShowToast(t('invalid_address'), 'error');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      onShowToast(t('enter_amount'), 'error');
      return;
    }
    setStep('confirm');
  };

  const handleSend = async () => {
    setIsSending(true);
    try {
      // TODO: Implement actual send transaction
      await new Promise(resolve => setTimeout(resolve, 2000));
      onShowToast('Transaction sent successfully!', 'success');
      handleReset();
      onClose();
    } catch (error) {
      onShowToast(t('transaction_failed'), 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleReset = () => {
    setStep('select');
    setSelectedChain(null);
    setSelectedToken(null);
    setRecipientAddress('');
    setAmount('');
  };

  const handleBack = () => {
    if (step === 'amount') setStep('select');
    else if (step === 'confirm') setStep('amount');
  };

  return (
    <DismissibleModal visible={visible} onClose={onClose} fullHeight>
      <View style={styles.header}>
        {step !== 'select' && (
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        )}
        <Text style={styles.title}>{t('send')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {step === 'select' && (
          <View>
            <Text style={styles.subtitle}>Select token to send</Text>
            
            {chains.map((chain) => {
              const tokens = configService.getTokens(chain.id).slice(0, 3);
              if (tokens.length === 0) return null;
              
              return (
                <View key={chain.id} style={styles.chainSection}>
                  <View style={styles.chainHeader}>
                    <TokenLogo symbol={chain.symbol} chainId={chain.id} size={24} logoURI={chain.logoURI} />
                    <Text style={styles.chainName}>{chain.name}</Text>
                  </View>
                  
                  {tokens.map((token) => (
                    <TouchableOpacity
                      key={`${chain.id}-${token.address}`}
                      style={styles.tokenOption}
                      onPress={() => handleSelectToken(chain, token)}
                    >
                      <TokenLogo 
                        symbol={token.symbol} 
                        chainId={chain.id} 
                        address={token.address}
                        size={40} 
                        logoURI={token.logoURI} 
                      />
                      <View style={styles.tokenOptionInfo}>
                        <Text style={styles.tokenOptionSymbol}>{token.symbol}</Text>
                        <Text style={styles.tokenOptionName}>{token.name}</Text>
                      </View>
                      <Text style={styles.tokenOptionBalance}>0.00</Text>
                      <Ionicons name="chevron-forward" size={20} color="#666" />
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })}
          </View>
        )}

        {step === 'amount' && selectedToken && selectedChain && (
          <View>
            <View style={styles.selectedTokenHeader}>
              <TokenLogo 
                symbol={selectedToken.symbol} 
                chainId={selectedChain.id}
                size={48} 
                logoURI={selectedToken.logoURI} 
              />
              <Text style={styles.selectedTokenSymbol}>{selectedToken.symbol}</Text>
              <Text style={styles.selectedTokenChain}>{selectedChain.name}</Text>
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Recipient Address</Text>
              <View style={styles.addressInputContainer}>
                <TextInput
                  style={styles.addressInput}
                  placeholder="Enter wallet address"
                  placeholderTextColor="#666"
                  value={recipientAddress}
                  onChangeText={setRecipientAddress}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.pasteButton} onPress={handlePaste}>
                  <Ionicons name="clipboard-outline" size={20} color="#00D4AA" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputSection}>
              <View style={styles.amountHeader}>
                <Text style={styles.inputLabel}>Amount</Text>
                <TouchableOpacity>
                  <Text style={styles.maxButton}>MAX</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.amountInputContainer}>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  placeholderTextColor="#666"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.amountSymbol}>{selectedToken.symbol}</Text>
              </View>
              <Text style={styles.amountUsd}>≈ $0.00</Text>
            </View>

            <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
              <Text style={styles.continueButtonText}>{t('continue')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'confirm' && selectedToken && selectedChain && (
          <View>
            <View style={styles.confirmSection}>
              <Text style={styles.confirmLabel}>You're sending</Text>
              <View style={styles.confirmAmount}>
                <TokenLogo 
                  symbol={selectedToken.symbol} 
                  chainId={selectedChain.id}
                  size={32} 
                  logoURI={selectedToken.logoURI} 
                />
                <Text style={styles.confirmAmountText}>{amount} {selectedToken.symbol}</Text>
              </View>
            </View>

            <View style={styles.confirmDetails}>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmRowLabel}>To</Text>
                <Text style={styles.confirmRowValue} numberOfLines={1}>
                  {recipientAddress.slice(0, 10)}...{recipientAddress.slice(-8)}
                </Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmRowLabel}>Network</Text>
                <Text style={styles.confirmRowValue}>{selectedChain.name}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmRowLabel}>Network Fee</Text>
                <Text style={styles.confirmRowValue}>~$0.50</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.sendButton, isSending && styles.sendButtonDisabled]} 
              onPress={handleSend}
              disabled={isSending}
            >
              {isSending ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={20} color="#000" />
                  <Text style={styles.sendButtonText}>{t('send')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </DismissibleModal>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 20,
  },
  chainSection: {
    marginBottom: 20,
  },
  chainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  chainName: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  tokenOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  tokenOptionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  tokenOptionSymbol: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tokenOptionName: {
    color: '#888',
    fontSize: 12,
  },
  tokenOptionBalance: {
    color: '#888',
    fontSize: 14,
    marginRight: 8,
  },
  selectedTokenHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  selectedTokenSymbol: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 12,
  },
  selectedTokenChain: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
  },
  addressInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  addressInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    padding: 16,
  },
  pasteButton: {
    padding: 16,
  },
  amountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  maxButton: {
    color: '#00D4AA',
    fontSize: 14,
    fontWeight: '600',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a3e',
    paddingRight: 16,
  },
  amountInput: {
    flex: 1,
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    padding: 16,
  },
  amountSymbol: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
  },
  amountUsd: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'right',
  },
  continueButton: {
    backgroundColor: '#00D4AA',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  continueButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  confirmSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  confirmLabel: {
    color: '#888',
    fontSize: 14,
    marginBottom: 12,
  },
  confirmAmount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  confirmAmountText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  confirmDetails: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  confirmRowLabel: {
    color: '#888',
    fontSize: 14,
  },
  confirmRowValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    maxWidth: '60%',
  },
  sendButton: {
    flexDirection: 'row',
    backgroundColor: '#00D4AA',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
