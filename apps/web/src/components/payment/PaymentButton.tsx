'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle, AlertCircle, Wallet, CreditCard } from 'lucide-react';

// EVM
import { useAccount, useBalance, useSendTransaction, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi';
import { parseUnits, encodeFunctionData } from 'viem';

// Solana
import { useConnection, useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';

// Sui
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction as SuiTransaction } from '@mysten/sui/transactions';

import { getChainById, EVM_CHAIN_IDS } from '@/lib/chain-config';

const erc20Abi = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const TOKEN_DECIMALS: Record<string, number> = {
  usdc: 6,
  usdt: 6,
};

type PaymentMethod = 'crypto' | 'stripe';

interface PaymentButtonProps {
  amount: number;
  chainId: string;
  chainType: 'evm' | 'solana' | 'sui' | string;
  token: 'usdc' | 'usdt';
  tokenAddress: string;
  recipientAddress: string;
  onSuccess: (txHash: string, method: PaymentMethod) => void;
  onError: (error: string) => void;
  // Stripe-specific props
  enableStripe?: boolean;
  stripeProductName?: string;
  stripeMetadata?: Record<string, string>;
}

export function PaymentButton({
  amount,
  chainId,
  chainType,
  token,
  tokenAddress,
  recipientAddress,
  onSuccess,
  onError,
  enableStripe = true,
  stripeProductName = 'Payment',
  stripeMetadata = {},
}: PaymentButtonProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('crypto');

  const normalizedType = chainType?.toLowerCase() || '';
  const numericChainId = parseInt(chainId, 10);
  
  const isSolana = normalizedType === 'solana' || chainId === 'solana-mainnet';
  const isSui = normalizedType === 'sui' || chainId === 'sui-mainnet';
  const isEVM = 
    normalizedType === 'evm' || 
    normalizedType === 'ethereum' ||
    (!isNaN(numericChainId) && EVM_CHAIN_IDS.includes(numericChainId)) ||
    (!isSolana && !isSui && !isNaN(numericChainId));

  const handleCryptoSuccess = (txHash: string) => {
    onSuccess(txHash, 'crypto');
  };

  const handleStripeSuccess = (sessionId: string) => {
    onSuccess(sessionId, 'stripe');
  };

  return (
    <div className="space-y-4">
      {/* Payment Method Selector */}
      {enableStripe && (
        <div className="flex gap-2 p-1 bg-gray-800 rounded-lg">
          <button
            onClick={() => setPaymentMethod('crypto')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              paymentMethod === 'crypto'
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Wallet className="w-4 h-4" />
            Crypto
          </button>
          <button
            onClick={() => setPaymentMethod('stripe')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              paymentMethod === 'stripe'
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Card
          </button>
        </div>
      )}

      {/* Stripe Payment */}
      {paymentMethod === 'stripe' && enableStripe && (
        <StripePaymentButton
          amount={amount}
          productName={stripeProductName}
          metadata={stripeMetadata}
          onSuccess={handleStripeSuccess}
          onError={onError}
        />
      )}

      {/* Crypto Payment */}
      {paymentMethod === 'crypto' && (
        <>
          {isSolana && (
            <SolanaPaymentButton
              amount={amount}
              token={token}
              tokenAddress={tokenAddress}
              recipientAddress={recipientAddress}
              onSuccess={handleCryptoSuccess}
              onError={onError}
            />
          )}

          {isSui && (
            <SuiPaymentButton
              amount={amount}
              token={token}
              tokenAddress={tokenAddress}
              recipientAddress={recipientAddress}
              onSuccess={handleCryptoSuccess}
              onError={onError}
            />
          )}

          {isEVM && (
            <EVMPaymentButton
              amount={amount}
              chainId={numericChainId}
              token={token}
              tokenAddress={tokenAddress}
              recipientAddress={recipientAddress}
              onSuccess={handleCryptoSuccess}
              onError={onError}
            />
          )}

          {!isEVM && !isSolana && !isSui && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-center">
              <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-yellow-500 font-medium">Unsupported chain: {chainType}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ===========================================
// STRIPE PAYMENT BUTTON
// ===========================================

interface StripePaymentButtonProps {
  amount: number;
  productName: string;
  metadata: Record<string, string>;
  onSuccess: (sessionId: string) => void;
  onError: (error: string) => void;
}

function StripePaymentButton({
  amount,
  productName,
  metadata,
  onSuccess,
  onError,
}: StripePaymentButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleStripePayment = async () => {
    try {
      setStatus('loading');

      // Create Stripe Checkout Session
      const response = await fetch('/api/payments/stripe/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // Stripe expects cents
          currency: 'usd',
          productName,
          metadata,
          successUrl: `${window.location.origin}${window.location.pathname}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}${window.location.pathname}?payment=cancelled`,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create payment session');
      }

      const { sessionId, url } = await response.json();

      // Redirect to Stripe Checkout
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error: any) {
      console.error('Stripe payment error:', error);
      const message = error?.message || 'Payment failed';
      setErrorMessage(message);
      setStatus('error');
      onError(message);
    }
  };

  // Check for successful payment return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    const sessionId = params.get('session_id');

    if (paymentStatus === 'success' && sessionId) {
      setStatus('success');
      onSuccess(sessionId);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (paymentStatus === 'cancelled') {
      setErrorMessage('Payment was cancelled');
      setStatus('error');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [onSuccess]);

  if (status === 'success') {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
        <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
        <p className="text-green-500 font-medium">Payment successful!</p>
        <p className="text-sm text-gray-400 mt-1">Your card payment has been processed</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-500 font-medium">{errorMessage}</p>
        <button
          onClick={() => { setStatus('idle'); setErrorMessage(''); }}
          className="mt-3 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleStripePayment}
        disabled={status === 'loading'}
        className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2"
      >
        {status === 'loading' ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Redirecting to checkout...
          </>
        ) : (
          <>
            <CreditCard className="w-5 h-5" />
            Pay ${amount.toFixed(2)} with Card
          </>
        )}
      </button>
      <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
        <span>Secured by</span>
        <svg className="h-5" viewBox="0 0 60 25" fill="currentColor">
          <path d="M59.64 14.28h-8.06v-1.96h8.06v1.96zm-8.06-4.94h8.06V7.38h-8.06v1.96zm-6.67 8.48c-.61.54-1.4.82-2.37.82-.98 0-1.77-.28-2.38-.82-.61-.55-.91-1.28-.91-2.19s.3-1.64.91-2.18c.61-.55 1.4-.82 2.38-.82.97 0 1.76.27 2.37.82.61.54.91 1.27.91 2.18s-.3 1.64-.91 2.19zm-2.37-7.55c-1.5 0-2.76.45-3.76 1.36-1 .9-1.5 2.1-1.5 3.58s.5 2.67 1.5 3.58c1 .9 2.26 1.36 3.76 1.36s2.76-.45 3.76-1.36c1-.9 1.5-2.1 1.5-3.58s-.5-2.67-1.5-3.58c-1-.9-2.26-1.36-3.76-1.36zM28.3 17.82c-.61.54-1.4.82-2.37.82-.98 0-1.77-.28-2.38-.82-.61-.55-.91-1.28-.91-2.19s.3-1.64.91-2.18c.61-.55 1.4-.82 2.38-.82.97 0 1.76.27 2.37.82.61.54.91 1.27.91 2.18s-.3 1.64-.91 2.19zm-2.37-7.55c-1.5 0-2.76.45-3.76 1.36-1 .9-1.5 2.1-1.5 3.58s.5 2.67 1.5 3.58c1 .9 2.26 1.36 3.76 1.36s2.76-.45 3.76-1.36c1-.9 1.5-2.1 1.5-3.58s-.5-2.67-1.5-3.58c-1-.9-2.26-1.36-3.76-1.36zM14.74 19.28V7.38H12.3v4.77c-.73-.73-1.63-1.1-2.7-1.1-1.36 0-2.5.46-3.42 1.38-.92.92-1.38 2.1-1.38 3.56s.46 2.64 1.38 3.56c.92.92 2.06 1.38 3.42 1.38 1.07 0 1.97-.36 2.7-1.1v.95h2.44v.5zm-4.77-1.64c-.7 0-1.27-.23-1.73-.7-.45-.46-.68-1.06-.68-1.8 0-.73.23-1.33.68-1.8.46-.46 1.03-.7 1.73-.7s1.27.23 1.73.7c.45.47.68 1.07.68 1.8 0 .74-.23 1.34-.68 1.8-.46.47-1.03.7-1.73.7z"/>
        </svg>
        <span>Stripe</span>
      </div>
    </div>
  );
}

// ===========================================
// EVM PAYMENT BUTTON (unchanged from before)
// ===========================================

interface EVMPaymentButtonProps {
  amount: number;
  chainId: number;
  token: 'usdc' | 'usdt';
  tokenAddress: string;
  recipientAddress: string;
  onSuccess: (txHash: string) => void;
  onError: (error: string) => void;
}

function EVMPaymentButton({
  amount,
  chainId,
  token,
  tokenAddress,
  recipientAddress,
  onSuccess,
  onError,
}: EVMPaymentButtonProps) {
  const [status, setStatus] = useState<'idle' | 'switching' | 'confirming' | 'pending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { address, isConnected, chain: currentChain } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();

  const { data: balanceData } = useBalance({
    address,
    token: tokenAddress as `0x${string}`,
    chainId,
  });

  const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId,
  });

  useEffect(() => {
    if (isConfirmed && txHash) {
      setStatus('success');
      onSuccess(txHash);
    }
  }, [isConfirmed, txHash, onSuccess]);

  const chainConfig = getChainById(chainId);
  const chainName = chainConfig?.name || `Chain ${chainId}`;

  const handlePayment = async () => {
    if (!address || !isConnected) {
      setErrorMessage('Please connect your wallet first');
      setStatus('error');
      onError('Wallet not connected');
      return;
    }

    try {
      if (currentChain?.id !== chainId) {
        setStatus('switching');
        try {
          await switchChainAsync({ chainId });
        } catch {
          setErrorMessage('Please switch to ' + chainName + ' in your wallet');
          setStatus('error');
          onError('Chain switch failed');
          return;
        }
      }

      setStatus('confirming');

      const decimals = TOKEN_DECIMALS[token] || 6;
      const amountInWei = parseUnits(amount.toString(), decimals);

      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [recipientAddress as `0x${string}`, amountInWei],
      });

      const hash = await sendTransactionAsync({
        to: tokenAddress as `0x${string}`,
        data,
        chainId,
      });

      setTxHash(hash);
      setStatus('pending');
    } catch (error: any) {
      const message = error?.code === 4001 ? 'Transaction rejected' : (error?.message?.slice(0, 100) || 'Transaction failed');
      setErrorMessage(message);
      setStatus('error');
      onError(message);
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 text-center">
        <Wallet className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-400">Connect your EVM wallet to pay</p>
      </div>
    );
  }

  const balance = balanceData ? parseFloat(balanceData.formatted) : null;
  const hasInsufficientBalance = balance !== null && balance < amount;

  if (hasInsufficientBalance) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-500 font-medium">Insufficient {token.toUpperCase()} balance</p>
        <p className="text-sm text-gray-400 mt-1">Required: ${amount.toFixed(2)} | Available: ${balance?.toFixed(2)}</p>
      </div>
    );
  }

  if (status === 'success' && txHash) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
        <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
        <p className="text-green-500 font-medium">Payment successful!</p>
        <p className="text-sm text-gray-400 mt-1 font-mono">{txHash.slice(0, 10)}...{txHash.slice(-8)}</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-500 font-medium">{errorMessage}</p>
        <button onClick={() => { setStatus('idle'); setErrorMessage(''); }} className="mt-3 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm">Try Again</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {currentChain?.id !== chainId && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm">
          <p className="text-yellow-500">Click pay to switch to {chainName}</p>
        </div>
      )}
      <button
        onClick={handlePayment}
        disabled={status !== 'idle'}
        className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2"
      >
        {status === 'switching' && <><Loader2 className="w-5 h-5 animate-spin" />Switching chain...</>}
        {status === 'confirming' && <><Loader2 className="w-5 h-5 animate-spin" />Confirm in wallet...</>}
        {status === 'pending' && <><Loader2 className="w-5 h-5 animate-spin" />Transaction pending...</>}
        {status === 'idle' && <>Pay ${amount.toFixed(2)} {token.toUpperCase()}</>}
      </button>
      {balance !== null && status === 'idle' && (
        <p className="text-sm text-gray-400 text-center">Balance: {balance.toFixed(2)} {token.toUpperCase()}</p>
      )}
    </div>
  );
}

