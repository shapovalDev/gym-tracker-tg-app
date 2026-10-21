'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatShortDate, formatDate } from '@/lib/format';

export interface ChartPoint {
  date: string;
  value: number;
}

/**
 * Single-series line: one data point per real session (no gap filling),
 * 2px line, 8px markers, crosshair tooltip with the exact value, recessive grid.
 */
export function ProgressChart({
  points,
  unit,
  label,
}: {
  points: ChartPoint[];
  unit: string;
  label: string;
}) {
  const data = points.map((p) => ({ ...p, t: new Date(p.date).getTime() }));
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(1, (max - min) * 0.15);
  return (
    <figure aria-label={`График: ${label}`} className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(t: number) => formatShortDate(new Date(t).toISOString())}
            tick={{ fill: 'var(--muted)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
            padding={{ left: 12, right: 12 }}
          />
          <YAxis
            width={44}
            domain={[Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)]}
            tick={{ fill: 'var(--muted)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!active || !p) return null;
              return (
                <div className="rounded-xl bg-ink px-3 py-2 text-card shadow-lg">
                  <div className="text-xs opacity-75">{formatDate(p.date)}</div>
                  <div className="num text-[16px] font-semibold">
                    {new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(p.value)}{' '}
                    {unit}
                  </div>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={{ r: 4, fill: 'var(--primary)', stroke: 'var(--card)', strokeWidth: 2 }}
            activeDot={{
              r: 6,
              fill: 'var(--primary)',
              stroke: 'var(--card)',
              strokeWidth: 2,
            }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}
