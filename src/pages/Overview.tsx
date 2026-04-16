import { useReport } from '../context/ReportContext'
import StatCard from '../components/StatCard'
import Card from '../components/Card'
import ChartWrapper, { darkTooltipStyle } from '../components/ChartWrapper'
import GoalSetting from '../components/GoalSetting'
import { formatCurrency, formatCurrencyFull, formatPercent, pnlColor } from '../lib/utils'
import { fmtCurrencyFull } from '../lib/chart-helpers'
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

export default function Overview() {
  const { state } = useReport()
  const report = state.report!
  const o = report.overview
  const proj = report.projections

  return (
    <div className="space-y-6">
      {/* Hero KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Net Realized P&L" value={formatCurrencyFull(o.net_realized_pnl)} valueColor={pnlColor(o.net_realized_pnl)} />
        <StatCard label="Unrealized P&L" value={formatCurrencyFull(o.unrealized_pnl)} valueColor={pnlColor(o.unrealized_pnl)} />
        <StatCard label="Total Fees" value={formatCurrencyFull(o.total_fees)} valueColor="var(--color-negative-text)" />
        <StatCard label="Funding P&L" value={formatCurrencyFull(o.total_funding_pnl)} valueColor={pnlColor(o.total_funding_pnl)} />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Win Rate" value={formatPercent(o.win_rate)} valueColor={o.win_rate >= 50 ? 'var(--color-positive-text)' : 'var(--color-negative-text)'} />
        <StatCard label="Total Trades" value={String(o.total_trades)} subtext={`${o.tokens_traded} tokens`} />
        <StatCard label="Avg Winner" value={formatCurrency(o.avg_winner)} valueColor="var(--color-positive-text)" />
        <StatCard label="Avg Loser" value={formatCurrency(o.avg_loser)} valueColor="var(--color-negative-text)" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Winners" value={String(o.winners)} valueColor="var(--color-positive-text)" />
        <StatCard label="Losers" value={String(o.losers)} valueColor="var(--color-negative-text)" />
        <StatCard label="Win/Loss Ratio" value={o.win_loss_ratio.toFixed(2)} subtext="avg win / avg loss" />
      </div>

      {/* Quick Insights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="Best Trade"><p className="font-mono text-lg font-bold" style={{ color: 'var(--color-positive-text)' }}>{formatCurrencyFull(o.best_trade)}</p></Card>
        <Card title="Worst Trade"><p className="font-mono text-lg font-bold" style={{ color: 'var(--color-negative-text)' }}>{formatCurrencyFull(o.worst_trade)}</p></Card>
        <Card title="Long P&L"><p className="font-mono text-lg font-bold" style={{ color: pnlColor(o.long_pnl) }}>{formatCurrencyFull(o.long_pnl)}</p></Card>
        <Card title="Short P&L"><p className="font-mono text-lg font-bold" style={{ color: pnlColor(o.short_pnl) }}>{formatCurrencyFull(o.short_pnl)}</p></Card>
      </div>

      {/* Equity Curve */}
      {o.equity_curve.length > 0 && (
        <Card title="Equity Curve">
          <ChartWrapper height={350}>
            <AreaChart data={o.equity_curve}>
              <defs>
                <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00a876" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#00a876" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="date" tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: string) => v.slice(5, 10)} />
              <YAxis tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: number) => formatCurrency(v)} />
              <Tooltip {...darkTooltipStyle()} formatter={fmtCurrencyFull} />
              <Area type="monotone" dataKey="cumulative" stroke="#00a876" fill="url(#eqGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ChartWrapper>
        </Card>
      )}

      {/* Perps vs Options */}
      <div className="grid grid-cols-2 gap-4">
        <Card title="Perps P&L"><p className="font-mono text-xl font-bold" style={{ color: pnlColor(o.perps_pnl) }}>{formatCurrencyFull(o.perps_pnl)}</p></Card>
        <Card title="Options P&L"><p className="font-mono text-xl font-bold" style={{ color: pnlColor(o.options_pnl) }}>{formatCurrencyFull(o.options_pnl)}</p></Card>
      </div>

      {/* APR/APY Projections */}
      {proj.overall && (
        <Card title="Future Projections">
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>If you continue trading at your current pace</p>
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Daily return:</span>
            <span className="font-mono font-bold" style={{ color: 'var(--color-positive-text)' }}>{formatPercent(proj.overall.daily_return_pct)}</span>
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>APR:</span>
            <span className="font-mono font-bold" style={{ color: 'var(--color-positive-text)' }}>{formatPercent(proj.overall.apr)}</span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {([
              ['1 Year', proj.overall.value_1yr, proj.overall.apy_1yr],
              ['3 Years', proj.overall.value_3yr, proj.overall.apy_5yr],
              ['5 Years', proj.overall.value_5yr, proj.overall.apy_5yr],
              ['10 Years', proj.overall.value_10yr, proj.overall.apy_10yr],
            ] as [string, number, number][]).map(([label, val, pct]) => (
              <div key={label} className="text-center p-3 rounded-lg" style={{ background: 'var(--color-bg-surface-alt)' }}>
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>{label}</div>
                <div className="font-mono font-bold text-sm" style={{ color: 'var(--color-positive-text)' }}>{formatCurrency(val)}</div>
                <div className="font-mono text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>+{pct.toFixed(0)}%</div>
              </div>
            ))}
          </div>
          <p className="text-[10px] mt-3" style={{ color: 'var(--color-text-quaternary)' }}>
            Projections assume consistent performance. Past results don't guarantee future returns.
          </p>
        </Card>
      )}

      {/* Monthly P&L Goal */}
      <GoalSetting />
    </div>
  )
}
