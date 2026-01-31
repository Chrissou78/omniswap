'use client';

import Link from 'next/link';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import { Moon, Sun, Menu, Megaphone, Coins, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WalletButton } from '@/components/wallet/WalletButton';
import { useState } from 'react';

export function Header() {
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <motion.div
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.5 }}
            className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center"
          >
            <span className="text-white font-bold text-sm">O</span>
          </motion.div>
          <span className="font-bold text-xl hidden sm:block">OmniSwap</span>
        </Link>

        {/* Navigation - Hidden on lg and below (was md) */}
        <nav className="hidden xl:flex items-center gap-6">
          <NavLink href="/">Swap</NavLink>
          <NavLink href="/history">History</NavLink>
          <NavLink href="/portfolio">Portfolio</NavLink>
          
          {/* Separator */}
          <div className="h-4 w-px bg-border" />
          
          {/* Services */}
          <NavLink href="/ads/order" icon={<Megaphone className="h-4 w-4" />}>
            Advertise
          </NavLink>
          <NavLink href="/listing" icon={<Coins className="h-4 w-4" />}>
            List Token
          </NavLink>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="h-9 w-9"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          {/* Wallet Button */}
          <WalletButton />

          {/* Mobile Menu Button - Shows on xl and below (was md) */}
          <Button
            variant="ghost"
            size="icon"
            className="xl:hidden h-9 w-9"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation - Shows on xl and below */}
      {mobileMenuOpen && (
        <motion.nav
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="xl:hidden border-t bg-background/95 backdrop-blur-xl p-4 space-y-1"
        >
          <MobileNavLink href="/" onClick={() => setMobileMenuOpen(false)}>
            Swap
          </MobileNavLink>
          <MobileNavLink href="/history" onClick={() => setMobileMenuOpen(false)}>
            History
          </MobileNavLink>
          <MobileNavLink href="/portfolio" onClick={() => setMobileMenuOpen(false)}>
            Portfolio
          </MobileNavLink>
          
          <div className="h-px bg-border my-3" />
          
          <MobileNavLink href="/ads/order" onClick={() => setMobileMenuOpen(false)}>
            <Megaphone className="h-4 w-4 inline mr-2" />
            Advertise
          </MobileNavLink>
          <MobileNavLink href="/listing" onClick={() => setMobileMenuOpen(false)}>
            <Coins className="h-4 w-4 inline mr-2" />
            List Token
          </MobileNavLink>
        </motion.nav>
      )}
    </header>
  );
}

function NavLink({ 
  href, 
  children, 
  icon 
}: { 
  href: string; 
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-muted-foreground hover:text-foreground transition-colors font-medium flex items-center gap-1.5"
    >
      {icon}
      {children}
    </Link>
  );
}

function MobileNavLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block py-2.5 px-3 text-base font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      {children}
    </Link>
  );
}
