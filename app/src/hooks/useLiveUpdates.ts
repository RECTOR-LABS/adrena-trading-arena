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
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    if (!competitionId) return;

    const source = new EventSource(
      `${ORCHESTRATOR_API_URL}/api/competitions/${competitionId}/live`
    );

    source.onopen = () => {
      setConnected(true);
      setReconnecting(false);
    };

    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as LiveEvent;
        setEvents(prev => [parsed, ...prev].slice(0, 100));
      } catch (e) {
        console.warn('Failed to parse SSE event:', e);
      }
    };

    source.onerror = () => {
      setConnected(false);
      setReconnecting(true);
    };

    return () => source.close();
  }, [competitionId]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { events, connected, reconnecting, clearEvents };
}
