'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useCompetitions() {
  return useQuery({
    queryKey: ['competitions'],
    queryFn: api.getCompetitions,
  });
}

export function useCompetition(id: string) {
  return useQuery({
    queryKey: ['competition', id],
    queryFn: () => api.getCompetition(id),
    enabled: !!id,
  });
}
