import { useMemo, useState } from 'react'
import Card from './Card'
import { formatCurrencyFull, formatPercent } from '../lib/utils'
import type { MatchedTrade } from '../types/report'

interface Props {
  trades: MatchedTrade[]
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_INDEX_MAP: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 }

const CELL_W = 48
const CELL_H = 20
const LABEL_W = 44
const HEADER_H = 28

interface CellData {
  hour: number
  day: number
  avgPnl: number
  trades: number
  winRate: number
}

function getHeatColor(value: number, maxAbs: number): string {
  if (maxAbs === 0) return '#2d303a'
  const ratio = value / maxAbs
  if (ratio > 0.6) return '#15803d'
  if (ratio > 0.3) return '#16a34a'
  if (ratio > 0.05) return '#22c55e40'
  if (ratio > -0.05) return '#2d303a'
  if (ratio > -0.3) return '#ef444440'
  if (ratio > -0.6) return '#dc2626'
  return '#b91c1c'
}

export default function TimeHeatmap({ trades }: Props) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; cell: CellData } | null>(null)

  const { grid, maxAbs, bestWindow } = useMemo(() => {
    // Group trades by (hour, dayOfWeek)
    const buckets = new Map<string, { totalPnl: number; count: number; wins: number }>()

    for (const trade of trades) {
      const exitDate = new Date(trade.exit_time)
      const hour = exitDate.getUTCHours()
      const jsDay = exitDate.getUTCDay()
      const day = DAY_INDEX_MAP[jsDay]
      const key = `${hour}-${day}`

      const bucket = buckets.get(key) ?? { totalPnl: 0, count: 0, wins: 0 }
      bucket.totalPnl += trade.pnl
      bucket.count += 1
      if (trade.pnl > 0) bucket.wins += 1
      buckets.set(key, bucket)
    }

    const cells: CellData[] = []
    let mAbs = 0

    for (let hour = 0; hour < 24; hour++) {
      for (let day = 0; day < 7; day++) {
        const bucket = buckets.get(`${hour}-${day}`)
        const avgPnl = bucket ? bucket.totalPnl / bucket.count : 0
        const tradeCount = bucket?.count ?? 0
        const winRate = bucket && bucket.count > 0 ? (bucket.wins / bucket.count) * 100 : 0
        cells.push({ hour, day, avgPnl, trades: tradeCount, winRate })
        if (Math.abs(avgPnl) > mAbs) mAbs = Math.abs(avgPnl)
      }
    }

    // Find best trading window
    let bestAvg = -Infinity
    let bestCell: CellData | null = null
    for (const cell of cells) {
      if (cell.trades >= 2 && cell.avgPnl > bestAvg) {
        bestAvg = cell.avgPnl
        bestCell = cell
      }
    }

    return { grid: cells, maxAbs: mAbs, bestWindow: bestCell }
  }, [trades])

  if (trades.length === 0) return null

  const svgWidth = LABEL_W + 7 * CELL_W + 4
  const svgHeight = HEADER_H + 24 * CELL_H + 4

  return (
    <Card title="P&L by Hour & Day">
      <div className="overflow-x-auto relative">
        <svg
          width={svgWidth}
          height={svgHeight}
          style={{ display: 'block' }}
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Day headers */}
          {DAYS.map((day, i) => (
            <text
              key={day}
              x={LABEL_W + i * CELL_W + CELL_W / 2}
              y={16}
              textAnchor="middle"
              fill="var(--color-text-secondary)"
              fontSize={10}
              fontWeight={600}
              fontFamily="var(--font-sans)"
            >
              {day}
            </text>
          ))}

          {/* Hour labels */}
          {Array.from({ length: 24 }, (_, h) => (
            <text
              key={h}
              x={LABEL_W - 6}
              y={HEADER_H + h * CELL_H + CELL_H / 2 + 3}
              textAnchor="end"
              fill="var(--color-text-tertiary)"
              fontSize={9}
              fontFamily="var(--font-mono)"
            >
              {h % 3 === 0 ? `${String(h).padStart(2, '0')}:00` : ''}
            </text>
          ))}

          {/* Cells */}
          {grid.map((cell) => {
            const x = LABEL_W + cell.day * CELL_W
            const y = HEADER_H + cell.hour * CELL_H
            return (
              <rect
                key={`${cell.hour}-${cell.day}`}
                x={x + 1}
                y={y + 1}
                width={CELL_W - 2}
                height={CELL_H - 2}
                rx={3}
                fill={cell.trades === 0 ? '#1a1a1f' : getHeatColor(cell.avgPnl, maxAbs)}
                style={{ cursor: cell.trades > 0 ? 'pointer' : 'default' }}
                onMouseEnter={(e) => {
                  if (cell.trades === 0) return
                  const rect = (e.target as SVGRectElement).getBoundingClientRect()
                  setTooltip({ x: rect.left + rect.width / 2, y: rect.top, cell })
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            )
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 pointer-events-none px-3 py-2 rounded text-xs"
            style={{
              left: tooltip.x,
              top: tooltip.y - 8,
              transform: 'translate(-50%, -100%)',
              background: '#212126',
              border: '1px solid var(--color-separator-2)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              color: 'var(--color-text-primary)',
              minWidth: 160,
            }}
          >
            <div className="font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              {DAYS[tooltip.cell.day]} {String(tooltip.cell.hour).padStart(2, '0')}:00 UTC
            </div>
            <div className="mt-1 font-mono font-bold" style={{ color: tooltip.cell.avgPnl >= 0 ? 'var(--color-positive-text)' : 'var(--color-negative-text)' }}>
              Avg P&L: {formatCurrencyFull(tooltip.cell.avgPnl)}
            </div>
            <div style={{ color: 'var(--color-text-tertiary)' }}>
              {tooltip.cell.trades} trades, {formatPercent(tooltip.cell.winRate)} win rate
            </div>
          </div>
        )}
      </div>

      {/* Best window insight */}
      {bestWindow && (
        <div className="mt-4 px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--color-positive-muted)' }}>
          <span style={{ color: 'var(--color-positive-text)' }}>
            Your best trading window: {DAYS[bestWindow.day]} {String(bestWindow.hour).padStart(2, '0')}:00-{String(bestWindow.hour + 1).padStart(2, '0')}:00 UTC (Avg {formatCurrencyFull(bestWindow.avgPnl)}, {bestWindow.trades} trades)
          </span>
        </div>
      )}
    </Card>
  )
}
