// apps/web/src/stores/tokenStore.ts
import { create } from 'zustand';
import { Token } from '@omniswap/types';

interface TokenState {
  tokens: Map<string, Token[]>; // chainId -> tokens
  popularTokens: Map<string, Token[]>;
  recentTokens: Token[];
  isLoading: boolean;
  
  // Actions
  setTokens: (chainId: string, tokens: Token[]) => void;
  setPopularTokens: (chainId: string, tokens: Token[]) => void;
  addRecentToken: (token: Token) => void;
  setIsLoading: (loading: boolean) => void;
  getTokensByChain: (chainId: string) => Token[];
}

export const useTokenStore = create<TokenState>((set, get) => ({
  tokens: new Map(),
  popularTokens: new Map(),
  recentTokens: [],
  isLoading: false,

  setTokens: (chainId, tokens) => {
    const newTokens = new Map(get().tokens);
    newTokens.set(chainId, tokens);
    set({ tokens: newTokens });
  },

  setPopularTokens: (chainId, tokens) => {
    const newPopular = new Map(get().popularTokens);
    newPopular.set(chainId, tokens);
    set({ popularTokens: newPopular });
  },

  addRecentToken: (token) => {
    const recent = get().recentTokens.filter(
      t => !(t.chainId === token.chainId && t.address === token.address)
    );
    set({ recentTokens: [token, ...recent].slice(0, 10) });
  },

  setIsLoading: (loading) => set({ isLoading: loading }),

  getTokensByChain: (chainId) => get().tokens.get(chainId) || [],
}));
