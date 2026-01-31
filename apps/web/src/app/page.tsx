import SwapWidget from '@/components/swap/SwapWidget';
import AdSlot from '@/components/ads/AdSlot';

export default function Home() {
  return (
    <main className="min-h-[calc(100vh-200px)]">
      {/* Header Banner Ad */}
      <div className="w-full flex justify-center py-4 bg-gradient-to-r from-gray-900/50 to-gray-800/50">
        <AdSlot 
          position="header" 
          slotId="header-banner" 
          dimensions="728x90" 
        />
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-purple-400 via-pink-500 to-orange-400 bg-clip-text text-transparent">
              Swap Anything
            </span>
            {' '}
            <span className="text-white">Anywhere</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            The best rates across Ethereum, Solana, Sui, and 10+ chains. 
            Powered by AI-optimized routing.
          </p>
        </div>

        {/* Three Column Layout with 4 Sidebar Ads */}
        <div className="flex justify-center gap-6">
          {/* Left Sidebars - Desktop Only */}
          <div className="hidden xl:flex flex-col gap-4 w-[300px] flex-shrink-0">
            <div className="sticky top-24 flex flex-col gap-4">
              <AdSlot 
                position="sidebar" 
                slotId="sidebar-left-top" 
                dimensions="300x250" 
              />
              <AdSlot 
                position="sidebar" 
                slotId="sidebar-left-bottom" 
                dimensions="300x250" 
              />
            </div>
          </div>

          {/* Center - Swap Widget */}
          <div className="w-full max-w-[480px]">
            <SwapWidget />
            
            {/* Swap Ad - Below Widget */}
            <div className="mt-6 flex justify-center">
              <AdSlot 
                position="swap" 
                slotId="swap-widget" 
                dimensions="300x100" 
              />
            </div>
          </div>

          {/* Right Sidebars - Desktop Only */}
          <div className="hidden xl:flex flex-col gap-4 w-[300px] flex-shrink-0">
            <div className="sticky top-24 flex flex-col gap-4">
              <AdSlot 
                position="sidebar" 
                slotId="sidebar-right-top" 
                dimensions="300x250" 
              />
              <AdSlot 
                position="sidebar" 
                slotId="sidebar-right-bottom" 
                dimensions="300x250" 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Banner Ad */}
      <div className="w-full flex justify-center py-6 mt-8 border-t border-gray-800">
        <AdSlot 
          position="footer" 
          slotId="footer-banner" 
          dimensions="728x90" 
        />
      </div>
    </main>
  );
}
