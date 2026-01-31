import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DismissibleModal } from './DismissibleModal';
import { TokenLogo } from './TokenLogo';
import { WalletInfo } from '../../stores/walletStore';
import { configService, Chain, Token } from '../../services/configService';
import { t } from '../../services/i18n';

interface BuyModalProps {
  visible: boolean;
  onClose: () => void;
  wallet: WalletInfo | null;
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const FIAT_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

const PAYMENT_METHODS = [
  { id: 'card', name: 'Credit/Debit Card', icon: 'card', fee: '2.9%' },
  { id: 'apple', name: 'Apple Pay', icon: 'logo-apple', fee: '2.9%' },
  { id: 'google', name: 'Google Pay', icon: 'logo-google', fee: '2.9%' },
  { id: 'bank', name: 'Bank Transfer', icon: 'business', fee: '1.5%' },
];

export const BuyModal: React.FC<BuyModalProps> = ({ visible, onClose, wallet, onShowToast }) => {
  const [step, setStep] = useState<'amount' | 'token' | 'payment' | 'confirm'>('amount');
  const [fiatAmount, setFiatAmount] = useState('100');
  const [selectedFiat, setSelectedFiat] = useState('USD');
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [selectedChain, setSelectedChain] = useState<Chain | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null);

  const popularTokens = React.useMemo(() => {
    const chains = configService.getChains().filter(c => (c.popularity || 0) > 50);
    const tokens: { chain: Chain; token: Token }[] = [];
    
    for (const chain of chains.slice(0, 8)) {
      const chainTokens = configService.getTokens(chain.id);
      const native = chainTokens.find(t => t.isNative);
      if (native) {
        tokens.push({ chain, token: native });
      }
    }
    return tokens;
  }, []);

  const handleSelectToken = (chain: Chain, token: Token) => {
    setSelectedChain(chain);
    setSelectedToken(token);
    setStep('payment');
  };

  const handleSelectPayment = (paymentId: string) => {
    setSelectedPayment(paymentId);
    setStep('confirm');
  };

  const handleBuy = async () => {
    // For now, open a placeholder URL or show coming soon
    // In production, this would initiate Stripe checkout
    onShowToast('Buy feature coming soon with Stripe integration!', 'info');
    
    // Example: Open MoonPay or similar
    // await Linking.openURL(`https://buy.moonpay.com/?currencyCode=${selectedToken?.symbol}`);
  };

  const handleBack = () => {
    if (step === 'token') setStep('amount');
    else if (step === 'payment') setStep('token');
    else if (step === 'confirm') setStep('payment');
  };

  const handleReset = () => {
    setStep('amount');
    setFiatAmount('100');
    setSelectedToken(null);
    setSelectedChain(null);
    setSelectedPayment(null);
  };

  const estimatedCrypto = selectedToken 
    ? (parseFloat(fiatAmount || '0') / 2500).toFixed(6) // Mock conversion
    : '0';

