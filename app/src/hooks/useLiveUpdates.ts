'use client';

import { useEffect, useState, useCallback } from 'react';
import { ORCHESTRATOR_API_URL } from '@/lib/constants';

interface LiveEvent {
  agent_mint: string;
  event_type: string;
  data: unknown;
  timestamp: string;
}

export function useLiveUpdates(competitionId: string) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!competitionId) return;

    const source = new EventSource(
      `${ORCHESTRATOR_API_URL}/api/competitions/${competitionId}/live`
    );

    source.onopen = () => setConnected(true);
    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as LiveEvent;
        setEvents(prev => [parsed, ...prev].slice(0, 100));
      } catch {
        /* ignore malformed SSE payloads */
      }
    };
    source.onerror = () => setConnected(false);

    return () => source.close();
  }, [competitionId]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { events, connected, clearEvents };
}
