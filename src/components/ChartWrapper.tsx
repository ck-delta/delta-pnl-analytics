import type { ReactNode } from 'react'
import { ResponsiveContainer } from 'recharts'

interface Props {
  height?: number
  children: ReactNode
}

export default function ChartWrapper({ height = 300, children }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      {children as React.ReactElement}
    </ResponsiveContainer>
  )
}

export function darkTooltipStyle() {
  return {
    contentStyle: {
      background: '#212126',
      border: '1px solid #262832',
      borderRadius: '4px',
      fontSize: '12px',
      color: '#e1e1e2',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    },
    labelStyle: {
      color: '#8e9298',
      fontWeight: 600,
      marginBottom: '4px',
    },
    itemStyle: {
      color: '#e1e1e2',
      fontSize: '12px',
      padding: '1px 0',
    },
  }
}
