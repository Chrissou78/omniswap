// packages/shared/src/hooks/useConfig.ts
import { useState, useEffect, useCallback } from 'react';
import { ConfigService } from '../configService';

interface UseConfigOptions {
  configService: ConfigService;
  checkInterval?: number;
}

interface UseConfigResult {
  hasUpdates: boolean;
  isChecking: boolean;
  lastChecked: Date | null;
  checkForUpdates: () => Promise<boolean>;
  clearCache: () => void;
}

export function useConfig(options: UseConfigOptions): UseConfigResult {
  const { configService, checkInterval = 5 * 60 * 1000 } = options;

  const [hasUpdates, setHasUpdates] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkForUpdates = useCallback(async (): Promise<boolean> => {
    setIsChecking(true);
    try {
      const updates = await configService.checkForUpdates();
      setHasUpdates(updates);
      setLastChecked(new Date());
      return updates;
    } catch (e) {
      console.error('Error checking for updates:', e);
      return false;
    } finally {
      setIsChecking(false);
    }
  }, [configService]);

  const clearCache = useCallback(() => {
    configService.clearCache();
    setHasUpdates(false);
  }, [configService]);

  useEffect(() => {
    checkForUpdates();

    const interval = setInterval(checkForUpdates, checkInterval);
    return () => clearInterval(interval);
  }, [checkForUpdates, checkInterval]);

  return {
    hasUpdates,
    isChecking,
    lastChecked,
    checkForUpdates,
    clearCache,
  };
}
