'use client';

import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useCompetition } from '@/hooks/useCompetitions';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useLiveUpdates } from '@/hooks/useLiveUpdates';
import { CompetitionTimer } from '@/components/competitions/CompetitionTimer';
import { LeaderboardTable } from '@/components/rankings/LeaderboardTable';
import { TradesFeed } from '@/components/battle/TradesFeed';
import { PageContainer } from '@/components/layout/PageContainer';
import { formatUsd, cn } from '@/lib/utils';
import { competitionStatusColors } from '@/lib/status-colors';

const LivePnLChart = dynamic(
  () => import('@/components/battle/LivePnLChart').then(m => ({ default: m.LivePnLChart })),
  { ssr: false, loading: () => <div className="h-[300px] bg-arena-deep rounded-lg animate-pulse" /> }
);

export default function CompetitionBattlePage() {
  const params = useParams<{ id: string }>();
  const competitionId = params.id;

  const { data: competition, isLoading, error } = useCompetition(competitionId);
  const { data: leaderboard } = useLeaderboard(competitionId);
  const { events, connected } = useLiveUpdates(competitionId);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="text-center py-20 text-arena-muted">Loading competition...</div>
      </PageContainer>
    );
  }

  if (error || !competition) {
    return (
      <PageContainer>
        <div className="text-center py-20">
          <p className="text-arena-accent text-lg mb-2">Competition not found</p>
          <p className="text-arena-muted text-sm">
            {error?.message ?? 'The competition may not exist or the orchestrator is offline.'}
          </p>
        </div>
      </PageContainer>
    );
  }

  // Build dummy chart data from leaderboard PnL for demo purposes
  const chartData = (leaderboard ?? []).map((entry, i) => ({
    time: Math.floor(Date.now() / 1000) - (leaderboard!.length - i) * 60,
    value: entry.pnl / 1_000_000,
  }));

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{competition.name}</h1>
            <span
              className={cn(
                'px-2 py-1 rounded text-xs font-medium',
                competitionStatusColors[competition.status] ?? competitionStatusColors.Pending
              )}
            >
              {competition.status}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-arena-muted">
            <span>{competition.format}</span>
            <span>Prize: {formatUsd(competition.prize_pool / 1_000_000)}</span>
            <span>
              {competition.registered_count}/{competition.max_agents} agents
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <CompetitionTimer
            startTime={competition.start_time}
            endTime={competition.end_time}
            status={competition.status}
          />
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                connected ? 'bg-arena-success animate-pulse' : 'bg-arena-muted'
              )}
            />
            <span className="text-xs text-arena-muted">
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart + Leaderboard (takes 2 columns on lg) */}
        <div className="lg:col-span-2 space-y-6">
          {/* PnL Chart */}
          <div className="bg-arena-card border border-arena-border rounded-xl p-4">
            <h2 className="text-lg font-semibold mb-4">Performance</h2>
            {chartData.length > 0 ? (
              <LivePnLChart data={chartData} label="Aggregate PnL" />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-arena-muted">
                No performance data yet. Waiting for trades...
              </div>
            )}
          </div>

          {/* Leaderboard */}
          <div className="bg-arena-card border border-arena-border rounded-xl p-4">
            <h2 className="text-lg font-semibold mb-4">Leaderboard</h2>
            <LeaderboardTable entries={leaderboard ?? []} />
          </div>
        </div>

        {/* Sidebar: Trade Feed */}
        <div className="space-y-6">
          <div className="bg-arena-card border border-arena-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Trade Feed</h2>
              <span className="text-xs text-arena-muted">{events.length} events</span>
            </div>
            <TradesFeed
              events={events.map(e => ({
                ...e,
                data: e.data as {
                  side?: string;
                  action?: string;
                  size?: number;
                  price?: number;
                  pnl?: number;
                },
              }))}
            />
          </div>

          {/* Competition Details */}
          <div className="bg-arena-card border border-arena-border rounded-xl p-4">
            <h2 className="text-lg font-semibold mb-4">Details</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-arena-muted">Format</dt>
                <dd className="text-arena-text font-medium">{competition.format}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-arena-muted">Entry Fee</dt>
                <dd className="text-arena-text font-medium">
                  {competition.entry_fee > 0 ? formatUsd(competition.entry_fee / 1_000_000) : 'Free'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-arena-muted">Prize Pool</dt>
                <dd className="text-arena-text font-medium">
                  {formatUsd(competition.prize_pool / 1_000_000)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-arena-muted">Agents</dt>
                <dd className="text-arena-text font-medium">
                  {competition.registered_count} / {competition.max_agents}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-arena-muted">Start</dt>
                <dd className="text-arena-text font-medium text-xs">
                  {new Date(competition.start_time).toLocaleString()}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-arena-muted">End</dt>
                <dd className="text-arena-text font-medium text-xs">
                  {new Date(competition.end_time).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
