import { useReport } from '../context/ReportContext'
import StatCard from '../components/StatCard'
import Card from '../components/Card'
import ChartWrapper, { darkTooltipStyle } from '../components/ChartWrapper'
import { formatCurrency, formatPercent, pnlColor } from '../lib/utils'
import { fmtCurrencyFull, fmtPercent } from '../lib/chart-helpers'
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell, ScatterChart, Scatter, ZAxis } from 'recharts'

export default function RiskMetrics() {
  const { state } = useReport()
  const r = state.report!.risk_metrics

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Sharpe Ratio" value={r.sharpe_ratio.toFixed(2)} valueColor={r.sharpe_ratio >= 1 ? 'var(--color-positive-text)' : r.sharpe_ratio >= 0 ? 'var(--color-warning)' : 'var(--color-negative-text)'} subtext="365-day annualized" />
        <StatCard label="Sortino Ratio" value={r.sortino_ratio.toFixed(2)} valueColor={r.sortino_ratio >= 1.5 ? 'var(--color-positive-text)' : 'var(--color-text-primary)'} />
        <StatCard label="Profit Factor" value={r.profit_factor.toFixed(2)} valueColor={r.profit_factor >= 1.5 ? 'var(--color-positive-text)' : r.profit_factor >= 1 ? 'var(--color-warning)' : 'var(--color-negative-text)'} />
        <StatCard label="Max Drawdown" value={formatPercent(r.max_drawdown)} valueColor="var(--color-negative-text)" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Payoff Ratio" value={r.payoff_ratio.toFixed(2)} subtext="avg win / avg loss" />
        <StatCard label="Calmar Ratio" value={r.calmar_ratio.toFixed(2)} />
        <StatCard label="Expectancy" value={formatCurrency(r.expectancy)} valueColor={pnlColor(r.expectancy)} subtext="per trade" />
        <StatCard label="Recovery Factor" value={r.recovery_factor.toFixed(2)} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Daily Std Dev" value={formatCurrency(r.daily_std_dev)} />
        <StatCard label="Best Win Streak" value={`${r.consecutive_wins} days`} valueColor="var(--color-positive-text)" />
        <StatCard label="Worst Loss Streak" value={`${r.consecutive_losses} days`} valueColor="var(--color-negative-text)" />
        <StatCard label="Max DD Duration" value={`${r.max_drawdown_duration_days}d`} />
      </div>

      {/* Equity Curve */}
      {r.equity_curve.length > 0 && (
        <Card title="Equity Curve">
          <ChartWrapper height={350}>
            <AreaChart data={r.equity_curve}>
              <defs>
                <linearGradient id="riskEqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00a876" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#00a876" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="date" tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: number) => formatCurrency(v)} />
              <Tooltip {...darkTooltipStyle()} formatter={fmtCurrencyFull} />
              <Area type="monotone" dataKey="cumulative" stroke="#00a876" fill="url(#riskEqGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ChartWrapper>
        </Card>
      )}

      {/* Drawdown */}
      {r.drawdown_curve.length > 0 && (
        <Card title="Drawdown">
          <ChartWrapper height={200}>
            <AreaChart data={r.drawdown_curve}>
              <defs>
                <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#eb5454" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#eb5454" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="date" tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
              <Tooltip {...darkTooltipStyle()} formatter={fmtPercent} />
              <Area type="monotone" dataKey="drawdown" stroke="#eb5454" fill="url(#ddGrad)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ChartWrapper>
        </Card>
      )}

      {/* P&L Distribution */}
      {r.pnl_distribution.length > 0 && (
        <Card title="P&L Distribution">
          <ChartWrapper height={250}>
            <BarChart data={r.pnl_distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="range" tick={{ fill: '#71747a', fontSize: 8 }} angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fill: '#71747a', fontSize: 10 }} />
              <Tooltip {...darkTooltipStyle()} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {r.pnl_distribution.map((d, i) => <Cell key={i} fill={d.min >= 0 ? '#00a876' : '#eb5454'} />)}
              </Bar>
            </BarChart>
          </ChartWrapper>
        </Card>
      )}

      {/* Risk-Reward Scatter */}
      {r.risk_reward_scatter.length > 0 && (
        <Card title="Risk-Reward Scatter">
          <ChartWrapper height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="capital" name="Capital" tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: number) => formatCurrency(v)} />
              <YAxis dataKey="return_pct" name="Return %" tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
              <ZAxis range={[30, 150]} />
              <Tooltip {...darkTooltipStyle()} formatter={fmtCurrencyFull} />
              <Scatter data={r.risk_reward_scatter}>
                {r.risk_reward_scatter.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? '#00a87680' : '#eb545480'} />)}
              </Scatter>
            </ScatterChart>
          </ChartWrapper>
        </Card>
      )}
    </div>
  )
}
