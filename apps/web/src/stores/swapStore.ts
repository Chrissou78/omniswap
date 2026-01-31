// apps/web/src/stores/swapStore.ts (updated)
import { create } from 'zustand';
import { Token, Route, Quote, Swap } from '@omniswap/types';
import { api } from '@/lib/api';

interface SwapState {
  // Input state
  inputToken: Token | null;
  outputToken: Token | null;
  inputAmount: string;
  inputChainId: number | string | null;
  outputChainId: number | string | null;
  
  // Quote state
  quote: Quote | null;
  selectedRoute: Route | null;
  
  // Swap state
  isSwapping: boolean;
  currentSwap: Swap | null;
  swapHistory: Swap[];
  
  // Settings
  slippage: number;
  deadline: number; // minutes
  
  // Actions
  setInputToken: (token: Token | null) => void;
  setOutputToken: (token: Token | null) => void;
  setInputAmount: (amount: string) => void;
  setInputChainId: (chainId: number | string | null) => void;
  setOutputChainId: (chainId: number | string | null) => void;
  setQuote: (quote: Quote | null) => void;
  setSelectedRoute: (route: Route | null) => void;
  setSlippage: (slippage: number) => void;
  setDeadline: (deadline: number) => void;
  setCurrentSwap: (swap: Swap | null) => void;
  swapTokens: () => void;
  resetSwap: () => void;
  executeSwap: (route: Route) => Promise<Swap | null>;
}

export const useSwapStore = create<SwapState>((set, get) => ({
  // Initial state
  inputToken: null,
  outputToken: null,
  inputAmount: '',
  inputChainId: 1, // Default to Ethereum
  outputChainId: 1,
  quote: null,
  selectedRoute: null,
  isSwapping: false,
  currentSwap: null,
  swapHistory: [],
  slippage: 0.5,
  deadline: 20,

  // Setters
  setInputToken: (token) => set({ inputToken: token }),
  setOutputToken: (token) => set({ outputToken: token }),
  setInputAmount: (amount) => set({ inputAmount: amount }),
  setInputChainId: (chainId) => set({ inputChainId: chainId }),
  setOutputChainId: (chainId) => set({ outputChainId: chainId }),
  setQuote: (quote) => set({ quote }),
  setSelectedRoute: (route) => set({ selectedRoute: route }),
  setSlippage: (slippage) => set({ slippage }),
  setDeadline: (deadline) => set({ deadline }),
  setCurrentSwap: (swap) => set({ currentSwap: swap }),

  // Swap input/output tokens
  swapTokens: () => {
    const { inputToken, outputToken, inputChainId, outputChainId, selectedRoute } = get();
    set({
      inputToken: outputToken,
      outputToken: inputToken,
      inputChainId: outputChainId,
      outputChainId: inputChainId,
      inputAmount: selectedRoute?.estimatedOutput || '',
      quote: null,
      selectedRoute: null,
    });
  },

  // Reset swap state
  resetSwap: () =>
    set({
      inputToken: null,
      outputToken: null,
      inputAmount: '',
      quote: null,
      selectedRoute: null,
      isSwapping: false,
      currentSwap: null,
    }),

  // Execute swap
  executeSwap: async (route: Route) => {
    const { inputAmount, slippage } = get();
    
    set({ isSwapping: true });

    try {
      const response = await api.post<Swap>('/api/v1/swap/execute', {
        quoteId: route.quoteId,
        routeId: route.id,
        slippage,
        inputAmount,
      });

      const swap = response.data;
      
      set({
        currentSwap: swap,
        swapHistory: [swap, ...get().swapHistory],
      });

      return swap;
    } catch (error) {
      console.error('Swap execution failed:', error);
      set({ isSwapping: false });
      return null;
    }
  },
}));
