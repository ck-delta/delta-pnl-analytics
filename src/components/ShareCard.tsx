import { useState, useRef, useCallback } from 'react'
import { toPng } from 'html-to-image'
import { Share2, Download, Copy, X, Check } from 'lucide-react'
import { formatCurrencyFull, formatPercent } from '../lib/utils'
import type { DeltaReportData } from '../types/report'

interface Props {
  report: DeltaReportData
}

function getGrade(winRate: number, profitFactor: number, sharpe: number): { letter: string; color: string } {
  let score = 0
  if (winRate >= 60) score += 3
  else if (winRate >= 50) score += 2
  else if (winRate >= 40) score += 1

  if (profitFactor >= 2) score += 3
  else if (profitFactor >= 1.5) score += 2
  else if (profitFactor >= 1) score += 1

  if (sharpe >= 2) score += 3
  else if (sharpe >= 1) score += 2
  else if (sharpe >= 0) score += 1

  if (score >= 8) return { letter: 'A', color: '#00a876' }
  if (score >= 6) return { letter: 'B', color: '#33b991' }
  if (score >= 4) return { letter: 'C', color: '#ffd033' }
  return { letter: 'D', color: '#eb5454' }
}

function getBestToken(report: DeltaReportData): string {
  const byUnderlying = report.instruments.pnl_by_underlying
  if (byUnderlying.length === 0) return 'N/A'
  const best = byUnderlying.reduce((a, b) => (a.pnl > b.pnl ? a : b))
  return best.underlying
}

export default function ShareCard({ report }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const o = report.overview
  const risk = report.risk_metrics
  const grade = getGrade(o.win_rate, risk.profit_factor, risk.sharpe_ratio)
  const bestToken = getBestToken(report)

  const generateImage = useCallback(async () => {
    if (!cardRef.current) return
    setGenerating(true)
    try {
      const dataUrl = await toPng(cardRef.current, {
        width: 1200,
        height: 675,
        pixelRatio: 2,
        backgroundColor: '#101013',
      })
      setImageUrl(dataUrl)
      setShowModal(true)
    } catch (err) {
      console.error('Failed to generate share image:', err)
    } finally {
      setGenerating(false)
    }
  }, [])

  const downloadPng = useCallback(() => {
    if (!imageUrl) return
    const link = document.createElement('a')
    link.download = `delta-pnl-${new Date().toISOString().slice(0, 10)}.png`
    link.href = imageUrl
    link.click()
  }, [imageUrl])

  const copyToClipboard = useCallback(async () => {
    if (!imageUrl) return
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }, [imageUrl])

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={generateImage}
        disabled={generating}
        className="btn-secondary flex items-center gap-2"
      >
        <Share2 size={14} />
        {generating ? 'Generating...' : 'Share Your Stats'}
      </button>

      {/* Hidden render target */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <div
          ref={cardRef}
          style={{
            width: 1200,
            height: 675,
            background: 'linear-gradient(135deg, #101013 0%, #18191e 40%, #22242c 100%)',
            fontFamily: '"Geist Variable", system-ui, sans-serif',
            padding: 60,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Orange gradient accent */}
          <div
            style={{
              position: 'absolute',
              top: -100,
              right: -100,
              width: 400,
              height: 400,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #fe6c0220 0%, transparent 70%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -60,
              left: -60,
              width: 300,
              height: 300,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #fe6c0210 0%, transparent 70%)',
            }}
          />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: '#fe6c02',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  fontWeight: 800,
                  color: '#fff',
                }}
              >
                D
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#e1e1e2' }}>Delta PnL Analytics</div>
                <div style={{ fontSize: 13, color: '#71747a', marginTop: 2 }}>
                  {report.metadata.date_range.start} - {report.metadata.date_range.end}
                </div>
              </div>
            </div>

            {/* Grade */}
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 16,
                background: `${grade.color}15`,
                border: `2px solid ${grade.color}40`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 48,
                fontWeight: 800,
                color: grade.color,
                fontFamily: '"Geist Mono Variable", monospace',
              }}
            >
              {grade.letter}
            </div>
          </div>

          {/* Metric boxes */}
          <div style={{ display: 'flex', gap: 24, marginTop: 'auto' }}>
            {[
              {
                label: 'Net P&L',
                value: formatCurrencyFull(o.net_realized_pnl),
                color: o.net_realized_pnl >= 0 ? '#33b991' : '#ff5c5c',
              },
              {
                label: 'Win Rate',
                value: formatPercent(o.win_rate),
                color: o.win_rate >= 50 ? '#33b991' : '#ff5c5c',
              },
              {
                label: 'R:R Ratio',
                value: o.win_loss_ratio.toFixed(2),
                color: o.win_loss_ratio >= 1 ? '#33b991' : '#ff5c5c',
              },
              {
                label: 'Best Token',
                value: bestToken,
                color: '#fe8935',
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  flex: 1,
                  background: '#22242c',
                  border: '1px solid #2d303a',
                  borderRadius: 12,
                  padding: '24px 20px',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8e9298', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {item.label}
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: item.color,
                    marginTop: 8,
                    fontFamily: '"Geist Mono Variable", monospace',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 }}>
            <div style={{ fontSize: 11, color: '#44464a' }}>
              {o.total_trades} trades across {o.tokens_traded} tokens
            </div>
            <div style={{ fontSize: 11, color: '#44464a' }}>
              delta.exchange
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && imageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div
            className="rounded-xl p-6 max-w-2xl w-full mx-4"
            style={{ background: 'var(--color-bg-modal)', border: '1px solid var(--color-separator-2)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-on-bg)' }}>Share Your Stats</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded transition-colors"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Preview */}
            <div className="rounded-lg overflow-hidden mb-4" style={{ border: '1px solid var(--color-separator)' }}>
              <img src={imageUrl} alt="Share card preview" className="w-full" />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={downloadPng} className="btn-primary flex items-center gap-2 flex-1 justify-center">
                <Download size={14} />
                Download PNG
              </button>
              <button onClick={copyToClipboard} className="btn-secondary flex items-center gap-2 flex-1 justify-center">
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
