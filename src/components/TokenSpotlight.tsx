import { useMemo } from 'react'
import { formatCurrencyFull, formatPercent, pnlColor } from '../lib/utils'
import type { MatchedTrade } from '../types/report'

interface Props {
  underlying: string
  trades: MatchedTrade[]
}

export default function TokenSpotlight({ underlying, trades }: Props) {
  const stats = useMemo(() => {
    const totalFills = trades.length
    const netPnl = trades.reduce((sum, t) => sum + t.net_pnl, 0)
    const winners = trades.filter(t => t.net_pnl > 0).length
    const winRate = totalFills > 0 ? (winners / totalFills) * 100 : 0

    // Instrument breakdown
    const perps = trades.filter(t => t.instrument_type === 'perpetual')
    const calls = trades.filter(t => t.instrument_type === 'call')
    const puts = trades.filter(t => t.instrument_type === 'put')

    const perpsPnl = perps.reduce((sum, t) => sum + t.net_pnl, 0)
    const callsPnl = calls.reduce((sum, t) => sum + t.net_pnl, 0)
    const putsPnl = puts.reduce((sum, t) => sum + t.net_pnl, 0)

    // Verdict
    let verdict: string
    let verdictColor: string
    if (netPnl > 10) {
      verdict = 'Your edge'
      verdictColor = 'var(--color-positive-text)'
    } else if (netPnl < -10) {
      verdict = 'Avoid'
      verdictColor = 'var(--color-negative-text)'
    } else {
      verdict = 'Breakeven'
      verdictColor = 'var(--color-text-tertiary)'
    }

    return {
      totalFills,
      netPnl,
      winRate,
      perpsPnl,
      perpsCount: perps.length,
      callsPnl,
      callsCount: calls.length,
      putsPnl,
      putsCount: puts.length,
      verdict,
      verdictColor,
    }
  }, [trades])

  const borderColor = stats.netPnl >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'

  return (
    <div
      className="p-4 rounded-xl"
      style={{
        background: 'var(--color-bg-primary)',
        border: '1px solid var(--color-bg-secondary)',
        borderLeft: `3px solid ${borderColor}`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
            {underlying}
          </span>
          <span
            className="badge text-[10px]"
            style={{
              background: stats.netPnl >= 0 ? 'var(--color-positive-muted)' : 'var(--color-negative-muted)',
              color: stats.verdictColor,
            }}
          >
            {stats.verdict}
          </span>
        </div>
        <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
          {stats.totalFills} fills
        </span>
      </div>

      {/* Main stats */}
      <div className="flex items-baseline gap-4 mb-3">
        <span className="font-mono text-lg font-bold" style={{ color: pnlColor(stats.netPnl) }}>
          {formatCurrencyFull(stats.netPnl)}
        </span>
        <span className="font-mono text-xs" style={{ color: stats.winRate >= 50 ? 'var(--color-positive-text)' : 'var(--color-negative-text)' }}>
          {formatPercent(stats.winRate)} WR
        </span>
      </div>

      {/* Instrument breakdown */}
      <div className="grid grid-cols-3 gap-2">
        {([
          { label: 'Perps', pnl: stats.perpsPnl, count: stats.perpsCount },
          { label: 'Calls', pnl: stats.callsPnl, count: stats.callsCount },
          { label: 'Puts', pnl: stats.putsPnl, count: stats.putsCount },
        ] as const).filter(item => item.count > 0).map((item) => (
          <div
            key={item.label}
            className="p-2 rounded-lg text-center"
            style={{ background: 'var(--color-bg-surface-alt)' }}
          >
            <div className="text-[10px] font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>
              {item.label} ({item.count})
            </div>
            <div className="font-mono text-xs font-bold mt-0.5" style={{ color: pnlColor(item.pnl) }}>
              {formatCurrencyFull(item.pnl)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
