const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Make env vars available
  env: {
    NEXT_PUBLIC_PAYMENT_WALLET_EVM: process.env.NEXT_PUBLIC_PAYMENT_WALLET_EVM,
    NEXT_PUBLIC_PAYMENT_WALLET_SOLANA: process.env.NEXT_PUBLIC_PAYMENT_WALLET_SOLANA,
    NEXT_PUBLIC_PAYMENT_WALLET_SUI: process.env.NEXT_PUBLIC_PAYMENT_WALLET_SUI,
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        'lokijs',
        'pino-pretty',
        'encoding',
      ];
    }

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
        'pino-pretty': false,
      };
    }

    config.ignoreWarnings = [
      { module: /node_modules\/punycode/ },
      { module: /node_modules\/pino/ },
      { module: /node_modules\/@walletconnect/ },
    ];

    return config;
  },

  transpilePackages: [
    '@walletconnect/core',
    '@walletconnect/sign-client',
    '@walletconnect/universal-provider',
    '@walletconnect/ethereum-provider',
  ],

  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

module.exports = nextConfig;
