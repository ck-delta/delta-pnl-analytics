import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Card from './Card'
import { formatCurrencyFull, pnlColor } from '../lib/utils'

interface DailyPnlEntry {
  date: string
  pnl: number
  trades: number
}

interface Props {
  dailyPnl: DailyPnlEntry[]
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getMonthName(month: number): string {
  return ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'][month]
}

/** Returns 0 = Mon ... 6 = Sun (ISO weekday) */
function isoWeekday(date: Date): number {
  return (date.getDay() + 6) % 7
}

function pnlCellBg(pnl: number, maxAbs: number): string {
  if (maxAbs === 0) return 'var(--color-bg-surface-alt)'
  const intensity = Math.min(Math.abs(pnl) / maxAbs, 1)
  // Scale alpha from 0.15 to 0.6
  const alpha = 0.15 + intensity * 0.45
  if (pnl > 0) return `rgba(0, 168, 118, ${alpha.toFixed(2)})`
  if (pnl < 0) return `rgba(235, 84, 84, ${alpha.toFixed(2)})`
  return 'var(--color-bg-surface-alt)'
}

export default function TradingCalendar({ dailyPnl }: Props) {
  // Build lookup map
  const pnlMap = useMemo(() => {
    const map = new Map<string, DailyPnlEntry>()
    for (const entry of dailyPnl) {
      map.set(entry.date, entry)
    }
    return map
  }, [dailyPnl])

  // Determine the default month: last month with data
  const defaultDate = useMemo(() => {
    if (dailyPnl.length === 0) return new Date()
    const last = dailyPnl[dailyPnl.length - 1]
    const d = new Date(last.date)
    return new Date(d.getFullYear(), d.getMonth(), 1)
  }, [dailyPnl])

  const [currentMonth, setCurrentMonth] = useState(defaultDate)
  const [selectedDay, setSelectedDay] = useState<DailyPnlEntry | null>(null)

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

  // Max absolute P&L for color scaling
  const maxAbsPnl = useMemo(() => {
    let max = 0
    for (const entry of dailyPnl) {
      const abs = Math.abs(entry.pnl)
      if (abs > max) max = abs
    }
    return max
  }, [dailyPnl])

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startWeekday = isoWeekday(firstDay) // 0-6

    const days: (null | { day: number; dateStr: string; entry: DailyPnlEntry | undefined })[] = []

    // Padding for days before the 1st
    for (let i = 0; i < startWeekday; i++) {
      days.push(null)
    }

    // Actual days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ day: d, dateStr, entry: pnlMap.get(dateStr) })
    }

    return days
  }, [year, month, pnlMap])

  const prevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1))
    setSelectedDay(null)
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1))
    setSelectedDay(null)
  }

  const handleDayClick = (entry: DailyPnlEntry | undefined) => {
    if (entry) {
      setSelectedDay(prev => prev?.date === entry.date ? null : entry)
    }
  }

  return (
    <Card title="Trading Calendar">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {getMonthName(month)} {year}
        </span>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-[10px] font-semibold py-1"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((cell, i) => {
          if (!cell) {
            return <div key={`empty-${i}`} className="aspect-square" />
          }

          const hasData = !!cell.entry
          const isSelected = selectedDay?.date === cell.dateStr

          return (
            <button
              key={cell.dateStr}
              onClick={() => handleDayClick(cell.entry)}
              className="aspect-square rounded-lg flex flex-col items-center justify-center transition-all relative"
              style={{
                background: hasData ? pnlCellBg(cell.entry!.pnl, maxAbsPnl) : 'var(--color-bg-surface-alt)',
                cursor: hasData ? 'pointer' : 'default',
                opacity: hasData ? 1 : 0.4,
                outline: isSelected ? '2px solid var(--color-brand)' : 'none',
                outlineOffset: '-1px',
              }}
              disabled={!hasData}
            >
              <span
                className="text-xs font-semibold"
                style={{ color: hasData ? 'var(--color-text-primary)' : 'var(--color-text-quaternary)' }}
              >
                {cell.day}
              </span>
              {hasData && (
                <span
                  className="text-[8px] font-mono font-bold"
                  style={{ color: pnlColor(cell.entry!.pnl) }}
                >
                  {cell.entry!.pnl >= 0 ? '+' : ''}{cell.entry!.pnl >= 1000 || cell.entry!.pnl <= -1000
                    ? `${(cell.entry!.pnl / 1000).toFixed(1)}K`
                    : cell.entry!.pnl.toFixed(0)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Expanded day detail */}
      {selectedDay && (
        <div
          className="mt-4 p-4 rounded-lg border animate-fade-in"
          style={{
            background: 'var(--color-bg-surface-alt)',
            borderColor: selectedDay.pnl >= 0 ? 'var(--color-positive)' : 'var(--color-negative)',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                {new Date(selectedDay.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
              <div className="font-mono text-xl font-bold mt-1" style={{ color: pnlColor(selectedDay.pnl) }}>
                {formatCurrencyFull(selectedDay.pnl)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase" style={{ color: 'var(--color-text-tertiary)' }}>
                Trades
              </div>
              <div className="font-mono text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {selectedDay.trades}
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
