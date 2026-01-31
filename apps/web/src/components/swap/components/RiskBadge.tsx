'use client';

interface RiskBadgeProps {
  level: 'low' | 'medium' | 'high' | 'critical';
  onClick?: () => void;
}

export function RiskBadge({ level, onClick }: RiskBadgeProps) {
  const colors = {
    low: 'bg-green-500/20 text-green-400 border-green-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const icons = {
    low: '✓',
    medium: '⚠',
    high: '⚠',
    critical: '✕',
  };

  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 text-xs font-medium rounded border ${colors[level]} hover:opacity-80 transition-opacity flex items-center gap-1`}
    >
      <span>{icons[level]}</span>
      <span className="capitalize">{level}</span>
    </button>
  );
}
