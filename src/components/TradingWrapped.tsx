import { useState, useEffect, useCallback, useRef, useMemo, type ReactElement } from 'react'
import type { DeltaReportData } from '../types/report'
import {
  YourTradingYear,
  YourIdentity,
  BestMoment,
  ToughestLesson,
  WhatsWorking,
  WhatsNotWorking,
  WhatIf,
  TokenSpotlight,
  YourEdge,
  YourGrade,
  Achievements,
  ShareAndExplore,
} from './wrapped/slides'

interface Props {
  report: DeltaReportData
  onFinish: () => void
}

const AUTO_ADVANCE_MS = 8000
const TRANSITION_MS = 300

export default function TradingWrapped({ report, onFinish }: Props) {
  const [showShareCard, setShowShareCard] = useState(false)

  // Build slide array, filtering out nulls (e.g. YourEdge if no profitable categories)
  const slides = useMemo(() => {
    const raw: Array<{ key: string; element: ReactElement | null }> = [
      { key: 'year', element: <YourTradingYear report={report} /> },
      { key: 'identity', element: <YourIdentity report={report} /> },
      { key: 'best', element: <BestMoment report={report} /> },
      { key: 'tough', element: <ToughestLesson report={report} /> },
      { key: 'working', element: <WhatsWorking report={report} /> },
      { key: 'notworking', element: <WhatsNotWorking report={report} /> },
      { key: 'whatif', element: <WhatIf report={report} /> },
      { key: 'token', element: <TokenSpotlight report={report} /> },
      { key: 'edge', element: <YourEdge report={report} /> },
      { key: 'grade', element: <YourGrade report={report} /> },
      { key: 'achievements', element: <Achievements report={report} /> },
      {
        key: 'share',
        element: (
          <ShareAndExplore
            report={report}
            onShare={() => setShowShareCard(true)}
            onExplore={onFinish}
          />
        ),
      },
    ]
    return raw.filter((s) => s.element !== null) as Array<{ key: string; element: ReactElement }>
  }, [report, onFinish])

  const totalSlides = slides.length
  const [currentSlide, setCurrentSlide] = useState(0)
  const [fadeState, setFadeState] = useState<'in' | 'out'>('in')
  const [displaySlide, setDisplaySlide] = useState(0)
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Find actual what-if index in filtered array
  const whatIfActualIndex = slides.findIndex((s) => s.key === 'whatif')

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= totalSlides) return
      if (next === currentSlide) return
      setFadeState('out')
      setTimeout(() => {
        setDisplaySlide(next)
        setCurrentSlide(next)
        setFadeState('in')
      }, TRANSITION_MS)
    },
    [currentSlide, totalSlides]
  )

  const goNext = useCallback(() => {
    if (currentSlide >= totalSlides - 1) {
      onFinish()
    } else {
      goTo(currentSlide + 1)
    }
  }, [currentSlide, totalSlides, goTo, onFinish])

  const goPrev = useCallback(() => {
    if (currentSlide > 0) goTo(currentSlide - 1)
  }, [currentSlide, goTo])

  // Auto-advance
  useEffect(() => {
    // Pause on what-if slide and last slide
    const isWhatIf = currentSlide === whatIfActualIndex
    const isLast = currentSlide === totalSlides - 1

    if (isWhatIf || isLast) {
      if (autoTimerRef.current) {
        clearInterval(autoTimerRef.current)
        autoTimerRef.current = null
      }
      return
    }

    autoTimerRef.current = setInterval(() => {
      goNext()
    }, AUTO_ADVANCE_MS)

    return () => {
      if (autoTimerRef.current) {
        clearInterval(autoTimerRef.current)
        autoTimerRef.current = null
      }
    }
  }, [currentSlide, whatIfActualIndex, totalSlides, goNext])

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        goNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goPrev()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onFinish()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goNext, goPrev, onFinish])

  // Tap zones
  function handleTap(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = x / rect.width
    if (pct < 0.3) {
      goPrev()
    } else {
      goNext()
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'var(--color-bg-depth)',
        overflow: 'hidden',
      }}
    >
      {/* Progress bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 60,
          display: 'flex',
          gap: 3,
          padding: '8px 12px',
        }}
      >
        {slides.map((s, i) => (
          <div
            key={s.key}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background:
                i < currentSlide
                  ? 'var(--color-brand)'
                  : i === currentSlide
                    ? 'var(--color-brand)'
                    : 'var(--color-bg-tertiary)',
              opacity: i <= currentSlide ? 1 : 0.4,
              transition: 'background 300ms ease, opacity 300ms ease',
            }}
          />
        ))}
      </div>

      {/* Skip button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onFinish()
        }}
        style={{
          position: 'absolute',
          top: 20,
          right: 16,
          zIndex: 60,
          background: 'rgba(255,255,255,0.08)',
          color: 'var(--color-text-tertiary)',
          border: 'none',
          borderRadius: 6,
          padding: '6px 14px',
          fontSize: '0.75rem',
          fontWeight: 600,
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
        }}
      >
        Skip
      </button>

      {/* Slide content with tap zones */}
      <div
        onClick={handleTap}
        style={{
          width: '100%',
          height: '100%',
          cursor: 'pointer',
          opacity: fadeState === 'in' ? 1 : 0,
          transition: `opacity ${TRANSITION_MS}ms ease`,
        }}
      >
        {slides[displaySlide]?.element}
      </div>

      {/* Share card overlay */}
      {showShareCard && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 70,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowShareCard(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-bg-surface)',
              borderRadius: 16,
              padding: 32,
              maxWidth: 400,
              width: '90%',
              textAlign: 'center',
              border: '1px solid var(--color-separator)',
            }}
          >
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-on-bg)', display: 'block', marginBottom: 12 }}>
              Share Your Stats
            </span>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 20 }}>
              Use the Share Card on the dashboard for a shareable image of your trading stats.
            </p>
            <button
              onClick={() => {
                setShowShareCard(false)
                onFinish()
              }}
              style={{
                background: 'var(--color-brand)',
                color: 'var(--color-text-on-bg)',
                fontWeight: 700,
                fontSize: '0.875rem',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                cursor: 'pointer',
              }}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
