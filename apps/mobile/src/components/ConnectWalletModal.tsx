import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useWalletStore } from '../stores/walletStore';
import { useMultiWalletStore } from '../stores/multiWalletStore';
import { walletCore } from '../services/wallet/walletCore';
import * as Clipboard from 'expo-clipboard';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ConnectWalletModalProps {
  visible: boolean;
  onClose: () => void;
}

type ModalScreen = 'main' | 'create' | 'import' | 'unlock' | 'backup' | 'connected';

// Simple Modal Wrapper - No swipe gestures to avoid conflicts
const DismissibleModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}> = ({ visible, onClose, children, title }) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContent}>
              {/* Swipe Handle - Visual indicator */}
              <TouchableOpacity style={styles.swipeHandle} onPress={onClose}>
                <View style={styles.swipeBar} />
              </TouchableOpacity>
              
              {title ? (
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{title}</Text>
                  <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              
              {children}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const ConnectWalletModal: React.FC<ConnectWalletModalProps> = ({ visible, onClose }) => {
  const walletStore = useWalletStore();
  const multiWalletStore = useMultiWalletStore();
  
  const [screen, setScreen] = useState<ModalScreen>('main');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Wallet creation state
  const [walletName, setWalletName] = useState('');
  const [seedWords, setSeedWords] = useState<12 | 24>(12);
  const [generatedMnemonic, setGeneratedMnemonic] = useState('');
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  
  // Import state
  const [importMnemonic, setImportMnemonic] = useState('');
  
  // Password state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [enableBiometrics, setEnableBiometrics] = useState(true);
  
  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      if (walletStore.hasWallet && !walletStore.isUnlocked) {
        setScreen('unlock');
      } else if (walletStore.isUnlocked) {
        setScreen('connected');
      } else {
        setScreen('main');
      }
      setError(null);
      setPassword('');
      setConfirmPassword('');
      setWalletName('');
      setImportMnemonic('');
      setBackupConfirmed(false);
      setGeneratedMnemonic('');
    }
  }, [visible, walletStore.hasWallet, walletStore.isUnlocked]);

  const validatePassword = (pwd: string): { valid: boolean; message: string } => {
    if (pwd.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters' };
    }
    if (!/[a-zA-Z]/.test(pwd)) {
      return { valid: false, message: 'Password must contain at least one letter' };
    }
    if (!/[0-9]/.test(pwd)) {
      return { valid: false, message: 'Password must contain at least one number' };
    }
    return { valid: true, message: '' };
  };

  const validateWalletName = (name: string): { valid: boolean; message: string } => {
    if (!name.trim()) {
      return { valid: false, message: 'Wallet name is required' };
    }
    if (name.trim().length < 2) {
      return { valid: false, message: 'Wallet name must be at least 2 characters' };
    }
    if (multiWalletStore.isNameTaken(name)) {
      return { valid: false, message: `Wallet name "${name}" already exists` };
    }
    return { valid: true, message: '' };
  };

  const handleCreateWallet = () => {
    const defaultName = multiWalletStore.generateUniqueName('My Wallet');
    setWalletName(defaultName);
    setScreen('create');
    setError(null);
  };

  const handleGenerateSeed = () => {
    const nameValidation = validateWalletName(walletName);
    if (!nameValidation.valid) {
      setError(nameValidation.message);
      return;
    }
    
    try {
      const mnemonic = walletCore.generateMnemonic(seedWords);
      setGeneratedMnemonic(mnemonic);
      setScreen('backup');
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to generate wallet');
    }
  };

  const handleConfirmBackup = async () => {
    if (!backupConfirmed) {
      setError('Please confirm you have saved your recovery phrase');
      return;
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.message);
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await walletStore.createWallet(generatedMnemonic, password, enableBiometrics, seedWords);
      
      if (walletStore.account) {
        const result = await multiWalletStore.addWallet({
          name: walletName.trim(),
          evmAddress: walletStore.account.evm?.address || '',
          solanaAddress: walletStore.account.solana?.address || '',
          suiAddress: walletStore.account.sui?.address || '',
          tronAddress: walletStore.account.tron?.address || '',
        });
        
        if (!result.success) {
          setError(result.error || 'Failed to save wallet');
          setLoading(false);
          return;
        }
      }
      
      setScreen('connected');
    } catch (err: any) {
      setError(err.message || 'Failed to create wallet');
    } finally {
      setLoading(false);
    }
  };

  const handleImportWallet = async () => {
    const nameValidation = validateWalletName(walletName);
    if (!nameValidation.valid) {
      setError(nameValidation.message);
      return;
    }
    
    const words = importMnemonic.trim().split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      setError('Please enter a valid 12 or 24 word recovery phrase');
      return;
    }
    
    if (!walletCore.validateMnemonic(importMnemonic.trim())) {
      setError('Invalid recovery phrase. Please check and try again.');
      return;
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.message);
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await walletStore.importWallet(importMnemonic.trim(), password, enableBiometrics);
      
      if (walletStore.account) {
        const result = await multiWalletStore.addWallet({
          name: walletName.trim(),
          evmAddress: walletStore.account.evm?.address || '',
          solanaAddress: walletStore.account.solana?.address || '',
          suiAddress: walletStore.account.sui?.address || '',
          tronAddress: walletStore.account.tron?.address || '',
        });
        
        if (!result.success) {
          setError(result.error || 'Failed to save wallet');
          setLoading(false);
          return;
        }
      }
      
      setScreen('connected');
    } catch (err: any) {
      setError(err.message || 'Failed to import wallet');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!password) {
      setError('Please enter your password');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const success = await walletStore.unlockWithPin(password);
      if (success) {
        setScreen('connected');
      } else {
        setError('Incorrect password. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to unlock wallet');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricUnlock = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const success = await walletStore.unlockWithBiometrics();
      if (success) {
        setScreen('connected');
      } else {
        setError('Biometric authentication failed');
      }
    } catch (err: any) {
      setError(err.message || 'Biometric authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = async (address: string) => {
    await Clipboard.setStringAsync(address);
    Alert.alert('Copied', 'Address copied to clipboard');
  };

  const handleLock = () => {
    walletStore.lock();
    setScreen('unlock');
    setPassword('');
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Delete Wallet',
      'Are you sure? This will remove the wallet from this device. Make sure you have backed up your recovery phrase!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await walletStore.deleteWallet();
            setScreen('main');
          },
        },
      ]
    );
  };

  // Main screen
  const renderMainScreen = () => (
    <View style={styles.screenContainer}>
      <Text style={styles.subtitle}>Create or import a wallet to get started</Text>
      
      <TouchableOpacity style={styles.primaryButton} onPress={handleCreateWallet}>
        <Text style={styles.primaryButtonText}>Create New Wallet</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.secondaryButton} 
        onPress={() => {
          const defaultName = multiWalletStore.generateUniqueName('Imported Wallet');
          setWalletName(defaultName);
          setScreen('import');
        }}
      >
        <Text style={styles.secondaryButtonText}>Import Existing Wallet</Text>
      </TouchableOpacity>
    </View>
  );

  // Create wallet screen
  const renderCreateScreen = () => (
    <View style={styles.screenContainer}>
      <Text style={styles.subtitle}>Set up your new wallet</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Wallet Name</Text>
        <TextInput
          style={styles.input}
          value={walletName}
          onChangeText={(text) => {
            setWalletName(text);
            setError(null);
          }}
          placeholder="Enter wallet name"
          placeholderTextColor="#666"
          autoCapitalize="words"
        />
        {walletName && multiWalletStore.isNameTaken(walletName) && (
          <Text style={styles.errorHint}>This name is already taken</Text>
        )}
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Recovery Phrase Length</Text>
        <View style={styles.seedOptions}>
          <TouchableOpacity
            style={[styles.seedOption, seedWords === 12 && styles.seedOptionActive]}
            onPress={() => setSeedWords(12)}
          >
            <Text style={[styles.seedOptionText, seedWords === 12 && styles.seedOptionTextActive]}>
              12 Words
            </Text>
            <Text style={styles.seedOptionSubtext}>Standard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.seedOption, seedWords === 24 && styles.seedOptionActive]}
            onPress={() => setSeedWords(24)}
          >
            <Text style={[styles.seedOptionText, seedWords === 24 && styles.seedOptionTextActive]}>
              24 Words
            </Text>
            <Text style={styles.seedOptionSubtext}>Enhanced</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {error && <Text style={styles.errorText}>{error}</Text>}
      
      <TouchableOpacity style={styles.primaryButton} onPress={handleGenerateSeed}>
        <Text style={styles.primaryButtonText}>Generate Wallet</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.backButton} onPress={() => setScreen('main')}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
    </View>
  );

  // Backup screen - FIXED: No PanResponder conflicts
  const renderBackupScreen = () => {
    const words = generatedMnemonic.split(' ');
    
    return (
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.screenContainer}
      >
        <ScrollView 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
        >
          {/* Warning */}
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>⚠️ Save Your Recovery Phrase</Text>
            <Text style={styles.warningText}>
              Write down these words in order and store them safely. This is the ONLY way to recover your wallet!
            </Text>
          </View>
          
          {/* Seed Words Grid */}
          <View style={styles.seedGrid}>
            {words.map((word, index) => (
              <View key={index} style={styles.seedWord}>
                <Text style={styles.seedWordNumber}>{index + 1}</Text>
                <Text style={styles.seedWordText}>{word}</Text>
              </View>
            ))}
          </View>
          
          <TouchableOpacity 
            style={styles.copyButton}
            onPress={() => {
              Clipboard.setStringAsync(generatedMnemonic);
              Alert.alert('Copied', 'Recovery phrase copied to clipboard. Store it safely!');
            }}
          >
            <Text style={styles.copyButtonText}>📋 Copy to Clipboard</Text>
          </TouchableOpacity>
          
          {/* Confirmation */}
          <TouchableOpacity 
            style={styles.checkboxRow}
            onPress={() => setBackupConfirmed(!backupConfirmed)}
          >
            <View style={[styles.checkbox, backupConfirmed && styles.checkboxChecked]}>
              {backupConfirmed && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxText}>
              I have saved my recovery phrase securely
            </Text>
          </TouchableOpacity>
          
          {/* Password Section */}
          <View style={styles.passwordSection}>
            <Text style={styles.sectionTitle}>Create Password</Text>
            <Text style={styles.passwordHint}>
              At least 8 characters with letters and numbers
            </Text>
            
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                placeholderTextColor="#666"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity 
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm password"
              placeholderTextColor="#666"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            
            {/* Password Strength */}
            {password.length > 0 && (
              <View style={styles.passwordStrength}>
                <View style={styles.strengthBar}>
                  <View style={[
                    styles.strengthFill,
                    { 
                      width: `${Math.min(100, (password.length / 12) * 100)}%`,
                      backgroundColor: password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password)
                        ? '#4CAF50' 
                        : password.length >= 6 ? '#FFC107' : '#F44336'
                    }
                  ]} />
                </View>
                <Text style={styles.strengthText}>
                  {password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password)
                    ? '✓ Strong password'
                    : 'Needs letters and numbers'}
                </Text>
              </View>
            )}
            
            {/* Biometrics Toggle */}
            <View style={styles.biometricsRow}>
              <View>
                <Text style={styles.biometricsLabel}>Enable Biometrics</Text>
                <Text style={styles.biometricsSubtext}>Face ID / Fingerprint</Text>
              </View>
              <Switch
                value={enableBiometrics}
                onValueChange={setEnableBiometrics}
                trackColor={{ false: '#333', true: '#4CAF50' }}
                thumbColor="#fff"
              />
            </View>
          </View>
          
          {error && <Text style={styles.errorText}>{error}</Text>}
          
          <TouchableOpacity 
            style={[styles.primaryButton, loading && styles.buttonDisabled]} 
            onPress={handleConfirmBackup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.primaryButtonText}>Create Wallet</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.backButton} onPress={() => setScreen('create')}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          
          {/* Bottom padding for scroll */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  // Import screen
  const renderImportScreen = () => (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.screenContainer}
    >
      <ScrollView 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
      >
        <Text style={styles.subtitle}>Import your existing wallet</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Wallet Name</Text>
          <TextInput
            style={styles.input}
            value={walletName}
            onChangeText={(text) => {
              setWalletName(text);
              setError(null);
            }}
            placeholder="Enter wallet name"
            placeholderTextColor="#666"
            autoCapitalize="words"
          />
          {walletName && multiWalletStore.isNameTaken(walletName) && (
            <Text style={styles.errorHint}>This name is already taken</Text>
          )}
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Recovery Phrase</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={importMnemonic}
            onChangeText={setImportMnemonic}
            placeholder="Enter your 12 or 24 word recovery phrase"
            placeholderTextColor="#666"
            multiline
            numberOfLines={4}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {importMnemonic && (
            <Text style={styles.wordCount}>
              {importMnemonic.trim().split(/\s+/).filter(w => w).length} words
            </Text>
          )}
        </View>
        
        <View style={styles.passwordSection}>
          <Text style={styles.sectionTitle}>Create Password</Text>
          <Text style={styles.passwordHint}>
            At least 8 characters with letters and numbers
          </Text>
          
          <View style={styles.passwordInputContainer}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              placeholderTextColor="#666"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity 
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
            </TouchableOpacity>
          </View>
          
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm password"
            placeholderTextColor="#666"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
          
          <View style={styles.biometricsRow}>
            <View>
              <Text style={styles.biometricsLabel}>Enable Biometrics</Text>
              <Text style={styles.biometricsSubtext}>Face ID / Fingerprint</Text>
            </View>
            <Switch
              value={enableBiometrics}
              onValueChange={setEnableBiometrics}
              trackColor={{ false: '#333', true: '#4CAF50' }}
              thumbColor="#fff"
            />
          </View>
        </View>
        
        {error && <Text style={styles.errorText}>{error}</Text>}
        
        <TouchableOpacity 
          style={[styles.primaryButton, loading && styles.buttonDisabled]} 
          onPress={handleImportWallet}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.primaryButtonText}>Import Wallet</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.backButton} onPress={() => setScreen('main')}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // Unlock screen
  const renderUnlockScreen = () => (
    <View style={styles.unlockContainer}>
      <View style={styles.unlockIcon}>
        <Text style={styles.unlockIconText}>🔐</Text>
      </View>
      
      <Text style={styles.unlockTitle}>Welcome Back</Text>
      <Text style={styles.unlockSubtitle}>Enter your password to unlock</Text>
      
      <View style={styles.unlockInputContainer}>
        <View style={styles.passwordInputContainer}>
          <TextInput
            style={styles.unlockInput}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setError(null);
            }}
            placeholder="Enter password"
            placeholderTextColor="#888"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
          <TouchableOpacity 
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {error && <Text style={styles.unlockError}>{error}</Text>}
      
      <TouchableOpacity 
        style={[styles.unlockButton, loading && styles.buttonDisabled]} 
        onPress={handleUnlock}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.unlockButtonText}>Unlock</Text>
        )}
      </TouchableOpacity>
      
      {walletStore.biometricsEnabled && (
        <TouchableOpacity 
          style={styles.biometricButton}
          onPress={handleBiometricUnlock}
        >
          <Text style={styles.biometricIcon}>👆</Text>
          <Text style={styles.biometricText}>Use Biometrics</Text>
        </TouchableOpacity>
      )}
      
      <View style={styles.unlockFooter}>
        <TouchableOpacity onPress={() => {
          Alert.alert(
            'Reset Wallet',
            'This will delete your current wallet. Make sure you have your recovery phrase to restore it.',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Reset', 
                style: 'destructive',
                onPress: async () => {
                  await walletStore.deleteWallet();
                  setScreen('main');
                  setPassword('');
                }
              }
            ]
          );
        }}>
          <Text style={styles.unlockFooterLink}>Forgot password?</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Connected screen
  const renderConnectedScreen = () => {
    const account = walletStore.account;
    
    return (
      <ScrollView 
        style={styles.screenContainer} 
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        <View style={styles.connectedHeader}>
          <View style={styles.connectedAvatar}>
            <Text style={styles.connectedAvatarText}>👛</Text>
          </View>
          <Text style={styles.connectedTitle}>Wallet Connected</Text>
        </View>
        
        <View style={styles.addressesContainer}>
          {account?.evm && (
            <TouchableOpacity 
              style={styles.addressCard}
              onPress={() => copyAddress(account.evm!.address)}
            >
              <View style={styles.addressHeader}>
                <Text style={styles.chainLabel}>EVM (ETH, BSC, etc.)</Text>
                <Text style={styles.copyHint}>Tap to copy</Text>
              </View>
              <Text style={styles.addressText} numberOfLines={1}>
                {walletStore.shortenAddress(account.evm.address)}
              </Text>
            </TouchableOpacity>
          )}
          
          {account?.solana && (
            <TouchableOpacity 
              style={styles.addressCard}
              onPress={() => copyAddress(account.solana!.address)}
            >
              <View style={styles.addressHeader}>
                <Text style={styles.chainLabel}>Solana</Text>
                <Text style={styles.copyHint}>Tap to copy</Text>
              </View>
              <Text style={styles.addressText} numberOfLines={1}>
                {walletStore.shortenAddress(account.solana.address)}
              </Text>
            </TouchableOpacity>
          )}
          
          {account?.sui && (
            <TouchableOpacity 
              style={styles.addressCard}
              onPress={() => copyAddress(account.sui!.address)}
            >
              <View style={styles.addressHeader}>
                <Text style={styles.chainLabel}>SUI</Text>
                <Text style={styles.copyHint}>Tap to copy</Text>
              </View>
              <Text style={styles.addressText} numberOfLines={1}>
                {walletStore.shortenAddress(account.sui.address)}
              </Text>
            </TouchableOpacity>
          )}
          
          {account?.tron && (
            <TouchableOpacity 
              style={styles.addressCard}
              onPress={() => copyAddress(account.tron!.address)}
            >
              <View style={styles.addressHeader}>
                <Text style={styles.chainLabel}>TRON</Text>
                <Text style={styles.copyHint}>Tap to copy</Text>
              </View>
              <Text style={styles.addressText} numberOfLines={1}>
                {walletStore.shortenAddress(account.tron.address)}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.lockButton} onPress={handleLock}>
            <Text style={styles.lockButtonText}>🔒 Lock Wallet</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
            <Text style={styles.disconnectButtonText}>Delete Wallet</Text>
          </TouchableOpacity>
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  const renderCurrentScreen = () => {
    switch (screen) {
      case 'main':
        return renderMainScreen();
      case 'create':
        return renderCreateScreen();
      case 'backup':
        return renderBackupScreen();
      case 'import':
        return renderImportScreen();
      case 'unlock':
        return renderUnlockScreen();
      case 'connected':
        return renderConnectedScreen();
      default:
        return renderMainScreen();
    }
  };

  const getModalTitle = () => {
    switch (screen) {
      case 'main':
        return 'Connect Wallet';
      case 'create':
        return 'Create Wallet';
      case 'backup':
        return 'Backup Recovery Phrase';
      case 'import':
        return 'Import Wallet';
      case 'unlock':
        return '';
      case 'connected':
        return 'Wallet';
      default:
        return 'Wallet';
    }
  };

  return (
    <DismissibleModal
      visible={visible}
      onClose={onClose}
      title={getModalTitle()}
    >
      {renderCurrentScreen()}
    </DismissibleModal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.9,
    minHeight: 300,
  },
  swipeHandle: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  swipeBar: {
    width: 40,
    height: 4,
    backgroundColor: '#555',
    borderRadius: 2,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#888',
  },
  screenContainer: {
    padding: 20,
    maxHeight: SCREEN_HEIGHT * 0.75,
  },
  subtitle: {
    fontSize: 15,
    color: '#888',
    marginBottom: 24,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#00D4AA',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#444',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  errorHint: {
    fontSize: 12,
    color: '#F44336',
    marginTop: 6,
  },
  wordCount: {
    fontSize: 12,
    color: '#888',
    marginTop: 6,
    textAlign: 'right',
  },
  seedOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  seedOption: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
  },
  seedOptionActive: {
    borderColor: '#00D4AA',
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
  },
  seedOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  seedOptionTextActive: {
    color: '#00D4AA',
  },
  seedOptionSubtext: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  warningBox: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.3)',
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFC107',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  seedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  seedWord: {
    width: '31%',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  seedWordNumber: {
    fontSize: 12,
    color: '#666',
    marginRight: 6,
    width: 18,
  },
  seedWordText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  copyButton: {
    alignItems: 'center',
    padding: 12,
    marginBottom: 16,
  },
  copyButtonText: {
    fontSize: 14,
    color: '#00D4AA',
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#555',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#00D4AA',
    borderColor: '#00D4AA',
  },
  checkmark: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxText: {
    flex: 1,
    fontSize: 14,
    color: '#ccc',
  },
  passwordSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  passwordHint: {
    fontSize: 13,
    color: '#888',
    marginBottom: 16,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#fff',
  },
  eyeButton: {
    padding: 16,
  },
  eyeIcon: {
    fontSize: 18,
  },
  passwordStrength: {
    marginTop: 8,
    marginBottom: 16,
  },
  strengthBar: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    marginBottom: 6,
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    color: '#888',
  },
  biometricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
    marginTop: 8,
  },
  biometricsLabel: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },
  biometricsSubtext: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 16,
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  backButtonText: {
    fontSize: 15,
    color: '#888',
  },
  // Unlock Screen
  unlockContainer: {
    padding: 24,
    alignItems: 'center',
  },
  unlockIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  unlockIconText: {
    fontSize: 40,
  },
  unlockTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  unlockSubtitle: {
    fontSize: 15,
    color: '#888',
    marginBottom: 32,
  },
  unlockInputContainer: {
    width: '100%',
    marginBottom: 16,
  },
  unlockInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#fff',
  },
  unlockError: {
    fontSize: 14,
    color: '#F44336',
    marginBottom: 16,
  },
  unlockButton: {
    width: '100%',
    backgroundColor: '#00D4AA',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  unlockButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 24,
  },
  biometricIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  biometricText: {
    fontSize: 15,
    color: '#00D4AA',
    fontWeight: '600',
  },
  unlockFooter: {
    marginTop: 16,
  },
  unlockFooterLink: {
    fontSize: 14,
    color: '#888',
    textDecorationLine: 'underline',
  },
  // Connected Screen
  connectedHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  connectedAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  connectedAvatarText: {
    fontSize: 32,
  },
  connectedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#00D4AA',
  },
  addressesContainer: {
    marginBottom: 24,
  },
  addressCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chainLabel: {
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
  },
  copyHint: {
    fontSize: 11,
    color: '#666',
  },
  addressText: {
    fontSize: 15,
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actionButtons: {
    gap: 12,
    paddingBottom: 20,
  },
  lockButton: {
    backgroundColor: '#333',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  lockButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  disconnectButton: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.3)',
  },
  disconnectButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F44336',
  },
});

export default ConnectWalletModal;
