import { useState } from 'react'
import { Lock, Eye, EyeOff, ExternalLink, ShieldCheck, Sparkles } from 'lucide-react'
import { useReport } from '../context/ReportContext'
import { analyzePortfolio } from '../lib/api'

export default function AuthPage() {
  const { dispatch } = useReport()
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [localError, setLocalError] = useState('')

  const canSubmit = apiKey.length >= 8 && apiSecret.length >= 8

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setLocalError('')
    dispatch({ type: 'SET_LOADING' })

    try {
      const report = await analyzePortfolio(apiKey, apiSecret, (progress) => {
        dispatch({ type: 'SET_PROGRESS', payload: progress })
      })
      dispatch({ type: 'SET_REPORT', payload: report })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed'
      setLocalError(msg)
      dispatch({ type: 'SET_ERROR', payload: msg })
    }
  }

  async function handleSampleReport() {
    setLocalError('')
    dispatch({ type: 'SET_LOADING' })

    // Simulate a brief loading sequence so the hedge-fund loading screen has a chance to play
    const steps = [
      { step: 'Loading sample data...', stepIndex: 0, totalSteps: 4, percent: 10 },
      { step: 'Matching trades...', stepIndex: 1, totalSteps: 4, percent: 40 },
      { step: 'Computing analytics...', stepIndex: 2, totalSteps: 4, percent: 70 },
      { step: 'Preparing your Wrapped...', stepIndex: 3, totalSteps: 4, percent: 95 },
    ]
    for (const p of steps) {
      dispatch({ type: 'SET_PROGRESS', payload: p })
      await new Promise((r) => setTimeout(r, 400))
    }

    try {
      const resp = await fetch('/demo-report.json')
      if (!resp.ok) throw new Error(`Sample unavailable (${resp.status})`)
      const report = await resp.json()
      dispatch({ type: 'SET_REPORT', payload: report })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load sample report'
      setLocalError(msg)
      dispatch({ type: 'SET_ERROR', payload: msg })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-bg-depth)' }}>
      <div className="w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-brand)' }}>
              <span className="text-white font-bold text-lg">D</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Delta PnL Analytics</h1>
          </div>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Connect your Delta Exchange account to analyze your trading performance
          </p>
        </div>

        {/* Auth Card */}
        <form onSubmit={handleSubmit} className="card">
          <div className="mb-5">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              API Key
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              className="input input-mono"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              API Secret
            </label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Enter your API secret"
                className="input input-mono pr-12"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {localError && (
            <div className="mb-4 p-3 rounded text-sm" style={{ background: 'var(--color-negative-muted)', color: 'var(--color-negative-text)' }}>
              {localError}
            </div>
          )}

          <button type="submit" disabled={!canSubmit} className="btn-primary w-full text-base py-3">
            Analyze My Trades
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: 'var(--color-separator)' }} />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
              No keys? Try a sample
            </span>
            <div className="flex-1 h-px" style={{ background: 'var(--color-separator)' }} />
          </div>

          {/* Sample Report Button */}
          <button
            type="button"
            onClick={handleSampleReport}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded text-sm font-semibold transition-colors"
            style={{
              background: 'var(--color-bg-secondary)',
              color: 'var(--color-brand-text)',
              border: '1px solid var(--color-brand-muted)',
            }}
          >
            <Sparkles size={14} />
            Check Sample Report
          </button>
          <p className="text-[10px] text-center mt-2" style={{ color: 'var(--color-text-tertiary)' }}>
            1,168 trades · BTC / ETH / SOL · perps + options (daily/weekly/monthly)
          </p>
        </form>

        {/* Security Notice */}
        <div className="mt-6 p-4 rounded-lg" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-separator)' }}>
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--color-positive-text)' }} />
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-positive-text)' }}>
                Your keys are never stored
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-tertiary)' }}>
                Keys are used once to fetch your data and discarded immediately. We recommend using{' '}
                <strong style={{ color: 'var(--color-text-secondary)' }}>read-only</strong> API keys.
              </p>
            </div>
          </div>
        </div>

        {/* Link to create API key */}
        <div className="mt-4 text-center">
          <a
            href="https://www.delta.exchange/app/account/manageapikeys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
            style={{ color: 'var(--color-brand-text)' }}
          >
            <Lock size={12} />
            Need an API key?
            <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </div>
  )
}
