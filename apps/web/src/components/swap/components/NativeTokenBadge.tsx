'use client';

interface NativeTokenBadgeProps {
  symbol: string;
  onClick?: () => void;
}

export function NativeTokenBadge({ symbol, onClick }: NativeTokenBadgeProps) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-0.5 text-xs font-medium rounded border bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30 transition-colors flex items-center gap-1"
    >
      <span>🛡️</span>
      <span>Native</span>
    </button>
  );
}
