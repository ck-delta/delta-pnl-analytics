export function formatCurrency(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : value > 0 ? '+' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(2)}`
}

export function formatCurrencyFull(value: number): string {
  const sign = value < 0 ? '-' : value > 0 ? '+' : ''
  return `${sign}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function pnlColor(value: number): string {
  if (value > 0) return 'var(--color-positive-text)'
  if (value < 0) return 'var(--color-negative-text)'
  return 'var(--color-text-secondary)'
}

export function pnlClass(value: number): string {
  if (value > 0) return 'text-[var(--color-positive-text)]'
  if (value < 0) return 'text-[var(--color-negative-text)]'
  return 'text-[var(--color-text-secondary)]'
}

export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 24) return `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`
  const days = Math.floor(hours / 24)
  const remHours = Math.round(hours % 24)
  return `${days}d ${remHours}h`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}
