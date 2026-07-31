const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, '../..'),

  // Make env vars available (only reference Vercel-injected vars)
  env: {
    NEXT_PUBLIC_PAYMENT_WALLET_EVM: process.env.NEXT_PUBLIC_PAYMENT_WALLET_EVM,
    NEXT_PUBLIC_PAYMENT_WALLET_SOLANA: process.env.NEXT_PUBLIC_PAYMENT_WALLET_SOLANA,
    NEXT_PUBLIC_PAYMENT_WALLET_SUI: process.env.NEXT_PUBLIC_PAYMENT_WALLET_SUI,
  },

  webpack: (config, { isServer, webpack }) => {
    // Optional x402 payment feature of @coinbase/cdp-sdk (pulled in transitively
    // via RainbowKit/wagmi's Coinbase connector) whose @x402/* submodules aren't
    // installed as dependencies and aren't used by this app.
    config.plugins.push(
      new webpack.IgnorePlugin({ resourceRegExp: /^@x402\// })
    );

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
