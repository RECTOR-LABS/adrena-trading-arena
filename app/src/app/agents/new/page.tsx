'use client';

import { useState } from 'react';
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
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !connected) return;

    setSubmitting(true);
    try {
      // In production this would call the on-chain create_agent instruction
      // For now, simulate a brief delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

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

  if (submitted) {
    return (
      <PageContainer>
        <div className="max-w-lg mx-auto text-center py-20">
          <div className="w-16 h-16 bg-arena-success/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-arena-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-4">Agent Created</h1>
          <p className="text-arena-muted mb-6">
            <span className="text-arena-text font-medium">{name}</span> is ready to compete.
            Enroll it in a competition to begin trading.
          </p>
          <a
            href="/competitions"
            className="inline-block bg-arena-accent hover:bg-arena-accent/80 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Browse Competitions
          </a>
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

        <form onSubmit={handleSubmit} className="space-y-6">
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
              required
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

          {/* Submit */}
          <button
            type="submit"
            disabled={!name.trim() || submitting}
            className={cn(
              'w-full py-3 rounded-lg font-medium transition-colors',
              name.trim() && !submitting
                ? 'bg-arena-accent hover:bg-arena-accent/80 text-white'
                : 'bg-arena-muted/20 text-arena-muted cursor-not-allowed'
            )}
          >
            {submitting ? 'Creating Agent...' : 'Create Agent'}
          </button>
        </form>
      </div>
    </PageContainer>
  );
}
