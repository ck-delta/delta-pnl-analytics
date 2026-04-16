import { useState, useEffect, useRef, useCallback } from 'react'
import { useInView } from 'react-intersection-observer'
import { useReport } from '../context/ReportContext'
import { fetchAdvice } from '../lib/api'
import { formatCurrencyFull, formatPercent, cn } from '../lib/utils'
import { RefreshCw, Download, ChevronRight, AlertCircle } from 'lucide-react'
import jsPDF from 'jspdf'

// ─── Advice response types ─────────────────────────────────────

interface AdviceResponse {
  grade: string
  summary: string
  key_metrics: { label: string; value: string }[]
  whats_working: string[]
  whats_not_working: string[]
  how_to_improve: { text: string; tab?: string }[]
  kelly_criterion: {
    full_kelly_pct: number
    half_kelly_pct: number
    explanation: string
  }
  bottom_line: string
}

// ─── Slide wrapper with IntersectionObserver ────────────────────

function Slide({
  index,
  onVisible,
  children,
  className,
}: {
  index: number
  onVisible: (idx: number) => void
  children: React.ReactNode
  className?: string
}) {
  const { ref, inView } = useInView({ threshold: 0.5 })

  useEffect(() => {
    if (inView) onVisible(index)
  }, [inView, index, onVisible])

  return (
    <section
      ref={ref}
      className={cn('snap-slide', className)}
    >
      <div className="w-full max-w-2xl mx-auto animate-fade-in">
        {children}
      </div>
    </section>
  )
}

// ─── Grade colors ───────────────────────────────────────────────

function gradeColor(grade: string): string {
  switch (grade.toUpperCase()) {
    case 'A': case 'A+': case 'A-': return '#00a876'
    case 'B': case 'B+': case 'B-': return '#33b991'
    case 'C': case 'C+': case 'C-': return '#ffd033'
    default: return '#eb5454'
  }
}

// ─── Shimmer placeholders ───────────────────────────────────────

function ShimmerSlide() {
  return (
    <section className="snap-slide">
      <div className="w-full max-w-2xl mx-auto space-y-6">
        <div className="shimmer h-8 w-48 rounded" />
        <div className="shimmer h-24 rounded-xl" />
        <div className="space-y-3">
          <div className="shimmer h-5 w-full rounded" />
          <div className="shimmer h-5 w-5/6 rounded" />
          <div className="shimmer h-5 w-4/6 rounded" />
        </div>
        <div className="shimmer h-5 w-3/4 rounded" />
      </div>
    </section>
  )
}

// ─── Kelly bar visualization ────────────────────────────────────

function KellyBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  const displayPct = Math.min(Math.max(pct, 0), 100)
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{label}</span>
        <span className="font-mono text-sm font-bold" style={{ color }}>{formatPercent(pct)}</span>
      </div>
      <div className="h-6 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-tertiary)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${displayPct}%`, background: color }}
        />
      </div>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────

