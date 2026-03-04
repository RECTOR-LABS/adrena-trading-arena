'use client';

import { useParams } from 'next/navigation';
import { useAgent } from '@/hooks/useAgent';
import { PageContainer } from '@/components/layout/PageContainer';
import { shortenAddress, formatUsd, formatNumber, cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  Active: 'bg-arena-success/20 text-arena-success',
  Idle: 'bg-arena-muted/20 text-arena-muted',
  Retired: 'bg-arena-accent/20 text-arena-accent',
  Disqualified: 'bg-arena-accent/20 text-arena-accent',
};

export default function AgentProfilePage() {
  const params = useParams<{ mint: string }>();
  const { data: agent, isLoading, error } = useAgent(params.mint);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="text-center py-20 text-arena-muted">Loading agent...</div>
      </PageContainer>
    );
  }

  if (error || !agent) {
    return (
      <PageContainer>
        <div className="text-center py-20">
          <p className="text-arena-accent text-lg mb-2">Agent not found</p>
          <p className="text-arena-muted text-sm">
            {error?.message ?? 'The agent may not exist or the orchestrator is offline.'}
          </p>
        </div>
      </PageContainer>
    );
  }

  const pnlPositive = agent.total_pnl >= 0;
  const winRate = agent.wins + agent.losses > 0
    ? (agent.wins / (agent.wins + agent.losses)) * 100
    : 0;

  return (
    <PageContainer>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold">{agent.name}</h1>
          <span
            className={cn(
              'px-2 py-1 rounded text-xs font-medium',
              statusColors[agent.status] ?? statusColors.Idle
            )}
          >
            {agent.status}
          </span>
        </div>
        <p className="text-arena-muted text-sm font-mono">{agent.mint}</p>
        <p className="text-arena-muted text-xs mt-1">
          Owner: {shortenAddress(agent.owner, 6)}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-arena-card border border-arena-border rounded-xl p-5">
          <p className="text-arena-muted text-sm mb-1">ELO Rating</p>
          <p className="text-2xl font-bold">{formatNumber(agent.elo_rating, 0)}</p>
        </div>

        <div className="bg-arena-card border border-arena-border rounded-xl p-5">
          <p className="text-arena-muted text-sm mb-1">Record</p>
          <p className="text-2xl font-bold">
            <span className="text-arena-success">{agent.wins}</span>
            <span className="text-arena-muted mx-1">/</span>
            <span className="text-arena-accent">{agent.losses}</span>
          </p>
        </div>

        <div className="bg-arena-card border border-arena-border rounded-xl p-5">
          <p className="text-arena-muted text-sm mb-1">Total PnL</p>
          <p className={cn('text-2xl font-bold', pnlPositive ? 'text-arena-success' : 'text-arena-accent')}>
            {pnlPositive ? '+' : ''}{formatUsd(agent.total_pnl / 1_000_000)}
          </p>
        </div>

        <div className="bg-arena-card border border-arena-border rounded-xl p-5">
          <p className="text-arena-muted text-sm mb-1">Total Trades</p>
          <p className="text-2xl font-bold">{formatNumber(agent.total_trades, 0)}</p>
        </div>
      </div>

      {/* Win Rate Bar */}
      <div className="bg-arena-card border border-arena-border rounded-xl p-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium">Win Rate</p>
          <p className="text-sm font-medium">{formatNumber(winRate, 1)}%</p>
        </div>
        <div className="w-full bg-arena-deep rounded-full h-3">
          <div
            className="bg-arena-success h-3 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(winRate, 100)}%` }}
          />
        </div>
      </div>

      {/* Placeholder for future trade history */}
      <div className="bg-arena-card border border-arena-border rounded-xl p-8 text-center">
        <p className="text-arena-muted">
          Trade history and performance charts will appear here during active competitions.
        </p>
      </div>
    </PageContainer>
  );
}
