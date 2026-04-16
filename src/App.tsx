import { useState, useCallback, lazy, Suspense } from 'react'
import { LayoutDashboard, BarChart3, PieChart, Repeat, Clock, Activity, DollarSign, Briefcase, List, BrainCircuit, LogOut } from 'lucide-react'
import { ReportProvider, useReport } from './context/ReportContext'
import AuthPage from './components/AuthPage'
import LoadingScreen, { BrandReveal } from './components/LoadingScreen'
import { formatCurrencyFull, pnlColor } from './lib/utils'

const Overview = lazy(() => import('./pages/Overview'))
const PnlAnalysis = lazy(() => import('./pages/PnlAnalysis'))
const InstrumentAnalysis = lazy(() => import('./pages/InstrumentAnalysis'))
const FundingAnalysis = lazy(() => import('./pages/FundingAnalysis'))
const ExpiryAnalysis = lazy(() => import('./pages/ExpiryAnalysis'))
const RiskMetrics = lazy(() => import('./pages/RiskMetrics'))
const ChargesFees = lazy(() => import('./pages/ChargesFees'))
const OpenPortfolio = lazy(() => import('./pages/OpenPortfolio'))
const TradeLog = lazy(() => import('./pages/TradeLog'))
const TraderAdvice = lazy(() => import('./pages/TraderAdvice'))

const NAV_ITEMS = [
  { name: 'Overview', icon: LayoutDashboard },
  { name: 'P&L Analysis', icon: BarChart3 },
  { name: 'Instruments', icon: PieChart },
  { name: 'Funding', icon: Repeat },
  { name: 'Expiry', icon: Clock },
  { name: 'Risk & Metrics', icon: Activity },
  { name: 'Charges', icon: DollarSign },
  { name: 'Open Portfolio', icon: Briefcase },
  { name: 'Trade Log', icon: List },
  { name: 'AI Advice', icon: BrainCircuit },
]

const PAGES = [Overview, PnlAnalysis, InstrumentAnalysis, FundingAnalysis, ExpiryAnalysis, RiskMetrics, ChargesFees, OpenPortfolio, TradeLog, TraderAdvice]

function ShimmerFallback() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="shimmer h-24 rounded-xl" />)}
      </div>
      <div className="shimmer h-80 rounded-xl" />
    </div>
  )
}

function AppContent() {
  const { state, dispatch } = useReport()
  const [showBrandReveal, setShowBrandReveal] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleBrandDone = useCallback(() => setShowBrandReveal(false), [])
  const handleRetry = useCallback(() => dispatch({ type: 'CLEAR' }), [dispatch])

  if (showBrandReveal) return <BrandReveal onDone={handleBrandDone} />

  if (state.loading) {
    return <LoadingScreen progress={state.loadingProgress} error={state.error} onRetry={handleRetry} />
  }

  if (state.error && !state.loading) {
    return <LoadingScreen progress={state.loadingProgress} error={state.error} onRetry={handleRetry} />
  }

  if (!state.report) return <AuthPage />

  const ActivePage = PAGES[state.activeTab]
  const report = state.report

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-bg-depth)' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 w-[260px] h-screen shrink-0 border-r flex flex-col transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-separator)' }}
      >
        <div className="flex items-center gap-2 p-5 pb-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-brand)' }}>
            <span className="text-white font-bold text-sm">D</span>
          </div>
          <span className="text-sm font-bold text-white tracking-tight">Delta PnL</span>
        </div>

        {/* Net P&L badge */}
        <div className="px-5 py-3">
          <div className="p-3 rounded-lg" style={{ background: 'var(--color-bg-primary)' }}>
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-tertiary)' }}>Net P&L</div>
            <div className="font-mono text-lg font-bold" style={{ color: pnlColor(report.overview.net_realized_pnl) }}>
              {formatCurrencyFull(report.overview.net_realized_pnl)}
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item, i) => {
            const Icon = item.icon
            const active = state.activeTab === i
            return (
              <button
                key={i}
                onClick={() => { dispatch({ type: 'SET_TAB', payload: i }); setSidebarOpen(false) }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors"
                style={{
                  background: active ? 'var(--color-brand-muted)' : 'transparent',
                  color: active ? 'var(--color-brand-text)' : 'var(--color-text-secondary)',
                  borderLeft: active ? '2px solid var(--color-brand)' : '2px solid transparent',
                }}
              >
                <Icon size={16} />
                {item.name}
              </button>
            )
          })}
        </nav>

        <div className="p-3 border-t" style={{ borderColor: 'var(--color-separator)' }}>
          <button
            onClick={handleRetry}
            className="w-full flex items-center gap-2 px-3 py-2 rounded text-xs"
            style={{ color: 'var(--color-text-tertiary)', background: 'var(--color-bg-primary)' }}
          >
            <LogOut size={14} />
            New Analysis
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">
        <header
          className="sticky top-0 z-10 h-14 flex items-center px-4 lg:px-6 border-b"
          style={{ background: 'var(--color-bg-header)', borderColor: 'var(--color-separator)' }}
        >
          {/* Mobile hamburger */}
          <button className="lg:hidden mr-3 p-1" onClick={() => setSidebarOpen(true)} style={{ color: 'var(--color-text-secondary)' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>

          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Dashboard <span style={{ color: 'var(--color-text-quaternary)' }}>/</span> {NAV_ITEMS[state.activeTab].name}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <span className="badge badge-brand font-mono text-[10px]">
              {report.metadata.date_range.start} → {report.metadata.date_range.end}
            </span>
            <span className="badge badge-positive font-mono text-[10px]">
              {report.metadata.tokens_traded} tokens
            </span>
          </div>
        </header>

        <div className="p-4 lg:p-6">
          <Suspense fallback={<ShimmerFallback />}>
            <ActivePage />
          </Suspense>
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
