import type { DeltaReportData, MatchedTrade } from '../../types/report'

export interface TraderIdentity {
  persona: string
  emoji: string
  description: string
  topAsset: string
  topInstrument: string
  style: string
  statLine: string
}

interface AssetCount {
  asset: string
  count: number
  pnl: number
}

interface InstrumentCount {
  type: 'perpetual' | 'call' | 'put'
  count: number
  pnl: number
}

function countByAsset(trades: MatchedTrade[]): AssetCount[] {
  const map = new Map<string, { count: number; pnl: number }>()
  for (const t of trades) {
    const prev = map.get(t.underlying) ?? { count: 0, pnl: 0 }
    map.set(t.underlying, { count: prev.count + 1, pnl: prev.pnl + t.net_pnl })
  }
  return Array.from(map.entries())
    .map(([asset, v]) => ({ asset, ...v }))
    .sort((a, b) => b.count - a.count)
}

function countByInstrument(trades: MatchedTrade[]): InstrumentCount[] {
  const map = new Map<string, { count: number; pnl: number }>()
  for (const t of trades) {
    const prev = map.get(t.instrument_type) ?? { count: 0, pnl: 0 }
    map.set(t.instrument_type, { count: prev.count + 1, pnl: prev.pnl + t.net_pnl })
  }
  return Array.from(map.entries())
    .map(([type, v]) => ({ type: type as InstrumentCount['type'], ...v }))
    .sort((a, b) => b.count - a.count)
}

function avgHoldDuration(trades: MatchedTrade[]): number {
  if (trades.length === 0) return 0
  const total = trades.reduce((sum, t) => sum + t.hold_duration_hours, 0)
  return total / trades.length
}

function instrumentLabel(type: 'perpetual' | 'call' | 'put'): string {
  switch (type) {
    case 'perpetual': return 'Perps'
    case 'call': return 'Call Options'
    case 'put': return 'Put Options'
  }
}

export function classifyTrader(report: DeltaReportData): TraderIdentity {
  const trades = report.trade_log.trades
  const totalTrades = trades.length

  if (totalTrades === 0) {
    return {
      persona: 'The Observer',
      emoji: '\u{1F440}',
      description: 'You haven\'t placed any trades yet. The market awaits.',
      topAsset: 'N/A',
      topInstrument: 'N/A',
      style: 'Watching from the sidelines',
      statLine: 'No trades recorded',
    }
  }

  const assets = countByAsset(trades)
  const instruments = countByInstrument(trades)
  const avgHold = avgHoldDuration(trades)

  const topAsset = assets[0]?.asset ?? 'BTC'
  const topInstrumentType = instruments[0]?.type ?? 'perpetual'
  const topInstrumentName = instrumentLabel(topInstrumentType)
  const assetConcentration = (assets[0]?.count ?? 0) / totalTrades
  const numAssets = assets.length

  const isPerpsHeavy = topInstrumentType === 'perpetual'
  const isOptionsHeavy = topInstrumentType === 'call' || topInstrumentType === 'put'
  const isSpeedTrader = avgHold < 1
  const isDiamondHands = avgHold >= 24
  const isDiversified = numAssets >= 5 && assetConcentration < 0.5
  const isHighFrequency = totalTrades > 500

  const longCount = trades.filter(t => t.direction === 'long').length
  const isLongBiased = longCount / totalTrades > 0.6
  const isShortBiased = longCount / totalTrades < 0.4

  const directionWord = isLongBiased ? 'mostly goes long' : isShortBiased ? 'mostly goes short' : 'trades both sides'

  let persona: string
  let emoji: string
  let description: string
  let style: string

  if (isDiversified) {
    persona = 'Multi-Asset Diversifier'
    emoji = '\u{1F30D}'
    description = `You spread your bets across ${numAssets} tokens and ${directionWord}. Diversification is your game.`
    style = 'Balanced portfolio allocation'
  } else if (isSpeedTrader && isPerpsHeavy && isHighFrequency) {
    persona = 'Degen Speed Trader'
    emoji = '\u{26A1}'
    description = `You fire off trades at lightning speed with sub-hour holds. ${topAsset} perps are your playground.`
    style = 'Ultra-fast execution, high volume'
  } else if (isSpeedTrader && isPerpsHeavy) {
    persona = 'Perps Scalper'
    emoji = '\u{1F3AF}'
    description = `You scalp ${topAsset} perpetuals with precision. Quick in, quick out, and ${directionWord}.`
    style = 'Short-duration momentum trades'
  } else if (isDiamondHands) {
    persona = 'Diamond Hands Holder'
    emoji = '\u{1F48E}'
    description = `You hold your convictions with an average hold time of ${Math.round(avgHold)}h. Patience is your strategy.`
    style = 'High-conviction directional bets'
  } else if (isOptionsHeavy && topInstrumentType === 'put') {
    persona = `${topAsset} Options Strategist`
    emoji = '\u{1F9E0}'
    description = `You're a put options specialist on ${topAsset} who ${directionWord}. Hedging or bearish bets are your forte.`
    style = 'Options-heavy strategic positioning'
  } else if (isOptionsHeavy && topInstrumentType === 'call') {
    persona = `${topAsset} Options Strategist`
    emoji = '\u{1F9E0}'
    description = `You're a call options specialist on ${topAsset} who ${directionWord}. Leveraged upside is your game.`
    style = 'Options-heavy strategic positioning'
  } else if (isPerpsHeavy && topAsset === 'ETH') {
    persona = 'ETH Perps Warrior'
    emoji = '\u{2694}\u{FE0F}'
    description = `You battle the ETH perpetuals market and ${directionWord}. Ethereum is your arena.`
    style = 'Focused ETH perpetual trading'
  } else if (isPerpsHeavy) {
    persona = `${topAsset} Perps Warrior`
    emoji = '\u{2694}\u{FE0F}'
    description = `You dominate ${topAsset} perpetuals and ${directionWord}. Conviction meets execution.`
    style = 'Focused perpetual trading'
  } else {
    persona = `${topAsset} Options Strategist`
    emoji = '\u{1F9E0}'
    description = `You're a high-conviction ${topAsset} options trader who ${directionWord}.`
    style = 'High-conviction directional bets'
  }

  const topAssetCount = assets[0]?.count ?? 0
  const statLine = assetConcentration > 0.5
    ? `${topAssetCount} of ${totalTrades} trades were ${topAsset}`
    : `${numAssets} tokens traded across ${totalTrades} trades`

  return {
    persona,
    emoji,
    description,
    topAsset,
    topInstrument: topInstrumentName,
    style,
    statLine,
  }
}
