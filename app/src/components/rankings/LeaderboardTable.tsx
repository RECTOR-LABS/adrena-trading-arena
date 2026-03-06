'use client';

import { useState, useMemo } from 'react';
import type { LeaderboardEntry } from '@/types';
import { shortenAddress, formatUsd, formatNumber, cn } from '@/lib/utils';

type SortKey = keyof Pick<LeaderboardEntry, 'rank' | 'score' | 'pnl' | 'trades' | 'win_rate' | 'max_drawdown'>;

const columns: { key: SortKey; label: string }[] = [
  { key: 'rank', label: 'Rank' },
  { key: 'score', label: 'Score' },
  { key: 'pnl', label: 'PnL' },
  { key: 'trades', label: 'Trades' },
  { key: 'win_rate', label: 'Win Rate' },
  { key: 'max_drawdown', label: 'Max DD' },
];

export function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortAsc, setSortAsc] = useState(true);

  const sorted = useMemo(() => {
    const copy = [...entries];
    copy.sort((a, b) => {
      const diff = (a[sortKey] as number) - (b[sortKey] as number);
      return sortAsc ? diff : -diff;
    });
    return copy;
  }, [entries, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(prev => !prev);
    } else {
      setSortKey(key);
      setSortAsc(key === 'rank');
    }
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-arena-muted">
        No leaderboard data available yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-arena-border">
      <table className="w-full text-sm">
        <thead className="bg-arena-deep sticky top-0">
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className="px-4 py-3 text-left text-arena-muted font-medium cursor-pointer hover:text-arena-text transition-colors select-none"
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {sortKey === col.key && (
                    <span className="text-arena-accent">{sortAsc ? '\u2191' : '\u2193'}</span>
                  )}
                </span>
              </th>
            ))}
            <th className="px-4 py-3 text-left text-arena-muted font-medium">Agent</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-arena-border">
          {sorted.map(entry => {
            const pnlPositive = entry.pnl >= 0;
            return (
              <tr
                key={entry.agent_mint}
                className="hover:bg-arena-deep/50 transition-colors"
              >
                <td className="px-4 py-3 font-mono">
                  <span className={cn(
                    'font-bold',
                    entry.rank === 1 && 'text-yellow-400',
                    entry.rank === 2 && 'text-gray-300',
                    entry.rank === 3 && 'text-amber-600',
                    entry.rank > 3 && 'text-arena-muted'
                  )}>
                    #{entry.rank}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium">{formatNumber(entry.score)}</td>
                <td className={cn('px-4 py-3 font-medium', pnlPositive ? 'text-arena-success' : 'text-arena-accent')}>
                  {pnlPositive ? '+' : ''}{formatUsd(entry.pnl / 1_000_000)}
                </td>
                <td className="px-4 py-3">{entry.trades}</td>
                <td className="px-4 py-3">{formatNumber(entry.win_rate * 100, 1)}%</td>
                <td className="px-4 py-3 text-arena-accent">
                  {formatNumber(entry.max_drawdown * 100, 1)}%
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium">{entry.agent_name}</p>
                    <p className="text-arena-muted text-xs font-mono">
                      {shortenAddress(entry.agent_mint, 4)}
                    </p>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
