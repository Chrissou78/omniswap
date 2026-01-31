// packages/core/src/services/portfolio.service.ts
import { prisma } from '../lib/prisma';
import { redis } from '../utils/redis';
import { PriceService } from './price.service';
import { ethers } from 'ethers';

export interface PortfolioSummary {
  totalValueUsd: number;
  totalPnlUsd: number;
  totalPnlPercent: number;
  holdings: PortfolioHolding[];
  allocation: AllocationItem[];
  performance: PerformanceData;
}

export interface PortfolioHolding {
  chainId: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  balance: string;
  balanceUsd: number;
  price: number;
  priceChange24h: number;
  avgCostBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  allocation: number;
  logoURI?: string;
}

export interface AllocationItem {
  symbol: string;
  value: number;
  percent: number;
  color: string;
}

export interface PerformanceData {
  day: { value: number; change: number; changePercent: number };
  week: { value: number; change: number; changePercent: number };
  month: { value: number; change: number; changePercent: number };
  year: { value: number; change: number; changePercent: number };
  all: { value: number; change: number; changePercent: number };
}

export class PortfolioService {
  private priceService: PriceService;
  private rpcProviders: Map<string, ethers.JsonRpcProvider>;

  constructor(priceService: PriceService) {
    this.priceService = priceService;
    this.rpcProviders = new Map();
  }

  /**
   * Get or create portfolio for user
   */
  async getOrCreatePortfolio(userId: string): Promise<any> {
    let portfolio = await prisma.portfolio.findUnique({
      where: { userId },
      include: {
        holdings: {
          where: { isHidden: false },
          orderBy: { balanceUsd: 'desc' },
        },
      },
    });

    if (!portfolio) {
      portfolio = await prisma.portfolio.create({
        data: { userId },
        include: { holdings: true },
      });
    }

    return portfolio;
  }

  /**
   * Get full portfolio summary
   */
  async getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
    const portfolio = await this.getOrCreatePortfolio(userId);
    
    // Get user addresses
    const userAddresses = await prisma.userAddress.findMany({
      where: { userId },
    });

    // Refresh balances
    await this.refreshBalances(userId, userAddresses);

    // Get updated holdings
    const holdings = await prisma.portfolioHolding.findMany({
      where: { portfolioId: portfolio.id, isHidden: false },
      orderBy: { balanceUsd: 'desc' },
    });

    // Enrich with prices and token data
    const enrichedHoldings = await this.enrichHoldings(holdings);

    // Calculate totals
    const totalValueUsd = enrichedHoldings.reduce((sum, h) => sum + h.balanceUsd, 0);
    const totalPnlUsd = enrichedHoldings.reduce((sum, h) => sum + h.unrealizedPnl, 0);
    const totalCost = enrichedHoldings.reduce((sum, h) => sum + (h.avgCostBasis * parseFloat(h.balance)), 0);
    const totalPnlPercent = totalCost > 0 ? (totalPnlUsd / totalCost) * 100 : 0;

    // Calculate allocation
    const allocation = this.calculateAllocation(enrichedHoldings, totalValueUsd);

    // Get performance data
    const performance = await this.getPerformance(portfolio.id);

    // Update portfolio totals
    await prisma.portfolio.update({
      where: { id: portfolio.id },
      data: {
        totalValueUsd,
        totalPnlUsd,
        totalPnlPercent,
        lastUpdatedAt: new Date(),
      },
    });

