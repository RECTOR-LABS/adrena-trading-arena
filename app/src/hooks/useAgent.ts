'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useAgent(mint: string) {
  return useQuery({
    queryKey: ['agent', mint],
    queryFn: () => api.getAgent(mint),
    enabled: !!mint,
  });
}
