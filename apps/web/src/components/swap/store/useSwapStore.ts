// apps/web/src/components/swap/store/useSwapStore.ts

import { create } from 'zustand';
import { TokenInfo, SwapState } from '../types';

interface SwapStore extends SwapState {
  setInputToken: (token: TokenInfo | null) => void;
  setOutputToken: (token: TokenInfo | null) => void;
  setInputAmount: (amount: string) => void;
  setOutputAmount: (amount: string) => void;
  setSlippage: (slippage: number) => void;
  setDeadline: (deadline: number) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  swapTokens: () => void;
  reset: () => void;
}

const initialState: SwapState = {
  inputToken: null,
  outputToken: null,
  inputAmount: '',
  outputAmount: '',
  slippage: 0.5,
  deadline: 20,
  isLoading: false,
  error: null,
};

export const useSwapStore = create<SwapStore>((set, get) => ({
  ...initialState,

  setInputToken: (token) => set({ inputToken: token }),
  
  setOutputToken: (token) => set({ outputToken: token }),
  
  setInputAmount: (amount) => set({ inputAmount: amount }),
  
  setOutputAmount: (amount) => set({ outputAmount: amount }),
  
  setSlippage: (slippage) => set({ slippage }),
  
  setDeadline: (deadline) => set({ deadline }),
  
  setIsLoading: (isLoading) => set({ isLoading }),
  
  setError: (error) => set({ error }),
  
  swapTokens: () => {
    const { inputToken, outputToken, inputAmount, outputAmount } = get();
    set({
      inputToken: outputToken,
      outputToken: inputToken,
      inputAmount: outputAmount,
      outputAmount: inputAmount,
    });
  },
  
  reset: () => set(initialState),
}));

export default useSwapStore;
