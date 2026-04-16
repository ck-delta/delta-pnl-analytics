import { useState, useEffect } from 'react'
import { Check, Loader2, Circle } from 'lucide-react'
import type { LoadingProgress } from '../types/report'

const STEPS = [
  'Connecting to Delta Exchange',
  'Fetching product metadata',
  'Fetching fill history',
  'Fetching wallet transactions',
  'Fetching open positions',
  'Matching trades',
  'Computing analytics',
]

const QUOTES = [
  { text: 'The market can remain irrational longer than you can remain solvent.', author: 'John Maynard Keynes' },
  { text: 'Risk comes from not knowing what you\'re doing.', author: 'Warren Buffett' },
  { text: 'The trend is your friend until the end when it bends.', author: 'Ed Seykota' },
  { text: 'Cut your losses short and let your profits run.', author: 'David Ricardo' },
  { text: 'Markets are never wrong — opinions often are.', author: 'Jesse Livermore' },
  { text: "It's not whether you're right or wrong, but how much you make when you're right.", author: 'George Soros' },
  { text: 'The goal of a successful trader is to make the best trades. Money is secondary.', author: 'Alexander Elder' },
  { text: 'In trading, the impossible happens about twice a year.', author: 'Henri M. Simoes' },
]

interface Props {
  progress: LoadingProgress | null
  error?: string | null
  onRetry?: () => void
}

export default function LoadingScreen({ progress, error, onRetry }: Props) {
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * QUOTES.length))

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((i) => (i + 1) % QUOTES.length)
    }, 8000)
    return () => clearInterval(interval)
  }, [])

  const currentStep = progress?.stepIndex ?? 0
  const percent = progress?.percent ?? 0
  const quote = QUOTES[quoteIndex]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'var(--color-bg-depth)' }}>
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle, var(--color-text-quaternary) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative z-10 w-full max-w-lg px-6">
        {/* Title */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-1">DELTA PnL ANALYTICS</h1>
          <div className="h-0.5 w-20 mx-auto rounded-full" style={{ background: 'var(--color-brand)' }} />
        </div>

        {error ? (
          /* Error State */
          <div className="text-center">
            <div className="mb-4 p-4 rounded-lg" style={{ background: 'var(--color-negative-muted)', border: '1px solid var(--color-negative)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--color-negative-text)' }}>{error}</p>
            </div>
            {onRetry && (
              <button onClick={onRetry} className="btn-primary">Try Again</button>
            )}
          </div>
        ) : (
          <>
            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  {progress?.step ?? 'Initializing...'}
                </span>
                <span className="font-mono text-sm font-semibold" style={{ color: 'var(--color-brand-text)' }}>
                  {Math.round(percent)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-secondary)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${percent}%`,
                    background: `linear-gradient(90deg, var(--color-brand), var(--color-brand-hover))`,
                  }}
                />
              </div>
              {progress?.detail && (
                <p className="mt-2 text-xs font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
                  {progress.detail}
                </p>
              )}
            </div>

            {/* Step Checklist */}
            <div className="p-4 rounded-lg mb-8" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-separator)' }}>
              {STEPS.map((step, i) => (
                <div key={i} className="flex items-center gap-3 py-1.5">
                  {i < currentStep ? (
                    <Check size={14} style={{ color: 'var(--color-positive-text)' }} />
                  ) : i === currentStep ? (
                    <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-brand)' }} />
                  ) : (
                    <Circle size={14} style={{ color: 'var(--color-text-quaternary)' }} />
                  )}
                  <span
                    className="text-sm"
                    style={{
                      color: i < currentStep
                        ? 'var(--color-positive-text)'
                        : i === currentStep
                          ? 'var(--color-text-primary)'
                          : 'var(--color-text-quaternary)',
                    }}
                  >
                    {step}
                  </span>
                </div>
              ))}
            </div>

            {/* Quote */}
            <div className="text-center">
              <p className="text-sm italic leading-relaxed" style={{ color: 'var(--color-text-tertiary)' }}>
                "{quote.text}"
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-quaternary)' }}>
                — {quote.author}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Brief brand reveal animation on app load */
export function BrandReveal({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 100)
    const t2 = setTimeout(() => setPhase(2), 1200)
    const t3 = setTimeout(() => onDone(), 2500)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: 'var(--color-bg-depth)' }}>
      <h1
        className="text-4xl font-bold tracking-tight transition-all duration-700"
        style={{
          color: 'var(--color-text-on-bg)',
          opacity: phase >= 1 ? 1 : 0,
          transform: phase >= 1 ? 'translateY(0)' : 'translateY(12px)',
        }}
      >
        DELTA <span style={{ color: 'var(--color-brand)' }}>PnL</span> ANALYTICS
      </h1>
      <div
        className="h-0.5 mt-3 rounded-full transition-all duration-700 delay-300"
        style={{
          background: 'var(--color-brand)',
          width: phase >= 1 ? '120px' : '0px',
        }}
      />
      <p
        className="mt-4 text-xs font-mono transition-all duration-500"
        style={{
          color: 'var(--color-text-tertiary)',
          opacity: phase >= 2 ? 1 : 0,
        }}
      >
        Initializing analytics engine...
      </p>
    </div>
  )
}