    return {
      totalValueUsd,
      totalPnlUsd,
      totalPnlPercent,
      holdings: enrichedHoldings,
      allocation,
      performance,
    };
  }

  /**
   * Refresh balances from on-chain
   */
  async refreshBalances(userId: string, addresses: any[]): Promise<void> {
    const portfolio = await this.getOrCreatePortfolio(userId);

    for (const addr of addresses) {
      if (addr.chainType === 'EVM') {
        await this.refreshEVMBalances(portfolio.id, addr.address);
      } else if (addr.chainType === 'SOLANA') {
        await this.refreshSolanaBalances(portfolio.id, addr.address);
      } else if (addr.chainType === 'SUI') {
        await this.refreshSuiBalances(portfolio.id, addr.address);
      }
    }
  }

  /**
   * Refresh EVM chain balances
   */
  private async refreshEVMBalances(portfolioId: string, address: string): Promise<void> {
    const chains = ['1', '56', '137', '42161', '10', '8453'];

    for (const chainId of chains) {
      try {
        const provider = this.getProvider(chainId);
        
        // Get native balance
        const nativeBalance = await provider.getBalance(address);
        const nativeToken = this.getNativeToken(chainId);
        
        await this.updateHolding(portfolioId, {
          chainId,
          tokenAddress: nativeToken.address,
          tokenSymbol: nativeToken.symbol,
          tokenName: nativeToken.name,
          balance: ethers.formatEther(nativeBalance),
        });

        // Get tracked token balances
        const trackedTokens = await prisma.portfolioHolding.findMany({
          where: {
            portfolioId,
            chainId,
            isTracked: true,
            tokenAddress: { not: nativeToken.address },
          },
        });

        for (const token of trackedTokens) {
          const balance = await this.getERC20Balance(
            provider,
            token.tokenAddress,
            address
          );
          
          await this.updateHolding(portfolioId, {
            chainId,
            tokenAddress: token.tokenAddress,
            tokenSymbol: token.tokenSymbol,
            tokenName: token.tokenName,
            balance,
          });
        }
      } catch (error) {
        console.error(`Error refreshing balances for chain ${chainId}:`, error);
      }
    }
  }

  /**
   * Refresh Solana balances
   */
  private async refreshSolanaBalances(portfolioId: string, address: string): Promise<void> {
    // Implementation for Solana balance fetching
    // Would use @solana/web3.js
  }

  /**
   * Refresh Sui balances
   */
  private async refreshSuiBalances(portfolioId: string, address: string): Promise<void> {
    // Implementation for Sui balance fetching
    // Would use @mysten/sui.js
  }

  /**
   * Update or create holding
   */
  private async updateHolding(
    portfolioId: string,
    data: {
      chainId: string;
      tokenAddress: string;
      tokenSymbol: string;
      tokenName: string;
      balance: string;
    }
  ): Promise<void> {
    const balanceNum = parseFloat(data.balance);
    
    // Get price
    const price = await this.priceService.getTokenPriceUsd(
      data.chainId,
      data.tokenAddress
    );

    const balanceUsd = balanceNum * (price || 0);

    await prisma.portfolioHolding.upsert({
      where: {
        portfolioId_chainId_tokenAddress: {
          portfolioId,
          chainId: data.chainId,
          tokenAddress: data.tokenAddress.toLowerCase(),
        },
      },
      update: {
        balance: data.balance,
        balanceUsd,
        lastUpdatedAt: new Date(),
      },
      create: {
        portfolioId,
        chainId: data.chainId,
        tokenAddress: data.tokenAddress.toLowerCase(),
        tokenSymbol: data.tokenSymbol,
        tokenName: data.tokenName,
        balance: data.balance,
        balanceUsd,
      },
    });
  }

  /**
   * Update cost basis from swap
   */
  async updateCostBasisFromSwap(
    userId: string,
    swap: {
      toChainId: string;
      toTokenAddress: string;
      toTokenSymbol: string;
      toTokenName: string;
      outputAmount: string;
      volumeUsd: number;
    }
  ): Promise<void> {
    const portfolio = await this.getOrCreatePortfolio(userId);

    const holding = await prisma.portfolioHolding.findUnique({
      where: {
        portfolioId_chainId_tokenAddress: {
          portfolioId: portfolio.id,
          chainId: swap.toChainId,
          tokenAddress: swap.toTokenAddress.toLowerCase(),
        },
      },
    });

    const outputAmount = parseFloat(swap.outputAmount);
    const costPerUnit = swap.volumeUsd / outputAmount;

    if (holding) {
      // Calculate new weighted average cost basis
      const existingBalance = parseFloat(holding.balance);
      const existingCost = holding.totalCost;
      
      const newTotalCost = existingCost + swap.volumeUsd;
      const newTotalBalance = existingBalance + outputAmount;
      const newAvgCost = newTotalCost / newTotalBalance;

      await prisma.portfolioHolding.update({
        where: { id: holding.id },
        data: {
          avgCostBasis: newAvgCost,
          totalCost: newTotalCost,
        },
      });
    } else {
      // Create new holding with cost basis
      await prisma.portfolioHolding.create({
        data: {
          portfolioId: portfolio.id,
          chainId: swap.toChainId,
          tokenAddress: swap.toTokenAddress.toLowerCase(),
          tokenSymbol: swap.toTokenSymbol,
          tokenName: swap.toTokenName,
          balance: swap.outputAmount,
          balanceUsd: swap.volumeUsd,
          avgCostBasis: costPerUnit,
          totalCost: swap.volumeUsd,
        },
      });
    }
  }

  /**
   * Enrich holdings with current prices and P&L
   */
  private async enrichHoldings(holdings: any[]): Promise<PortfolioHolding[]> {
    const enriched: PortfolioHolding[] = [];

    for (const holding of holdings) {
      // Get current price
      const price = await this.priceService.getTokenPriceUsd(
        holding.chainId,
        holding.tokenAddress
      ) || 0;

      // Get 24h change
      const priceChange24h = await this.priceService.get24hPriceChange(
        holding.chainId,
        holding.tokenAddress
      ) || 0;

      // Get token metadata
      const token = await prisma.token.findFirst({
        where: {
          chainId: holding.chainId,
          address: holding.tokenAddress,
        },
      });

      const balance = parseFloat(holding.balance);
      const balanceUsd = balance * price;
      const costBasis = holding.avgCostBasis || 0;
      const totalCost = costBasis * balance;
      const unrealizedPnl = balanceUsd - totalCost;
      const unrealizedPnlPercent = totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0;

      enriched.push({
        chainId: holding.chainId,
        tokenAddress: holding.tokenAddress,
        tokenSymbol: holding.tokenSymbol,
        tokenName: holding.tokenName,
        balance: holding.balance,
        balanceUsd,
        price,
        priceChange24h,
        avgCostBasis: costBasis,
        unrealizedPnl,
        unrealizedPnlPercent,
        allocation: 0, // Calculated later
        logoURI: token?.logoURI,
      });
    }

    return enriched;
  }

  /**
   * Calculate allocation breakdown
   */
  private calculateAllocation(holdings: PortfolioHolding[], totalValue: number): AllocationItem[] {
    const colors = [
      '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
      '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
    ];

    return holdings
      .filter((h) => h.balanceUsd > 0)
      .slice(0, 10) // Top 10
      .map((h, index) => ({
        symbol: h.tokenSymbol,
        value: h.balanceUsd,
        percent: totalValue > 0 ? (h.balanceUsd / totalValue) * 100 : 0,
        color: colors[index % colors.length],
      }));
  }

  /**
   * Get performance data
   */
  private async getPerformance(portfolioId: string): Promise<PerformanceData> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const [currentSnapshot, daySnapshot, weekSnapshot, monthSnapshot, yearSnapshot, firstSnapshot] = 
      await Promise.all([
        prisma.portfolioSnapshot.findFirst({
          where: { portfolioId },
          orderBy: { timestamp: 'desc' },
        }),
        prisma.portfolioSnapshot.findFirst({
          where: { portfolioId, timestamp: { lte: dayAgo } },
          orderBy: { timestamp: 'desc' },
        }),
        prisma.portfolioSnapshot.findFirst({
          where: { portfolioId, timestamp: { lte: weekAgo } },
          orderBy: { timestamp: 'desc' },
        }),
        prisma.portfolioSnapshot.findFirst({
          where: { portfolioId, timestamp: { lte: monthAgo } },
          orderBy: { timestamp: 'desc' },
        }),
        prisma.portfolioSnapshot.findFirst({
          where: { portfolioId, timestamp: { lte: yearAgo } },
          orderBy: { timestamp: 'desc' },
        }),
        prisma.portfolioSnapshot.findFirst({
          where: { portfolioId },
          orderBy: { timestamp: 'asc' },
        }),
      ]);

    const currentValue = currentSnapshot?.totalValueUsd || 0;

    const calcChange = (oldValue: number | undefined) => {
      const old = oldValue || currentValue;
      const change = currentValue - old;
      const changePercent = old > 0 ? (change / old) * 100 : 0;
      return { value: currentValue, change, changePercent };
    };

    return {
      day: calcChange(daySnapshot?.totalValueUsd),
      week: calcChange(weekSnapshot?.totalValueUsd),
      month: calcChange(monthSnapshot?.totalValueUsd),
      year: calcChange(yearSnapshot?.totalValueUsd),
      all: calcChange(firstSnapshot?.totalValueUsd),
    };
  }

  /**
   * Create portfolio snapshot
   */
  async createSnapshot(portfolioId: string): Promise<void> {
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: { holdings: { where: { isHidden: false } } },
    });

    if (!portfolio) return;

    const holdingsData = portfolio.holdings.map((h) => ({
      chainId: h.chainId,
      tokenAddress: h.tokenAddress,
      balance: h.balance,
      valueUsd: h.balanceUsd,
    }));

    await prisma.portfolioSnapshot.create({
      data: {
        portfolioId,
        totalValueUsd: portfolio.totalValueUsd,
        totalPnlUsd: portfolio.totalPnlUsd,
        holdings: holdingsData,
      },
    });
  }

  /**
   * Get historical portfolio values
   */
  async getHistoricalValues(
    portfolioId: string,
    days: number = 30
  ): Promise<{ date: string; value: number }[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const snapshots = await prisma.portfolioSnapshot.findMany({
      where: {
        portfolioId,
        timestamp: { gte: startDate },
      },
      orderBy: { timestamp: 'asc' },
      select: {
        timestamp: true,
        totalValueUsd: true,
      },
    });

    return snapshots.map((s) => ({
      date: s.timestamp.toISOString(),
      value: s.totalValueUsd,
    }));
  }

  // Helper methods
  private getProvider(chainId: string): ethers.JsonRpcProvider {
    if (!this.rpcProviders.has(chainId)) {
      const rpcUrl = this.getRpcUrl(chainId);
      this.rpcProviders.set(chainId, new ethers.JsonRpcProvider(rpcUrl));
    }
    return this.rpcProviders.get(chainId)!;
  }

  private getRpcUrl(chainId: string): string {
    const rpcs: Record<string, string> = {
      '1': process.env.ETH_RPC_URL || 'https://eth.llamarpc.com',
      '56': process.env.BSC_RPC_URL || 'https://bsc.llamarpc.com',
      '137': process.env.POLYGON_RPC_URL || 'https://polygon.llamarpc.com',
      '42161': process.env.ARBITRUM_RPC_URL || 'https://arbitrum.llamarpc.com',
      '10': process.env.OPTIMISM_RPC_URL || 'https://optimism.llamarpc.com',
      '8453': process.env.BASE_RPC_URL || 'https://base.llamarpc.com',
    };
    return rpcs[chainId] || rpcs['1'];
  }

  private getNativeToken(chainId: string): { address: string; symbol: string; name: string } {
    const tokens: Record<string, { address: string; symbol: string; name: string }> = {
      '1': { address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', symbol: 'ETH', name: 'Ethereum' },
      '56': { address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', symbol: 'BNB', name: 'BNB' },
      '137': { address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', symbol: 'MATIC', name: 'Polygon' },
      '42161': { address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', symbol: 'ETH', name: 'Ethereum' },
      '10': { address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', symbol: 'ETH', name: 'Ethereum' },
      '8453': { address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', symbol: 'ETH', name: 'Ethereum' },
    };
    return tokens[chainId] || tokens['1'];
  }

  private async getERC20Balance(
    provider: ethers.JsonRpcProvider,
    tokenAddress: string,
    walletAddress: string
  ): Promise<string> {
    const contract = new ethers.Contract(
      tokenAddress,
      ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
      provider
    );

    const [balance, decimals] = await Promise.all([
      contract.balanceOf(walletAddress),
      contract.decimals(),
    ]);

    return ethers.formatUnits(balance, decimals);
  }
}
