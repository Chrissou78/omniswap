import React, { useState, useEffect } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { configService } from '../../services/configService';

interface TokenLogoProps {
  symbol: string;
  chainId?: string | number;
  address?: string;
  size?: number;
  logoURI?: string;
  style?: any;
}

export const TokenLogo: React.FC<TokenLogoProps> = ({ 
  symbol, 
  chainId, 
  address,
  size = 40, 
  logoURI,
  style 
}) => {
  const [imageError, setImageError] = useState(false);
  const [resolvedUri, setResolvedUri] = useState<string | null>(logoURI || null);

  useEffect(() => {
    // Reset error state when props change
    setImageError(false);

    if (logoURI) {
      setResolvedUri(logoURI);
      return;
    }

    // Try to get logo from configService
    const findLogo = () => {
      try {
        const upperSymbol = symbol.toUpperCase();

        // If we have chainId and address, try direct lookup
        if (chainId && address) {
          const logo = configService.getTokenLogo(chainId, address);
          if (logo) {
            setResolvedUri(logo);
            return;
          }
        }

        // If chainId provided, search tokens on that chain
        if (chainId) {
          const chainTokens = configService.getTokens(chainId);
          if (chainTokens && Array.isArray(chainTokens)) {
            const token = chainTokens.find(
              (t: any) => t.symbol?.toUpperCase() === upperSymbol
            );
            if (token?.logoURI) {
              setResolvedUri(token.logoURI);
              return;
            }
          }
        }

        // Search across all chains
        const chains = configService.getChains();
        if (chains && Array.isArray(chains)) {
          // First check if it's a native chain token
          for (const chain of chains) {
            if (chain.symbol?.toUpperCase() === upperSymbol && chain.logoURI) {
              setResolvedUri(chain.logoURI);
              return;
            }
          }

          // Then search in all chain tokens
          for (const chain of chains) {
            const tokens = configService.getTokens(chain.id);
            if (tokens && Array.isArray(tokens)) {
              const token = tokens.find(
                (t: any) => t.symbol?.toUpperCase() === upperSymbol
              );
              if (token?.logoURI) {
                setResolvedUri(token.logoURI);
                return;
              }
            }
          }
        }

        // No logo found
        setResolvedUri(null);
      } catch (error) {
        console.warn('[TokenLogo] Error finding logo:', error);
        setResolvedUri(null);
      }
    };

    findLogo();
  }, [symbol, chainId, address, logoURI]);

  if (resolvedUri && !imageError) {
    return (
      <Image
        source={{ uri: resolvedUri }}
        style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
        onError={() => setImageError(true)}
      />
    );
  }

  // Fallback to colored circle with initials
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F8B500', '#00D4AA'
  ];
  const colorIndex = (symbol.charCodeAt(0) + (symbol.charCodeAt(1) || 0)) % colors.length;

  return (
    <View 
      style={[
        styles.fallback, 
        { 
          width: size, 
          height: size, 
          borderRadius: size / 2, 
          backgroundColor: colors[colorIndex] 
        }, 
        style
      ]}
    >
      <Text style={[styles.fallbackText, { fontSize: size * 0.4 }]}>
        {symbol.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  fallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
