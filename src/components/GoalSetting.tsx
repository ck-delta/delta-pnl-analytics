import { useState, useEffect, useMemo } from 'react'
import { useReport } from '../context/ReportContext'
import Card from './Card'
import { formatCurrencyFull, cn } from '../lib/utils'
import { Target, Pencil, RotateCcw } from 'lucide-react'

const STORAGE_KEY = 'deltaPnlGoal'
const DEFAULT_GOAL = 500

function getStoredGoal(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = parseFloat(stored)
      if (!isNaN(parsed) && parsed > 0) return parsed
    }
  } catch {}
  return DEFAULT_GOAL
}

export default function GoalSetting() {
  const { state } = useReport()
  const report = state.report!

  const [goal, setGoal] = useState(getStoredGoal)
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')

  // Get current month P&L from monthly data
  const currentMonthPnl = useMemo(() => {
    const monthly = report.pnl_analysis.monthly
    if (monthly.length === 0) return 0
    return monthly[monthly.length - 1].net_pnl
  }, [report])

  const progress = goal > 0 ? (currentMonthPnl / goal) * 100 : 0
  const clampedProgress = Math.max(0, Math.min(progress, 100))

  // Determine color based on progress
  const statusColor = useMemo(() => {
    if (currentMonthPnl < 0) return 'var(--color-negative)'
    if (progress >= 80) return 'var(--color-positive)'
    if (progress >= 40) return 'var(--color-warning)'
    return 'var(--color-negative)'
  }, [currentMonthPnl, progress])

  const statusTextColor = useMemo(() => {
    if (currentMonthPnl < 0) return 'var(--color-negative-text)'
    if (progress >= 80) return 'var(--color-positive-text)'
    if (progress >= 40) return 'var(--color-warning)'
    return 'var(--color-negative-text)'
  }, [currentMonthPnl, progress])

  const statusLabel = useMemo(() => {
    if (currentMonthPnl < 0) return 'In the red'
    if (progress >= 100) return 'Goal reached!'
    if (progress >= 80) return 'Almost there'
    if (progress >= 40) return 'Making progress'
    return 'Behind target'
  }, [currentMonthPnl, progress])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(goal))
    } catch {}
  }, [goal])

  const handleEdit = () => {
    setInputValue(String(goal))
    setEditing(true)
  }

  const handleSave = () => {
    const parsed = parseFloat(inputValue)
    if (!isNaN(parsed) && parsed > 0) {
      setGoal(parsed)
    }
    setEditing(false)
  }

  const handleReset = () => {
    setGoal(DEFAULT_GOAL)
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') setEditing(false)
  }

  return (
    <Card title="Monthly P&L Goal">
      <div className="space-y-4">
        {/* Target display / edit */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target size={16} style={{ color: 'var(--color-brand-text)' }} />
            {editing ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono" style={{ color: 'var(--color-text-secondary)' }}>$</span>
                <input
                  type="number"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSave}
                  autoFocus
                  className="input input-mono w-32 py-1 px-2 text-sm"
                  min="1"
                  step="50"
                />
              </div>
            ) : (
              <span className="font-mono text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Target: {formatCurrencyFull(goal).replace('+', '')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {!editing && (
              <button
                onClick={handleEdit}
                className="p-1.5 rounded transition-colors"
                style={{ color: 'var(--color-text-tertiary)' }}
                title="Edit goal"
              >
                <Pencil size={14} />
              </button>
            )}
            <button
              onClick={handleReset}
              className="p-1.5 rounded transition-colors"
              style={{ color: 'var(--color-text-tertiary)' }}
              title="Reset to default"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div
            className="h-4 rounded-full overflow-hidden"
            style={{ background: 'var(--color-bg-tertiary)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${clampedProgress}%`,
                background: statusColor,
                minWidth: currentMonthPnl !== 0 ? '4px' : '0px',
              }}
            />
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between">
            <span
              className="font-mono text-lg font-bold"
              style={{ color: statusTextColor }}
            >
              {formatCurrencyFull(currentMonthPnl)}
            </span>
            <span
              className={cn('badge text-[10px] font-semibold')}
              style={{
                background: currentMonthPnl < 0 ? 'var(--color-negative-muted)' : progress >= 80 ? 'var(--color-positive-muted)' : progress >= 40 ? 'rgba(255, 208, 51, 0.15)' : 'var(--color-negative-muted)',
                color: statusTextColor,
              }}
            >
              {progress >= 0 ? `${progress.toFixed(0)}%` : `${progress.toFixed(0)}%`} -- {statusLabel}
            </span>
          </div>
        </div>

        {/* Subtext */}
        <p className="text-[11px]" style={{ color: 'var(--color-text-quaternary)' }}>
          Tracking current month's net P&L against your target.
        </p>
      </div>
    </Card>
  )
}
