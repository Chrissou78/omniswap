// apps/web/src/hooks/useSwap.ts
import { useCallback } from 'react';
import { useSwapStore } from '@/stores/swapStore';
import { useWallet } from './useWallet';
import { api } from '@/lib/api';

export function useSwap() {
  const {
    quote,
    selectedRoute,
    currentSwap,
    setCurrentSwap,
    setIsSwapping,
    setSwapError,
  } = useSwapStore();

  const { address, signTransaction: walletSign } = useWallet();

  const createSwap = useCallback(async () => {
    if (!quote || !selectedRoute || !address) {
      throw new Error('Missing required data for swap');
    }

    setIsSwapping(true);
    setSwapError(null);

    try {
      const swap = await api.createSwap({
        quoteId: quote.id,
        routeId: selectedRoute.id,
        userAddress: address,
      });

      setCurrentSwap(swap);
      return swap;
    } catch (error: any) {
      setSwapError(error.message);
      throw error;
    } finally {
      setIsSwapping(false);
    }
  }, [quote, selectedRoute, address, setCurrentSwap, setIsSwapping, setSwapError]);

  const signTransaction = useCallback(async (swapId: string) => {
    try {
      // Get transaction to sign
      const { transaction } = await api.getSwapTransaction(swapId);

      // Check if approval needed
      if (transaction.needsApproval && transaction.approvalTx) {
        // Sign approval first
        await walletSign(transaction.approvalTx);
      }

      // Sign main transaction
      const signed = await walletSign({
        to: transaction.to,
        data: transaction.data,
        value: transaction.value,
        chainId: transaction.chainId,
      });

      return signed;
    } catch (error: any) {
      setSwapError(error.message);
      throw error;
    }
  }, [walletSign, setSwapError]);

  const executeStep = useCallback(async (swapId: string, signedTransaction: string) => {
    setIsSwapping(true);

    try {
      const result = await api.executeSwapStep(swapId, signedTransaction);
      setCurrentSwap(result.swap);
      return result;
    } catch (error: any) {
      setSwapError(error.message);
      throw error;
    } finally {
      setIsSwapping(false);
    }
  }, [setCurrentSwap, setIsSwapping, setSwapError]);

  return {
    createSwap,
    signTransaction,
    executeStep,
  };
}
