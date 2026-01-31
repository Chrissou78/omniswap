import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  StatusBar,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { configService, Chain } from '../../src/services/configService';
import { t, setLocale, getLocale } from '../../src/services/i18n';
import { DismissibleModal } from '../../src/components/wallet';
import { useSettingsStore } from '../../src/stores/settingsStore';

export default function SettingsScreen() {
  const settings = useSettingsStore();
  const [chains, setChains] = useState<Chain[]>([]);
  const [showChainFilter, setShowChainFilter] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [showAutoLock, setShowAutoLock] = useState(false);
  const [showBackupWarning, setShowBackupWarning] = useState(false);

  // Get colors based on theme
  const colors = settings.theme === 'dark' ? DARK_COLORS : LIGHT_COLORS;

  useEffect(() => {
    settings.loadSettings();
    loadChains();
  }, []);

  const loadChains = async () => {
    await configService.initialize();
    setChains(configService.getChains());
  };

  const handleThemeChange = (isDark: boolean) => {
    settings.setTheme(isDark ? 'dark' : 'light');
  };

  const handleAutoLockChange = (minutes: number) => {
    settings.setAutoLock(minutes);
    setShowAutoLock(false);
  };

  const handleLanguageChange = (lang: string) => {
    settings.setLanguage(lang);
    setLocale(lang);
    setShowLanguage(false);
  };

  const autoLockOptions = [
    { label: '1 minute', value: 1 },
    { label: '5 minutes', value: 5 },
    { label: '15 minutes', value: 15 },
    { label: '30 minutes', value: 30 },
    { label: '1 hour', value: 60 },
    { label: 'Never', value: 0 },
  ];

  const languageOptions = [
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'Français' },
    { code: 'es', name: 'Español' },
    { code: 'zh', name: '中文' },
  ];

  const visibleChainCount = chains.length - settings.hiddenChainIds.length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={settings.theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />

      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('settings')}</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Appearance Section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Appearance</Text>
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, { backgroundColor: '#9B59B620' }]}>
                <Ionicons name={settings.theme === 'dark' ? 'moon' : 'sunny'} size={20} color="#9B59B6" />
              </View>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Dark Mode</Text>
            </View>
            <Switch
              value={settings.theme === 'dark'}
              onValueChange={handleThemeChange}
              trackColor={{ false: '#2a2a3e', true: '#00D4AA' }}
              thumbColor="#fff"
            />
          </View>

          <TouchableOpacity style={[styles.settingRow, { borderBottomColor: colors.border }]} onPress={() => setShowLanguage(true)}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, { backgroundColor: '#3498db20' }]}>
                <Ionicons name="language" size={20} color="#3498db" />
              </View>
              <Text style={[styles.settingLabel, { color: colors.text }]}>{t('language')}</Text>
            </View>
            <View style={styles.settingValue}>
              <Text style={[styles.settingValueText, { color: colors.textSecondary }]}>
                {languageOptions.find(l => l.code === settings.language)?.name || 'English'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Security Section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('security')}</Text>
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <TouchableOpacity style={[styles.settingRow, { borderBottomColor: colors.border }]} onPress={() => setShowAutoLock(true)}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, { backgroundColor: '#00D4AA20' }]}>
                <Ionicons name="timer" size={20} color="#00D4AA" />
              </View>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Auto-Lock</Text>
            </View>
            <View style={styles.settingValue}>
              <Text style={[styles.settingValueText, { color: colors.textSecondary }]}>
                {settings.autoLockMinutes === 0 ? 'Never' : `${settings.autoLockMinutes} min`}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.settingRow, { borderBottomColor: colors.border }]} onPress={() => setShowBackupWarning(true)}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, { backgroundColor: '#FF475720' }]}>
                <Ionicons name="key" size={20} color="#FF4757" />
              </View>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Backup Seed Phrase</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Networks Section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('networks')}</Text>
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <TouchableOpacity style={[styles.settingRow, { borderBottomColor: colors.border }]} onPress={() => setShowChainFilter(true)}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, { backgroundColor: '#F39C1220' }]}>
                <Ionicons name="git-network" size={20} color="#F39C12" />
              </View>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Visible Chains</Text>
            </View>
            <View style={styles.settingValue}>
              <Text style={[styles.settingValueText, { color: colors.textSecondary }]}>
                {visibleChainCount} / {chains.length}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('about')}</Text>
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, { backgroundColor: '#1abc9c20' }]}>
                <Ionicons name="information-circle" size={20} color="#1abc9c" />
              </View>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Version</Text>
            </View>
            <Text style={[styles.settingValueText, { color: colors.textSecondary }]}>1.0.0</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Language Modal */}
      <DismissibleModal visible={showLanguage} onClose={() => setShowLanguage(false)}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{t('language')}</Text>
          {languageOptions.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.modalOption,
                settings.language === lang.code && styles.modalOptionActive,
              ]}
              onPress={() => handleLanguageChange(lang.code)}
            >
              <Text style={[
                styles.modalOptionText,
                settings.language === lang.code && styles.modalOptionTextActive,
              ]}>
                {lang.name}
              </Text>
              {settings.language === lang.code && (
                <Ionicons name="checkmark" size={20} color="#00D4AA" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </DismissibleModal>

      {/* Auto-Lock Modal */}
      <DismissibleModal visible={showAutoLock} onClose={() => setShowAutoLock(false)}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Auto-Lock Timer</Text>
          {autoLockOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.modalOption,
                settings.autoLockMinutes === option.value && styles.modalOptionActive,
              ]}
              onPress={() => handleAutoLockChange(option.value)}
            >
              <Text style={[
                styles.modalOptionText,
                settings.autoLockMinutes === option.value && styles.modalOptionTextActive,
              ]}>
                {option.label}
              </Text>
              {settings.autoLockMinutes === option.value && (
                <Ionicons name="checkmark" size={20} color="#00D4AA" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </DismissibleModal>

      {/* Chain Filter Modal */}
      <DismissibleModal visible={showChainFilter} onClose={() => setShowChainFilter(false)}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Visible Chains</Text>
          <Text style={styles.modalSubtitle}>
            Toggle chains to show/hide in wallet and swap
          </Text>
          <ScrollView style={styles.chainList} showsVerticalScrollIndicator={false}>
            {chains.map((chain) => {
              const isVisible = settings.isChainVisible(chain.id);
              return (
                <TouchableOpacity
                  key={chain.id}
                  style={styles.chainItem}
                  onPress={() => settings.toggleChain(String(chain.id))}
                >
                  <View style={styles.chainInfo}>
                    <View style={[styles.chainIcon, { backgroundColor: chain.color || '#666' }]}>
                      <Text style={styles.chainIconText}>{chain.symbol?.slice(0, 2)}</Text>
                    </View>
                    <View>
                      <Text style={styles.chainName}>{chain.name}</Text>
                      <Text style={styles.chainSymbol}>{chain.symbol}</Text>
                    </View>
                  </View>
                  <Switch
                    value={isVisible}
                    onValueChange={() => settings.toggleChain(String(chain.id))}
                    trackColor={{ false: '#2a2a3e', true: '#00D4AA' }}
                    thumbColor="#fff"
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </DismissibleModal>

      {/* Backup Warning Modal */}
      <DismissibleModal visible={showBackupWarning} onClose={() => setShowBackupWarning(false)}>
        <View style={styles.modalContent}>
          <View style={styles.warningIcon}>
            <Ionicons name="warning" size={48} color="#FF4757" />
          </View>
          <Text style={styles.warningTitle}>Backup Your Seed Phrase</Text>
          <Text style={styles.warningText}>
            Your seed phrase is the only way to recover your wallet. Never share it with anyone.
          </Text>
          <TouchableOpacity 
            style={styles.warningButton}
            onPress={() => setShowBackupWarning(false)}
          >
            <Text style={styles.warningButtonText}>View Seed Phrase</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.warningCancelButton}
            onPress={() => setShowBackupWarning(false)}
          >
            <Text style={styles.warningCancelText}>Later</Text>
          </TouchableOpacity>
        </View>
      </DismissibleModal>
    </SafeAreaView>
  );
}

// Color schemes
const DARK_COLORS = {
  bg: '#0a0a0f',
  card: '#12121a',
  border: '#1a1a2e',
  text: '#ffffff',
  textSecondary: '#888',
  textMuted: '#666',
};

const LIGHT_COLORS = {
  bg: '#f5f5f5',
  card: '#ffffff',
  border: '#e0e0e0',
  text: '#000000',
  textSecondary: '#666',
  textMuted: '#999',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
    marginLeft: 4,
  },
  section: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
  },
  settingValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingValueText: {
    fontSize: 14,
  },
  modalContent: {
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    marginBottom: 8,
  },
  modalOptionActive: {
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    borderWidth: 1,
    borderColor: '#00D4AA',
  },
  modalOptionText: {
    color: '#fff',
    fontSize: 16,
  },
  modalOptionTextActive: {
    color: '#00D4AA',
    fontWeight: '600',
  },
  chainList: {
    maxHeight: 400,
  },
  chainItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    marginBottom: 8,
  },
  chainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chainIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chainIconText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  chainName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  chainSymbol: {
    color: '#888',
    fontSize: 12,
  },
  warningIcon: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  warningText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  warningButton: {
    backgroundColor: '#FF4757',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  warningButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  warningCancelButton: {
    padding: 12,
    alignItems: 'center',
  },
  warningCancelText: {
    color: '#888',
    fontSize: 14,
  },
});
