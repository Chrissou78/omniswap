'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useDisconnect, useBalance } from 'wagmi';
import { useWallet as useSolanaWallet, useConnection } from '@solana/wallet-adapter-react';
import { useCurrentAccount, useDisconnectWallet, useConnectWallet, useWallets, useSuiClientQuery } from '@mysten/dapp-kit';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ChevronDown, LogOut, Copy, Check, Wallet, X } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

// Wallet Icons
function MetaMaskIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <path d="M36.4 3.4L22.5 13.7l2.6-6.1 11.3-4.2z" fill="#E17726"/>
      <path d="M3.6 3.4l13.8 10.4-2.5-6.2L3.6 3.4zM31.3 27.8l-3.7 5.7 7.9 2.2 2.3-7.7-6.5-.2zM2.2 28l2.3 7.7 7.9-2.2-3.7-5.7-6.5.2z" fill="#E27625"/>
      <path d="M12 17.5l-2.2 3.3 7.8.4-.3-8.4-5.3 4.7zM28 17.5l-5.4-4.8-.2 8.5 7.8-.4-2.2-3.3zM12.4 33.5l4.7-2.3-4-3.2-.7 5.5zM22.9 31.2l4.7 2.3-.7-5.5-4 3.2z" fill="#E27625"/>
      <path d="M27.6 33.5l-4.7-2.3.4 3 0 1.3 4.3-2zM12.4 33.5l4.3 2-.1-1.3.4-3-4.6 2.3z" fill="#D5BFB2"/>
      <path d="M16.8 25.8l-3.9-1.1 2.7-1.3 1.2 2.4zM23.2 25.8l1.2-2.4 2.8 1.3-4 1.1z" fill="#233447"/>
      <path d="M12.4 33.5l.7-5.7-4.4.1 3.7 5.6zM26.9 27.8l.7 5.7 3.7-5.6-4.4-.1zM30.2 20.8l-7.8.4.7 4 1.2-2.5 2.8 1.3 3.1-3.2zM12.9 24.7l2.8-1.3 1.2 2.4.7-4-7.8-.3 3.1 3.2z" fill="#CC6228"/>
      <path d="M9.8 20.8l3.2 6.3-.1-3.1-3.1-3.2zM27.1 24l-.1 3.1 3.2-6.3-3.1 3.2zM17.6 21.2l-.7 4 .9 4.6.2-6-.4-2.6zM22.4 21.2l-.4 2.5.2 6.1.9-4.6-.7-4z" fill="#E27525"/>
      <path d="M23.1 25.2l-.9 4.6.6.5 4-3.2.1-3.1-3.8 1.2zM12.9 24l.1 3.1 4 3.2.6-.5-.9-4.6-3.8-1.2z" fill="#F5841F"/>
      <path d="M23.2 35.5l0-1.3-.3-.3h-5.8l-.3.3 0 1.3-4.4-2 1.5 1.3 3.1 2.2h5.9l3.1-2.2 1.5-1.3-4.3 2z" fill="#C0AC9D"/>
      <path d="M22.9 31.2l-.6-.5h-4.6l-.6.5-.4 3 .3-.3h5.8l.3.3-.2-3z" fill="#161616"/>
      <path d="M37 14.4l1.2-5.7L36.4 3.4 22.9 13.3l5.1 4.2 7.2 2.1 1.6-1.8-.7-.5 1.1-1-.8-.6 1.1-.9-.7-.4zM1.8 8.7L3 14.4l-.7.5 1.1.8-.8.6 1.1 1-.7.5 1.6 1.9 7.2-2.1 5.1-4.3L3.6 3.4 1.8 8.7z" fill="#763E1A"/>
      <path d="M35.2 19.6l-7.2-2.1 2.2 3.3-3.2 6.3 4.2-.1h6.3l-2.3-7.4zM12 17.5l-7.2 2.1-2.4 7.4h6.3l4.2.1-3.2-6.3 2.3-3.3zM22.4 21.2l.5-8 2.1-5.6h-9.9l2.1 5.6.5 8 .2 2.6v6h4.6l.1-6 .2-2.6z" fill="#F5841F"/>
    </svg>
  );
}

function PhantomIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="url(#phantom-g2)"/>
      <path d="M29.5 20.5c0 5.5-4.5 10-10 10h-9c-.6 0-1-.4-1-1v-1c0-7.7 6.3-14 14-14h5c.6 0 1 .4 1 1v5zm-13.5 4a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm5 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" fill="#fff"/>
      <defs><linearGradient id="phantom-g2" x1="0" y1="0" x2="40" y2="40"><stop stopColor="#534BB1"/><stop offset="1" stopColor="#551BF9"/></linearGradient></defs>
    </svg>
  );
}

function SuiIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#6FBCF0"/>
      <path d="M20 8c-6.6 0-12 5.4-12 12s5.4 12 12 12 12-5.4 12-12-5.4-12-12-12zm0 18c-3.3 0-6-2.7-6-6 0-2.1 1.1-4 2.8-5.1l3.2 5.6 3.2-5.6c1.7 1.1 2.8 3 2.8 5.1 0 3.3-2.7 6-6 6z" fill="#fff"/>
    </svg>
  );
}

function WalletConnectIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#3B99FC"/>
      <path d="M12.5 15.5c4.1-4 10.9-4 15 0l.5.5c.2.2.2.5 0 .7l-1.7 1.7c-.1.1-.3.1-.4 0l-.7-.7c-2.9-2.8-7.6-2.8-10.5 0l-.7.7c-.1.1-.3.1-.4 0l-1.7-1.7c-.2-.2-.2-.5 0-.7l.6-.5zm18.5 3.5l1.5 1.5c.2.2.2.5 0 .7l-6.8 6.6c-.2.2-.5.2-.7 0l-4.8-4.7c0-.1-.1-.1-.2 0l-4.8 4.7c-.2.2-.5.2-.7 0L7.5 21.2c-.2-.2-.2-.5 0-.7L9 19c.2-.2.5-.2.7 0l4.8 4.7c0 .1.1.1.2 0l4.8-4.7c.2-.2.5-.2.7 0l4.8 4.7c0 .1.1.1.2 0l4.8-4.7c.2-.2.5-.2.7 0z" fill="#fff"/>
    </svg>
  );
}

