import { cn } from '../lib/utils'

interface Props {
  label: string
  value: string
  trend?: string
  trendDirection?: 'up' | 'down' | 'neutral'
  subtext?: string
  valueColor?: string
  className?: string
}

export default function StatCard({ label, value, trend, trendDirection, subtext, valueColor, className }: Props) {
  return (
    <div className={cn('stat-card', className)}>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value" style={{ color: valueColor }}>
        {value}
      </div>
      {(trend || subtext) && (
        <div className="mt-2 flex items-center gap-2">
          {trend && (
            <span
              className="badge text-[10px]"
              style={{
                background: trendDirection === 'up' ? 'var(--color-positive-muted)' : trendDirection === 'down' ? 'var(--color-negative-muted)' : 'var(--color-bg-secondary)',
                color: trendDirection === 'up' ? 'var(--color-positive-text)' : trendDirection === 'down' ? 'var(--color-negative-text)' : 'var(--color-text-secondary)',
              }}
            >
              {trendDirection === 'up' ? '▲' : trendDirection === 'down' ? '▼' : ''} {trend}
            </span>
          )}
          {subtext && (
            <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{subtext}</span>
          )}
        </div>
      )}
    </div>
  )
}
