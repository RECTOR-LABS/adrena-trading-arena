'use client';

import { useEffect, useMemo, useState } from 'react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function computeTimeLeft(targetMs: number): TimeLeft | null {
  const diff = targetMs - Date.now();
  if (diff <= 0) return null;

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

interface CompetitionTimerProps {
  startTime: string;
  endTime: string;
  status: string;
}

export function CompetitionTimer({ startTime, endTime, status }: CompetitionTimerProps) {
  const targetMs = useMemo(
    () => status === 'Active' ? new Date(endTime).getTime() : new Date(startTime).getTime(),
    [startTime, endTime, status]
  );
  const label = status === 'Active' ? 'Ends in' : 'Starts in';

  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() => computeTimeLeft(targetMs));

  useEffect(() => {
    if (status === 'Settled' || status === 'Scoring') return;

    const interval = setInterval(() => {
      setTimeLeft(computeTimeLeft(targetMs));
    }, 1000);

    return () => clearInterval(interval);
  }, [targetMs, status]);

  if (status === 'Settled' || status === 'Scoring') {
    return (
      <div className="text-arena-muted text-sm">
        {status === 'Settled' ? 'Competition ended' : 'Scoring in progress...'}
      </div>
    );
  }

  if (!timeLeft) {
    return <div className="text-arena-muted text-sm">Starting soon...</div>;
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-arena-muted text-sm">{label}</span>
      <div className="flex items-center gap-1 font-mono text-arena-text">
        {timeLeft.days > 0 && (
          <span className="bg-arena-deep px-2 py-1 rounded text-sm">
            {timeLeft.days}d
          </span>
        )}
        <span className="bg-arena-deep px-2 py-1 rounded text-sm">
          {pad(timeLeft.hours)}h
        </span>
        <span className="bg-arena-deep px-2 py-1 rounded text-sm">
          {pad(timeLeft.minutes)}m
        </span>
        <span className="bg-arena-deep px-2 py-1 rounded text-sm">
          {pad(timeLeft.seconds)}s
        </span>
      </div>
    </div>
  );
}
