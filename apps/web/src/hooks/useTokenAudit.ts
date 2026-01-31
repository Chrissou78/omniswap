// apps/web/src/hooks/useTokenAudit.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { TokenAuditResult, AuditSummary } from '@omniswap/core';

interface UseTokenAuditOptions {
  enabled?: boolean;
  refetchOnMount?: boolean;
}

export const useTokenAudit = (
  tokenAddress: string | null,
  chainId: number | string | null,
  options: UseTokenAuditOptions = {}
) => {
  const { enabled = true, refetchOnMount = false } = options;

  const {
    data: audit,
    isLoading,
    error,
    refetch,
  } = useQuery<TokenAuditResult | null>({
    queryKey: ['tokenAudit', chainId, tokenAddress],
    queryFn: async () => {
      if (!tokenAddress || !chainId) return null;
      
      const response = await api.get<TokenAuditResult>(
        `/api/v1/tokens/${chainId}/${tokenAddress}/audit`
      );
      return response.data;
    },
    enabled: enabled && !!tokenAddress && !!chainId,
    staleTime: 1000 * 60 * 30, // 30 minutes
    refetchOnMount,
  });

  // Lightweight summary for badges
  const auditSummary: AuditSummary | null = audit
    ? {
        riskLevel: audit.riskLevel,
        riskScore: audit.riskScore,
        isHoneypot: audit.isHoneypot,
        hasHighTax: audit.buyTax > 10 || audit.sellTax > 10,
        isTrusted: audit.isTrusted,
        criticalRisks: audit.risks.filter((r) => r.severity === 'critical').length,
        highRisks: audit.risks.filter((r) => r.severity === 'high').length,
        mediumRisks: audit.risks.filter((r) => r.severity === 'medium').length,
      }
    : null;

  return {
    audit,
    auditSummary,
    isLoading,
    error,
    refetch,
  };
};

// Hook for batch auditing multiple tokens
export const useBatchTokenAudit = (
  tokens: Array<{ address: string; chainId: number | string }>,
  options: UseTokenAuditOptions = {}
) => {
  const { enabled = true } = options;

  const { data, isLoading, error } = useQuery({
    queryKey: ['batchTokenAudit', tokens.map((t) => `${t.chainId}-${t.address}`).join(',')],
    queryFn: async () => {
      if (tokens.length === 0) return new Map();

      // Group by chainId
      const byChain = new Map<number | string, string[]>();
      for (const token of tokens) {
        const existing = byChain.get(token.chainId) || [];
        existing.push(token.address);
        byChain.set(token.chainId, existing);
      }

      const results = new Map<string, AuditSummary>();

      // Fetch for each chain
      for (const [chainId, addresses] of byChain) {
        const response = await api.post<Record<string, AuditSummary>>(
          `/api/v1/tokens/${chainId}/audit/batch`,
          { addresses }
        );
        
        for (const [address, summary] of Object.entries(response.data)) {
          results.set(`${chainId}-${address.toLowerCase()}`, summary);
        }
      }

      return results;
    },
    enabled: enabled && tokens.length > 0,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  const getAuditSummary = useCallback(
    (address: string, chainId: number | string): AuditSummary | null => {
      if (!data) return null;
      return data.get(`${chainId}-${address.toLowerCase()}`) || null;
    },
    [data]
  );

  return {
    audits: data || new Map(),
    getAuditSummary,
    isLoading,
    error,
  };
};
