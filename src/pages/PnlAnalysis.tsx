import { useReport } from '../context/ReportContext'
import Card from '../components/Card'
import DataTable from '../components/DataTable'
import DailyHeatmap from '../components/DailyHeatmap'
import TimeHeatmap from '../components/TimeHeatmap'
import ChartWrapper, { darkTooltipStyle } from '../components/ChartWrapper'
import { formatCurrency, formatCurrencyFull, formatPercent, pnlColor } from '../lib/utils'
import { fmtCurrencyFull } from '../lib/chart-helpers'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ComposedChart, Line, Cell } from 'recharts'
import { createColumnHelper } from '@tanstack/react-table'
import type { MonthlyPnl } from '../types/report'

const col = createColumnHelper<MonthlyPnl>()
const monthCols = [
  col.accessor('month', { header: 'Month' }),
  col.accessor('trades', { header: 'Trades' }),
  col.accessor('gross_pnl', { header: 'Gross P&L', cell: (i) => <span className="font-mono" style={{ color: pnlColor(i.getValue()) }}>{formatCurrencyFull(i.getValue())}</span> }),
  col.accessor('fees', { header: 'Fees', cell: (i) => <span className="font-mono" style={{ color: 'var(--color-negative-text)' }}>{formatCurrencyFull(i.getValue())}</span> }),
  col.accessor('net_pnl', { header: 'Net P&L', cell: (i) => <span className="font-mono font-semibold" style={{ color: pnlColor(i.getValue()) }}>{formatCurrencyFull(i.getValue())}</span> }),
  col.accessor('win_rate', { header: 'Win Rate', cell: (i) => <span className="font-mono">{formatPercent(i.getValue())}</span> }),
  col.accessor('best', { header: 'Best', cell: (i) => <span className="font-mono" style={{ color: 'var(--color-positive-text)' }}>{formatCurrency(i.getValue())}</span> }),
  col.accessor('worst', { header: 'Worst', cell: (i) => <span className="font-mono" style={{ color: 'var(--color-negative-text)' }}>{formatCurrency(i.getValue())}</span> }),
]

export default function PnlAnalysis() {
  const { state } = useReport()
  const p = state.report!.pnl_analysis

  return (
    <div className="space-y-6">
      {/* Monthly Table */}
      <Card title="Monthly Performance">
        <DataTable data={p.monthly} columns={monthCols as any} pageSize={12} />
      </Card>

      {/* Daily P&L Heatmap */}
      <DailyHeatmap data={p.daily_pnl} />

      {/* 2D Time Heatmap */}
      {state.report!.trade_log.trades.length > 0 && (
        <TimeHeatmap trades={state.report!.trade_log.trades} />
      )}

      {/* Day of Week */}
      <Card title="P&L by Day of Week">
        <ChartWrapper height={250}>
          <BarChart data={p.day_of_week}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
            <XAxis dataKey="day" tick={{ fill: '#71747a', fontSize: 11 }} />
            <YAxis tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: number) => formatCurrency(v)} />
            <Tooltip {...darkTooltipStyle()} formatter={fmtCurrencyFull} />
            <Bar dataKey="avg_pnl" radius={[4, 4, 0, 0]}>
              {p.day_of_week.map((d, i) => (
                <Cell key={i} fill={d.avg_pnl >= 0 ? '#00a876' : '#eb5454'} />
              ))}
            </Bar>
          </BarChart>
        </ChartWrapper>
      </Card>

      {/* Hour of Day */}
      {p.hourly_pnl.length > 0 && (
        <Card title="P&L by Hour of Day (UTC)">
          <ChartWrapper height={250}>
            <BarChart data={p.hourly_pnl}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="hour" tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: number) => `${v}:00`} />
              <YAxis tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: number) => formatCurrency(v)} />
              <Tooltip {...darkTooltipStyle()} formatter={fmtCurrencyFull} />
              <Bar dataKey="avg_pnl" radius={[3, 3, 0, 0]}>
                {p.hourly_pnl.map((d, i) => (
                  <Cell key={i} fill={d.avg_pnl >= 0 ? '#00a876' : '#eb5454'} />
                ))}
              </Bar>
            </BarChart>
          </ChartWrapper>
        </Card>
      )}

      {/* Top Contributors & Detractors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Top 5 Contributors">
          <ChartWrapper height={200}>
            <BarChart data={p.top_contributors} layout="vertical">
              <XAxis type="number" tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: number) => formatCurrency(v)} />
              <YAxis dataKey="underlying" type="category" tick={{ fill: '#e1e1e2', fontSize: 11 }} width={60} />
              <Tooltip {...darkTooltipStyle()} formatter={fmtCurrencyFull} />
              <Bar dataKey="pnl" fill="#00a876" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartWrapper>
        </Card>
        <Card title="Top 5 Detractors">
          <ChartWrapper height={200}>
            <BarChart data={p.top_detractors} layout="vertical">
              <XAxis type="number" tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: number) => formatCurrency(v)} />
              <YAxis dataKey="underlying" type="category" tick={{ fill: '#e1e1e2', fontSize: 11 }} width={60} />
              <Tooltip {...darkTooltipStyle()} formatter={fmtCurrencyFull} />
              <Bar dataKey="pnl" fill="#eb5454" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartWrapper>
        </Card>
      </div>

      {/* Waterfall */}
      {p.waterfall.length > 0 && (
        <Card title="P&L Waterfall (Top 20 Underlyings)">
          <ChartWrapper height={350}>
            <ComposedChart data={p.waterfall}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="underlying" tick={{ fill: '#71747a', fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
              <YAxis tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: number) => formatCurrency(v)} />
              <Tooltip {...darkTooltipStyle()} formatter={fmtCurrencyFull} />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                {p.waterfall.map((d, i) => (
                  <Cell key={i} fill={d.pnl >= 0 ? '#00a876' : '#eb5454'} />
                ))}
              </Bar>
              <Line type="monotone" dataKey="cumulative" stroke="#3895ed" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ChartWrapper>
        </Card>
      )}
    </div>
  )
}
