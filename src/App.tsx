import { useState, useCallback, lazy, Suspense } from 'react'
import {
  LayoutDashboard, BarChart3, PieChart, Repeat, Clock, Activity,
  DollarSign, Briefcase, List, BrainCircuit, LogOut, Sparkles,
} from 'lucide-react'
import { ReportProvider, useReport, type TopTab } from './context/ReportContext'
import AuthPage from './components/AuthPage'
import LoadingScreen, { BrandReveal } from './components/LoadingScreen'
import TradingWrapped from './components/TradingWrapped'
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

const DASHBOARD_TABS = [
  { name: 'Overview', icon: LayoutDashboard },
  { name: 'P&L Analysis', icon: BarChart3 },
  { name: 'Instruments', icon: PieChart },
  { name: 'Funding', icon: Repeat },
  { name: 'Expiry', icon: Clock },
  { name: 'Risk & Metrics', icon: Activity },
  { name: 'Charges', icon: DollarSign },
  { name: 'Open Portfolio', icon: Briefcase },
]

const DASHBOARD_PAGES = [Overview, PnlAnalysis, InstrumentAnalysis, FundingAnalysis, ExpiryAnalysis, RiskMetrics, ChargesFees, OpenPortfolio]

const TOP_TABS: { key: TopTab; label: string; icon: typeof BrainCircuit }[] = [
  { key: 'advice', label: 'AI Advice', icon: Sparkles },
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'tradelog', label: 'Trade Log', icon: List },
]

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
  const handleWrappedFinish = useCallback(() => {
    dispatch({ type: 'SET_VIEW_MODE', payload: 'dashboard' })
  }, [dispatch])

  if (showBrandReveal) return <BrandReveal onDone={handleBrandDone} />
  if (state.loading) return <LoadingScreen progress={state.loadingProgress} error={state.error} onRetry={handleRetry} />
  if (state.error && !state.loading) return <LoadingScreen progress={state.loadingProgress} error={state.error} onRetry={handleRetry} />
  if (!state.report) return <AuthPage />

  // Wrapped mode — full-screen story experience
  if (state.viewMode === 'wrapped') {
    return <TradingWrapped report={state.report} onFinish={handleWrappedFinish} />
  }

  // Dashboard mode
  const report = state.report

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--color-bg-depth)' }}>
      {/* Top Navigation Bar */}
      <header
        className="sticky top-0 z-20 flex items-center border-b"
        style={{ background: 'var(--color-bg-header)', borderColor: 'var(--color-separator)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-5 py-3 border-r" style={{ borderColor: 'var(--color-separator)' }}>
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'var(--color-brand)' }}>
            <span className="text-white font-bold text-xs">D</span>
          </div>
          <span className="text-sm font-bold text-white tracking-tight hidden sm:inline">Delta PnL</span>
        </div>

        {/* Top Tabs */}
        <nav className="flex items-center gap-1 px-4">
          {TOP_TABS.map((tab) => {
            const Icon = tab.icon
            const active = state.topTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => dispatch({ type: 'SET_TOP_TAB', payload: tab.key })}
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2"
                style={{
                  color: active ? 'var(--color-brand-text)' : 'var(--color-text-secondary)',
                  borderColor: active ? 'var(--color-brand)' : 'transparent',
                }}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Right side: badges + actions */}
        <div className="ml-auto flex items-center gap-2 px-4">
          <span className="badge badge-brand font-mono text-[10px] hidden md:inline-flex">
            {report.metadata.date_range.start} → {report.metadata.date_range.end}
          </span>
          <span className="badge badge-positive font-mono text-[10px]">
            {report.metadata.tokens_traded} tokens
          </span>
          <button
            onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'wrapped' })}
            className="text-xs px-2 py-1 rounded"
            style={{ color: 'var(--color-brand-text)', background: 'var(--color-brand-muted)' }}
            title="Replay Wrapped"
          >
            <Sparkles size={13} />
          </button>
          <button
            onClick={handleRetry}
            className="text-xs p-1 rounded"
            style={{ color: 'var(--color-text-tertiary)' }}
            title="New Analysis"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex flex-1">
        {/* Sidebar (only for Dashboard top-tab) */}
        {state.topTab === 'dashboard' && (
          <>
            {sidebarOpen && (
              <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
            )}
            <aside
              className={`fixed lg:sticky top-[53px] left-0 z-40 w-[220px] h-[calc(100vh-53px)] shrink-0 border-r flex flex-col transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
              style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-separator)' }}
            >
              {/* Net P&L badge */}
              <div className="px-4 py-3">
                <div className="p-3 rounded-lg" style={{ background: 'var(--color-bg-primary)' }}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-tertiary)' }}>Net P&L</div>
                  <div className="font-mono text-lg font-bold" style={{ color: pnlColor(report.overview.net_realized_pnl) }}>
                    {formatCurrencyFull(report.overview.net_realized_pnl)}
                  </div>
                </div>
              </div>

              <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
                {DASHBOARD_TABS.map((item, i) => {
                  const Icon = item.icon
                  const active = state.activeTab === i
                  return (
                    <button
                      key={i}
                      onClick={() => { dispatch({ type: 'SET_TAB', payload: i }); setSidebarOpen(false) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors"
                      style={{
                        background: active ? 'var(--color-brand-muted)' : 'transparent',
                        color: active ? 'var(--color-brand-text)' : 'var(--color-text-secondary)',
                        borderLeft: active ? '2px solid var(--color-brand)' : '2px solid transparent',
                      }}
                    >
                      <Icon size={15} />
                      {item.name}
                    </button>
                  )
                })}
              </nav>
            </aside>
          </>
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-auto">
          {/* Mobile hamburger for dashboard */}
          {state.topTab === 'dashboard' && (
            <div className="lg:hidden p-2 border-b" style={{ borderColor: 'var(--color-separator)' }}>
              <button onClick={() => setSidebarOpen(true)} className="p-2 rounded" style={{ color: 'var(--color-text-secondary)' }}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M3 5h14M3 10h14M3 15h14" />
                </svg>
              </button>
              <span className="text-xs ml-2" style={{ color: 'var(--color-text-tertiary)' }}>
                {DASHBOARD_TABS[state.activeTab]?.name}
              </span>
            </div>
          )}

          <div className="p-4 lg:p-6">
            <Suspense fallback={<ShimmerFallback />}>
              {state.topTab === 'advice' && <TraderAdvice />}
              {state.topTab === 'dashboard' && (() => {
                const ActivePage = DASHBOARD_PAGES[state.activeTab]
                return ActivePage ? <ActivePage /> : null
              })()}
              {state.topTab === 'tradelog' && <TradeLog />}
            </Suspense>
          </div>
        </main>
      </div>
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
