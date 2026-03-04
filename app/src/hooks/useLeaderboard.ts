'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useLeaderboard(competitionId: string) {
  return useQuery({
    queryKey: ['leaderboard', competitionId],
    queryFn: () => api.getLeaderboard(competitionId),
    enabled: !!competitionId,
    refetchInterval: 10_000,
  });
}
