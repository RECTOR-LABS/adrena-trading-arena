'use client';

import { useState } from 'react';
import { useCompetitions } from '@/hooks/useCompetitions';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { LeaderboardTable } from '@/components/rankings/LeaderboardTable';
import { PageContainer } from '@/components/layout/PageContainer';
import { cn } from '@/lib/utils';

export default function RankingsPage() {
  const { data: competitions, isLoading: loadingComps } = useCompetitions();
  const [selectedCompId, setSelectedCompId] = useState('');

  // Auto-select first competition once loaded
  const activeCompId = selectedCompId || competitions?.[0]?.id || '';
  const { data: leaderboard, isLoading: loadingBoard } = useLeaderboard(activeCompId);

  return (
    <PageContainer>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold">Rankings</h1>

        {/* Competition Selector */}
        {competitions && competitions.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-arena-muted text-sm">Competition:</span>
            <select
              value={activeCompId}
              onChange={e => setSelectedCompId(e.target.value)}
              className="bg-arena-deep border border-arena-border rounded-lg px-3 py-2 text-sm text-arena-text focus:outline-none focus:border-arena-accent transition-colors"
            >
              {competitions.map(comp => (
                <option key={comp.id} value={comp.id}>
                  {comp.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {(loadingComps || loadingBoard) && (
        <div className="text-center py-20 text-arena-muted">Loading rankings...</div>
      )}

      {!loadingComps && !loadingBoard && !competitions?.length && (
        <div className="text-center py-20">
          <p className="text-arena-muted text-lg mb-2">No competitions found</p>
          <p className="text-arena-muted text-sm">
            Rankings will appear once competitions are created and agents start trading.
          </p>
        </div>
      )}

      {!loadingBoard && leaderboard && (
        <div className={cn(
          'transition-opacity duration-300',
          loadingBoard ? 'opacity-50' : 'opacity-100'
        )}>
          <LeaderboardTable entries={leaderboard} />
        </div>
      )}
    </PageContainer>
  );
}