  return (
    <DismissibleModal visible={visible} onClose={onClose} fullHeight>
      <View style={styles.header}>
        {step !== 'amount' && (
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        )}
        <Text style={styles.title}>{t('buy')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {step === 'amount' && (
          <View>
            <Text style={styles.subtitle}>Enter amount to spend</Text>

            <View style={styles.amountContainer}>
              <View style={styles.fiatSelector}>
                <Text style={styles.fiatSymbol}>$</Text>
                <TextInput
                  style={styles.fiatInput}
                  value={fiatAmount}
                  onChangeText={setFiatAmount}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="#666"
                />
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fiatCurrencies}>
                {FIAT_CURRENCIES.map((currency) => (
                  <TouchableOpacity
                    key={currency}
                    style={[
                      styles.fiatOption,
                      selectedFiat === currency && styles.fiatOptionActive,
                    ]}
                    onPress={() => setSelectedFiat(currency)}
                  >
                    <Text
                      style={[
                        styles.fiatOptionText,
                        selectedFiat === currency && styles.fiatOptionTextActive,
                      ]}
                    >
                      {currency}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.quickAmounts}>
              {['50', '100', '250', '500', '1000'].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={[
                    styles.quickAmountBtn,
                    fiatAmount === amount && styles.quickAmountBtnActive,
                  ]}
                  onPress={() => setFiatAmount(amount)}
                >
                  <Text
                    style={[
                      styles.quickAmountText,
                      fiatAmount === amount && styles.quickAmountTextActive,
                    ]}
                  >
                    ${amount}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.continueButton, !fiatAmount && styles.continueButtonDisabled]}
              onPress={() => setStep('token')}
              disabled={!fiatAmount}
            >
              <Text style={styles.continueButtonText}>{t('continue')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'token' && (
          <View>
            <Text style={styles.subtitle}>Select crypto to buy</Text>
            <Text style={styles.spendingAmount}>
              Spending ${fiatAmount} {selectedFiat}
            </Text>

            {popularTokens.map(({ chain, token }) => (
              <TouchableOpacity
                key={`${chain.id}-${token.address}`}
                style={styles.tokenOption}
                onPress={() => handleSelectToken(chain, token)}
              >
                <TokenLogo
                  symbol={token.symbol}
                  chainId={chain.id}
                  address={token.address}
                  size={44}
                  logoURI={token.logoURI}
                />
                <View style={styles.tokenOptionInfo}>
                  <Text style={styles.tokenOptionSymbol}>{token.symbol}</Text>
                  <Text style={styles.tokenOptionChain}>{chain.name}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 'payment' && (
          <View>
            <Text style={styles.subtitle}>Select payment method</Text>

            {PAYMENT_METHODS.map((method) => (
              <TouchableOpacity
                key={method.id}
                style={styles.paymentOption}
                onPress={() => handleSelectPayment(method.id)}
              >
                <View style={styles.paymentIcon}>
                  <Ionicons name={method.icon as any} size={24} color="#00D4AA" />
                </View>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentName}>{method.name}</Text>
                  <Text style={styles.paymentFee}>Fee: {method.fee}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            ))}

            <View style={styles.securityNote}>
              <Ionicons name="shield-checkmark" size={20} color="#00D4AA" />
              <Text style={styles.securityText}>
                Payments are processed securely via Stripe
              </Text>
            </View>
          </View>
        )}

        {step === 'confirm' && selectedToken && selectedChain && (
          <View>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmLabel}>You pay</Text>
              <Text style={styles.confirmFiat}>${fiatAmount} {selectedFiat}</Text>

              <Ionicons name="arrow-down" size={24} color="#00D4AA" style={styles.confirmArrow} />

              <Text style={styles.confirmLabel}>You receive (estimated)</Text>
              <View style={styles.confirmCrypto}>
                <TokenLogo
                  symbol={selectedToken.symbol}
                  chainId={selectedChain.id}
                  size={32}
                  logoURI={selectedToken.logoURI}
                />
                <Text style={styles.confirmCryptoAmount}>
                  {estimatedCrypto} {selectedToken.symbol}
                </Text>
              </View>
            </View>

            <View style={styles.confirmDetails}>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmRowLabel}>Network</Text>
                <Text style={styles.confirmRowValue}>{selectedChain.name}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmRowLabel}>Payment Method</Text>
                <Text style={styles.confirmRowValue}>
                  {PAYMENT_METHODS.find(p => p.id === selectedPayment)?.name}
                </Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmRowLabel}>Processing Fee</Text>
                <Text style={styles.confirmRowValue}>
                  {PAYMENT_METHODS.find(p => p.id === selectedPayment)?.fee}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.buyButton} onPress={handleBuy}>
              <Ionicons name="card" size={20} color="#000" />
              <Text style={styles.buyButtonText}>Buy {selectedToken.symbol}</Text>
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              Cryptocurrency prices are volatile. The final amount may vary.
            </Text>
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
  amountContainer: {
    marginBottom: 24,
  },
  fiatSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  fiatSymbol: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#888',
    marginRight: 8,
  },
  fiatInput: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    minWidth: 100,
    textAlign: 'center',
  },
  fiatCurrencies: {
    flexDirection: 'row',
  },
  fiatOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
    marginRight: 8,
  },
  fiatOptionActive: {
    backgroundColor: '#00D4AA',
  },
  fiatOptionText: {
    color: '#888',
    fontWeight: '600',
  },
  fiatOptionTextActive: {
    color: '#000',
  },
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 8,
  },
  quickAmountBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  quickAmountBtnActive: {
    borderColor: '#00D4AA',
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
  },
  quickAmountText: {
    color: '#888',
    fontWeight: '600',
  },
  quickAmountTextActive: {
    color: '#00D4AA',
  },
  continueButton: {
    backgroundColor: '#00D4AA',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  spendingAmount: {
    color: '#00D4AA',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
  },
  tokenOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
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
  tokenOptionChain: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  paymentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  paymentFee: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    borderRadius: 8,
  },
  securityText: {
    color: '#00D4AA',
    fontSize: 12,
    flex: 1,
  },
  confirmCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  confirmLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  confirmFiat: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  confirmArrow: {
    marginVertical: 16,
  },
  confirmCrypto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  confirmCryptoAmount: {
    color: '#00D4AA',
    fontSize: 24,
    fontWeight: 'bold',
  },
  confirmDetails: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
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
  },
  buyButton: {
    flexDirection: 'row',
    backgroundColor: '#00D4AA',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  buyButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disclaimer: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
  },
});
