import { useState, useEffect, useCallback, useMemo } from 'react'
import { useReport } from '../context/ReportContext'
import { fetchAdvice } from '../lib/api'
import Card from '../components/Card'
import StreakTracker from '../components/StreakTracker'
import TokenSpotlight from '../components/TokenSpotlight'
import ShareCard from '../components/ShareCard'
import { formatCurrencyFull, formatPercent } from '../lib/utils'
import { RefreshCw, Download, ChevronRight, AlertCircle, Play } from 'lucide-react'
import type { MatchedTrade } from '../types/report'
import jsPDF from 'jspdf'

// ---- Advice response types ----

interface AdviceResponse {
  grade: string
  summary: string
  key_metrics: { label: string; value: string }[]
  whats_working: string[]
  whats_not_working: string[]
  how_to_improve: { text: string; tab?: string }[]
  bottom_line: string
  overall_score: number
}

// ---- Grade colors ----

function gradeColor(grade: string): string {
  switch (grade.toUpperCase()) {
    case 'A': case 'A+': case 'A-': return '#00a876'
    case 'B': case 'B+': case 'B-': return '#33b991'
    case 'C': case 'C+': case 'C-': return '#ffd033'
    default: return '#eb5454'
  }
}

// ---- Main component ----

export default function TraderAdvice() {
  const { state, dispatch } = useReport()
  const report = state.report!

  const [advice, setAdvice] = useState<AdviceResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadAdvice = useCallback(async () => {
    setLoading(true)
    setError(null)
    setAdvice(null)
    try {
      const result = await fetchAdvice(report) as AdviceResponse
      setAdvice(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load advice')
    } finally {
      setLoading(false)
    }
  }, [report])

  useEffect(() => {
    loadAdvice()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const navigateToTab = (tabName?: string) => {
    if (!tabName) return
    const tabMap: Record<string, number> = {
      overview: 0, 'p&l analysis': 1, pnl: 1, instruments: 2, funding: 3,
      expiry: 4, risk: 5, 'risk & metrics': 5, charges: 6, 'open portfolio': 7,
      'trade log': 8, trades: 8,
    }
    const idx = tabMap[tabName.toLowerCase()]
    if (idx !== undefined) dispatch({ type: 'SET_TAB', payload: idx })
  }

  // Token spotlights: group trades by underlying, top 4 by count
  const tokenSpotlights = useMemo(() => {
    const trades = report.trade_log.trades
    const grouped = new Map<string, MatchedTrade[]>()
    for (const trade of trades) {
      const existing = grouped.get(trade.underlying)
      if (existing) {
        existing.push(trade)
      } else {
        grouped.set(trade.underlying, [trade])
      }
    }
    return Array.from(grouped.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 4)
  }, [report])

  const downloadPdf = useCallback(() => {
    if (!advice) return
    const doc = new jsPDF()
    const margin = 20
    let y = margin

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.text(`Trader Advice Report (Grade: ${advice.grade})`, margin, y)
    y += 12

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(advice.summary, margin, y, { maxWidth: 170 })
    y += 16

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text("What's Working", margin, y)
    y += 8
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    for (const item of advice.whats_working) {
      const lines = doc.splitTextToSize(`- ${item}`, 170)
      doc.text(lines, margin, y)
      y += lines.length * 5 + 3
    }
    y += 4

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text("What's Not Working", margin, y)
    y += 8
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    for (const item of advice.whats_not_working) {
      const lines = doc.splitTextToSize(`- ${item}`, 170)
      doc.text(lines, margin, y)
      y += lines.length * 5 + 3
    }
    y += 4

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('How to Improve', margin, y)
    y += 8
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    for (const item of advice.how_to_improve) {
      const lines = doc.splitTextToSize(`- ${item.text}`, 170)
      doc.text(lines, margin, y)
      y += lines.length * 5 + 3
    }
    y += 4

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('Bottom Line', margin, y)
    y += 8
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const blLines = doc.splitTextToSize(advice.bottom_line, 170)
    doc.text(blLines, margin, y)

    doc.save(`trader-advice-${new Date().toISOString().slice(0, 10)}.pdf`)
  }, [advice])

  // ---- Error state ----
  if (error && !loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 112px)' }}>
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle size={48} style={{ color: 'var(--color-negative-text)', margin: '0 auto' }} />
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-on-bg)' }}>Failed to Load Advice</h2>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{error}</p>
          <button onClick={loadAdvice} className="btn-primary">
            <RefreshCw size={14} className="inline mr-2" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  // ---- Loading state ----
  if (loading || !advice) {
    return (
      <div className="space-y-6">
        {/* Replay Wrapped button (disabled while loading) */}
        <button className="btn-secondary flex items-center gap-2 opacity-50" disabled>
          <Play size={14} />
          Replay Wrapped
        </button>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="card space-y-4">
            <div className="shimmer h-6 w-40 rounded" />
            <div className="shimmer h-16 rounded-xl" />
            <div className="shimmer h-4 w-3/4 rounded" />
          </div>
        ))}
      </div>
    )
  }

  // ---- Advice loaded ----
  const o = report.overview

  return (
    <div className="space-y-6">
      {/* Replay Wrapped */}
      <button
        onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'wrapped' })}
        className="btn-primary flex items-center gap-2"
      >
        <Play size={14} />
        Replay Wrapped
      </button>

      {/* Grade Card */}
      <Card>
        <div className="flex items-center gap-6">
          {/* Grade badge */}
          <div
            className="w-24 h-24 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: `${gradeColor(advice.grade)}15`,
              border: `3px solid ${gradeColor(advice.grade)}40`,
            }}
          >
            <span
              className="font-mono text-5xl font-black"
              style={{ color: gradeColor(advice.grade) }}
            >
              {advice.grade}
            </span>
          </div>

          {/* Score and summary */}
          <div className="flex-1 min-w-0">
            {advice.overall_score > 0 && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                  Score
                </span>
                <span className="font-mono text-lg font-bold" style={{ color: gradeColor(advice.grade) }}>
                  {advice.overall_score}/100
                </span>
              </div>
            )}

            {/* Key metrics */}
            <div className="flex gap-6 mb-3">
              {(advice.key_metrics?.length > 0 ? advice.key_metrics.slice(0, 3) : [
                { label: 'Net P&L', value: formatCurrencyFull(o.net_realized_pnl) },
                { label: 'Win Rate', value: formatPercent(o.win_rate) },
                { label: 'Trades', value: String(o.total_trades) },
              ]).map((m) => (
                <div key={m.label}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>{m.label}</div>
                  <div className="font-mono text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>{m.value}</div>
                </div>
              ))}
            </div>

            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              {advice.summary}
            </p>
          </div>
        </div>
      </Card>

      {/* What's Working */}
      {advice.whats_working.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-1 h-6 rounded-full" style={{ background: 'var(--color-positive)' }} />
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-positive-text)' }}>What's Working</h2>
          </div>
          <div className="space-y-3">
            {advice.whats_working.map((item, i) => (
              <div
                key={i}
                className="p-4 rounded-xl"
                style={{
                  background: 'var(--color-bg-primary)',
                  borderLeft: '3px solid var(--color-positive)',
                  border: '1px solid var(--color-bg-secondary)',
                  borderLeftColor: 'var(--color-positive)',
                }}
              >
                <div className="flex gap-3">
                  <span className="font-mono text-xs font-bold shrink-0 mt-0.5" style={{ color: 'var(--color-positive-text)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>{item}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What's Not Working */}
      {advice.whats_not_working.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-1 h-6 rounded-full" style={{ background: 'var(--color-negative)' }} />
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-negative-text)' }}>What's Not Working</h2>
          </div>
          <div className="space-y-3">
            {advice.whats_not_working.map((item, i) => (
              <div
                key={i}
                className="p-4 rounded-xl"
                style={{
                  background: 'var(--color-bg-primary)',
                  borderLeft: '3px solid var(--color-negative)',
                  border: '1px solid var(--color-bg-secondary)',
                  borderLeftColor: 'var(--color-negative)',
                }}
              >
                <div className="flex gap-3">
                  <span className="font-mono text-xs font-bold shrink-0 mt-0.5" style={{ color: 'var(--color-negative-text)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>{item}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {advice.how_to_improve.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-1 h-6 rounded-full" style={{ background: 'var(--color-accent-blue)' }} />
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-accent-blue-text)' }}>Recommendations</h2>
          </div>
          <div className="space-y-3">
            {advice.how_to_improve.map((item, i) => (
              <div
                key={i}
                className="p-4 rounded-xl"
                style={{
                  background: 'var(--color-bg-primary)',
                  borderLeft: '3px solid var(--color-accent-blue)',
                  border: '1px solid var(--color-bg-secondary)',
                  borderLeftColor: 'var(--color-accent-blue)',
                }}
              >
                <div className="flex gap-3">
                  <span className="font-mono text-xs font-bold shrink-0 mt-0.5" style={{ color: 'var(--color-accent-blue-text)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>{item.text}</p>
                    {item.tab && (
                      <button
                        onClick={() => navigateToTab(item.tab)}
                        className="mt-2 flex items-center gap-1 text-xs font-semibold transition-colors"
                        style={{ color: 'var(--color-accent-blue-text)' }}
                      >
                        <ChevronRight size={12} />
                        View in {item.tab}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Token Spotlights */}
      {tokenSpotlights.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-1 h-6 rounded-full" style={{ background: 'var(--color-brand)' }} />
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-brand-text)' }}>Token Spotlights</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {tokenSpotlights.map(([underlying, trades]) => (
              <TokenSpotlight key={underlying} underlying={underlying} trades={trades} />
            ))}
          </div>
        </div>
      )}

      {/* Achievements / Streaks */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-1 h-6 rounded-full" style={{ background: 'var(--color-accent-purple)' }} />
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-accent-purple-text)' }}>Achievements</h2>
        </div>
        <StreakTracker streaks={report.streaks} />
      </div>

      {/* Bottom Line */}
      {advice.bottom_line && (
        <Card>
          <div className="text-center space-y-4 py-4">
            <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-on-bg)' }}>Bottom Line</h3>
            <p className="text-sm leading-relaxed max-w-xl mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
              {advice.bottom_line}
            </p>
          </div>
        </Card>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <ShareCard report={report} />
        <button onClick={downloadPdf} className="btn-secondary flex items-center gap-2">
          <Download size={14} />
          Download PDF
        </button>
        <button onClick={loadAdvice} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={14} />
          Regenerate
        </button>
      </div>
    </div>
  )
}
