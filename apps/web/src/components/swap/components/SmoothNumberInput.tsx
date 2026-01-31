// apps/web/src/components/swap/components/SmoothNumberInput.tsx
'use client';

import { useState, useEffect, useRef } from 'react';

interface SmoothNumberInputProps {
  value: string;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

export function SmoothNumberInput({
  value,
  isLoading = false,
  placeholder = '0.0',
  className = '',
}: SmoothNumberInputProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [opacity, setOpacity] = useState(1);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // If value is empty or loading, show placeholder smoothly
    if (!value || isLoading) {
      setOpacity(0.5);
      timeoutRef.current = setTimeout(() => {
        setDisplayValue('');
        setOpacity(1);
      }, 150);
      return;
    }

    // Fade out, update, fade in
    setOpacity(0.7);
    timeoutRef.current = setTimeout(() => {
      setDisplayValue(value);
      setOpacity(1);
    }, 100);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, isLoading]);

  return (
    <div
      className={`transition-opacity duration-200 ${className}`}
      style={{ opacity }}
    >
      {isLoading && !displayValue ? (
        <div className="flex items-center gap-2">
          <div className="h-7 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      ) : (
        <input
          type="text"
          value={displayValue || ''}
          readOnly
          placeholder={placeholder}
          className="w-full bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      )}
    </div>
  );
}
