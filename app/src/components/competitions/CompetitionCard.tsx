'use client';

import Link from 'next/link';
import type { Competition } from '@/types';
import { formatUsd, cn } from '@/lib/utils';
import { competitionStatusColors } from '@/lib/status-colors';

export function CompetitionCard({ competition }: { competition: Competition }) {
  return (
    <Link href={`/competitions/${competition.id}`}>
      <div className="bg-arena-card border border-arena-border rounded-xl p-6 hover:border-arena-accent/50 transition-all cursor-pointer group">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold group-hover:text-arena-accent transition-colors">
            {competition.name}
          </h3>
          <span
            className={cn(
              'px-2 py-1 rounded text-xs font-medium shrink-0 ml-2',
              competitionStatusColors[competition.status] ?? competitionStatusColors.Pending
            )}
          >
            {competition.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-arena-muted">Prize Pool</p>
            <p className="text-arena-text font-medium">
              {formatUsd(competition.prize_pool / 1_000_000)}
            </p>
          </div>
          <div>
            <p className="text-arena-muted">Agents</p>
            <p className="text-arena-text font-medium">
              {competition.registered_count} / {competition.max_agents}
            </p>
          </div>
          <div>
            <p className="text-arena-muted">Format</p>
            <p className="text-arena-text font-medium">{competition.format}</p>
          </div>
          <div>
            <p className="text-arena-muted">Entry Fee</p>
            <p className="text-arena-text font-medium">
              {competition.entry_fee > 0
                ? formatUsd(competition.entry_fee / 1_000_000)
                : 'Free'}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
