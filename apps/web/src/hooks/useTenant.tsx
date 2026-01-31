'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface TenantConfig {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  feeBps: number;
}

interface TenantContextType {
  tenant: TenantConfig | null;
  isLoading: boolean;
  error: Error | null;
}

const defaultTenant: TenantConfig = {
  id: 'default',
  name: 'OmniSwap',
  slug: 'omniswap',
  primaryColor: '#6366f1',
  secondaryColor: '#8b5cf6',
  feeBps: 40,
};

const TenantContext = createContext<TenantContextType>({
  tenant: defaultTenant,
  isLoading: false,
  error: null,
});

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<TenantConfig | null>(defaultTenant);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadTenant = async () => {
      try {
        setIsLoading(true);
        setTenant(defaultTenant);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTenant();
  }, []);

  return (
    <TenantContext.Provider value={{ tenant, isLoading, error }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}