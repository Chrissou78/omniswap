import React, { createContext, useContext } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export const DARK_THEME = {
  dark: true,
  colors: {
    bg: '#0a0a0f',
    card: '#12121a',
    cardLight: '#1a1a24',
    cardBorder: '#2a2a3e',
    border: '#1a1a2e',
    primary: '#00D4AA',
    primaryDark: '#00A88A',
    secondary: '#6366F1',
    text: '#ffffff',
    textSecondary: '#888888',
    textMuted: '#666666',
    success: '#00D4AA',
    error: '#FF6B6B',
    warning: '#FF9500',
    tabBar: '#12121a',
    tabBarBorder: '#2a2a3e',
  },
};

export const LIGHT_THEME = {
  dark: false,
  colors: {
    bg: '#f5f5f7',
    card: '#ffffff',
    cardLight: '#f0f0f2',
    cardBorder: '#e0e0e5',
    border: '#e0e0e5',
    primary: '#00D4AA',
    primaryDark: '#00A88A',
    secondary: '#6366F1',
    text: '#000000',
    textSecondary: '#666666',
    textMuted: '#999999',
    success: '#00D4AA',
    error: '#FF6B6B',
    warning: '#FF9500',
    tabBar: '#ffffff',
    tabBarBorder: '#e0e0e5',
  },
};

export type AppTheme = typeof DARK_THEME;
export type ThemeColors = typeof DARK_THEME.colors;

interface ThemeContextType {
  theme: AppTheme;
  colors: ThemeColors;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: DARK_THEME,
  colors: DARK_THEME.colors,
  isDark: true,
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const settingsStore = useSettingsStore();
  
  const isDark = settingsStore.theme === 'dark';
  const theme = isDark ? DARK_THEME : LIGHT_THEME;

  return (
    <ThemeContext.Provider value={{ theme, colors: theme.colors, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};
