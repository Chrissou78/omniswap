// src/stores/swapStore.ts
import { create } from 'zustand';
import { configService, Chain, Token } from '../services/configService';

interface SwapState {
  // Chains & Tokens
  chains: Chain[];
  inputChain: Chain | null;
  outputChain: Chain | null;
  inputToken: Token | null;
  outputToken: Token | null;
  
  // Amounts
  inputAmount: string;
  outputAmount: string;
  
  // Settings
  slippage: number;
  isLoading: boolean;
  isCrossChain: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  setInputChain: (chain: Chain) => void;
  setOutputChain: (chain: Chain) => void;
  setInputToken: (token: Token | null) => void;
  setOutputToken: (token: Token | null) => void;
  setInputAmount: (amount: string) => void;
  setOutputAmount: (amount: string) => void;
  setSlippage: (slippage: number) => void;
  setIsLoading: (loading: boolean) => void;
  swapTokens: () => void;
  getTokensForChain: (chainId: number | string) => Token[];
}

export const useSwapStore = create<SwapState>((set, get) => ({
  chains: [],
  inputChain: null,
  outputChain: null,
  inputToken: null,
  outputToken: null,
  inputAmount: '',
  outputAmount: '',
  slippage: 0.5,
  isLoading: false,
  isCrossChain: false,

  initialize: async () => {
    await configService.initialize();
    const chains = configService.getChains();
    const defaultChain = chains[0]; // Ethereum (highest popularity)
    const tokens = defaultChain ? configService.getTokens(defaultChain.id) : [];
    
    set({
      chains,
      inputChain: defaultChain || null,
      outputChain: defaultChain || null,
      inputToken: tokens[0] || null,
      outputToken: tokens[1] || null,
    });
  },

  setInputChain: (chain) => {
    const tokens = configService.getTokens(chain.id);
    const { outputChain } = get();
    set({
      inputChain: chain,
      inputToken: tokens[0] || null,
      isCrossChain: outputChain?.id !== chain.id,
    });
  },

  setOutputChain: (chain) => {
    const tokens = configService.getTokens(chain.id);
    const { inputChain } = get();
    set({
      outputChain: chain,
      outputToken: tokens[0] || null,
      isCrossChain: inputChain?.id !== chain.id,
    });
  },

  setInputToken: (token) => set({ inputToken: token }),
  setOutputToken: (token) => set({ outputToken: token }),
  setInputAmount: (amount) => set({ inputAmount: amount }),
  setOutputAmount: (amount) => set({ outputAmount: amount }),
  setSlippage: (slippage) => set({ slippage }),
  setIsLoading: (loading) => set({ isLoading: loading }),

  swapTokens: () => {
    const { inputChain, outputChain, inputToken, outputToken, inputAmount, outputAmount } = get();
    set({
      inputChain: outputChain,
      outputChain: inputChain,
      inputToken: outputToken,
      outputToken: inputToken,
      inputAmount: outputAmount,
      outputAmount: inputAmount,
    });
  },

  getTokensForChain: (chainId: number | string) => {
    return configService.getTokens(chainId);
  },
}));
