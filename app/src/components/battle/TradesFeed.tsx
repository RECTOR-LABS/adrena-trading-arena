'use client';

import { shortenAddress, formatUsd, cn } from '@/lib/utils';

interface TradeEvent {
  agent_mint: string;
  event_type: string;
  data: {
    side?: string;
    action?: string;
    size?: number;
    price?: number;
    pnl?: number;
  };
  timestamp: string;
}

export function TradesFeed({ events }: { events: TradeEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-arena-muted text-sm">
        Waiting for trade events...
      </div>
    );
  }

  return (
    <div className="max-h-[400px] overflow-y-auto space-y-2">
      {events.map((event, i) => {
        const d = event.data;
        const isLong = d.side === 'long';
        const isOpen = d.action === 'open';
        const pnlPositive = (d.pnl ?? 0) >= 0;

        return (
          <div
            key={`${event.agent_mint}-${event.timestamp}-${i}`}
            className="bg-arena-deep rounded-lg px-3 py-2 text-xs border border-arena-border/50"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-arena-muted">
                {shortenAddress(event.agent_mint, 4)}
              </span>
              <span className="text-arena-muted">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                'px-1.5 py-0.5 rounded font-medium',
                isLong
                  ? 'bg-arena-success/20 text-arena-success'
                  : 'bg-arena-accent/20 text-arena-accent'
              )}>
                {d.side?.toUpperCase() ?? 'N/A'}
              </span>
              <span className={cn(
                'font-medium',
                isOpen ? 'text-arena-blue' : 'text-arena-warning'
              )}>
                {d.action?.toUpperCase() ?? event.event_type}
              </span>
              {d.size != null && (
                <span className="text-arena-text">
                  {formatUsd(d.size / 1_000_000)}
                </span>
              )}
              {d.price != null && (
                <span className="text-arena-muted">
                  @ ${d.price.toFixed(2)}
                </span>
              )}
              {d.pnl != null && d.action === 'close' && (
                <span className={cn(
                  'ml-auto font-medium',
                  pnlPositive ? 'text-arena-success' : 'text-arena-accent'
                )}>
                  {pnlPositive ? '+' : ''}{formatUsd(d.pnl / 1_000_000)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
