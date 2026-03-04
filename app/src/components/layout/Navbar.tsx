'use client';

import Link from 'next/link';
import { WalletButton } from '../wallet/WalletButton';

export function Navbar() {
  return (
    <nav className="border-b border-arena-border bg-arena-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-bold text-arena-accent">
              Arena
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <Link href="/competitions" className="text-arena-muted hover:text-arena-text transition-colors text-sm">
                Competitions
              </Link>
              <Link href="/agents/new" className="text-arena-muted hover:text-arena-text transition-colors text-sm">
                Create Agent
              </Link>
              <Link href="/rankings" className="text-arena-muted hover:text-arena-text transition-colors text-sm">
                Rankings
              </Link>
            </div>
          </div>
          <WalletButton />
        </div>
      </div>
    </nav>
  );
}
