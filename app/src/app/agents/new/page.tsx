'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { WalletButton } from '@/components/wallet/WalletButton';
import { cn } from '@/lib/utils';

const STRATEGIES = [
  {
    value: 'momentum',
    label: 'Momentum',
    description: 'Follows strong price trends. Opens longs in uptrends, shorts in downtrends.',
  },
  {
    value: 'mean_reversion',
    label: 'Mean Reversion',
    description: 'Bets on price returning to the mean after extreme moves.',
  },
  {
    value: 'breakout',
    label: 'Breakout',
    description: 'Enters positions when price breaks key support/resistance levels.',
  },
  {
    value: 'scalper',
    label: 'Scalper',
    description: 'Rapid small trades capturing micro price movements. High frequency, low duration.',
  },
];

export default function CreateAgentPage() {
  const { connected } = useWallet();
  const [name, setName] = useState('');
  const [strategy, setStrategy] = useState('momentum');

  if (!connected) {
    return (
      <PageContainer>
        <div className="max-w-lg mx-auto text-center py-20">
          <h1 className="text-3xl font-bold mb-4">Create Agent</h1>
          <p className="text-arena-muted mb-6">
            Connect your wallet to create a trading agent.
          </p>
          <div className="flex justify-center">
            <WalletButton />
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-bold mb-2">Create Agent</h1>
        <p className="text-arena-muted mb-8">
          Configure your autonomous trading agent. Once created, enroll it in a competition.
        </p>

        {/* Coming Soon Banner */}
        <div className="bg-arena-blue/20 border border-arena-blue/40 rounded-xl p-5 mb-8">
          <p className="text-arena-text font-medium mb-1">Coming Soon</p>
          <p className="text-arena-muted text-sm">
            Agent creation will be available when the arena launches on mainnet.
            Browse existing competitions in the meantime.
          </p>
          <Link
            href="/competitions"
            className="inline-block mt-3 text-sm text-arena-accent hover:text-arena-accent/80 transition-colors font-medium"
          >
            Browse Competitions &rarr;
          </Link>
        </div>

        <fieldset disabled className="opacity-60 cursor-not-allowed">
          <div className="space-y-6">
            {/* Name */}
            <div>
              <label htmlFor="agent-name" className="block text-sm font-medium text-arena-text mb-2">
                Agent Name
              </label>
              <input
                id="agent-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. AlphaStrike"
                maxLength={32}
                className="w-full bg-arena-deep border border-arena-border rounded-lg px-4 py-3 text-arena-text placeholder:text-arena-muted/50 focus:outline-none focus:border-arena-accent transition-colors"
              />
            </div>

            {/* Strategy */}
            <div>
              <label className="block text-sm font-medium text-arena-text mb-2">
                Strategy
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {STRATEGIES.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStrategy(s.value)}
                    className={cn(
                      'text-left p-4 rounded-lg border transition-all',
                      strategy === s.value
                        ? 'border-arena-accent bg-arena-accent/10'
                        : 'border-arena-border bg-arena-deep hover:border-arena-accent/30'
                    )}
                  >
                    <p className="font-medium text-sm">{s.label}</p>
                    <p className="text-arena-muted text-xs mt-1">{s.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Submit (disabled) */}
            <button
              type="button"
              disabled
              className="w-full py-3 rounded-lg font-medium bg-arena-muted/20 text-arena-muted cursor-not-allowed"
            >
              Create Agent
            </button>
          </div>
        </fieldset>
      </div>
    </PageContainer>
  );
}
