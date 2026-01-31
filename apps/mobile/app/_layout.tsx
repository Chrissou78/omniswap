// Polyfills must be first
import '../src/polyfills';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { walletStore } from '../src/stores/walletStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext';

function RootLayoutContent() {
  const { colors, isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

function AppLoader({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const settingsStore = useSettingsStore();

  useEffect(() => {
    const init = async () => {
      try {
        // Load settings first (for theme)
        await settingsStore.loadSettings();
        // Then initialize wallet
        await walletStore.initialize();
      } catch (error) {
        console.error('[App] Init error:', error);
      } finally {
        setIsReady(true);
      }
    };
    init();
  }, []);

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#00D4AA" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppLoader>
        <ThemeProvider>
          <RootLayoutContent />
        </ThemeProvider>
      </AppLoader>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
});