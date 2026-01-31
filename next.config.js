/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: process.cwd(),
  reactStrictMode: true,
  transpilePackages: ['@omniswap/types', '@omniswap/core'],
}

module.exports = nextConfig