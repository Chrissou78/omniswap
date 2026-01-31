// apps/web/src/hooks/useQuote.ts
import { useCallback } from 'react';
import { useSwapStore } from '@/stores/swapStore';
import { api } from '@/lib/api';
import { parseUnits } from '@/lib/utils';

export function useQuote() {
  const {
    inputToken,
    outputToken,
    inputAmount,
    slippage,
    setQuote,
    setIsLoadingQuote,
    setQuoteError,
  } = useSwapStore();

  const fetchQuote = useCallback(async () => {
    if (!inputToken || !outputToken || !inputAmount || parseFloat(inputAmount) === 0) {
      return;
    }

    setIsLoadingQuote(true);
    setQuoteError(null);

    try {
      // Convert amount to smallest unit
      const amountInSmallestUnit = parseUnits(inputAmount, inputToken.decimals);

      const quote = await api.getQuote({
        inputToken: {
          chainId: inputToken.chainId,
          address: inputToken.address,
        },
        outputToken: {
          chainId: outputToken.chainId,
          address: outputToken.address,
        },
        inputAmount: amountInSmallestUnit.toString(),
        slippage,
      });

      setQuote(quote);
    } catch (error: any) {
      console.error('Quote fetch error:', error);
      setQuoteError(error.message || 'Failed to get quote');
    } finally {
      setIsLoadingQuote(false);
    }
  }, [inputToken, outputToken, inputAmount, slippage, setQuote, setIsLoadingQuote, setQuoteError]);

  return { fetchQuote };
}