export default function TraderAdvice() {
  const { state, dispatch } = useReport()
  const report = state.report!

  const [tone, setTone] = useState<'helpful' | 'roast'>('helpful')
  const [advice, setAdvice] = useState<AdviceResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeSlide, setActiveSlide] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const loadAdvice = useCallback(async (selectedTone: 'helpful' | 'roast') => {
    setLoading(true)
    setError(null)
    setAdvice(null)
    try {
      const result = await fetchAdvice(report, selectedTone) as AdviceResponse
      setAdvice(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load advice')
    } finally {
      setLoading(false)
    }
  }, [report])

  useEffect(() => {
    loadAdvice(tone)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleToneChange = (newTone: 'helpful' | 'roast') => {
    setTone(newTone)
    loadAdvice(newTone)
  }

  const handleSlideVisible = useCallback((idx: number) => {
    setActiveSlide(idx)
  }, [])

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
    doc.text('Kelly Criterion', margin, y)
    y += 8
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`Full Kelly: ${formatPercent(advice.kelly_criterion.full_kelly_pct)}`, margin, y)
    y += 6
    doc.text(`Half Kelly (recommended): ${formatPercent(advice.kelly_criterion.half_kelly_pct)}`, margin, y)
    y += 6
    const kellyLines = doc.splitTextToSize(advice.kelly_criterion.explanation, 170)
    doc.text(kellyLines, margin, y)
    y += kellyLines.length * 5 + 8

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

  // ─── Error state ────────────────────────────────────────────

  if (error && !loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 112px)' }}>
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle size={48} style={{ color: 'var(--color-negative-text)', margin: '0 auto' }} />
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-on-bg)' }}>Failed to Load Advice</h2>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{error}</p>
          <button onClick={() => loadAdvice(tone)} className="btn-primary">
            <RefreshCw size={14} className="inline mr-2" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  // ─── Loading state ──────────────────────────────────────────

  if (loading || !advice) {
    return (
      <div>
        {/* Tone toggle still visible while loading */}
        <div className="sticky top-0 z-20 py-3 flex items-center justify-center" style={{ background: 'var(--color-bg-depth)' }}>
          <ToneToggle tone={tone} onChange={handleToneChange} disabled />
        </div>
        <div className="snap-container" style={{ height: 'calc(100vh - 112px)' }}>
          {Array.from({ length: 6 }, (_, i) => <ShimmerSlide key={i} />)}
        </div>
      </div>
    )
  }

  // ─── Advice loaded ──────────────────────────────────────────

  const o = report.overview

  return (
    <div className="relative">
      {/* Tone toggle */}
      <div className="sticky top-0 z-20 py-3 flex items-center justify-center" style={{ background: 'var(--color-bg-depth)' }}>
        <ToneToggle tone={tone} onChange={handleToneChange} />
      </div>

      {/* Dot indicators */}
      <div className="fixed right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
        {['Score', 'Working', 'Not Working', 'Improve', 'Kelly', 'Summary'].map((label, i) => (
          <button
            key={i}
            onClick={() => {
              const slides = containerRef.current?.querySelectorAll('.snap-slide')
              slides?.[i]?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="group flex items-center gap-2"
            title={label}
          >
            <span
              className="text-[9px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {label}
            </span>
            <div
              className="w-2.5 h-2.5 rounded-full transition-all"
              style={{
                background: activeSlide === i ? 'var(--color-brand)' : 'var(--color-bg-tertiary)',
                transform: activeSlide === i ? 'scale(1.3)' : 'scale(1)',
              }}
            />
          </button>
        ))}
      </div>

      {/* Slides */}
      <div
        ref={containerRef}
        className="snap-container"
        style={{ height: 'calc(100vh - 112px)' }}
      >
        {/* ── Slide 1: Score Card ────────────────── */}
        <Slide index={0} onVisible={handleSlideVisible}>
          <div className="text-center space-y-8">
            {/* Grade */}
            <div
              className="inline-flex items-center justify-center w-32 h-32 rounded-3xl mx-auto"
              style={{
                background: `${gradeColor(advice.grade)}15`,
                border: `3px solid ${gradeColor(advice.grade)}40`,
              }}
            >
              <span
                className="font-mono text-7xl font-black"
                style={{ color: gradeColor(advice.grade) }}
              >
                {advice.grade}
              </span>
            </div>

            {/* Key metrics */}
            <div className="flex justify-center gap-8">
              {(advice.key_metrics?.length > 0 ? advice.key_metrics.slice(0, 3) : [
                { label: 'Net P&L', value: formatCurrencyFull(o.net_realized_pnl) },
                { label: 'Win Rate', value: formatPercent(o.win_rate) },
                { label: 'Trades', value: String(o.total_trades) },
              ]).map((m) => (
                <div key={m.label}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>{m.label}</div>
                  <div className="font-mono text-xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <p className="text-lg leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              {advice.summary}
            </p>
          </div>
        </Slide>

        {/* ── Slide 2: What's Working ────────────── */}
        <Slide index={1} onVisible={handleSlideVisible}>
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 rounded-full" style={{ background: 'var(--color-positive)' }} />
              <h2 className="text-2xl font-bold" style={{ color: 'var(--color-positive-text)' }}>What's Working</h2>
            </div>

            <div className="space-y-4">
              {advice.whats_working.map((item, i) => (
                <div
                  key={i}
                  className="flex gap-4 p-4 rounded-xl"
                  style={{ background: 'var(--color-positive-muted)' }}
                >
                  <span className="font-mono text-lg font-bold shrink-0" style={{ color: 'var(--color-positive-text)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>{item}</p>
                </div>
              ))}
            </div>
          </div>
        </Slide>

        {/* ── Slide 3: What's Not Working ─────────── */}
        <Slide index={2} onVisible={handleSlideVisible}>
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 rounded-full" style={{ background: 'var(--color-negative)' }} />
              <h2 className="text-2xl font-bold" style={{ color: 'var(--color-negative-text)' }}>What's Not Working</h2>
            </div>

            <div className="space-y-4">
              {advice.whats_not_working.map((item, i) => (
                <div
                  key={i}
                  className="flex gap-4 p-4 rounded-xl"
                  style={{ background: 'var(--color-negative-muted)' }}
                >
                  <span className="font-mono text-lg font-bold shrink-0" style={{ color: 'var(--color-negative-text)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>{item}</p>
                </div>
              ))}
            </div>
          </div>
        </Slide>

        {/* ── Slide 4: How to Improve ────────────── */}
        <Slide index={3} onVisible={handleSlideVisible}>
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 rounded-full" style={{ background: 'var(--color-accent-blue)' }} />
              <h2 className="text-2xl font-bold" style={{ color: 'var(--color-accent-blue-text)' }}>How to Improve</h2>
            </div>

            <div className="space-y-4">
              {advice.how_to_improve.map((item, i) => (
                <div
                  key={i}
                  className="flex gap-4 p-4 rounded-xl"
                  style={{ background: 'var(--color-accent-blue-muted)' }}
                >
                  <span className="font-mono text-lg font-bold shrink-0" style={{ color: 'var(--color-accent-blue-text)' }}>
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
              ))}
            </div>
          </div>
        </Slide>

        {/* ── Slide 5: Kelly Criterion ───────────── */}
        <Slide index={4} onVisible={handleSlideVisible}>
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 rounded-full" style={{ background: 'var(--color-accent-purple)' }} />
              <h2 className="text-2xl font-bold" style={{ color: 'var(--color-accent-purple-text)' }}>Kelly Criterion</h2>
            </div>

            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Optimal position sizing based on your win rate and payoff ratio.
            </p>

            <div className="space-y-6 p-6 rounded-xl" style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-separator)' }}>
              <KellyBar
                label="Full Kelly"
                pct={advice.kelly_criterion.full_kelly_pct}
                color="var(--color-accent-purple)"
              />
              <KellyBar
                label="Half Kelly (Recommended)"
                pct={advice.kelly_criterion.half_kelly_pct}
                color="var(--color-positive)"
              />
            </div>

            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-tertiary)' }}>
              {advice.kelly_criterion.explanation}
            </p>
          </div>
        </Slide>

        {/* ── Slide 6: Bottom Line ───────────────── */}
        <Slide index={5} onVisible={handleSlideVisible}>
          <div className="space-y-8 text-center">
            <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-on-bg)' }}>Bottom Line</h2>

            <p className="text-lg leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              {advice.bottom_line}
            </p>

            <div className="flex justify-center gap-4 pt-4">
              <button onClick={downloadPdf} className="btn-primary flex items-center gap-2">
                <Download size={14} />
                Download PDF
              </button>
              <button onClick={() => loadAdvice(tone)} className="btn-secondary flex items-center gap-2">
                <RefreshCw size={14} />
                Regenerate
              </button>
            </div>
          </div>
        </Slide>
      </div>
    </div>
  )
}

// ─── Tone toggle pill ───────────────────────────────────────────

function ToneToggle({
  tone,
  onChange,
  disabled,
}: {
  tone: 'helpful' | 'roast'
  onChange: (t: 'helpful' | 'roast') => void
  disabled?: boolean
}) {
  return (
    <div
      className="inline-flex rounded-full p-1"
      style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-separator)' }}
    >
      {(['helpful', 'roast'] as const).map((t) => (
        <button
          key={t}
          onClick={() => !disabled && onChange(t)}
          disabled={disabled}
          className="px-5 py-1.5 rounded-full text-xs font-semibold transition-all"
          style={{
            background: tone === t ? (t === 'helpful' ? 'var(--color-positive)' : 'var(--color-negative)') : 'transparent',
            color: tone === t ? '#fff' : 'var(--color-text-tertiary)',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {t === 'helpful' ? 'Helpful' : 'Roast Me'}
        </button>
      ))}
    </div>
  )
}
