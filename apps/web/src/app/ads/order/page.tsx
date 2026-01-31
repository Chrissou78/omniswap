'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, DollarSign, Eye, Image as ImageIcon, Link as LinkIcon, Mail, Building, User, CheckCircle, ArrowLeft, Info } from 'lucide-react';
import Link from 'next/link';
import PaymentButton from '@/components/payment/PaymentButton';

interface AdSlot {
  id: string;
  name: string;
  description: string;
  position: string;
  dimensions: string;
  width: number;
  height: number;
  basePrice: number;
  sortOrder: number;
  isActive: boolean;
}

interface BookingForm {
  imageUrl: string;
  targetUrl: string;
  altText: string;
  email: string;
  companyName: string;
  contactName: string;
}

const STABLECOIN_ADDRESSES: Record<string, { usdc?: string; usdt?: string }> = {
  '1': { usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', usdt: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
  '56': { usdc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', usdt: '0x55d398326f99059fF775485246999027B3197955' },
  '137': { usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', usdt: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' },
  '42161': { usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', usdt: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' },
  '10': { usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', usdt: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58' },
  '8453': { usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  '43114': { usdc: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', usdt: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7' },
  'solana-mainnet': { usdc: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
  'sui-mainnet': { usdc: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN' },
};

const PAYMENT_CHAINS = [
  { id: '1', name: 'Ethereum', type: 'evm', symbol: 'ETH' },
  { id: '137', name: 'Polygon', type: 'evm', symbol: 'MATIC' },
  { id: '42161', name: 'Arbitrum', type: 'evm', symbol: 'ETH' },
  { id: '8453', name: 'Base', type: 'evm', symbol: 'ETH' },
  { id: '56', name: 'BNB Chain', type: 'evm', symbol: 'BNB' },
  { id: 'solana-mainnet', name: 'Solana', type: 'solana', symbol: 'SOL' },
  { id: 'sui-mainnet', name: 'Sui', type: 'sui', symbol: 'SUI' },
];

const PAYMENT_WALLETS = {
  evm: process.env.NEXT_PUBLIC_PAYMENT_WALLET_EVM || '',
  solana: process.env.NEXT_PUBLIC_PAYMENT_WALLET_SOLANA || '',
  sui: process.env.NEXT_PUBLIC_PAYMENT_WALLET_SUI || '',
};

export default function AdOrderPage() {
  const [slots, setSlots] = useState<AdSlot[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [days, setDays] = useState(7);
  const [startDate, setStartDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  
  const [creatives, setCreatives] = useState<Record<string, { imageUrl: string; targetUrl: string; altText: string }>>({});
  
  const [form, setForm] = useState<BookingForm>({
    imageUrl: '',
    targetUrl: '',
    altText: '',
    email: '',
    companyName: '',
    contactName: '',
  });

  const [selectedPaymentChain, setSelectedPaymentChain] = useState('137');
  const [selectedToken, setSelectedToken] = useState<'usdc' | 'usdt'>('usdc');
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [bookingIds, setBookingIds] = useState<string[]>([]);
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSlots();
  }, []);

  async function fetchSlots() {
    try {
      const res = await fetch('/api/ads/slots');
      if (res.ok) {
        const data = await res.json();
        setSlots(data.filter((s: AdSlot) => s.isActive).sort((a: AdSlot, b: AdSlot) => a.sortOrder - b.sortOrder));
      }
    } catch (err) {
      console.error('Failed to fetch slots:', err);
    } finally {
      setLoading(false);
    }
  }

  const toggleSlot = (slotId: string) => {
    const newSelected = new Set(selectedSlots);
    if (newSelected.has(slotId)) {
      newSelected.delete(slotId);
      const newCreatives = { ...creatives };
      delete newCreatives[slotId];
      setCreatives(newCreatives);
    } else {
      newSelected.add(slotId);
      setCreatives(prev => ({
        ...prev,
        [slotId]: { imageUrl: '', targetUrl: '', altText: '' }
      }));
    }
    setSelectedSlots(newSelected);
  };

  const selectAllSlots = () => {
    const allIds = new Set(slots.map(s => s.id));
    setSelectedSlots(allIds);
    const newCreatives: Record<string, { imageUrl: string; targetUrl: string; altText: string }> = {};
    slots.forEach(s => {
      newCreatives[s.id] = { imageUrl: '', targetUrl: '', altText: '' };
    });
    setCreatives(newCreatives);
  };

  const clearAllSlots = () => {
    setSelectedSlots(new Set());
    setCreatives({});
  };

  const updateCreative = (slotId: string, field: string, value: string) => {
    setCreatives(prev => ({
      ...prev,
      [slotId]: { ...prev[slotId], [field]: value }
    }));
  };

  const applyToAll = (slotId: string) => {
    const source = creatives[slotId];
    if (!source) return;
    
    const newCreatives = { ...creatives };
    selectedSlots.forEach(id => {
      if (id !== slotId) {
        newCreatives[id] = { ...source };
      }
    });
    setCreatives(newCreatives);
  };

  // Calculate pricing with discounts
  const selectedSlotsList = slots.filter(s => selectedSlots.has(s.id));
  const totalDailyPrice = selectedSlotsList.reduce((sum, s) => sum + s.basePrice, 0);
  const totalPrice = totalDailyPrice * days;

  // Volume discount (based on campaign duration)
  const volumeDiscountPercent = days >= 30 ? 20 : days >= 14 ? 10 : days >= 7 ? 5 : 0;

  // Advance booking discount (based on how far in advance you book)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  const daysInAdvance = Math.max(0, Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  // 1% per day + 2% bonus per week, max 30%
  const advanceDiscountPercent = Math.min(
    daysInAdvance + Math.floor(daysInAdvance / 7) * 2,
    30
  );

  // Total discount capped at 50%
  const discountPercent = Math.min(volumeDiscountPercent + advanceDiscountPercent, 50);
  const discountedPrice = Math.round(totalPrice * (1 - discountPercent / 100));

  const currentChain = PAYMENT_CHAINS.find(c => c.id === selectedPaymentChain);
  const availableTokens = STABLECOIN_ADDRESSES[selectedPaymentChain] || {};
  const tokenAddress = availableTokens[selectedToken] || '';

  const canProceedToStep2 = selectedSlots.size > 0;
  const canProceedToStep3 = selectedSlotsList.every(s => 
    creatives[s.id]?.imageUrl && creatives[s.id]?.targetUrl
  );
  const canProceedToStep4 = form.email && form.companyName && form.contactName;

  async function handlePaymentSuccess(txHashOrSessionId: string, method?: 'crypto' | 'stripe') {
    setTxHash(txHashOrSessionId);
    setError('');

    try {
      const bookingPromises = selectedSlotsList.map(slot => 
        fetch('/api/ads/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slotId: slot.id,
            startDate,
            days,
            imageUrl: creatives[slot.id].imageUrl,
            targetUrl: creatives[slot.id].targetUrl,
            altText: creatives[slot.id].altText || `${form.companyName} advertisement`,
            email: form.email,
            companyName: form.companyName,
            contactName: form.contactName,
            pricing: {
              basePricePerDay: slot.basePrice,
              days,
              volumeDiscountPct: volumeDiscountPercent,
              advanceDiscountPct: advanceDiscountPercent,
              totalDiscountPct: discountPercent,
              subtotal: slot.basePrice * days,
              discountAmount: Math.round(slot.basePrice * days * discountPercent / 100),
              finalPrice: Math.round(slot.basePrice * days * (1 - discountPercent / 100)),
            },
            payment: {
              method: method || 'crypto',
              chainId: method === 'stripe' ? 'stripe' : selectedPaymentChain,
              token: method === 'stripe' ? 'USD' : selectedToken.toUpperCase(),
              txHash: txHashOrSessionId,
            },
          }),
        }).then(res => res.json())
      );

      const results = await Promise.all(bookingPromises);
      const ids = results.map(r => r.booking?.id).filter(Boolean);
      setBookingIds(ids);
      setPaymentComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create bookings');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (paymentComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-gray-900 rounded-2xl p-8 max-w-lg w-full text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Booking Confirmed!</h1>
          <p className="text-gray-400 mb-6">
            Your {selectedSlots.size} ad slot{selectedSlots.size > 1 ? 's have' : ' has'} been booked successfully.
          </p>
          
          <div className="bg-gray-800 rounded-lg p-4 mb-6 text-left">
            <div className="text-sm text-gray-400 mb-2">Booked Slots:</div>
            <ul className="space-y-1">
              {selectedSlotsList.map(slot => (
                <li key={slot.id} className="text-white text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  {slot.name} ({slot.dimensions})
                </li>
              ))}
            </ul>
            <div className="mt-3 pt-3 border-t border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Duration:</span>
                <span className="text-white">{days} days</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Start Date:</span>
                <span className="text-white">{new Date(startDate).toLocaleDateString()}</span>
              </div>
              {discountPercent > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Discount Applied:</span>
                  <span className="text-green-400">{discountPercent}% off</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Paid:</span>
                <span className="text-green-400 font-medium">${discountedPrice}</span>
              </div>
            </div>
          </div>

          {txHash && (
            <p className="text-xs text-gray-500 mb-4 break-all">
              Transaction: {txHash.slice(0, 20)}...
            </p>
          )}

          <p className="text-sm text-gray-400 mb-6">
            Your ads will be reviewed within 24 hours and will go live on {new Date(startDate).toLocaleDateString()}.
          </p>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-white">Book Advertisement Space</h1>
          <p className="text-gray-400 mt-2">Select multiple ad slots and customize each creative</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-4 mb-8 overflow-x-auto pb-2">
          {[
            { num: 1, label: 'Select Slots', icon: Eye },
            { num: 2, label: 'Upload Creatives', icon: ImageIcon },
            { num: 3, label: 'Contact Info', icon: Mail },
            { num: 4, label: 'Payment', icon: DollarSign },
          ].map(({ num, label, icon: Icon }) => (
            <div 
              key={num}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap ${
                step === num 
                  ? 'bg-purple-600 text-white' 
                  : step > num 
                    ? 'bg-green-600/20 text-green-400'
                    : 'bg-gray-800 text-gray-500'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="font-medium">{label}</span>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Select Slots */}
            {step === 1 && (
              <div className="bg-gray-900 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white">Select Ad Slots</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAllSlots}
                      className="text-sm text-purple-400 hover:text-purple-300"
                    >
                      Select All
                    </button>
                    <span className="text-gray-600">|</span>
                    <button
                      onClick={clearAllSlots}
                      className="text-sm text-gray-400 hover:text-gray-300"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid gap-4">
                  {slots.map(slot => (
                    <div
                      key={slot.id}
                      onClick={() => toggleSlot(slot.id)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedSlots.has(slot.id)
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              selectedSlots.has(slot.id)
                                ? 'border-purple-500 bg-purple-500'
                                : 'border-gray-600'
                            }`}>
                              {selectedSlots.has(slot.id) && (
                                <CheckCircle className="w-3 h-3 text-white" />
                              )}
                            </div>
                            <h3 className="font-medium text-white">{slot.name}</h3>
                            <span className="text-xs px-2 py-0.5 bg-gray-700 rounded text-gray-400">
                              {slot.dimensions}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 mt-1 ml-8">{slot.description}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-white">${slot.basePrice}</div>
                          <div className="text-xs text-gray-500">per day</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Duration Selector */}
                <div className="mt-6 pt-6 border-t border-gray-800">
                  <h3 className="text-lg font-medium text-white mb-4">Campaign Duration</h3>
                  <div className="grid grid-cols-4 gap-3">
                    {[7, 14, 30, 90].map(d => (
                      <button
                        key={d}
                        onClick={() => setDays(d)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          days === d
                            ? 'border-purple-500 bg-purple-500/10'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <div className="text-lg font-bold text-white">{d}</div>
                        <div className="text-xs text-gray-400">days</div>
                        {d >= 7 && (
                          <div className="text-xs text-green-400 mt-1">
                            {d >= 30 ? '20% off' : d >= 14 ? '10% off' : '5% off'}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm text-gray-400 mb-2">
                      Start Date
                      {daysInAdvance > 0 && (
                        <span className="ml-2 text-green-400">
                          (+{advanceDiscountPercent}% advance booking discount)
                        </span>
                      )}
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                    />
                    {daysInAdvance > 0 && (
                      <p className="text-xs text-green-400 mt-1">
                        Booking {daysInAdvance} days in advance = {advanceDiscountPercent}% discount (1%/day + 2%/week bonus, max 30%)
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setStep(2)}
                  disabled={!canProceedToStep2}
                  className="w-full mt-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
                >
                  Continue to Creatives
                </button>
              </div>
            )}

            {/* Step 2: Upload Creatives */}
            {step === 2 && (
              <div className="space-y-4">
                {selectedSlotsList.map((slot, index) => (
                  <div key={slot.id} className="bg-gray-900 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-medium text-white">{slot.name}</h3>
                        <p className="text-sm text-gray-400">Required: {slot.dimensions} image</p>
                      </div>
                      {index === 0 && selectedSlots.size > 1 && (
                        <button
                          onClick={() => applyToAll(slot.id)}
                          className="text-sm text-purple-400 hover:text-purple-300"
                        >
                          Apply to all slots
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">
                          <ImageIcon className="w-4 h-4 inline mr-1" />
                          Image URL *
                        </label>
                        <input
                          type="url"
                          value={creatives[slot.id]?.imageUrl || ''}
                          onChange={(e) => updateCreative(slot.id, 'imageUrl', e.target.value)}
                          placeholder={`https://example.com/ad-${slot.dimensions}.png`}
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-400 mb-2">
                          <LinkIcon className="w-4 h-4 inline mr-1" />
                          Target URL *
                        </label>
                        <input
                          type="url"
                          value={creatives[slot.id]?.targetUrl || ''}
                          onChange={(e) => updateCreative(slot.id, 'targetUrl', e.target.value)}
                          placeholder="https://yourwebsite.com"
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-400 mb-2">
                          Alt Text (optional)
                        </label>
                        <input
                          type="text"
                          value={creatives[slot.id]?.altText || ''}
                          onChange={(e) => updateCreative(slot.id, 'altText', e.target.value)}
                          placeholder="Description of your ad"
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                        />
                      </div>

                      {/* Preview */}
                      {creatives[slot.id]?.imageUrl && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 mb-2">Preview:</p>
                          <div 
                            className="bg-gray-800 rounded-lg overflow-hidden inline-block"
                            style={{ width: Math.min(slot.width, 300), height: Math.min(slot.height, 200) }}
                          >
                            <img
                              src={creatives[slot.id].imageUrl}
                              alt="Preview"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <div className="flex gap-4">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!canProceedToStep3}
                    className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Contact Info */}
            {step === 3 && (
              <div className="bg-gray-900 rounded-xl p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Contact Information</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      <Building className="w-4 h-4 inline mr-1" />
                      Company Name *
                    </label>
                    <input
                      type="text"
                      value={form.companyName}
                      onChange={(e) => setForm(prev => ({ ...prev, companyName: e.target.value }))}
                      placeholder="Your Company"
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      <User className="w-4 h-4 inline mr-1" />
                      Contact Name *
                    </label>
                    <input
                      type="text"
                      value={form.contactName}
                      onChange={(e) => setForm(prev => ({ ...prev, contactName: e.target.value }))}
                      placeholder="Your Name"
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      <Mail className="w-4 h-4 inline mr-1" />
                      Email *
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="you@company.com"
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                    />
                  </div>
                </div>

                <div className="flex gap-4 mt-6">
                  <button
                    onClick={() => setStep(2)}
                    className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep(4)}
                    disabled={!canProceedToStep4}
                    className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
                  >
                    Continue to Payment
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Payment */}
            {step === 4 && (
              <div className="bg-gray-900 rounded-xl p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Payment</h2>

                {/* Chain Selection */}
                <div className="mb-6">
                  <label className="block text-sm text-gray-400 mb-2">Select Network</label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {PAYMENT_CHAINS.map(chain => (
                      <button
                        key={chain.id}
                        onClick={() => {
                          setSelectedPaymentChain(chain.id);
                          const tokens = STABLECOIN_ADDRESSES[chain.id] || {};
                          if (!tokens[selectedToken]) {
                            setSelectedToken(tokens.usdc ? 'usdc' : 'usdt');
                          }
                        }}
                        className={`p-2 rounded-lg border-2 text-sm transition-all ${
                          selectedPaymentChain === chain.id
                            ? 'border-purple-500 bg-purple-500/10'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        {chain.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Token Selection */}
                <div className="mb-6">
                  <label className="block text-sm text-gray-400 mb-2">Select Token</label>
                  <div className="flex gap-2">
                    {Object.keys(availableTokens).map(token => (
                      <button
                        key={token}
                        onClick={() => setSelectedToken(token as 'usdc' | 'usdt')}
                        className={`px-4 py-2 rounded-lg border-2 transition-all ${
                          selectedToken === token
                            ? 'border-purple-500 bg-purple-500/10'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        {token.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <PaymentButton
                  amount={discountedPrice}
                  chainId={selectedPaymentChain}
                  chainType={currentChain?.type || 'evm'}
                  token={selectedToken}
                  tokenAddress={tokenAddress}
                  recipientAddress={PAYMENT_WALLETS[currentChain?.type as keyof typeof PAYMENT_WALLETS] || ''}
                  enableStripe={true}
                  stripeProductName={`Ad Booking - ${selectedSlots.size} slot${selectedSlots.size > 1 ? 's' : ''}`}
                  stripeMetadata={{
                    type: 'ad_booking',
                    slots: Array.from(selectedSlots).join(','),
                    days: String(days),
                    startDate,
                    email: form.email,
                    companyName: form.companyName,
                  }}
                  onSuccess={(hash, method) => handlePaymentSuccess(hash, method)}
                  onError={(err) => setError(err)}
                />

                <button
                  onClick={() => setStep(3)}
                  className="w-full mt-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium transition-colors"
                >
                  Back
                </button>
              </div>
            )}
          </div>

          {/* Sidebar - Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-gray-900 rounded-xl p-6 sticky top-24">
              <h3 className="text-lg font-semibold text-white mb-4">Order Summary</h3>

              {selectedSlots.size === 0 ? (
                <p className="text-gray-400 text-sm">No slots selected</p>
              ) : (
                <>
                  <div className="space-y-3 mb-4">
                    {selectedSlotsList.map(slot => (
                      <div key={slot.id} className="flex justify-between text-sm">
                        <span className="text-gray-400">{slot.name}</span>
                        <span className="text-white">${slot.basePrice}/day</span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-800 pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Duration</span>
                      <span className="text-white">{days} days</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Start Date</span>
                      <span className="text-white">{new Date(startDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Subtotal</span>
                      <span className="text-white">${totalPrice}</span>
                    </div>
                    {volumeDiscountPercent > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-green-400">Volume discount ({volumeDiscountPercent}%)</span>
                        <span className="text-green-400">-${Math.round(totalPrice * volumeDiscountPercent / 100)}</span>
                      </div>
                    )}
                    {advanceDiscountPercent > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-green-400">Advance booking ({advanceDiscountPercent}%)</span>
                        <span className="text-green-400">-${Math.round(totalPrice * advanceDiscountPercent / 100)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-800">
                      <span className="text-white">Total</span>
                      <span className="text-purple-400">${discountedPrice}</span>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-blue-400">
                        <p>Ads will be reviewed within 24 hours and go live on your selected start date.</p>
                        {discountPercent > 0 && (
                          <p className="mt-1 font-medium">
                            You're saving ${totalPrice - discountedPrice} ({discountPercent}% off)!
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
