// apps/web/src/components/swap/components/SmoothValue.tsx
'use client';

import { useState, useEffect, useRef } from 'react';

interface SmoothValueProps {
  value: number | null | undefined;
  format?: (value: number) => string;
  className?: string;
  prefix?: string;
  suffix?: string;
  duration?: number;
}

export function SmoothValue({
  value,
  format = (v) => v.toFixed(2),
  className = '',
  prefix = '',
  suffix = '',
  duration = 300,
}: SmoothValueProps) {
  const [displayValue, setDisplayValue] = useState<string>('');
  const [isAnimating, setIsAnimating] = useState(false);
  const prevValue = useRef<number | null>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (value === null || value === undefined || value <= 0) {
      setDisplayValue('');
      prevValue.current = null;
      return;
    }

    // If no previous value, set immediately
    if (prevValue.current === null) {
      setDisplayValue(format(value));
      prevValue.current = value;
      return;
    }

    // Animate from previous to new value
    const startValue = prevValue.current;
    const endValue = value;
    const startTime = performance.now();

    setIsAnimating(true);

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      const currentValue = startValue + (endValue - startValue) * easeProgress;
      setDisplayValue(format(currentValue));

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
        prevValue.current = endValue;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, format, duration]);

  if (!displayValue) {
    return null;
  }

  return (
    <div
      className={`transition-opacity duration-200 ${isAnimating ? 'opacity-80' : 'opacity-100'} ${className}`}
    >
      {prefix}
      {displayValue}
      {suffix}
    </div>
  );
}
