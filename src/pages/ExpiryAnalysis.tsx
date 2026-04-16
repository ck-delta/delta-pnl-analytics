import { useReport } from '../context/ReportContext'
import Card from '../components/Card'
import ChartWrapper, { darkTooltipStyle } from '../components/ChartWrapper'
import { formatCurrency } from '../lib/utils'
import { fmtCurrencyFull } from '../lib/chart-helpers'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts'

export default function ExpiryAnalysis() {
  const { state } = useReport()
  const e = state.report!.expiry

  if (!e.has_options) {
    return (
      <Card>
        <p className="text-sm text-center py-12" style={{ color: 'var(--color-text-tertiary)' }}>
          No options trades found. Expiry analysis is only available for options traders.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* By Expiry Type */}
      {e.by_expiry_type.length > 0 && (
        <Card title="P&L by Expiry Type">
          <ChartWrapper height={250}>
            <BarChart data={e.by_expiry_type}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="type" tick={{ fill: '#e1e1e2', fontSize: 12 }} />
              <YAxis tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: number) => formatCurrency(v)} />
              <Tooltip {...darkTooltipStyle()} formatter={fmtCurrencyFull} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {e.by_expiry_type.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? '#00a876' : '#eb5454'} />)}
              </Bar>
            </BarChart>
          </ChartWrapper>
        </Card>
      )}

      {/* By DTE */}
      {e.by_dte.length > 0 && (
        <Card title="P&L by Days to Expiry (DTE)">
          <ChartWrapper height={250}>
            <BarChart data={e.by_dte}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="bucket" tick={{ fill: '#e1e1e2', fontSize: 11 }} />
              <YAxis tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: number) => formatCurrency(v)} />
              <Tooltip {...darkTooltipStyle()} formatter={fmtCurrencyFull} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {e.by_dte.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? '#00a876' : '#eb5454'} />)}
              </Bar>
            </BarChart>
          </ChartWrapper>
        </Card>
      )}

      {/* By Expiry Date */}
      {e.by_expiry_date.length > 0 && (
        <Card title="P&L by Expiry Date">
          <ChartWrapper height={300}>
            <BarChart data={e.by_expiry_date}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="date" tick={{ fill: '#71747a', fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
              <YAxis tick={{ fill: '#71747a', fontSize: 10 }} tickFormatter={(v: number) => formatCurrency(v)} />
              <Tooltip {...darkTooltipStyle()} formatter={fmtCurrencyFull} />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                {e.by_expiry_date.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? '#00a876' : '#eb5454'} />)}
              </Bar>
            </BarChart>
          </ChartWrapper>
        </Card>
      )}
    </div>
  )
}
