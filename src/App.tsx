import { useState, useCallback } from 'react'
import { ReportProvider, useReport } from './context/ReportContext'
import AuthPage from './components/AuthPage'
import LoadingScreen, { BrandReveal } from './components/LoadingScreen'

function AppContent() {
  const { state, dispatch } = useReport()
  const [showBrandReveal, setShowBrandReveal] = useState(true)

  const handleBrandDone = useCallback(() => setShowBrandReveal(false), [])
  const handleRetry = useCallback(() => dispatch({ type: 'CLEAR' }), [dispatch])

  // Brand reveal on first load
  if (showBrandReveal) {
    return <BrandReveal onDone={handleBrandDone} />
  }

  // Loading state (fetching data from Delta)
  if (state.loading) {
    return (
      <LoadingScreen
        progress={state.loadingProgress}
        error={state.error}
        onRetry={handleRetry}
      />
    )
  }

  // Error state (after loading failed)
  if (state.error && !state.loading) {
    return (
      <LoadingScreen
        progress={state.loadingProgress}
        error={state.error}
        onRetry={handleRetry}
      />
    )
  }

  // No report loaded — show auth page
  if (!state.report) {
    return <AuthPage />
  }

  // Dashboard — will be built in Phase 3
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-bg-depth)' }}>
      {/* Sidebar placeholder */}
      <aside
        className="w-[260px] shrink-0 border-r p-5 flex flex-col"
        style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-separator)' }}
      >
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-brand)' }}>
            <span className="text-white font-bold text-sm">D</span>
          </div>
          <span className="text-sm font-bold text-white tracking-tight">Delta PnL</span>
        </div>

        <nav className="flex-1 space-y-1">
          {['Overview', 'P&L Analysis', 'Instruments', 'Funding', 'Expiry', 'Risk & Metrics', 'Charges', 'Open Portfolio', 'Trade Log', 'AI Advice'].map((name, i) => (
            <button
              key={i}
              onClick={() => dispatch({ type: 'SET_TAB', payload: i })}
              className="w-full text-left px-3 py-2 rounded text-sm transition-colors"
              style={{
                background: state.activeTab === i ? 'var(--color-brand-muted)' : 'transparent',
                color: state.activeTab === i ? 'var(--color-brand-text)' : 'var(--color-text-secondary)',
                borderLeft: state.activeTab === i ? '2px solid var(--color-brand)' : '2px solid transparent',
              }}
            >
              {name}
            </button>
          ))}
        </nav>

        <button
          onClick={handleRetry}
          className="text-xs mt-4 px-3 py-2 rounded"
          style={{ color: 'var(--color-text-tertiary)', background: 'var(--color-bg-primary)' }}
        >
          New Analysis
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Header placeholder */}
        <header
          className="sticky top-0 z-10 h-14 flex items-center px-6 border-b"
          style={{ background: 'var(--color-bg-header)', borderColor: 'var(--color-separator)' }}
        >
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Dashboard / {['Overview', 'P&L Analysis', 'Instruments', 'Funding', 'Expiry', 'Risk & Metrics', 'Charges', 'Open Portfolio', 'Trade Log', 'AI Advice'][state.activeTab]}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <span className="badge badge-brand font-mono text-xs">
              {state.report.metadata.tokens_traded} tokens
            </span>
            <span className="badge badge-positive font-mono text-xs">
              {state.report.metadata.total_trades} trades
            </span>
          </div>
        </header>

        {/* Page content - placeholder */}
        <div className="p-6">
          <div className="card">
            <div className="card-title">
              {['Overview', 'P&L Analysis', 'Instruments', 'Funding', 'Expiry', 'Risk & Metrics', 'Charges', 'Open Portfolio', 'Trade Log', 'AI Advice'][state.activeTab]}
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Dashboard pages will be built in Phase 3. Data loaded successfully with {state.report.metadata.total_trades} trades across {state.report.metadata.tokens_traded} tokens.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ReportProvider>
      <AppContent />
    </ReportProvider>
  )
}
