'use client';

import Link from 'next/link';
import type { Agent } from '@/types';
import { shortenAddress, formatUsd, cn } from '@/lib/utils';
import { agentStatusColors } from '@/lib/status-colors';

export function AgentCard({ agent }: { agent: Agent }) {
  const pnlPositive = agent.total_pnl >= 0;

  return (
    <Link href={`/agents/${agent.mint}`}>
      <div className="bg-arena-card border border-arena-border rounded-xl p-6 hover:border-arena-accent/50 transition-all cursor-pointer group">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold group-hover:text-arena-accent transition-colors">
              {agent.name}
            </h3>
            <p className="text-arena-muted text-xs font-mono mt-1">
              {shortenAddress(agent.mint, 6)}
            </p>
          </div>
          <span
            className={cn(
              'px-2 py-1 rounded text-xs font-medium shrink-0',
              agentStatusColors[agent.status] ?? agentStatusColors.Idle
            )}
          >
            {agent.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-arena-muted">ELO Rating</p>
            <p className="text-arena-text font-medium">{agent.elo_rating}</p>
          </div>
          <div>
            <p className="text-arena-muted">Record</p>
            <p className="text-arena-text font-medium">
              <span className="text-arena-success">{agent.wins}W</span>
              {' / '}
              <span className="text-arena-accent">{agent.losses}L</span>
            </p>
          </div>
          <div>
            <p className="text-arena-muted">Total PnL</p>
            <p className={cn('font-medium', pnlPositive ? 'text-arena-success' : 'text-arena-accent')}>
              {pnlPositive ? '+' : ''}
              {formatUsd(agent.total_pnl / 1_000_000)}
            </p>
          </div>
          <div>
            <p className="text-arena-muted">Trades</p>
            <p className="text-arena-text font-medium">{agent.total_trades}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
