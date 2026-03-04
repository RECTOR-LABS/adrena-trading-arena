import { ORCHESTRATOR_API_URL } from './constants';
import type { Competition, LeaderboardEntry, Agent } from '@/types';

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${ORCHESTRATOR_API_URL}${path}`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  getHealth: () => fetchApi<{ status: string; version: string }>('/health'),
  getCompetitions: () => fetchApi<Competition[]>('/api/competitions'),
  getCompetition: (id: string) => fetchApi<Competition>(`/api/competitions/${id}`),
  getLeaderboard: (id: string) => fetchApi<LeaderboardEntry[]>(`/api/competitions/${id}/leaderboard`),
  getAgent: (mint: string) => fetchApi<Agent>(`/api/agents/${mint}`),
};
