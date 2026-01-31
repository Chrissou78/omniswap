// apps/admin/src/components/layout/Sidebar.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import {
  LayoutDashboard,
  Building2,
  Coins,
  BarChart3,
  ArrowLeftRight,
  Settings,
  Key,
  ChevronLeft,
  ChevronRight,
  Users,
  Globe,
  Shield,
  FileText,
  HelpCircle,
  LogOut,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  children?: NavItem[];
}

const navigation: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: 'Tenants',
    href: '/admin/tenants',
    icon: <Building2 className="w-5 h-5" />,
    badge: 'White-label',
  },
  {
    label: 'Tokens',
    href: '/admin/tokens',
    icon: <Coins className="w-5 h-5" />,
  },
  {
    label: 'Analytics',
    href: '/admin/analytics',
    icon: <BarChart3 className="w-5 h-5" />,
    children: [
      { label: 'Overview', href: '/admin/analytics', icon: null },
      { label: 'Revenue', href: '/admin/analytics/revenue', icon: null },
      { label: 'Volume', href: '/admin/analytics/volume', icon: null },
      { label: 'Users', href: '/admin/analytics/users', icon: null },
    ],
  },
  {
    label: 'Swaps',
    href: '/admin/swaps',
    icon: <ArrowLeftRight className="w-5 h-5" />,
  },
  {
    label: 'Chains',
    href: '/admin/chains',
    icon: <Globe className="w-5 h-5" />,
  },
  {
    label: 'API Keys',
    href: '/admin/api-keys',
    icon: <Key className="w-5 h-5" />,
  },
  {
    label: 'Security',
    href: '/admin/security',
    icon: <Shield className="w-5 h-5" />,
  },
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: <Settings className="w-5 h-5" />,
  },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpanded = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    );
  };

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-card border-r transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b">
        {!collapsed && (
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold">O</span>
            </div>
            <span className="font-bold text-lg">OmniSwap</span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(collapsed && 'mx-auto')}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {navigation.map((item) => (
            <li key={item.label}>
              {item.children ? (
                // Parent with children
                <div>
                  <button
                    onClick={() => toggleExpanded(item.label)}
                    className={cn(
                      'flex items-center w-full gap-3 px-3 py-2 rounded-lg transition-colors',
                      'hover:bg-muted',
                      isActive(item.href) && 'bg-primary/10 text-primary'
                    )}
                  >
                    {item.icon}
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        <ChevronRight
                          className={cn(
                            'w-4 h-4 transition-transform',
                            expandedItems.includes(item.label) && 'rotate-90'
                          )}
                        />
                      </>
                    )}
                  </button>
                  
                  {!collapsed && expandedItems.includes(item.label) && (
                    <ul className="ml-8 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className={cn(
                              'block px-3 py-2 rounded-lg text-sm transition-colors',
                              'hover:bg-muted',
                              pathname === child.href && 'bg-primary/10 text-primary'
                            )}
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                // Single item
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                    'hover:bg-muted',
                    isActive(item.href) && 'bg-primary/10 text-primary'
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  {item.icon}
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        {!collapsed && (
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">Admin User</div>
              <div className="text-xs text-muted-foreground truncate">
                admin@omniswap.io
              </div>
            </div>
          </div>
        )}
        
        <div className={cn('flex gap-2', collapsed && 'flex-col')}>
          <Button variant="ghost" size="sm" className="flex-1" title="Help">
            <HelpCircle className="w-4 h-4" />
            {!collapsed && <span className="ml-2">Help</span>}
          </Button>
          <Button variant="ghost" size="sm" className="flex-1" title="Logout">
            <LogOut className="w-4 h-4" />
            {!collapsed && <span className="ml-2">Logout</span>}
          </Button>
        </div>
      </div>
    </aside>
  );
};