// ===========================================
// SOLANA PAYMENT BUTTON
// ===========================================

interface SolanaPaymentButtonProps {
  amount: number;
  token: 'usdc' | 'usdt';
  tokenAddress: string;
  recipientAddress: string;
  onSuccess: (txHash: string) => void;
  onError: (error: string) => void;
}

function SolanaPaymentButton({
  amount,
  token,
  tokenAddress,
  recipientAddress,
  onSuccess,
  onError,
}: SolanaPaymentButtonProps) {
  const [status, setStatus] = useState<'idle' | 'confirming' | 'pending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [txHash, setTxHash] = useState('');
  const [balance, setBalance] = useState<number | null>(null);

  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useSolanaWallet();

  useEffect(() => {
    const fetchBalance = async () => {
      if (!publicKey || !tokenAddress) return;
      try {
        const mintPubkey = new PublicKey(tokenAddress);
        const ata = await getAssociatedTokenAddress(mintPubkey, publicKey);
        const accountInfo = await connection.getTokenAccountBalance(ata);
        setBalance(parseFloat(accountInfo.value.uiAmountString || '0'));
      } catch {
        setBalance(null);
      }
    };
    if (connected && publicKey) fetchBalance();
  }, [connection, publicKey, tokenAddress, connected]);

  const handlePayment = useCallback(async () => {
    if (!publicKey || !connected) {
      setErrorMessage('Please connect your Solana wallet');
      setStatus('error');
      onError('Wallet not connected');
      return;
    }

    try {
      setStatus('confirming');

      const mintPubkey = new PublicKey(tokenAddress);
      const recipientPubkey = new PublicKey(recipientAddress);
      const senderAta = await getAssociatedTokenAddress(mintPubkey, publicKey);
      const recipientAta = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

      const decimals = TOKEN_DECIMALS[token] || 6;
      const amountInSmallestUnit = BigInt(Math.floor(amount * Math.pow(10, decimals)));

      const transferInstruction = createTransferInstruction(
        senderAta, recipientAta, publicKey, amountInSmallestUnit, [], TOKEN_PROGRAM_ID
      );

      const transaction = new Transaction().add(transferInstruction);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      setStatus('pending');
      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });

      setTxHash(signature);
      setStatus('success');
      onSuccess(signature);
    } catch (error: any) {
      const message = error?.message?.includes('rejected') ? 'Transaction rejected' : (error?.message?.slice(0, 100) || 'Transaction failed');
      setErrorMessage(message);
      setStatus('error');
      onError(message);
    }
  }, [publicKey, connected, tokenAddress, recipientAddress, amount, token, connection, sendTransaction, onSuccess, onError]);

  if (!connected) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 text-center">
        <Wallet className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-400">Connect your Solana wallet to pay</p>
      </div>
    );
  }

  if (balance !== null && balance < amount) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-500 font-medium">Insufficient {token.toUpperCase()} balance</p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
        <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
        <p className="text-green-500 font-medium">Payment successful!</p>
        <a href={`https://solscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-400 hover:text-purple-300">View on Solscan →</a>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-500 font-medium">{errorMessage}</p>
        <button onClick={() => { setStatus('idle'); setErrorMessage(''); }} className="mt-3 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm">Try Again</button>
      </div>
    );
  }

  return (
    <button
      onClick={handlePayment}
      disabled={status !== 'idle'}
      className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2"
    >
      {status !== 'idle' && <Loader2 className="w-5 h-5 animate-spin" />}
      {status === 'idle' ? `Pay $${amount.toFixed(2)} ${token.toUpperCase()} on Solana` : 'Processing...'}
    </button>
  );
}

// ===========================================
// SUI PAYMENT BUTTON
// ===========================================

interface SuiPaymentButtonProps {
  amount: number;
  token: 'usdc' | 'usdt';
  tokenAddress: string;
  recipientAddress: string;
  onSuccess: (txHash: string) => void;
  onError: (error: string) => void;
}

function SuiPaymentButton({
  amount,
  token,
  tokenAddress,
  recipientAddress,
  onSuccess,
  onError,
}: SuiPaymentButtonProps) {
  const [status, setStatus] = useState<'idle' | 'confirming' | 'pending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [txHash, setTxHash] = useState('');
  const [balance, setBalance] = useState<number | null>(null);

  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  useEffect(() => {
    const fetchBalance = async () => {
      if (!currentAccount?.address || !tokenAddress) return;
      try {
        const coins = await suiClient.getCoins({ owner: currentAccount.address, coinType: tokenAddress });
        const totalBalance = coins.data.reduce((sum, coin) => sum + BigInt(coin.balance), BigInt(0));
        setBalance(Number(totalBalance) / Math.pow(10, 6));
      } catch {
        setBalance(null);
      }
    };
    if (currentAccount?.address) fetchBalance();
  }, [suiClient, currentAccount, tokenAddress]);

  const handlePayment = useCallback(async () => {
    if (!currentAccount?.address) {
      setErrorMessage('Please connect your Sui wallet');
      setStatus('error');
      onError('Wallet not connected');
      return;
    }

    try {
      setStatus('confirming');

      const decimals = TOKEN_DECIMALS[token] || 6;
      const amountInSmallestUnit = BigInt(Math.floor(amount * Math.pow(10, decimals)));

      const coins = await suiClient.getCoins({ owner: currentAccount.address, coinType: tokenAddress });
      if (coins.data.length === 0) throw new Error('No coins found');

      const tx = new SuiTransaction();
      const primaryCoin = coins.data[0];

      if (coins.data.length > 1) {
        const otherCoins = coins.data.slice(1).map(c => c.coinObjectId);
        if (otherCoins.length > 0) {
          tx.mergeCoins(tx.object(primaryCoin.coinObjectId), otherCoins.map(id => tx.object(id)));
        }
      }

      const [coinToSend] = tx.splitCoins(tx.object(primaryCoin.coinObjectId), [amountInSmallestUnit]);
      tx.transferObjects([coinToSend], recipientAddress);

      setStatus('pending');
      const result = await signAndExecute({ transaction: tx });

      setTxHash(result.digest);
      setStatus('success');
      onSuccess(result.digest);
    } catch (error: any) {
      const message = error?.message?.includes('rejected') ? 'Transaction rejected' : (error?.message?.slice(0, 100) || 'Transaction failed');
      setErrorMessage(message);
      setStatus('error');
      onError(message);
    }
  }, [currentAccount, tokenAddress, recipientAddress, amount, token, suiClient, signAndExecute, onSuccess, onError]);

  if (!currentAccount?.address) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 text-center">
        <Wallet className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-400">Connect your Sui wallet to pay</p>
      </div>
    );
  }

  if (balance !== null && balance < amount) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-500 font-medium">Insufficient {token.toUpperCase()} balance</p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
        <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
        <p className="text-green-500 font-medium">Payment successful!</p>
        <a href={`https://suiscan.xyz/mainnet/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">View on SuiScan →</a>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-500 font-medium">{errorMessage}</p>
        <button onClick={() => { setStatus('idle'); setErrorMessage(''); }} className="mt-3 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm">Try Again</button>
      </div>
    );
  }

  return (
    <button
      onClick={handlePayment}
      disabled={status !== 'idle'}
      className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2"
    >
      {status !== 'idle' && <Loader2 className="w-5 h-5 animate-spin" />}
      {status === 'idle' ? `Pay $${amount.toFixed(2)} ${token.toUpperCase()} on Sui` : 'Processing...'}
    </button>
  );
}

export default PaymentButton;
