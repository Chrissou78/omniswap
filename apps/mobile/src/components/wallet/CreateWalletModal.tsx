import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DismissibleModal } from './DismissibleModal';
import { walletCore } from '../../services/wallet/walletCore';
import { t } from '../../services/i18n';

interface CreateWalletModalProps {
  visible: boolean;
  onClose: () => void;
  onWalletCreated: (name: string, mnemonic: string) => Promise<boolean>;
  existingWalletNames: string[];
}

type Step = 'name' | 'seedphrase' | 'verify' | 'complete';

export const CreateWalletModal: React.FC<CreateWalletModalProps> = ({
  visible,
  onClose,
  onWalletCreated,
  existingWalletNames,
}) => {
  const [step, setStep] = useState<Step>('name');
  const [walletName, setWalletName] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [mnemonicWords, setMnemonicWords] = useState<string[]>([]);
  const [seedPhraseHidden, setSeedPhraseHidden] = useState(true);
  const [hasCopied, setHasCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [verifyIndices, setVerifyIndices] = useState<number[]>([]);
  const [verifyInputs, setVerifyInputs] = useState<string[]>(['', '', '']);
  const [verifyError, setVerifyError] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setStep('name');
      setWalletName(`Wallet ${existingWalletNames.length + 1}`);
      setMnemonic('');
      setMnemonicWords([]);
      setSeedPhraseHidden(true);
      setHasCopied(false);
      setIsCreating(false);
      setVerifyInputs(['', '', '']);
      setVerifyError('');
    }
  }, [visible, existingWalletNames.length]);

  // Generate random indices for verification
  const generateVerifyIndices = (words: string[]) => {
    const indices: number[] = [];
    while (indices.length < 3) {
      const idx = Math.floor(Math.random() * words.length);
      if (!indices.includes(idx)) {
        indices.push(idx);
      }
    }
    setVerifyIndices(indices.sort((a, b) => a - b));
  };

  const handleNameSubmit = () => {
    // Validate name
    if (!walletName.trim()) {
      Alert.alert('Error', 'Please enter a wallet name');
      return;
    }

    // Check for duplicate names
    if (existingWalletNames.includes(walletName.trim())) {
      Alert.alert('Error', 'A wallet with this name already exists');
      return;
    }

    // Generate mnemonic
    const newMnemonic = walletCore.generateMnemonic();
    const words = newMnemonic.split(' ');
    setMnemonic(newMnemonic);
    setMnemonicWords(words);
    generateVerifyIndices(words);
    setStep('seedphrase');
  };

  const handleSeedPhraseContinue = () => {
    if (!hasCopied) {
      Alert.alert(
        'Warning',
        'Are you sure you have saved your seed phrase? You will not be able to recover your wallet without it.',
        [
          { text: 'Go Back', style: 'cancel' },
          { text: 'I Have Saved It', onPress: () => setStep('verify') },
        ]
      );
    } else {
      setStep('verify');
    }
  };

  const handleVerify = async () => {
    // Check verification words
    let allCorrect = true;
    for (let i = 0; i < verifyIndices.length; i++) {
      if (verifyInputs[i].toLowerCase().trim() !== mnemonicWords[verifyIndices[i]].toLowerCase()) {
        allCorrect = false;
        break;
      }
    }

    if (!allCorrect) {
      setVerifyError('Incorrect words. Please check your seed phrase and try again.');
      return;
    }

    setVerifyError('');
    setIsCreating(true);

    try {
      const success = await onWalletCreated(walletName.trim(), mnemonic);
      if (success) {
        setStep('complete');
      } else {
        Alert.alert('Error', 'Failed to create wallet. Please try again.');
      }
    } catch (error) {
      console.error('Wallet creation error:', error);
      Alert.alert('Error', 'Failed to create wallet. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSkipVerification = async () => {
    Alert.alert(
      'Skip Verification?',
      'Skipping verification is not recommended. Are you sure you have saved your seed phrase?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          style: 'destructive',
          onPress: async () => {
            setIsCreating(true);
            try {
              const success = await onWalletCreated(walletName.trim(), mnemonic);
              if (success) {
                setStep('complete');
              }
            } finally {
              setIsCreating(false);
            }
          },
        },
      ]
    );
  };

  const handleComplete = () => {
    onClose();
  };

  const copyToClipboard = async () => {
    try {
      const Clipboard = require('expo-clipboard');
      await Clipboard.setStringAsync(mnemonic);
      setHasCopied(true);
      Alert.alert('Copied', 'Seed phrase copied to clipboard. Make sure to save it securely and clear your clipboard.');
    } catch (error) {
      console.error('Copy error:', error);
    }
  };

  const renderNameStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Ionicons name="wallet" size={48} color="#00D4AA" />
      </View>
      <Text style={styles.stepTitle}>Name Your Wallet</Text>
      <Text style={styles.stepSubtitle}>
        Choose a name to identify this wallet
      </Text>

      <TextInput
        style={styles.nameInput}
        value={walletName}
        onChangeText={setWalletName}
        placeholder="Enter wallet name"
        placeholderTextColor="#666"
        autoFocus
        maxLength={30}
      />

      <TouchableOpacity style={styles.primaryButton} onPress={handleNameSubmit}>
        <Text style={styles.primaryButtonText}>Continue</Text>
        <Ionicons name="arrow-forward" size={20} color="#000" />
      </TouchableOpacity>
    </View>
  );

  const renderSeedPhraseStep = () => (
    <View style={styles.stepContainer}>
      <View style={[styles.iconContainer, { backgroundColor: '#FF575720' }]}>
        <Ionicons name="key" size={48} color="#FF5757" />
      </View>
      <Text style={styles.stepTitle}>Your Recovery Phrase</Text>
      <Text style={styles.stepSubtitle}>
        Write down these 12 words in order and store them safely. This is the only way to recover your wallet.
      </Text>

      <View style={styles.warningBox}>
        <Ionicons name="warning" size={20} color="#FF5757" />
        <Text style={styles.warningText}>
          Never share your recovery phrase with anyone. Anyone with these words can access your funds.
        </Text>
      </View>

      <View style={styles.seedPhraseContainer}>
        <TouchableOpacity
          style={styles.visibilityToggle}
          onPress={() => setSeedPhraseHidden(!seedPhraseHidden)}
        >
          <Ionicons
            name={seedPhraseHidden ? 'eye-off' : 'eye'}
            size={20}
            color="#888"
          />
          <Text style={styles.visibilityText}>
            {seedPhraseHidden ? 'Tap to reveal' : 'Tap to hide'}
          </Text>
        </TouchableOpacity>

        <View style={styles.wordsGrid}>
          {mnemonicWords.map((word, index) => (
            <View key={index} style={styles.wordItem}>
              <Text style={styles.wordNumber}>{index + 1}</Text>
              <Text style={styles.wordText}>
                {seedPhraseHidden ? '••••••' : word}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.copyButton} onPress={copyToClipboard}>
        <Ionicons name={hasCopied ? 'checkmark' : 'copy'} size={20} color="#00D4AA" />
        <Text style={styles.copyButtonText}>
          {hasCopied ? 'Copied!' : 'Copy to Clipboard'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.primaryButton} onPress={handleSeedPhraseContinue}>
        <Text style={styles.primaryButtonText}>I've Saved It</Text>
        <Ionicons name="arrow-forward" size={20} color="#000" />
      </TouchableOpacity>
    </View>
  );

  const renderVerifyStep = () => (
    <View style={styles.stepContainer}>
      <View style={[styles.iconContainer, { backgroundColor: '#3B82F620' }]}>
        <Ionicons name="shield-checkmark" size={48} color="#3B82F6" />
      </View>
      <Text style={styles.stepTitle}>Verify Recovery Phrase</Text>
      <Text style={styles.stepSubtitle}>
        Enter the following words from your recovery phrase to confirm you've saved it correctly.
      </Text>

      <View style={styles.verifyContainer}>
        {verifyIndices.map((wordIndex, i) => (
          <View key={i} style={styles.verifyItem}>
            <Text style={styles.verifyLabel}>Word #{wordIndex + 1}</Text>
            <TextInput
              style={[
                styles.verifyInput,
                verifyError ? styles.verifyInputError : null,
              ]}
              value={verifyInputs[i]}
              onChangeText={(text) => {
                const newInputs = [...verifyInputs];
                newInputs[i] = text;
                setVerifyInputs(newInputs);
                setVerifyError('');
              }}
              placeholder={`Enter word #${wordIndex + 1}`}
              placeholderTextColor="#666"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        ))}
      </View>

      {verifyError ? (
        <Text style={styles.errorText}>{verifyError}</Text>
      ) : null}

      <TouchableOpacity
        style={[styles.primaryButton, isCreating && styles.buttonDisabled]}
        onPress={handleVerify}
        disabled={isCreating}
      >
        {isCreating ? (
          <ActivityIndicator color="#000" />
        ) : (
          <>
            <Text style={styles.primaryButtonText}>Verify & Create</Text>
            <Ionicons name="checkmark" size={20} color="#000" />
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.skipButton} onPress={handleSkipVerification}>
        <Text style={styles.skipButtonText}>Skip Verification</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCompleteStep = () => (
    <View style={styles.stepContainer}>
      <View style={[styles.iconContainer, { backgroundColor: '#00D4AA20' }]}>
        <Ionicons name="checkmark-circle" size={64} color="#00D4AA" />
      </View>
      <Text style={styles.stepTitle}>Wallet Created!</Text>
      <Text style={styles.stepSubtitle}>
        Your wallet "{walletName}" has been created successfully.
      </Text>

      <View style={styles.successInfo}>
        <View style={styles.successItem}>
          <Ionicons name="shield-checkmark" size={24} color="#00D4AA" />
          <Text style={styles.successText}>Secured with biometrics</Text>
        </View>
        <View style={styles.successItem}>
          <Ionicons name="key" size={24} color="#00D4AA" />
          <Text style={styles.successText}>Recovery phrase saved</Text>
        </View>
        <View style={styles.successItem}>
          <Ionicons name="globe" size={24} color="#00D4AA" />
          <Text style={styles.successText}>Multi-chain support enabled</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleComplete}>
        <Text style={styles.primaryButtonText}>Start Using Wallet</Text>
        <Ionicons name="arrow-forward" size={20} color="#000" />
      </TouchableOpacity>
    </View>
  );

  return (
    <DismissibleModal visible={visible} onClose={onClose}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress indicator */}
        <View style={styles.progressContainer}>
          {['name', 'seedphrase', 'verify', 'complete'].map((s, i) => (
            <View
              key={s}
              style={[
                styles.progressDot,
                step === s && styles.progressDotActive,
                ['name', 'seedphrase', 'verify', 'complete'].indexOf(step) > i && styles.progressDotComplete,
              ]}
            />
          ))}
        </View>

        {step === 'name' && renderNameStep()}
        {step === 'seedphrase' && renderSeedPhraseStep()}
        {step === 'verify' && renderVerifyStep()}
        {step === 'complete' && renderCompleteStep()}
      </ScrollView>
    </DismissibleModal>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    maxHeight: '90%',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  progressDotActive: {
    backgroundColor: '#00D4AA',
    width: 24,
  },
  progressDotComplete: {
    backgroundColor: '#00D4AA',
  },
  stepContainer: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#00D4AA20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  nameInput: {
    width: '100%',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a3e',
    marginBottom: 24,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#FF575715',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 12,
    alignItems: 'flex-start',
  },
  warningText: {
    flex: 1,
    color: '#FF5757',
    fontSize: 13,
    lineHeight: 18,
  },
  seedPhraseContainer: {
    width: '100%',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  visibilityToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
    padding: 8,
  },
  visibilityText: {
    color: '#888',
    fontSize: 14,
  },
  wordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  wordItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12121a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    gap: 8,
  },
  wordNumber: {
    color: '#666',
    fontSize: 12,
    width: 20,
  },
  wordText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 16,
  },
  copyButtonText: {
    color: '#00D4AA',
    fontSize: 14,
    fontWeight: '500',
  },
  primaryButton: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#00D4AA',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  verifyContainer: {
    width: '100%',
    marginBottom: 16,
  },
  verifyItem: {
    marginBottom: 16,
  },
  verifyLabel: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
  },
  verifyInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  verifyInputError: {
    borderColor: '#FF5757',
  },
  errorText: {
    color: '#FF5757',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  skipButton: {
    padding: 16,
    marginTop: 8,
  },
  skipButtonText: {
    color: '#666',
    fontSize: 14,
  },
  successInfo: {
    width: '100%',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  successItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  successText: {
    color: '#fff',
    fontSize: 14,
  },
});

export default CreateWalletModal;