'use client';

import { AdDisplay } from '@/components/ads/AdDisplay';

interface AdBannerProps {
  position: 'left' | 'right' | 'top' | 'bottom';
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

// Map position/size to slot configuration
const slotConfig: Record<string, { slotId: string; dimensions: { width: number; height: number } }> = {
  'left-medium': { slotId: 'sidebar-top', dimensions: { width: 300, height: 250 } },
  'left-small': { slotId: 'sidebar-top', dimensions: { width: 300, height: 100 } },
  'right-medium': { slotId: 'sidebar-top', dimensions: { width: 300, height: 250 } },
  'right-small': { slotId: 'sidebar-top', dimensions: { width: 300, height: 100 } },
  'top-medium': { slotId: 'header-banner', dimensions: { width: 728, height: 90 } },
  'top-large': { slotId: 'header-banner', dimensions: { width: 728, height: 90 } },
  'bottom-medium': { slotId: 'footer-banner', dimensions: { width: 728, height: 90 } },
  'bottom-large': { slotId: 'footer-banner', dimensions: { width: 728, height: 90 } },
};

export function AdBanner({ position, size = 'medium', className = '' }: AdBannerProps) {
  const configKey = `${position}-${size}`;
  const config = slotConfig[configKey] || slotConfig['left-medium'];
  
  const adPosition = position === 'left' || position === 'right' ? 'sidebar' : 
                     position === 'top' ? 'header' : 'footer';

  return (
    <AdDisplay
      slotId={config.slotId}
      position={adPosition}
      dimensions={config.dimensions}
      fallbackSize={size}
      className={className}
    />
  );
}
