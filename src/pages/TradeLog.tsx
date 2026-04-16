import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { useReport } from '../context/ReportContext'
import Card from '../components/Card'
import DataTable from '../components/DataTable'
import { formatCurrencyFull, formatPercent, formatDuration, pnlColor } from '../lib/utils'
import { createColumnHelper } from '@tanstack/react-table'
import type { MatchedTrade } from '../types/report'

const col = createColumnHelper<MatchedTrade>()
const tradeCols = [
  col.accessor('underlying', { header: 'Underlying' }),
  col.accessor('instrument_type', { header: 'Type', cell: (i) => <span className="badge badge-brand text-[10px]">{i.getValue().toUpperCase()}</span> }),
  col.accessor('direction', { header: 'Dir', cell: (i) => <span style={{ color: i.getValue() === 'long' ? 'var(--color-positive-text)' : 'var(--color-negative-text)' }}>{i.getValue().toUpperCase()}</span> }),
  col.accessor('entry_time', { header: 'Entry', cell: (i) => <span className="text-xs">{i.getValue().slice(0, 16).replace('T', ' ')}</span> }),
  col.accessor('exit_time', { header: 'Exit', cell: (i) => <span className="text-xs">{i.getValue().slice(0, 16).replace('T', ' ')}</span> }),
  col.accessor('size', { header: 'Size', cell: (i) => <span className="font-mono">{i.getValue()}</span> }),
  col.accessor('entry_price', { header: 'Entry $', cell: (i) => <span className="font-mono">{formatCurrencyFull(i.getValue())}</span> }),
  col.accessor('exit_price', { header: 'Exit $', cell: (i) => <span className="font-mono">{formatCurrencyFull(i.getValue())}</span> }),
  col.accessor('net_pnl', { header: 'Net P&L', cell: (i) => <span className="font-mono font-semibold" style={{ color: pnlColor(i.getValue()) }}>{formatCurrencyFull(i.getValue())}</span> }),
  col.accessor('pnl_pct', { header: 'P&L %', cell: (i) => <span className="font-mono" style={{ color: pnlColor(i.getValue()) }}>{formatPercent(i.getValue())}</span> }),
  col.accessor('fees', { header: 'Fees', cell: (i) => <span className="font-mono text-xs">{formatCurrencyFull(i.getValue())}</span> }),
  col.accessor('hold_duration_hours', { header: 'Hold', cell: (i) => <span className="text-xs">{formatDuration(i.getValue())}</span> }),
  col.accessor('role', { header: 'Role', cell: (i) => <span className="text-xs uppercase">{i.getValue()}</span> }),
]

export default function TradeLog() {
  const { state } = useReport()
  const trades = state.report!.trade_log.trades
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [dirFilter, setDirFilter] = useState('all')

  const filtered = useMemo(() => {
    return trades.filter((t) => {
      if (search && !t.underlying.toLowerCase().includes(search.toLowerCase()) && !t.product_symbol.toLowerCase().includes(search.toLowerCase())) return false
      if (typeFilter !== 'all' && t.instrument_type !== typeFilter) return false
      if (dirFilter !== 'all' && t.direction !== dirFilter) return false
      return true
    })
  }, [trades, search, typeFilter, dirFilter])

  function downloadCSV() {
    const headers = ['Underlying', 'Type', 'Direction', 'Entry Time', 'Exit Time', 'Size', 'Entry Price', 'Exit Price', 'P&L', 'P&L %', 'Fees', 'Funding', 'Hold Duration (h)', 'Role']
    const rows = filtered.map((t) => [t.underlying, t.instrument_type, t.direction, t.entry_time, t.exit_time, t.size, t.entry_price, t.exit_price, t.net_pnl, t.pnl_pct, t.fees, t.funding_pnl, t.hold_duration_hours, t.role])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'delta-pnl-trades.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-tertiary)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by token..."
            className="input pl-9 text-sm"
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input w-auto text-sm" style={{ minWidth: 120 }}>
          <option value="all">All Types</option>
          <option value="perpetual">Perps</option>
          <option value="call">Calls</option>
          <option value="put">Puts</option>
        </select>
        <select value={dirFilter} onChange={(e) => setDirFilter(e.target.value)} className="input w-auto text-sm" style={{ minWidth: 120 }}>
          <option value="all">All Dirs</option>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>
        <button onClick={downloadCSV} className="btn-secondary text-xs">Export CSV</button>
      </div>

      <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        {filtered.length} trades {filtered.length !== trades.length && `(filtered from ${trades.length})`}
      </p>

      <Card>
        <DataTable data={filtered} columns={tradeCols as any} pageSize={50} />
      </Card>
    </div>
  )
}
