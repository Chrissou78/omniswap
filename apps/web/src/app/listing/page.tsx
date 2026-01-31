'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, ExternalLink, Coins, Link2, Mail, CreditCard } from 'lucide-react';
import { PaymentButton } from '@/components/payment/PaymentButton';

interface Chain {
  id: number | string;
  name: string;
  symbol: string;
  color: string;
  type: string;
  explorerUrl: string;
}

interface FormData {
  chainId: string;
  contractAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  totalSupply: string;
  logoUrl: string;
  description: string;
  websiteUrl: string;
  whitepaperUrl: string;
  twitterUrl: string;
  telegramUrl: string;
  discordUrl: string;
  githubUrl: string;
  coingeckoId: string;
  coinmarketcapId: string;
  launchDate: string;
  isAudited: boolean;
  auditUrl: string;
  additionalNotes: string;
  email: string;
  telegramHandle: string;
  projectRole: string;
}

const INITIAL_FORM: FormData = {
  chainId: '',
  contractAddress: '',
  symbol: '',
  name: '',
  decimals: 18,
  totalSupply: '',
  logoUrl: '',
  description: '',
  websiteUrl: '',
  whitepaperUrl: '',
  twitterUrl: '',
  telegramUrl: '',
  discordUrl: '',
  githubUrl: '',
  coingeckoId: '',
  coinmarketcapId: '',
  launchDate: '',
  isAudited: false,
  auditUrl: '',
  additionalNotes: '',
  email: '',
  telegramHandle: '',
  projectRole: '',
};

const LISTING_FEE = 300;

// Payment wallets from environment
const PAYMENT_WALLETS = {
  evm: process.env.NEXT_PUBLIC_PAYMENT_WALLET_EVM || '',
  solana: process.env.NEXT_PUBLIC_PAYMENT_WALLET_SOLANA || '',
  sui: process.env.NEXT_PUBLIC_PAYMENT_WALLET_SUI || '',
};

// USDC/USDT addresses per chain
const STABLECOIN_ADDRESSES: Record<string, { usdc?: string; usdt?: string }> = {
  '1': {
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    usdt: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  },
  '56': {
    usdc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    usdt: '0x55d398326f99059fF775485246999027B3197955',
  },
  '137': {
    usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    usdt: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  },
  '42161': {
    usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    usdt: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  },
  '10': {
    usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    usdt: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
  },
  '8453': {
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    usdt: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
  },
  '43114': {
    usdc: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    usdt: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
  },
  'solana-mainnet': {
    usdc: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    usdt: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  },
  'sui-mainnet': {
    usdc: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN',
    usdt: '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN',
  },
};

