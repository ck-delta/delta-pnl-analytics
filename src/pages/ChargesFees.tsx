import { useReport } from '../context/ReportContext'
import StatCard from '../components/StatCard'
import Card from '../components/Card'
import ChartWrapper, { darkTooltipStyle } from '../components/ChartWrapper'
import { formatCurrency, formatCurrencyFull, formatPercent } from '../lib/utils'
import { fmtCurrencyFull } from '../lib/chart-helpers'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts'

const COLORS = ['#fe6c02', '#3895ed', '#9276ff', '#00a876', '#eb5454', '#ffd033', '#a28467']

export default function ChargesFees() {
  const { state } = useReport()
  const c = state.report!.charges

  const makerTaker = [
    { name: 'Maker', value: c.maker_fees },
    { name: 'Taker', value: c.taker_fees },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Fees" value={formatCurrencyFull(c.total_fees)} valueColor="var(--color-negative-text)" />
        <StatCard label="Fees % of P&L" value={formatPercent(c.fees_pct_pnl)} valueColor="var(--color-warning)" />
        <StatCard label="Fees % of Volume" value={`${c.fees_pct_volume.toFixed(4)}%`} />
        <StatCard label="Maker Fill Rate" value={formatPercent(c.maker_fill_rate)} valueColor={c.maker_fill_rate >= 50 ? 'var(--color-positive-text)' : 'var(--color-text-primary)'} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard label="GST Estimate (18%)" value={formatCurrencyFull(c.gst_estimate)} valueColor="var(--color-warning)" />
        <StatCard label="Trades to Cover Fees" value={String(c.trades_to_cover_fees)} subtext="smallest winners needed" />
      </div>

      {/* Maker vs Taker */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Maker vs Taker Fees">
          <ChartWrapper height={200}>
            <PieChart>
              <Pie data={makerTaker} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4}>
                {makerTaker.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip {...darkTooltipStyle()} formatter={fmtCurrencyFull} />
            </PieChart>
          </ChartWrapper>
          <div className="flex justify-center gap-6 mt-2">
            {makerTaker.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded-sm" style={{ background: COLORS[i] }} />
                <span style={{ color: 'var(--color-text-secondary)' }}>{d.name}: {formatCurrencyFull(d.value)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Fees by Instrument">
          <ChartWrapper height={200}>
            <BarChart data={c.fees_by_instrument}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="instrument" tick={{ fill: '#e1e1e2', fontSize: 12 }} />
              <YAxis tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: number) => formatCurrency(v)} />
              <Tooltip {...darkTooltipStyle()} formatter={fmtCurrencyFull} />
              <Bar dataKey="fees" fill="#fe6c02" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartWrapper>
        </Card>
      </div>

      {/* Fees by Token */}
      {c.fees_by_token.length > 0 && (
        <Card title="Fees by Token">
          <ChartWrapper height={Math.max(200, c.fees_by_token.length * 30)}>
            <BarChart data={c.fees_by_token} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis type="number" tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: number) => formatCurrency(v)} />
              <YAxis dataKey="token" type="category" tick={{ fill: '#e1e1e2', fontSize: 11 }} width={60} />
              <Tooltip {...darkTooltipStyle()} formatter={fmtCurrencyFull} />
              <Bar dataKey="fees" fill="#fe6c02" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartWrapper>
        </Card>
      )}
    </div>
  )
}
