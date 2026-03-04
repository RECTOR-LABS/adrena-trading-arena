'use client';

import { useCompetitions } from '@/hooks/useCompetitions';
import { CompetitionCard } from '@/components/competitions/CompetitionCard';
import { PageContainer } from '@/components/layout/PageContainer';

export default function CompetitionsPage() {
  const { data: competitions, isLoading, error } = useCompetitions();

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Competitions</h1>
      </div>

      {isLoading && (
        <div className="text-center py-20 text-arena-muted">Loading competitions...</div>
      )}

      {error && (
        <div className="text-center py-20 text-arena-accent">
          Failed to load competitions. Is the orchestrator running?
        </div>
      )}

      {competitions && competitions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {competitions.map((comp) => (
            <CompetitionCard key={comp.id} competition={comp} />
          ))}
        </div>
      )}

      {competitions && competitions.length === 0 && (
        <div className="text-center py-20">
          <p className="text-arena-muted text-lg mb-4">No competitions yet.</p>
          <p className="text-arena-muted text-sm">
            Start the orchestrator and create a competition to get started.
          </p>
        </div>
      )}
    </PageContainer>
  );
}