export default function TokenListingPage() {
  const router = useRouter();

  // Data state
  const [chains, setChains] = useState<Chain[]>([]);
  const [paymentChains, setPaymentChains] = useState<Chain[]>([]);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [loading, setLoading] = useState(true);

  // Auto-fetch state
  const [autoFetching, setAutoFetching] = useState(false);
  const [autoFetchError, setAutoFetchError] = useState('');

  // Payment state
  const [selectedPaymentChain, setSelectedPaymentChain] = useState<string>('');
  const [selectedToken, setSelectedToken] = useState<'usdc' | 'usdt'>('usdc');
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  const [listingId, setListingId] = useState<string>('');

  // UI state
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  // Load chains on mount
  useEffect(() => {
    async function loadChains() {
      try {
        const res = await fetch('/api/admin/chains');
        if (res.ok) {
          const data = await res.json();
          setChains(data);
          const supported = data.filter((c: Chain) => STABLECOIN_ADDRESSES[String(c.id)]);
          setPaymentChains(supported);
          if (supported.length > 0) {
            setSelectedPaymentChain(String(supported[0].id));
          }
        }
      } catch (err) {
        console.error('Failed to load chains:', err);
      } finally {
        setLoading(false);
      }
    }
    loadChains();
  }, []);

  // Auto-fetch token info from CoinGecko
  const autoFetchTokenInfo = async () => {
    if (!form.chainId || !form.contractAddress) return;

    setAutoFetching(true);
    setAutoFetchError('');

    try {
      const platformMap: Record<string, string> = {
        '1': 'ethereum',
        '137': 'polygon-pos',
        '56': 'binance-smart-chain',
        '42161': 'arbitrum-one',
        '10': 'optimistic-ethereum',
        '43114': 'avalanche',
        '8453': 'base',
      };

      const platform = platformMap[form.chainId];
      if (!platform) {
        setAutoFetchError('Auto-fetch not available for this chain');
        return;
      }

      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/${platform}/contract/${form.contractAddress.toLowerCase()}`
      );

      if (res.ok) {
        const data = await res.json();
        setForm((prev) => ({
          ...prev,
          symbol: data.symbol?.toUpperCase() || prev.symbol,
          name: data.name || prev.name,
          decimals: data.detail_platforms?.[platform]?.decimal_place || prev.decimals,
          logoUrl: data.image?.large || prev.logoUrl,
          description: data.description?.en?.slice(0, 500) || prev.description,
          coingeckoId: data.id || prev.coingeckoId,
          websiteUrl: data.links?.homepage?.[0] || prev.websiteUrl,
          twitterUrl: data.links?.twitter_screen_name
            ? `https://twitter.com/${data.links.twitter_screen_name}`
            : prev.twitterUrl,
          telegramUrl: data.links?.telegram_channel_identifier
            ? `https://t.me/${data.links.telegram_channel_identifier}`
            : prev.telegramUrl,
          githubUrl: data.links?.repos_url?.github?.[0] || prev.githubUrl,
        }));
      } else {
        setAutoFetchError('Token not found on CoinGecko. Please fill in details manually.');
      }
    } catch (err: any) {
      setAutoFetchError(err.message || 'Failed to fetch token info');
    } finally {
      setAutoFetching(false);
    }
  };

  const updateForm = (field: keyof FormData, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Validation per step
  const canProceed = (currentStep: number): boolean => {
    switch (currentStep) {
      case 1:
        return !!(form.chainId && form.contractAddress && form.symbol && form.name);
      case 2:
        return true;
      case 3:
        return !!form.email;
      case 4:
        return !!selectedPaymentChain && !!selectedToken;
      default:
        return false;
    }
  };

  // Current selections
  const selectedChain = chains.find((c) => String(c.id) === form.chainId);
  const currentPaymentChain = paymentChains.find((c) => String(c.id) === selectedPaymentChain);

  const getPaymentWallet = () => {
    if (!currentPaymentChain) return '';
    switch (currentPaymentChain.type) {
      case 'solana':
        return PAYMENT_WALLETS.solana;
      case 'sui':
        return PAYMENT_WALLETS.sui;
      default:
        return PAYMENT_WALLETS.evm;
    }
  };

  const paymentWallet = getPaymentWallet();
  const tokenAddress = selectedPaymentChain
    ? STABLECOIN_ADDRESSES[selectedPaymentChain]?.[selectedToken]
    : undefined;
  const availableTokens = selectedPaymentChain
    ? Object.keys(STABLECOIN_ADDRESSES[selectedPaymentChain] || {})
    : [];

  // Handle payment success - create listing with payment info
  const handlePaymentSuccess = async (txHashOrSessionId: string, method?: 'crypto' | 'stripe') => {
    setTxHash(txHashOrSessionId);
    setError('');

    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          chainId: form.chainId,
          listingFee: LISTING_FEE,
          payment: {
            method: method || 'crypto',
            chainId: method === 'stripe' ? 'stripe' : selectedPaymentChain,
            token: method === 'stripe' ? 'USD' : selectedToken.toUpperCase(),
            txHash: txHashOrSessionId,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create listing');
      }

      const listing = await res.json();
      setListingId(listing.id);
      setPaymentComplete(true);
    } catch (err: any) {
      setError(err.message || 'Failed to create listing after payment');
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Success state
  if (paymentComplete) {
    return (
      <div className="min-h-screen bg-[#0a0b0f] text-white flex items-center justify-center">
        <div className="bg-[#1a1b23] rounded-xl p-8 border border-gray-800 max-w-md text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Listing Submitted!</h2>
          <p className="text-gray-400 mb-6">
            Your token listing request has been submitted. You'll receive a confirmation email at{' '}
            <span className="text-white">{form.email}</span>.
          </p>
          <div className="bg-[#12131a] rounded-lg p-4 mb-6 text-left">
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Request ID:</span>
                <span className="font-mono text-xs">{listingId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Token:</span>
                <span>
                  {form.name} ({form.symbol})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Fee Paid:</span>
                <span>
                  ${LISTING_FEE} {selectedToken.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Network:</span>
                <span>{currentPaymentChain?.name}</span>
              </div>
            </div>
          </div>
          {currentPaymentChain && txHash && (
            <a
              href={`${currentPaymentChain.explorerUrl}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm mb-6"
            >
              <ExternalLink className="w-4 h-4" />
              View transaction
            </a>
          )}
          <div>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-white">
      {/* Header */}
      <div className="bg-[#12131a] border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link href="/" className="text-gray-400 hover:text-white text-sm mb-2 inline-block">
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-bold">List Your Token</h1>
          <p className="text-gray-400 mt-2">
            Get your token listed on our DEX aggregator and reach thousands of traders
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[
            { num: 1, icon: Coins, label: 'Token Info' },
            { num: 2, icon: Link2, label: 'Links' },
            { num: 3, icon: Mail, label: 'Contact' },
            { num: 4, icon: CreditCard, label: 'Payment' },
          ].map((s, i) => (
            <div key={s.num} className="flex items-center">
              <button
                onClick={() => s.num < step && setStep(s.num)}
                disabled={s.num >= step}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                  step === s.num
                    ? 'bg-blue-600 text-white'
                    : step > s.num
                    ? 'bg-green-600 text-white cursor-pointer hover:bg-green-500'
                    : 'bg-gray-700 text-gray-400'
                }`}
              >
                {step > s.num ? '✓' : s.num}
              </button>
              {i < 3 && (
                <div className={`w-16 h-1 mx-2 ${step > s.num ? 'bg-green-600' : 'bg-gray-700'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-8 text-sm text-gray-400 mb-8">
          <span className={step === 1 ? 'text-white' : ''}>Token Info</span>
          <span className={step === 2 ? 'text-white' : ''}>Links</span>
          <span className={step === 3 ? 'text-white' : ''}>Contact</span>
          <span className={step === 4 ? 'text-white' : ''}>Payment</span>
        </div>

        {/* Listing Fee Banner */}
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Listing Fee</h3>
              <p className="text-sm text-gray-400">One-time payment for token verification and listing</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-green-400">${LISTING_FEE}</div>
              <div className="text-sm text-gray-400">USDC / USDT</div>
            </div>
          </div>
        </div>

        {/* Step 1: Token Info */}
        {step === 1 && (
          <div className="bg-[#1a1b23] rounded-xl p-6 border border-gray-800">
            <h2 className="text-xl font-semibold mb-6">Token Information</h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Chain <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.chainId}
                  onChange={(e) => updateForm('chainId', e.target.value)}
                  className="w-full px-4 py-3 bg-[#12131a] border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select Chain</option>
                  {chains.map((chain) => (
                    <option key={chain.id} value={chain.id}>
                      {chain.name} ({chain.symbol})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Contract Address <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.contractAddress}
                    onChange={(e) => updateForm('contractAddress', e.target.value)}
                    placeholder="0x..."
                    className="flex-1 px-4 py-3 bg-[#12131a] border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none font-mono text-sm"
                  />
                  <button
                    onClick={autoFetchTokenInfo}
                    disabled={!form.chainId || !form.contractAddress || autoFetching}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-semibold whitespace-nowrap"
                  >
                    {autoFetching ? '...' : 'Auto-fill'}
                  </button>
                </div>
                {autoFetchError && <p className="text-yellow-400 text-xs mt-1">{autoFetchError}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Symbol <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.symbol}
                  onChange={(e) => updateForm('symbol', e.target.value.toUpperCase())}
                  placeholder="e.g., ETH"
                  className="w-full px-4 py-3 bg-[#12131a] border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  placeholder="e.g., Ethereum"
                  className="w-full px-4 py-3 bg-[#12131a] border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Decimals</label>
                <input
                  type="number"
                  value={form.decimals}
                  onChange={(e) => updateForm('decimals', parseInt(e.target.value) || 18)}
                  className="w-full px-4 py-3 bg-[#12131a] border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Total Supply</label>
                <input
                  type="text"
                  value={form.totalSupply}
                  onChange={(e) => updateForm('totalSupply', e.target.value)}
                  placeholder="e.g., 1000000000"
                  className="w-full px-4 py-3 bg-[#12131a] border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Logo URL</label>
              <input
                type="url"
                value={form.logoUrl}
                onChange={(e) => updateForm('logoUrl', e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-3 bg-[#12131a] border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
              />
              {form.logoUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <img
                    src={form.logoUrl}
                    alt="Token logo"
                    className="w-8 h-8 rounded-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <span className="text-sm text-gray-400">Logo preview</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
                placeholder="Brief description of your token/project..."
                rows={3}
                className="w-full px-4 py-3 bg-[#12131a] border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
              />
            </div>
          </div>
        )}

        {/* Step 2: Project Links */}
        {step === 2 && (
          <div className="bg-[#1a1b23] rounded-xl p-6 border border-gray-800">
            <h2 className="text-xl font-semibold mb-6">Project Links</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Website</label>
                <input
                  type="url"
                  value={form.websiteUrl}
                  onChange={(e) => updateForm('websiteUrl', e.target.value)}
                  placeholder="https://your-project.com"
                  className="w-full px-4 py-3 bg-[#12131a] border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Twitter</label>
                  <input
                    type="url"
                    value={form.twitterUrl}
                    onChange={(e) => updateForm('twitterUrl', e.target.value)}
                    placeholder="https://twitter.com/..."
                    className="w-full px-4 py-3 bg-[#12131a] border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Telegram</label>
                  <input
                    type="url"
                    value={form.telegramUrl}
                    onChange={(e) => updateForm('telegramUrl', e.target.value)}
                    placeholder="https://t.me/..."
                    className="w-full px-4 py-3 bg-[#12131a] border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Discord</label>
                  <input
                    type="url"
                    value={form.discordUrl}
                    onChange={(e) => updateForm('discordUrl', e.target.value)}
                    placeholder="https://discord.gg/..."
                    className="w-full px-4 py-3 bg-[#12131a] border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">GitHub</label>
                  <input
                    type="url"
                    value={form.githubUrl}
                    onChange={(e) => updateForm('githubUrl', e.target.value)}
                    placeholder="https://github.com/..."
                    className="w-full px-4 py-3 bg-[#12131a] border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Whitepaper</label>
                <input
                  type="url"
                  value={form.whitepaperUrl}
                  onChange={(e) => updateForm('whitepaperUrl', e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-3 bg-[#12131a] border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">CoinGecko ID</label>
                  <input
                    type="text"
                    value={form.coingeckoId}
                    onChange={(e) => updateForm('coingeckoId', e.target.value)}
                    placeholder="e.g., ethereum"
                    className="w-full px-4 py-3 bg-[#12131a] border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">CoinMarketCap ID</label>
                  <input
                    type="text"
                    value={form.coinmarketcapId}
                    onChange={(e) => updateForm('coinmarketcapId', e.target.value)}
                    placeholder="e.g., 1027"
                    className="w-full px-4 py-3 bg-[#12131a] border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="border-t border-gray-700 pt-4 mt-4">
                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="checkbox"
                    id="isAudited"
                    checked={form.isAudited}
                    onChange={(e) => updateForm('isAudited', e.target.checked)}
                    className="w-5 h-5 rounded bg-[#12131a] border-gray-700"
                  />
                  <label htmlFor="isAudited" className="text-sm">
                    Token contract has been audited
                  </label>
                </div>

                {form.isAudited && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Audit Report URL</label>
                    <input
                      type="url"
                      value={form.auditUrl}
                      onChange={(e) => updateForm('auditUrl', e.target.value)}
                      placeholder="https://..."
                      className="w-full px-4 py-3 bg-[#12131a] border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Additional Notes</label>
                <textarea
                  value={form.additionalNotes}
                  onChange={(e) => updateForm('additionalNotes', e.target.value)}
                  placeholder="Any additional information about your project..."
                  rows={3}
                  className="w-full px-4 py-3 bg-[#12131a] border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Contact Info */}
        {step === 3 && (
          <div className="bg-[#1a1b23] rounded-xl p-6 border border-gray-800">
            <h2 className="text-xl font-semibold mb-6">Contact Information</h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateForm('email', e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 bg-[#12131a] border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Telegram Handle</label>
                  <input
                    type="text"
                    value={form.telegramHandle}
                    onChange={(e) => updateForm('telegramHandle', e.target.value)}
                    placeholder="@yourusername"
                    className="w-full px-4 py-3 bg-[#12131a] border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Your Role</label>
                  <select
                    value={form.projectRole}
                    onChange={(e) => updateForm('projectRole', e.target.value)}
                    className="w-full px-4 py-3 bg-[#12131a] border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Select Role</option>
                    <option value="founder">Founder / Co-founder</option>
                    <option value="developer">Developer</option>
                    <option value="marketing">Marketing</option>
                    <option value="community">Community Manager</option>
                    <option value="investor">Investor</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-[#12131a] rounded-lg p-4 border border-gray-700 mb-6">
              <h3 className="font-semibold mb-4">Listing Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Token:</span>
                  <span>
                    {form.name} ({form.symbol})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Chain:</span>
                  <span>{selectedChain?.name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Contract:</span>
                  <span className="font-mono text-xs truncate max-w-[200px]">
                    {form.contractAddress || '-'}
                  </span>
                </div>
                {form.isAudited && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Audited:</span>
                    <span className="text-green-400">✓ Yes</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-blue-500 text-xl">ℹ️</span>
                <div>
                  <h4 className="font-semibold text-blue-400">Review Process</h4>
                  <p className="text-sm text-gray-300 mt-1">
                    After payment, our team will review your submission within 24-48 hours.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Payment */}
        {step === 4 && (
          <div className="bg-[#1a1b23] rounded-xl p-6 border border-gray-800">
            <h2 className="text-xl font-semibold mb-4">Complete Payment</h2>

            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-lg">Amount to Pay:</span>
                <span className="text-3xl font-bold text-green-400">${LISTING_FEE}</span>
              </div>
            </div>

            {/* Select Network */}
            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2">Select Network</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {paymentChains.map((chain) => (
                  <button
                    key={chain.id}
                    onClick={() => {
                      setSelectedPaymentChain(String(chain.id));
                      const available = Object.keys(STABLECOIN_ADDRESSES[String(chain.id)] || {});
                      if (!available.includes(selectedToken)) {
                        setSelectedToken(available[0] as 'usdc' | 'usdt');
                      }
                    }}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedPaymentChain === String(chain.id)
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: chain.color }}
                      />
                      <span className="text-sm font-medium">{chain.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Select Token */}
            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2">Select Token</label>
              <div className="flex gap-2">
                {availableTokens.map((token) => (
                  <button
                    key={token}
                    onClick={() => setSelectedToken(token as 'usdc' | 'usdt')}
                    className={`px-6 py-3 rounded-lg border-2 font-semibold transition-all ${
                      selectedToken === token
                        ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                        : 'border-gray-700 hover:border-gray-600 text-gray-300'
                    }`}
                  >
                    {token.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Button */}
            {currentPaymentChain && tokenAddress && paymentWallet && (
              <div className="mb-6">
                <PaymentButton
                  amount={LISTING_FEE}
                  chainId={selectedPaymentChain}
                  chainType={currentPaymentChain.type as 'evm' | 'solana' | 'sui'}
                  token={selectedToken}
                  tokenAddress={tokenAddress}
                  recipientAddress={paymentWallet}
                  enableStripe={true}
                  stripeProductName={`Token Listing - ${form.symbol || 'New Token'}`}
                  stripeMetadata={{
                    type: 'token_listing',
                    tokenSymbol: form.symbol,
                    tokenName: form.name,
                    chainId: form.chainId,
                    contractAddress: form.contractAddress,
                    email: form.email,
                  }}
                  onSuccess={(txHashOrSessionId, method) => {
                    console.log(`Payment via ${method}:`, txHashOrSessionId);
                    handlePaymentSuccess(txHashOrSessionId, method);
                  }}
                  onError={(error) => {
                    console.error('Payment failed:', error);
                    setError(error);
                  }}
                />
              </div>
            )}

            {!paymentWallet && currentPaymentChain && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
                <p className="text-red-400 text-sm">
                  Payment wallet not configured for {currentPaymentChain.type}. Please contact
                  support.
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => setStep(step - 1)}
            disabled={step === 1}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              step === 1
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
          >
            ← Back
          </button>

          {step < 4 && (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed(step)}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                canProceed(step)
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }`}
            >
              Continue →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
