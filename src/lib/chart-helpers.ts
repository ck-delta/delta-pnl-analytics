import { formatCurrencyFull, formatCurrency } from './utils'

// Recharts v3 tooltip formatter expects (value: ValueType | undefined) => ReactNode
// We need to cast safely to avoid TS errors
export const fmtCurrencyFull = (v: unknown) => formatCurrencyFull(Number(v) || 0)
export const fmtCurrency = (v: unknown) => formatCurrency(Number(v) || 0)
export const fmtPercent = (v: unknown) => `${(Number(v) || 0).toFixed(2)}%`
