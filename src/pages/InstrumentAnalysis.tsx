import { useMemo } from 'react'
import { useReport } from '../context/ReportContext'
import StatCard from '../components/StatCard'
import Card from '../components/Card'
import DataTable from '../components/DataTable'
import ChartWrapper, { darkTooltipStyle } from '../components/ChartWrapper'
import TokenSpotlight from '../components/TokenSpotlight'
import { formatCurrency, formatCurrencyFull, formatPercent, pnlColor } from '../lib/utils'
import { fmtCurrencyFull } from '../lib/chart-helpers'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ScatterChart, Scatter, ZAxis, Cell } from 'recharts'
import { createColumnHelper } from '@tanstack/react-table'
import type { UnderlyingPnl, MatchedTrade } from '../types/report'

const col = createColumnHelper<UnderlyingPnl>()
const undCols = [
  col.accessor('underlying', { header: 'Underlying' }),
  col.accessor('num_trades', { header: 'Trades' }),
  col.accessor('pnl', { header: 'P&L', cell: (i) => <span className="font-mono font-semibold" style={{ color: pnlColor(i.getValue()) }}>{formatCurrencyFull(i.getValue())}</span> }),
  col.accessor('win_rate', { header: 'Win Rate', cell: (i) => <span className="font-mono">{formatPercent(i.getValue())}</span> }),
  col.accessor('avg_return', { header: 'Avg Return', cell: (i) => <span className="font-mono" style={{ color: pnlColor(i.getValue()) }}>{formatPercent(i.getValue())}</span> }),
  col.accessor('capital', { header: 'Capital', cell: (i) => <span className="font-mono">{formatCurrency(i.getValue())}</span> }),
]

export default function InstrumentAnalysis() {
  const { state } = useReport()
  const ins = state.report!.instruments
  const trades = state.report!.trade_log.trades

  // Group trades by underlying, sorted by trade count desc, top 4
  const tokenSpotlights = useMemo(() => {
    const grouped = new Map<string, MatchedTrade[]>()
    for (const trade of trades) {
      const existing = grouped.get(trade.underlying)
      if (existing) {
        existing.push(trade)
      } else {
        grouped.set(trade.underlying, [trade])
      }
    }

    return Array.from(grouped.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 4)
  }, [trades])

  const comparison = [
    { name: 'Perps', pnl: ins.perps_pnl, count: ins.perps_count },
    { name: 'Options', pnl: ins.options_pnl, count: ins.options_count },
  ]
  const callsPuts = [
    { name: 'Calls', pnl: ins.calls_pnl, count: ins.calls_count },
    { name: 'Puts', pnl: ins.puts_pnl, count: ins.puts_count },
  ]

  return (
    <div className="space-y-6">
      {/* Token Spotlights */}
      {tokenSpotlights.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Top Tokens
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {tokenSpotlights.map(([underlying, tokenTrades]) => (
              <TokenSpotlight key={underlying} underlying={underlying} trades={tokenTrades} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Perps P&L" value={formatCurrency(ins.perps_pnl)} valueColor={pnlColor(ins.perps_pnl)} subtext={`${ins.perps_count} trades`} />
        <StatCard label="Options P&L" value={formatCurrency(ins.options_pnl)} valueColor={pnlColor(ins.options_pnl)} subtext={`${ins.options_count} trades`} />
        <StatCard label="Calls P&L" value={formatCurrency(ins.calls_pnl)} valueColor={pnlColor(ins.calls_pnl)} subtext={`${ins.calls_count} trades`} />
        <StatCard label="Puts P&L" value={formatCurrency(ins.puts_pnl)} valueColor={pnlColor(ins.puts_pnl)} subtext={`${ins.puts_count} trades`} />
        <StatCard label="Total" value={formatCurrency(ins.perps_pnl + ins.options_pnl)} valueColor={pnlColor(ins.perps_pnl + ins.options_pnl)} />
      </div>

      {/* Perps vs Options */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Perps vs Options">
          <ChartWrapper height={200}>
            <BarChart data={comparison}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="name" tick={{ fill: '#e1e1e2', fontSize: 12 }} />
              <YAxis tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: number) => formatCurrency(v)} />
              <Tooltip {...darkTooltipStyle()} formatter={fmtCurrencyFull} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {comparison.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? '#00a876' : '#eb5454'} />)}
              </Bar>
            </BarChart>
          </ChartWrapper>
        </Card>
        <Card title="Calls vs Puts">
          <ChartWrapper height={200}>
            <BarChart data={callsPuts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="name" tick={{ fill: '#e1e1e2', fontSize: 12 }} />
              <YAxis tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: number) => formatCurrency(v)} />
              <Tooltip {...darkTooltipStyle()} formatter={fmtCurrencyFull} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {callsPuts.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? '#00a876' : '#eb5454'} />)}
              </Bar>
            </BarChart>
          </ChartWrapper>
        </Card>
      </div>

      {/* P&L by Underlying table */}
      <Card title="P&L by Underlying">
        <DataTable data={ins.pnl_by_underlying} columns={undCols as any} />
      </Card>

      {/* Capital vs Returns scatter */}
      {ins.capital_vs_returns.length > 0 && (
        <Card title="Capital Deployed vs Returns">
          <ChartWrapper height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="capital" name="Capital" tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: number) => formatCurrency(v)} />
              <YAxis dataKey="return_pct" name="Return %" tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
              <ZAxis range={[40, 200]} />
              <Tooltip {...darkTooltipStyle()} formatter={fmtCurrencyFull} />
              <Scatter data={ins.capital_vs_returns}>
                {ins.capital_vs_returns.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? '#00a876' : '#eb5454'} />)}
              </Scatter>
            </ScatterChart>
          </ChartWrapper>
        </Card>
      )}
    </div>
  )
}
