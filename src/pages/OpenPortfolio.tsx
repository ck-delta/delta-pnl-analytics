import { useReport } from '../context/ReportContext'
import StatCard from '../components/StatCard'
import Card from '../components/Card'
import DataTable from '../components/DataTable'
import ChartWrapper, { darkTooltipStyle } from '../components/ChartWrapper'
import { formatCurrency, formatCurrencyFull, pnlColor } from '../lib/utils'
import { fmtCurrencyFull } from '../lib/chart-helpers'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { createColumnHelper } from '@tanstack/react-table'
import type { OpenPosition } from '../types/report'

const COLORS = ['#fe6c02', '#3895ed', '#9276ff', '#00a876', '#eb5454', '#ffd033', '#a28467', '#ff5c5c', '#58a7f0', '#33b991']

const col = createColumnHelper<OpenPosition>()
const posCols = [
  col.accessor('symbol', { header: 'Symbol', cell: (i) => <span className="font-mono text-xs">{i.getValue()}</span> }),
  col.accessor('underlying', { header: 'Underlying' }),
  col.accessor('direction', { header: 'Dir', cell: (i) => <span className={i.getValue() === 'long' ? 'text-[var(--color-positive-text)]' : 'text-[var(--color-negative-text)]'}>{i.getValue().toUpperCase()}</span> }),
  col.accessor('size', { header: 'Size' }),
  col.accessor('entry_price', { header: 'Entry', cell: (i) => <span className="font-mono">{formatCurrencyFull(i.getValue())}</span> }),
  col.accessor('unrealized_pnl', { header: 'Unrealized P&L', cell: (i) => <span className="font-mono font-semibold" style={{ color: pnlColor(i.getValue()) }}>{formatCurrencyFull(i.getValue())}</span> }),
  col.accessor('margin', { header: 'Margin', cell: (i) => <span className="font-mono">{formatCurrency(i.getValue())}</span> }),
  col.accessor('liquidation_price', { header: 'Liq. Price', cell: (i) => <span className="font-mono">{i.getValue() ? formatCurrencyFull(i.getValue()) : '—'}</span> }),
  col.accessor('realized_funding', { header: 'Funding', cell: (i) => <span className="font-mono" style={{ color: pnlColor(i.getValue()) }}>{formatCurrency(i.getValue())}</span> }),
]

export default function OpenPortfolio() {
  const { state } = useReport()
  const op = state.report!.open_portfolio

  if (op.open_count === 0) {
    return (
      <Card>
        <p className="text-sm text-center py-12" style={{ color: 'var(--color-text-tertiary)' }}>
          No open positions found.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Open Positions" value={String(op.open_count)} />
        <StatCard label="Total Unrealized" value={formatCurrencyFull(op.total_unrealized_pnl)} valueColor={pnlColor(op.total_unrealized_pnl)} />
        <StatCard label="Max Profit" value={formatCurrencyFull(op.max_profit)} valueColor="var(--color-positive-text)" />
        <StatCard label="Max Loss" value={formatCurrencyFull(op.max_loss)} valueColor="var(--color-negative-text)" />
      </div>

      {/* Unrealized by position */}
      {op.unrealized_by_position.length > 0 && (
        <Card title="Unrealized P&L by Position">
          <ChartWrapper height={Math.max(200, op.unrealized_by_position.length * 30)}>
            <BarChart data={op.unrealized_by_position} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis type="number" tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: number) => formatCurrency(v)} />
              <YAxis dataKey="symbol" type="category" tick={{ fill: '#e1e1e2', fontSize: 9 }} width={80} />
              <Tooltip {...darkTooltipStyle()} formatter={fmtCurrencyFull} />
              <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                {op.unrealized_by_position.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? '#00a876' : '#eb5454'} />)}
              </Bar>
            </BarChart>
          </ChartWrapper>
        </Card>
      )}

      {/* Concentration */}
      {op.concentration.length > 0 && (
        <Card title="Portfolio Concentration">
          <ChartWrapper height={250}>
            <PieChart>
              <Pie data={op.concentration} dataKey="value" nameKey="underlying" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3}>
                {op.concentration.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip {...darkTooltipStyle()} />
            </PieChart>
          </ChartWrapper>
        </Card>
      )}

      {/* Positions Table */}
      <Card title="Open Positions">
        <DataTable data={op.positions} columns={posCols as any} pageSize={50} />
      </Card>
    </div>
  )
}
