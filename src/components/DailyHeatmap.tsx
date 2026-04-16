import { useMemo, useState } from 'react'
import Card from './Card'
import { formatCurrencyFull, formatDate } from '../lib/utils'

interface DayData {
  date: string
  pnl: number
  trades: number
}

interface Props {
  data: DayData[]
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const CELL_SIZE = 14
const CELL_GAP = 2
const CELL_TOTAL = CELL_SIZE + CELL_GAP

function getPercentileColor(value: number, percentiles: number[]): string {
  // percentiles: [p10, p25, p50, p75, p90] of non-zero pnl values
  if (value === 0) return '#2d303a'
  if (value < percentiles[0]) return '#b91c1c'   // deep red
  if (value < percentiles[1]) return '#dc2626'   // red
  if (value < percentiles[2]) return '#ef4444'   // light red
  if (value < percentiles[3]) return '#22c55e'   // light green
  if (value < percentiles[4]) return '#16a34a'   // green
  return '#15803d'                                // deep green
}

function computePercentiles(values: number[]): number[] {
  if (values.length === 0) return [0, 0, 0, 0, 0]
  const sorted = [...values].sort((a, b) => a - b)
  const pct = (p: number) => sorted[Math.floor(sorted.length * p)] ?? 0
  return [pct(0.1), pct(0.25), pct(0.5), pct(0.75), pct(0.9)]
}

export default function DailyHeatmap({ data }: Props) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; day: DayData } | null>(null)

  const { weeks, monthHeaders, percentiles, bestWindow } = useMemo(() => {
    if (data.length === 0) return { weeks: [], monthHeaders: [], percentiles: [0, 0, 0, 0, 0], bestWindow: null }

    const dataMap = new Map<string, DayData>()
    data.forEach(d => dataMap.set(d.date, d))

    const nonZeroPnls = data.filter(d => d.pnl !== 0).map(d => d.pnl)
    const pctls = computePercentiles(nonZeroPnls)

    // Find date range
    const dates = data.map(d => new Date(d.date)).sort((a, b) => a.getTime() - b.getTime())
    const startDate = new Date(dates[0])
    const endDate = new Date(dates[dates.length - 1])

    // Align start to Monday
    const dayOfWeek = startDate.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    startDate.setDate(startDate.getDate() + mondayOffset)

    // Build grid: rows=7 (Mon-Sun), columns=weeks
    const gridWeeks: (DayData | null)[][] = []
    const monthHeadersList: { label: string; weekIndex: number }[] = []
    let lastMonth = -1
    const cursor = new Date(startDate)

    while (cursor <= endDate || gridWeeks.length === 0) {
      const week: (DayData | null)[] = []
      for (let dow = 0; dow < 7; dow++) {
        const dateStr = cursor.toISOString().slice(0, 10)
        if (cursor > endDate) {
          week.push(null)
        } else {
          week.push(dataMap.get(dateStr) ?? { date: dateStr, pnl: 0, trades: 0 })
        }

        // Track month transitions on first day of week
        if (dow === 0 && cursor.getMonth() !== lastMonth && cursor <= endDate) {
          lastMonth = cursor.getMonth()
          monthHeadersList.push({ label: MONTH_LABELS[cursor.getMonth()], weekIndex: gridWeeks.length })
        }

        cursor.setDate(cursor.getDate() + 1)
      }
      gridWeeks.push(week)
    }

    // Find best 7-day rolling window
    let bestSum = -Infinity
    let bestIdx = 0
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date))
    for (let i = 0; i <= sorted.length - 7; i++) {
      const sum = sorted.slice(i, i + 7).reduce((s, d) => s + d.pnl, 0)
      if (sum > bestSum) {
        bestSum = sum
        bestIdx = i
      }
    }
    const bw = sorted.length >= 7 ? {
      start: sorted[bestIdx].date,
      end: sorted[bestIdx + 6].date,
      pnl: bestSum,
    } : null

    return { weeks: gridWeeks, monthHeaders: monthHeadersList, percentiles: pctls, bestWindow: bw }
  }, [data])

  if (data.length === 0) return null

  const labelWidth = 32
  const chartWidth = labelWidth + weeks.length * CELL_TOTAL
  const chartHeight = 7 * CELL_TOTAL + 20

  return (
    <Card title="Daily P&L Heatmap">
      <div className="overflow-x-auto relative">
        <svg
          width={chartWidth}
          height={chartHeight}
          style={{ display: 'block' }}
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Month labels */}
          {monthHeaders.map((mh, i) => (
            <text
              key={i}
              x={labelWidth + mh.weekIndex * CELL_TOTAL}
              y={10}
              fill="var(--color-text-tertiary)"
              fontSize={9}
              fontFamily="var(--font-sans)"
            >
              {mh.label}
            </text>
          ))}

          {/* Day labels */}
          {DAY_LABELS.map((label, i) => (
            <text
              key={label}
              x={0}
              y={20 + i * CELL_TOTAL + CELL_SIZE / 2 + 3}
              fill="var(--color-text-tertiary)"
              fontSize={9}
              fontFamily="var(--font-sans)"
            >
              {i % 2 === 0 ? label : ''}
            </text>
          ))}

          {/* Cells */}
          {weeks.map((week, wi) =>
            week.map((day, di) => {
              if (!day) return null
              const x = labelWidth + wi * CELL_TOTAL
              const y = 20 + di * CELL_TOTAL
              return (
                <rect
                  key={`${wi}-${di}`}
                  x={x}
                  y={y}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  rx={2}
                  fill={day.trades === 0 && day.pnl === 0 ? '#1a1a1f' : getPercentileColor(day.pnl, percentiles)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    const rect = (e.target as SVGRectElement).getBoundingClientRect()
                    setTooltip({ x: rect.left + rect.width / 2, y: rect.top, day })
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              )
            })
          )}
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
            }}
          >
            <div style={{ color: 'var(--color-text-secondary)' }}>{formatDate(tooltip.day.date)}</div>
            <div className="font-mono font-bold" style={{ color: tooltip.day.pnl >= 0 ? 'var(--color-positive-text)' : 'var(--color-negative-text)' }}>
              {formatCurrencyFull(tooltip.day.pnl)}
            </div>
            <div style={{ color: 'var(--color-text-tertiary)' }}>{tooltip.day.trades} trades</div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>Less</span>
          {['#b91c1c', '#dc2626', '#ef4444', '#2d303a', '#22c55e', '#16a34a', '#15803d'].map((c, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
          ))}
          <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>More</span>
        </div>
      </div>

      {/* Best window insight */}
      {bestWindow && (
        <div className="mt-4 px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--color-positive-muted)' }}>
          <span style={{ color: 'var(--color-positive-text)' }}>
            Best 7-day window: {formatDate(bestWindow.start)} - {formatDate(bestWindow.end)} ({formatCurrencyFull(bestWindow.pnl)})
          </span>
        </div>
      )}
    </Card>
  )
}
