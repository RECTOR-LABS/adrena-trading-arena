'use client';

import { useEffect, useRef } from 'react';
import { createChart, LineSeries, type IChartApi, type ISeriesApi } from 'lightweight-charts';

interface PnLDataPoint {
  time: number;
  value: number;
}

export function LivePnLChart({ data, label }: { data: PnLDataPoint[]; label?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // Create chart on mount only
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#0a0a1a' },
        textColor: '#6b7280',
      },
      grid: {
        vertLines: { color: '#1e1e3a' },
        horzLines: { color: '#1e1e3a' },
      },
      width: containerRef.current.clientWidth,
      height: 300,
      timeScale: { timeVisible: true },
    });

    const series = chart.addSeries(LineSeries, {
      color: '#e94560',
      lineWidth: 2,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Update data when it changes
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || data.length === 0) return;

    series.setData(
      data.map(d => ({
        time: d.time as unknown as Parameters<typeof series.setData>[0][0]['time'],
        value: d.value,
      }))
    );
  }, [data]);

  return (
    <div>
      {label && <h3 className="text-sm font-medium text-arena-muted mb-2">{label}</h3>}
      <div ref={containerRef} className="rounded-lg overflow-hidden border border-arena-border" />
    </div>
  );
}