export function WalletButton() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [solanaBalance, setSolanaBalance] = useState<string | null>(null);
  const [solanaLoading, setSolanaLoading] = useState(false);

  // Mount check
  useEffect(() => {
    setMounted(true);
  }, []);

  // EVM hooks
  const { address: evmAddress, isConnected: evmConnected, connector: evmConnector } = useAccount();
  const { disconnect: evmDisconnect } = useDisconnect();
  const { data: evmBalanceData } = useBalance({ address: evmAddress });

  // Solana hooks
  const { connection } = useConnection();
  const { 
    publicKey: solanaPublicKey, 
    connected: solanaConnected, 
    disconnect: solanaDisconnect,
    wallet: selectedWallet,
    wallets: solanaWallets,
    select: solanaSelect,
    connect: solanaConnect,
  } = useSolanaWallet();

  // Sui hooks
  const suiWallets = useWallets();
  const suiAccount = useCurrentAccount();
  const { mutate: suiConnect } = useConnectWallet();
  const { mutate: suiDisconnect } = useDisconnectWallet();
  
  // Sui balance
  const { data: suiBalanceData } = useSuiClientQuery(
    'getBalance',
    { owner: suiAccount?.address || '' },
    { enabled: !!suiAccount?.address }
  );

  // Fetch Solana balance
  useEffect(() => {
    if (!mounted) return;
    
    let isMounted = true;
    
    async function fetchSolanaBalance() {
      if (!solanaConnected || !solanaPublicKey) {
        setSolanaBalance(null);
        return;
      }

      setSolanaLoading(true);
      
      try {
        const balance = await connection.getBalance(solanaPublicKey);
        if (isMounted) {
          const solBalance = balance / LAMPORTS_PER_SOL;
          setSolanaBalance(solBalance.toFixed(4));
        }
      } catch (err) {
        console.error('Failed to fetch Solana balance:', err);
        if (isMounted) {
          try {
            const response = await fetch('https://api.mainnet-beta.solana.com', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getBalance',
                params: [solanaPublicKey.toBase58()]
              })
            });
            const data = await response.json();
            if (data.result?.value !== undefined) {
              const solBalance = data.result.value / LAMPORTS_PER_SOL;
              setSolanaBalance(solBalance.toFixed(4));
            }
          } catch (fetchErr) {
            setSolanaBalance('Error');
          }
        }
      } finally {
        if (isMounted) setSolanaLoading(false);
      }
    }
    
    fetchSolanaBalance();
    const interval = setInterval(fetchSolanaBalance, 30000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [mounted, solanaConnected, solanaPublicKey, connection]);

  // Close dropdown on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Loading state during SSR
  if (!mounted) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium bg-gradient-to-r from-indigo-600 to-purple-600 text-white opacity-70"
      >
        <Wallet className="w-4 h-4" />
        <span>Connect</span>
        <ChevronDown className="w-4 h-4" />
      </button>
    );
  }

  const truncateAddress = (addr: string): string => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const copyAddress = async (address: string) => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Check if Phantom is the connected EVM wallet
  const isPhantomEvm = evmConnector?.name?.toLowerCase().includes('phantom');
  
  // Check if Phantom is the connected Solana wallet
  const isPhantomSolana = selectedWallet?.adapter.name.toLowerCase().includes('phantom');
  
  // Check if Phantom is connected for Sui
  const phantomSuiWallet = suiWallets.find(w => w.name.toLowerCase().includes('phantom'));
  const isPhantomSui = suiAccount && phantomSuiWallet?.accounts.some(a => a.address === suiAccount.address);

  const connectPhantomSolana = async () => {
    const phantom = solanaWallets.find(w => 
      w.adapter.name.toLowerCase() === 'phantom'
    );
    
    if (phantom) {
      try {
        solanaSelect(phantom.adapter.name);
        setTimeout(async () => {
          try {
            await solanaConnect();
          } catch (e) {
            console.error('Phantom connect error:', e);
          }
        }, 100);
      } catch (err) {
        console.error('Phantom select error:', err);
      }
    } else {
      window.open('https://phantom.app/', '_blank');
    }
    setIsOpen(false);
  };

  const connectPhantomSui = () => {
    const phantom = suiWallets.find(w => 
      w.name.toLowerCase().includes('phantom')
    );
    
    if (phantom) {
      suiConnect({ wallet: phantom });
    } else {
      // Fall back to Sui Wallet or open Phantom
      const suiWallet = suiWallets.find(w => w.name.toLowerCase().includes('sui'));
      if (suiWallet) {
        suiConnect({ wallet: suiWallet });
      } else {
        window.open('https://phantom.app/', '_blank');
      }
    }
    setIsOpen(false);
  };

  const connectSuiWallet = () => {
    // Prefer Sui Wallet, then Phantom, then first available
    const suiWallet = suiWallets.find(w => 
      w.name.toLowerCase().includes('sui wallet')
    );
    const phantom = suiWallets.find(w => 
      w.name.toLowerCase().includes('phantom')
    );
    
    const walletToConnect = suiWallet || phantom || suiWallets[0];
    
    if (walletToConnect) {
      suiConnect({ wallet: walletToConnect });
    } else {
      window.open('https://suiwallet.com/', '_blank');
    }
    setIsOpen(false);
  };

  const formatSuiBalance = () => {
    if (!suiBalanceData?.totalBalance) return null;
    const balance = Number(suiBalanceData.totalBalance) / 1_000_000_000;
    return `${balance.toFixed(4)} SUI`;
  };

  // Determine wallet name with Phantom multi-chain indicator
  const getWalletName = (type: string) => {
    if (type === 'EVM') {
      if (isPhantomEvm) return 'Phantom (EVM)';
      return evmConnector?.name || 'EVM Wallet';
    }
    if (type === 'Solana') {
      if (isPhantomSolana) return 'Phantom (Solana)';
      return selectedWallet?.adapter.name || 'Solana Wallet';
    }
    if (type === 'Sui') {
      if (isPhantomSui) return 'Phantom (Sui)';
      return 'Sui Wallet';
    }
    return 'Wallet';
  };

  // Get wallet icon based on type and connected wallet
  const getWalletIcon = (type: string) => {
    if (type === 'EVM') {
      if (isPhantomEvm) return <PhantomIcon size={20} />;
      return <MetaMaskIcon size={20} />;
    }
    if (type === 'Solana') {
      return <PhantomIcon size={20} />;
    }
    if (type === 'Sui') {
      if (isPhantomSui) return <PhantomIcon size={20} />;
      return <SuiIcon size={20} />;
    }
    return <Wallet size={20} />;
  };

  // Build connections list
  const connections: any[] = [];
  if (evmConnected && evmAddress) {
    connections.push({ 
      type: 'EVM', 
      address: evmAddress, 
      name: getWalletName('EVM'), 
      icon: getWalletIcon('EVM'),
      balance: evmBalanceData ? `${parseFloat(evmBalanceData.formatted).toFixed(4)} ${evmBalanceData.symbol}` : null,
      isPhantom: isPhantomEvm,
    });
  }
  if (solanaConnected && solanaPublicKey) {
    connections.push({ 
      type: 'Solana', 
      address: solanaPublicKey.toBase58(), 
      name: getWalletName('Solana'), 
      icon: getWalletIcon('Solana'),
      balance: solanaLoading ? 'Loading...' : (solanaBalance ? `${solanaBalance} SOL` : null),
      isPhantom: isPhantomSolana,
    });
  }
  if (suiAccount?.address) {
    connections.push({ 
      type: 'Sui', 
      address: suiAccount.address, 
      name: getWalletName('Sui'), 
      icon: getWalletIcon('Sui'),
      balance: formatSuiBalance(),
      isPhantom: isPhantomSui,
    });
  }

  const isAnyConnected = connections.length > 0;
  
  // Check if any Phantom connection exists
  const hasPhantomConnection = connections.some(c => c.isPhantom);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
          isAnyConnected
            ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/25'
        }`}
      >
        {isAnyConnected ? (
          <>
            <div className="flex -space-x-1">
              {connections.map((c, i) => (
                <div key={i} className="w-5 h-5 rounded-full bg-white dark:bg-gray-900 p-0.5">{c.icon}</div>
              ))}
            </div>
            <span className="hidden sm:inline">
              {connections.length === 1 ? truncateAddress(connections[0].address) : `${connections.length} Wallets`}
            </span>
            <ChevronDown className="w-4 h-4" />
          </>
        ) : (
          <>
            <Wallet className="w-4 h-4" />
            <span>Connect</span>
            <ChevronDown className="w-4 h-4" />
          </>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
            
            <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {isAnyConnected ? 'Wallets' : 'Connect Wallet'}
              </p>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Connected Wallets */}
            {connections.length > 0 && (
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 font-semibold uppercase tracking-wide">Connected</p>
                <div className="space-y-2">
                  {connections.map((conn, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8">{conn.icon}</div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{conn.name}</p>
                            {conn.isPhantom && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded">
                                Phantom
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{truncateAddress(conn.address)}</p>
                          {conn.balance && (
                            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">{conn.balance}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => copyAddress(conn.address)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
                          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
                        </button>
                        <button
                          onClick={() => {
                            if (conn.type === 'EVM') evmDisconnect();
                            else if (conn.type === 'Solana') solanaDisconnect();
                            else if (conn.type === 'Sui') suiDisconnect();
                          }}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        >
                          <LogOut className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Connect Options */}
            <div className="p-4">
              {((!evmConnected) || (!solanaConnected) || (!suiAccount)) && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 font-semibold uppercase tracking-wide">
                  {isAnyConnected ? 'Connect More' : 'Select Wallet'}
                </p>
              )}
              
              <div className="space-y-2">
                {/* EVM Wallets */}
                {!evmConnected && (
                  <ConnectButton.Custom>
                    {({ openConnectModal }) => (
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          openConnectModal();
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex -space-x-2">
                          <MetaMaskIcon size={32} />
                          <PhantomIcon size={32} />
                          <WalletConnectIcon size={32} />
                        </div>
                        <div className="text-left flex-1">
                          <p className="font-semibold text-gray-900 dark:text-white">EVM Wallets</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">MetaMask, Phantom, WalletConnect</p>
                        </div>
                        <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">EVM</span>
                      </button>
                    )}
                  </ConnectButton.Custom>
                )}

                {/* Solana - Phantom */}
                {!solanaConnected && (
                  <button
                    onClick={connectPhantomSolana}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <PhantomIcon size={36} />
                    <div className="text-left flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white">Phantom</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Solana, Ethereum, Sui</p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">SOL</span>
                  </button>
                )}

                {/* Sui Wallets */}
                {!suiAccount && (
                  <>
                    {/* Show Phantom for Sui if available */}
                    {suiWallets.find(w => w.name.toLowerCase().includes('phantom')) && (
                      <button
                        onClick={connectPhantomSui}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <PhantomIcon size={36} />
                        <div className="text-left flex-1">
                          <p className="font-semibold text-gray-900 dark:text-white">Phantom (Sui)</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Connect Sui via Phantom</p>
                        </div>
                        <span className="text-xs px-2 py-1 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-full">SUI</span>
                      </button>
                    )}
                    
                    {/* Sui Wallet option */}
                    <button
                      onClick={connectSuiWallet}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <SuiIcon size={36} />
                      <div className="text-left flex-1">
                        <p className="font-semibold text-gray-900 dark:text-white">Sui Wallet</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Official Sui Wallet</p>
                      </div>
                      <span className="text-xs px-2 py-1 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-full">SUI</span>
                    </button>
                  </>
                )}

                {/* All connected message */}
                {evmConnected && solanaConnected && suiAccount && (
                  <div className="text-center py-3">
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                      ✓ All wallets connected!
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      You can pay on any supported chain
                    </p>
                  </div>
                )}
              </div>

              {/* Multi-chain info */}
              {!isAnyConnected && (
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Tip:</span> Phantom supports Ethereum, Solana, and Sui. Connect once to use across multiple chains!
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
