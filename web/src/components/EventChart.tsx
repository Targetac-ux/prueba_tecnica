import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { EventLevel, Stats } from '@event-logger/shared';
import styles from './EventChart.module.css';

const LEVEL_COLORS: Record<EventLevel, string> = {
  debug: '#9ca3af',
  info: '#3457d5',
  warning: '#eab308',
  error: '#ef4444',
  fatal: '#7f1d1d',
};

const LEVELS: EventLevel[] = ['debug', 'info', 'warning', 'error', 'fatal'];

interface EventChartProps {
  stats: Stats | null;
}

function EventChart({ stats }: EventChartProps) {
  if (!stats || stats.buckets.length === 0) {
    return <div className={styles.empty}>No hay datos suficientes para graficar.</div>;
  }

  const data = stats.buckets.map((bucket) => ({
    hour: new Date(bucket.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    ...Object.fromEntries(LEVELS.map((level) => [level, bucket.counts[level] ?? 0])),
  }));

  return (
    <div className={styles.chartWrapper}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="hour" fontSize={11} stroke="var(--color-text-muted)" />
          <YAxis fontSize={11} allowDecimals={false} stroke="var(--color-text-muted)" />
          <Tooltip
            contentStyle={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {LEVELS.map((level) => (
            <Bar key={level} dataKey={level} stackId="events" fill={LEVEL_COLORS[level]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default EventChart;
