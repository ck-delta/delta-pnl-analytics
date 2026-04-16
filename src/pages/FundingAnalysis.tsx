import { useReport } from '../context/ReportContext'
import StatCard from '../components/StatCard'
import Card from '../components/Card'
import ChartWrapper, { darkTooltipStyle } from '../components/ChartWrapper'
import { formatCurrency, formatCurrencyFull, pnlColor } from '../lib/utils'
import { fmtCurrencyFull } from '../lib/chart-helpers'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area, Cell } from 'recharts'

export default function FundingAnalysis() {
  const { state } = useReport()
  const f = state.report!.funding

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Funding P&L" value={formatCurrencyFull(f.total_funding_pnl)} valueColor={pnlColor(f.total_funding_pnl)} />
        <StatCard label="Paid as Long" value={formatCurrencyFull(f.funding_paid_as_long)} valueColor="var(--color-negative-text)" />
        <StatCard label="Received as Short" value={formatCurrencyFull(f.funding_received_as_short)} valueColor="var(--color-positive-text)" />
      </div>

      {/* Funding by Token */}
      {f.funding_by_token.length > 0 && (
        <Card title="Funding P&L by Token">
          <ChartWrapper height={Math.max(200, f.funding_by_token.length * 32)}>
            <BarChart data={f.funding_by_token} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis type="number" tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: number) => formatCurrency(v)} />
              <YAxis dataKey="token" type="category" tick={{ fill: '#e1e1e2', fontSize: 11 }} width={60} />
              <Tooltip {...darkTooltipStyle()} formatter={fmtCurrencyFull} />
              <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                {f.funding_by_token.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? '#00a876' : '#eb5454'} />)}
              </Bar>
            </BarChart>
          </ChartWrapper>
        </Card>
      )}

      {/* Cumulative Funding Curve */}
      {f.cumulative_funding.length > 0 && (
        <Card title="Cumulative Funding P&L">
          <ChartWrapper height={300}>
            <AreaChart data={f.cumulative_funding}>
              <defs>
                <linearGradient id="fundGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f6a609" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#f6a609" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="date" tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: number) => formatCurrency(v)} />
              <Tooltip {...darkTooltipStyle()} formatter={fmtCurrencyFull} />
              <Area type="monotone" dataKey="cumulative" stroke="#f6a609" fill="url(#fundGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ChartWrapper>
        </Card>
      )}

      {/* Monthly Funding vs Trading */}
      {f.monthly_funding_vs_trading.length > 0 && (
        <Card title="Monthly: Trading P&L vs Funding P&L">
          <ChartWrapper height={300}>
            <BarChart data={f.monthly_funding_vs_trading}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="month" tick={{ fill: '#71747a', fontSize: 10 }} />
              <YAxis tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: number) => formatCurrency(v)} />
              <Tooltip {...darkTooltipStyle()} formatter={fmtCurrencyFull} />
              <Bar dataKey="trading_pnl" name="Trading" fill="#00a876" radius={[3, 3, 0, 0]} />
              <Bar dataKey="funding_pnl" name="Funding" fill="#f6a609" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartWrapper>
        </Card>
      )}

      {f.funding_by_token.length === 0 && (
        <Card>
          <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-tertiary)' }}>
            No funding rate data found. Funding analysis requires perpetual futures positions.
          </p>
        </Card>
      )}
    </div>
  )
}
