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

interface ImportWalletModalProps {
  visible: boolean;
  onClose: () => void;
  onWalletImported: (name: string, mnemonic: string) => Promise<boolean>;
  existingWalletNames: string[];
}

type Step = 'name' | 'seedphrase' | 'complete';

export const ImportWalletModal: React.FC<ImportWalletModalProps> = ({
  visible,
  onClose,
  onWalletImported,
  existingWalletNames,
}) => {
  const [step, setStep] = useState<Step>('name');
  const [walletName, setWalletName] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setStep('name');
      setWalletName(`Wallet ${existingWalletNames.length + 1}`);
      setMnemonic('');
      setIsImporting(false);
      setError('');
    }
  }, [visible, existingWalletNames.length]);

  const handleNameSubmit = () => {
    if (!walletName.trim()) {
      Alert.alert('Error', 'Please enter a wallet name');
      return;
    }

    if (existingWalletNames.includes(walletName.trim())) {
      Alert.alert('Error', 'A wallet with this name already exists');
      return;
    }

    setStep('seedphrase');
  };

  const handleImport = async () => {
    const cleanMnemonic = mnemonic.trim().toLowerCase();
    
    // Validate word count
    const words = cleanMnemonic.split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      setError('Recovery phrase must be 12 or 24 words');
      return;
    }

    // Validate mnemonic
    if (!walletCore.validateMnemonic(cleanMnemonic)) {
      setError('Invalid recovery phrase. Please check your words and try again.');
      return;
    }

    setError('');
    setIsImporting(true);

    try {
      const success = await onWalletImported(walletName.trim(), cleanMnemonic);
      if (success) {
        setStep('complete');
      } else {
        Alert.alert('Error', 'Failed to import wallet. Please try again.');
      }
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert('Error', 'Failed to import wallet. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleComplete = () => {
    onClose();
  };

  const handlePaste = async () => {
    try {
      const Clipboard = require('expo-clipboard');
      const text = await Clipboard.getStringAsync();
      if (text) {
        setMnemonic(text.trim());
        setError('');
      }
    } catch (error) {
      console.error('Paste error:', error);
    }
  };

  const renderNameStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Ionicons name="download" size={48} color="#3B82F6" />
      </View>
      <Text style={styles.stepTitle}>Import Wallet</Text>
      <Text style={styles.stepSubtitle}>
        Choose a name for your imported wallet
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
      <View style={[styles.iconContainer, { backgroundColor: '#3B82F620' }]}>
        <Ionicons name="key" size={48} color="#3B82F6" />
      </View>
      <Text style={styles.stepTitle}>Enter Recovery Phrase</Text>
      <Text style={styles.stepSubtitle}>
        Enter your 12 or 24 word recovery phrase, separated by spaces
      </Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.seedInput}
          value={mnemonic}
          onChangeText={(text) => {
            setMnemonic(text);
            setError('');
          }}
          placeholder="Enter your recovery phrase..."
          placeholderTextColor="#666"
          multiline
          numberOfLines={4}
          autoCapitalize="none"
          autoCorrect={false}
          textAlignVertical="top"
        />
        <TouchableOpacity style={styles.pasteButton} onPress={handlePaste}>
          <Ionicons name="clipboard" size={20} color="#00D4AA" />
          <Text style={styles.pasteButtonText}>Paste</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.wordCount}>
        Words: {mnemonic.trim() ? mnemonic.trim().split(/\s+/).length : 0}
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.warningBox}>
        <Ionicons name="shield-checkmark" size={20} color="#00D4AA" />
        <Text style={styles.warningText}>
          Your recovery phrase is encrypted and stored securely on your device. We never have access to it.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, isImporting && styles.buttonDisabled]}
        onPress={handleImport}
        disabled={isImporting}
      >
        {isImporting ? (
          <ActivityIndicator color="#000" />
        ) : (
          <>
            <Text style={styles.primaryButtonText}>Import Wallet</Text>
            <Ionicons name="checkmark" size={20} color="#000" />
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderCompleteStep = () => (
    <View style={styles.stepContainer}>
      <View style={[styles.iconContainer, { backgroundColor: '#00D4AA20' }]}>
        <Ionicons name="checkmark-circle" size={64} color="#00D4AA" />
      </View>
      <Text style={styles.stepTitle}>Wallet Imported!</Text>
      <Text style={styles.stepSubtitle}>
        Your wallet "{walletName}" has been imported successfully.
      </Text>

      <View style={styles.successInfo}>
        <View style={styles.successItem}>
          <Ionicons name="shield-checkmark" size={24} color="#00D4AA" />
          <Text style={styles.successText}>Secured with biometrics</Text>
        </View>
        <View style={styles.successItem}>
          <Ionicons name="globe" size={24} color="#00D4AA" />
          <Text style={styles.successText}>Multi-chain addresses restored</Text>
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
        keyboardShouldPersistTaps="handled"
      >
        {/* Progress indicator */}
        <View style={styles.progressContainer}>
          {['name', 'seedphrase', 'complete'].map((s, i) => (
            <View
              key={s}
              style={[
                styles.progressDot,
                step === s && styles.progressDotActive,
                ['name', 'seedphrase', 'complete'].indexOf(step) > i && styles.progressDotComplete,
              ]}
            />
          ))}
        </View>

        {step === 'name' && renderNameStep()}
        {step === 'seedphrase' && renderSeedPhraseStep()}
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
    backgroundColor: '#3B82F6',
    width: 24,
  },
  progressDotComplete: {
    backgroundColor: '#3B82F6',
  },
  stepContainer: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3B82F620',
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
  inputContainer: {
    width: '100%',
    marginBottom: 8,
  },
  seedInput: {
    width: '100%',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a3e',
    minHeight: 120,
  },
  pasteButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00D4AA20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pasteButtonText: {
    color: '#00D4AA',
    fontSize: 12,
    fontWeight: '600',
  },
  wordCount: {
    color: '#666',
    fontSize: 12,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#00D4AA15',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
    alignItems: 'flex-start',
  },
  warningText: {
    flex: 1,
    color: '#00D4AA',
    fontSize: 13,
    lineHeight: 18,
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
  errorText: {
    color: '#FF5757',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
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

export default ImportWalletModal;
