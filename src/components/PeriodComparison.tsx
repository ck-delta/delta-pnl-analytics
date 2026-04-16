import Card from './Card'
import { formatCurrencyFull, formatPercent, cn } from '../lib/utils'
import type { MonthlyPnl } from '../types/report'

interface Props {
  monthly: MonthlyPnl[]
}

interface ComparisonRow {
  metric: string
  thisMonth: string
  lastMonth: string
  changeValue: number
  changeLabel: string
  isPercent?: boolean
}

function formatMonthLabel(monthStr: string): string {
  // monthStr format: "2024-01" or similar
  const [year, month] = monthStr.split('-')
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const idx = parseInt(month, 10) - 1
  return `${monthNames[idx] ?? month} ${year}`
}

function computeChange(current: number, previous: number): { value: number; label: string } {
  if (previous === 0) {
    return { value: current > 0 ? 100 : current < 0 ? -100 : 0, label: current === 0 ? '0%' : 'N/A' }
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100
  return { value: pct, label: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%` }
}

export default function PeriodComparison({ monthly }: Props) {
  if (monthly.length < 2) return null

  const thisMonth = monthly[monthly.length - 1]
  const lastMonth = monthly[monthly.length - 2]

  const rows: ComparisonRow[] = [
    (() => {
      const change = computeChange(thisMonth.net_pnl, lastMonth.net_pnl)
      return { metric: 'Net P&L', thisMonth: formatCurrencyFull(thisMonth.net_pnl), lastMonth: formatCurrencyFull(lastMonth.net_pnl), changeValue: change.value, changeLabel: change.label }
    })(),
    (() => {
      const change = computeChange(thisMonth.trades, lastMonth.trades)
      return { metric: 'Trades', thisMonth: String(thisMonth.trades), lastMonth: String(lastMonth.trades), changeValue: change.value, changeLabel: change.label }
    })(),
    (() => {
      const diff = thisMonth.win_rate - lastMonth.win_rate
      return { metric: 'Win Rate', thisMonth: formatPercent(thisMonth.win_rate), lastMonth: formatPercent(lastMonth.win_rate), changeValue: diff, changeLabel: `${diff > 0 ? '+' : ''}${diff.toFixed(1)}pp`, isPercent: true }
    })(),
    (() => {
      const change = computeChange(thisMonth.best, lastMonth.best)
      return { metric: 'Best Trade', thisMonth: formatCurrencyFull(thisMonth.best), lastMonth: formatCurrencyFull(lastMonth.best), changeValue: change.value, changeLabel: change.label }
    })(),
    (() => {
      // For worst trade, smaller absolute value is better, so we invert the comparison direction
      const change = computeChange(Math.abs(lastMonth.worst), Math.abs(thisMonth.worst))
      return { metric: 'Worst Trade', thisMonth: formatCurrencyFull(thisMonth.worst), lastMonth: formatCurrencyFull(lastMonth.worst), changeValue: change.value, changeLabel: change.label }
    })(),
    (() => {
      // For fees, lower is better, so we invert
      const change = computeChange(lastMonth.fees, thisMonth.fees)
      return { metric: 'Fees', thisMonth: formatCurrencyFull(thisMonth.fees), lastMonth: formatCurrencyFull(lastMonth.fees), changeValue: change.value, changeLabel: change.label }
    })(),
  ]

  return (
    <Card title="Month-over-Month Comparison">
      <div className="flex items-center gap-2 mb-4">
        <span className="badge badge-brand text-[10px]">{formatMonthLabel(thisMonth.month)}</span>
        <span className="text-xs" style={{ color: 'var(--color-text-quaternary)' }}>vs</span>
        <span className="badge text-[10px]" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}>
          {formatMonthLabel(lastMonth.month)}
        </span>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th style={{ textAlign: 'right' }}>{formatMonthLabel(thisMonth.month)}</th>
            <th style={{ textAlign: 'right' }}>{formatMonthLabel(lastMonth.month)}</th>
            <th style={{ textAlign: 'right' }}>Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isPositive = row.changeValue > 0
            const isNeutral = row.changeValue === 0
            return (
              <tr key={row.metric}>
                <td>
                  <span className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                    {row.metric}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span className="font-mono text-sm" style={{ color: 'var(--color-text-primary)' }}>
                    {row.thisMonth}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span className="font-mono text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {row.lastMonth}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span
                    className={cn('badge text-[10px] font-mono', isPositive ? 'badge-positive' : isNeutral ? '' : 'badge-negative')}
                    style={isNeutral ? { background: 'var(--color-bg-secondary)', color: 'var(--color-text-tertiary)' } : undefined}
                  >
                    {isPositive ? '▲' : isNeutral ? '' : '▼'} {row.changeLabel}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Summary */}
      <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--color-separator)' }}>
        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Gross P&L Change</span>
        <span
          className="font-mono text-sm font-bold"
          style={{ color: thisMonth.gross_pnl >= lastMonth.gross_pnl ? 'var(--color-positive-text)' : 'var(--color-negative-text)' }}
        >
          {formatCurrencyFull(thisMonth.gross_pnl - lastMonth.gross_pnl)}
        </span>
      </div>
    </Card>
  )
}
