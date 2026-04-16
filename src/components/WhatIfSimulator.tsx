import { useState, useMemo } from 'react'
import { Ban, TrendingUp, Clock, Target, ShieldAlert, Zap, Filter, ArrowUpRight } from 'lucide-react'
import Card from './Card'
import { formatCurrencyFull, formatPercent, cn } from '../lib/utils'
import type { WhatIfScenario } from '../types/report'

interface Props {
  scenarios: WhatIfScenario[]
  currentPnl: number
}

const ICON_MAP: Record<string, React.FC<{ size?: number; className?: string }>> = {
  ban: Ban,
  trending_up: TrendingUp,
  clock: Clock,
  target: Target,
  shield: ShieldAlert,
  zap: Zap,
  filter: Filter,
  arrow_up: ArrowUpRight,
}

function getIcon(iconName: string) {
  // Try various casing / patterns
  const normalized = iconName.toLowerCase().replace(/[-\s]/g, '_')
  return ICON_MAP[normalized] ?? Zap
}

export default function WhatIfSimulator({ scenarios, currentPnl }: Props) {
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set())

  const toggleScenario = (id: string) => {
    setActiveIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const combinedImpact = useMemo(() => {
    if (activeIds.size === 0) return null
    // Sum the individual improvements (note: each scenario has new_pnl and original_pnl)
    let totalImprovement = 0
    for (const s of scenarios) {
      if (activeIds.has(s.id)) {
        totalImprovement += (s.new_pnl - s.original_pnl)
      }
    }
    const combinedPnl = currentPnl + totalImprovement
    const combinedPct = currentPnl !== 0 ? ((combinedPnl - currentPnl) / Math.abs(currentPnl)) * 100 : 0
    return { pnl: combinedPnl, improvement: totalImprovement, pct: combinedPct }
  }, [activeIds, scenarios, currentPnl])

  if (scenarios.length === 0) return null

  return (
    <Card title="What-If Simulator">
      <p className="text-xs mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
        Toggle scenarios to see how your P&L would change with different strategies.
      </p>

      <div className="space-y-3">
        {scenarios.map((scenario) => {
          const isActive = activeIds.has(scenario.id)
          const Icon = getIcon(scenario.icon)
          return (
            <div
              key={scenario.id}
              className={cn(
                'flex items-start gap-3 p-4 rounded-lg border transition-all cursor-pointer',
                isActive && 'ring-1',
              )}
              style={{
                background: isActive ? 'var(--color-positive-muted)' : 'var(--color-bg-surface-alt)',
                borderColor: isActive ? 'var(--color-positive)' : 'var(--color-separator)',
                outlineColor: isActive ? 'var(--color-positive)' : 'transparent',
                opacity: isActive ? 1 : 0.75,
              }}
              onClick={() => toggleScenario(scenario.id)}
            >
              {/* Icon */}
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{
                  background: isActive ? 'var(--color-positive)' : 'var(--color-bg-secondary)',
                  color: isActive ? '#fff' : 'var(--color-text-secondary)',
                }}
              >
                <Icon size={16} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {scenario.label}
                  </span>
                  {/* Toggle */}
                  <div
                    className="w-10 h-5 rounded-full p-0.5 transition-colors shrink-0"
                    style={{ background: isActive ? 'var(--color-positive)' : 'var(--color-bg-tertiary)' }}
                  >
                    <div
                      className="w-4 h-4 rounded-full transition-transform"
                      style={{
                        background: '#fff',
                        transform: isActive ? 'translateX(20px)' : 'translateX(0)',
                      }}
                    />
                  </div>
                </div>

                <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  {scenario.detail}
                </p>

                {isActive && (
                  <div className="flex items-center gap-4 mt-2">
                    <span className="font-mono text-sm font-bold" style={{ color: 'var(--color-positive-text)' }}>
                      {formatCurrencyFull(scenario.new_pnl)}
                    </span>
                    <span className="badge badge-positive text-[10px]">
                      {formatPercent(scenario.improvement_pct)} improvement
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Combined impact bar */}
      {combinedImpact && (
        <div
          className="mt-4 p-4 rounded-lg border"
          style={{
            background: 'linear-gradient(135deg, var(--color-positive-muted), var(--color-bg-primary))',
            borderColor: 'var(--color-positive)',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: 'var(--color-positive-text)' }}>
                Combined Impact ({activeIds.size} scenario{activeIds.size > 1 ? 's' : ''})
              </div>
              <div className="font-mono text-lg font-bold mt-1" style={{ color: 'var(--color-positive-text)' }}>
                {formatCurrencyFull(combinedImpact.pnl)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>Improvement</div>
              <div className="font-mono text-sm font-bold" style={{ color: 'var(--color-positive-text)' }}>
                {formatCurrencyFull(combinedImpact.improvement)}
              </div>
              <div className="text-[10px] font-mono" style={{ color: 'var(--color-positive-text)' }}>
                ({formatPercent(combinedImpact.pct)})
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
