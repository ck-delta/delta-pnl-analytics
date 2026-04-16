/**
 * Client-side analytics engine.
 * Ports the Python trade matching + analytics computation to TypeScript.
 */
import type {
  DeltaReportData, MatchedTrade, ProjectionData,
  WhatIfScenario, Achievement, HistogramBin, MonthlyPnl,
} from '../types/report'

// ==========================================
// TRADE MATCHING (FIFO)
// ==========================================

interface Position {
  size: number
  avgEntry: number
  fees: number
  firstTime: string
  role: string
}

export function matchTrades(fills: any[], productsMap: Record<number, any>): MatchedTrade[] {
  const sorted = [...fills].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
  const positions: Record<number, Position> = {}
  const trades: MatchedTrade[] = []
  let tradeId = 0

  for (const fill of sorted) {
    const pid = fill.product_id
    if (pid == null) continue

    const product = productsMap[pid] || {}
    const contractValue = parseFloat(product.contract_value || '1') || 1
    const size = parseInt(fill.size || '0')
    const price = parseFloat(fill.price || '0')
    const fee = Math.abs(parseFloat(fill.commission || '0'))
    const side: string = fill.side || ''
    const fillTime: string = fill.created_at || ''
    const role: string = fill.role || 'taker'

    if (size === 0 || price === 0) continue

    const signed = side === 'buy' ? size : -size

    let pos = positions[pid] || { size: 0, avgEntry: 0, fees: 0, firstTime: fillTime, role }
    const oldSize = pos.size

    // Same direction — adding to position
    const sameDir = (oldSize >= 0 && signed > 0) || (oldSize <= 0 && signed < 0)
    if (sameDir || oldSize === 0) {
      if (Math.abs(oldSize) + size > 0) {
        const total = pos.avgEntry * Math.abs(oldSize) + price * size
        pos.avgEntry = total / (Math.abs(oldSize) + size)
      }
      pos.size = oldSize + signed
      pos.fees += fee
      if (oldSize === 0) {
        pos.firstTime = fillTime
        pos.role = role
      }
      positions[pid] = pos
      continue
    }

    // Closing or flipping
    const closeQty = Math.min(Math.abs(signed), Math.abs(oldSize))
    if (closeQty > 0) {
      const direction = oldSize > 0 ? 'long' : 'short'
      const pnl = direction === 'long'
        ? closeQty * contractValue * (price - pos.avgEntry)
        : closeQty * contractValue * (pos.avgEntry - price)

      const totalFees = pos.fees + fee
      const ct: string = product.contract_type || 'perpetual_futures'
      let instType: 'perpetual' | 'call' | 'put' = 'perpetual'
      if (ct.includes('call')) instType = 'call'
      else if (ct.includes('put')) instType = 'put'

      const underlying = product.underlying_asset?.symbol || fill.product_symbol?.slice(0, 3) || ''
      const notional = closeQty * contractValue * price
      const pnlPct = notional ? (pnl / notional) * 100 : 0

      let holdHours = 0
      try {
        const t0 = new Date(pos.firstTime).getTime()
        const t1 = new Date(fillTime).getTime()
        holdHours = (t1 - t0) / 3600000
      } catch { /* ignore */ }

      tradeId++
      trades.push({
        id: String(tradeId),
        underlying,
        product_symbol: fill.product_symbol || '',
        instrument_type: instType,
        direction: direction as 'long' | 'short',
        entry_time: pos.firstTime,
        exit_time: fillTime,
        entry_price: pos.avgEntry,
        exit_price: price,
        size: closeQty,
        notional_value: Math.round(notional * 100) / 100,
        pnl: Math.round(pnl * 10000) / 10000,
        pnl_pct: Math.round(pnlPct * 10000) / 10000,
        fees: Math.round(totalFees * 10000) / 10000,
        funding_pnl: 0,
        net_pnl: Math.round((pnl - totalFees) * 10000) / 10000,
        hold_duration_hours: Math.round(holdHours * 100) / 100,
        leverage: 0,
        role: pos.role as 'maker' | 'taker' | 'mixed',
      })
    }

    const remaining = Math.abs(signed) - closeQty
    if (remaining > 0) {
      pos = { size: signed > 0 ? remaining : -remaining, avgEntry: price, fees: 0, firstTime: fillTime, role }
    } else {
      const newSize = oldSize + signed
      pos = { size: newSize, avgEntry: newSize !== 0 ? pos.avgEntry : 0, fees: 0, firstTime: pos.firstTime, role }
    }
    positions[pid] = pos
  }

  return trades
}

// ==========================================
// ANALYTICS COMPUTATION
// ==========================================

export function computeAnalytics(
  trades: MatchedTrade[],
  _fills: any[],
  transactions: any[],
  positions: any[],
  productsMap: Record<number, any>,
  _balances: any[],
): DeltaReportData {
  const sorted = [...trades].sort((a, b) => a.exit_time.localeCompare(b.exit_time))
  const winning = trades.filter((t) => t.net_pnl > 0)
  const losing = trades.filter((t) => t.net_pnl < 0)
  const breakeven = trades.filter((t) => t.net_pnl === 0)

  const netPnl = sum(trades, 'net_pnl')
  const grossPnl = sum(trades, 'pnl')
  const totalFees = sum(trades, 'fees')
  const winRate = trades.length ? (winning.length / trades.length) * 100 : 0
  const avgWinner = winning.length ? sum(winning, 'net_pnl') / winning.length : 0
  const avgLoser = losing.length ? sum(losing, 'net_pnl') / losing.length : 0
  const underlyings = [...new Set(trades.map((t) => t.underlying))]

  // Equity curve + daily P&L
  let cumulative = 0
  const equityCurve: { date: string; pnl: number; cumulative: number }[] = []
  const dailyMap = new Map<string, { pnl: number; trades: number }>()

  for (const t of sorted) {
    cumulative += t.net_pnl
    equityCurve.push({ date: t.exit_time, pnl: t.net_pnl, cumulative: r2(cumulative) })
    const d = t.exit_time.slice(0, 10)
    const cur = dailyMap.get(d) || { pnl: 0, trades: 0 }
    cur.pnl += t.net_pnl
    cur.trades++
    dailyMap.set(d, cur)
  }
  const dailyPnl = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, pnl: r2(v.pnl), trades: v.trades }))

  // Hourly P&L
  const hourlyMap = new Map<number, { total: number; count: number; wins: number }>()
  for (const t of trades) {
    const h = parseInt(t.exit_time.slice(11, 13)) || 0
    const cur = hourlyMap.get(h) || { total: 0, count: 0, wins: 0 }
    cur.total += t.net_pnl
    cur.count++
    if (t.net_pnl > 0) cur.wins++
    hourlyMap.set(h, cur)
  }
  const hourlyPnl = [...Array(24)].map((_, h) => {
    const d = hourlyMap.get(h) || { total: 0, count: 0, wins: 0 }
    return { hour: h, avg_pnl: d.count ? r2(d.total / d.count) : 0, trades: d.count, win_rate: d.count ? r1(d.wins / d.count * 100) : 0 }
  })

  // Day of week
  const dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dowMap = new Map<number, { total: number; count: number; wins: number }>()
  for (const t of trades) {
    try {
      const dow = new Date(t.exit_time).getDay()
      const cur = dowMap.get(dow) || { total: 0, count: 0, wins: 0 }
      cur.total += t.net_pnl
      cur.count++
      if (t.net_pnl > 0) cur.wins++
      dowMap.set(dow, cur)
    } catch { /* ignore */ }
  }
  const dayOfWeek = [1, 2, 3, 4, 5, 6, 0].map((i) => {
    const d = dowMap.get(i) || { total: 0, count: 0, wins: 0 }
    return { day: dowNames[i], avg_pnl: d.count ? r2(d.total / d.count) : 0, trades: d.count, win_rate: d.count ? r1(d.wins / d.count * 100) : 0 }
  })

  // Monthly P&L
  const monthlyMap = new Map<string, { trades: number; gross: number; fees: number; funding: number; net: number; wins: number; best: number; worst: number }>()
  for (const t of sorted) {
    const m = t.exit_time.slice(0, 7)
    const cur = monthlyMap.get(m) || { trades: 0, gross: 0, fees: 0, funding: 0, net: 0, wins: 0, best: -Infinity, worst: Infinity }
    cur.trades++
    cur.gross += t.pnl
    cur.fees += t.fees
    cur.net += t.net_pnl
    if (t.net_pnl > 0) cur.wins++
    cur.best = Math.max(cur.best, t.net_pnl)
    cur.worst = Math.min(cur.worst, t.net_pnl)
    monthlyMap.set(m, cur)
  }
  const monthly: MonthlyPnl[] = [...monthlyMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, d]) => ({
    month, trades: d.trades, gross_pnl: r2(d.gross), fees: r2(d.fees), funding: r2(d.funding),
    net_pnl: r2(d.net), win_rate: d.trades ? r1(d.wins / d.trades * 100) : 0,
    best: r2(d.best === -Infinity ? 0 : d.best), worst: r2(d.worst === Infinity ? 0 : d.worst),
  }))

  // By underlying
  const undMap = new Map<string, { trades: number; pnl: number; wins: number; capital: number }>()
  for (const t of trades) {
    const cur = undMap.get(t.underlying) || { trades: 0, pnl: 0, wins: 0, capital: 0 }
    cur.trades++
    cur.pnl += t.net_pnl
    cur.capital += t.notional_value
    if (t.net_pnl > 0) cur.wins++
    undMap.set(t.underlying, cur)
  }
  const pnlByUnd = [...undMap.entries()]
    .map(([underlying, d]) => ({
      underlying, num_trades: d.trades, pnl: r2(d.pnl),
      win_rate: d.trades ? r1(d.wins / d.trades * 100) : 0,
      avg_return: d.capital ? r2(d.pnl / d.capital * 100) : 0,
      capital: r2(d.capital),
    }))
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))

  const topContributors = pnlByUnd.filter((x) => x.pnl > 0).slice(0, 5).map((x) => ({ underlying: x.underlying, pnl: x.pnl }))
  const topDetractors = pnlByUnd.filter((x) => x.pnl < 0).sort((a, b) => a.pnl - b.pnl).slice(0, 5).map((x) => ({ underlying: x.underlying, pnl: x.pnl }))

  // Waterfall
  let wfCum = 0
  const waterfall = pnlByUnd.slice(0, 20).map((w) => {
    wfCum += w.pnl
    return { underlying: w.underlying, pnl: w.pnl, cumulative: r2(wfCum) }
  })

  // Instruments
  const perps = trades.filter((t) => t.instrument_type === 'perpetual')
  const calls = trades.filter((t) => t.instrument_type === 'call')
  const puts = trades.filter((t) => t.instrument_type === 'put')
  const options = [...calls, ...puts]

  // Funding from transactions
  const fundingTxns = transactions.filter((tx: any) => tx.transaction_type === 'funding')
  const totalFunding = fundingTxns.reduce((s: number, tx: any) => s + parseFloat(tx.amount || '0'), 0)

  // Risk metrics
  const dailyReturns = dailyPnl.map((d) => d.pnl)
  let sharpe = 0, sortino = 0, stdDev = 0
  if (dailyReturns.length >= 2) {
    const avgRet = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
    stdDev = Math.sqrt(dailyReturns.reduce((s, r) => s + (r - avgRet) ** 2, 0) / (dailyReturns.length - 1))
    sharpe = stdDev > 0 ? (avgRet / stdDev) * Math.sqrt(365) : 0
    const downside = dailyReturns.filter((r) => r < 0)
    const downStd = downside.length ? Math.sqrt(downside.reduce((s, r) => s + r ** 2, 0) / downside.length) : 0
    sortino = downStd > 0 ? (avgRet / downStd) * Math.sqrt(365) : 0
  }

  const grossWins = sum(winning, 'net_pnl')
  const grossLosses = Math.abs(sum(losing, 'net_pnl'))
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? 999 : 0

  // Max drawdown
  let peak = 0, maxDd = 0
  let cum = 0
  const ddCurve: { date: string; drawdown: number }[] = []
  for (const d of dailyPnl) {
    cum += d.pnl
    peak = Math.max(peak, cum)
    const dd = peak > 0 ? ((cum - peak) / peak) * 100 : 0
    maxDd = Math.min(maxDd, dd)
    ddCurve.push({ date: d.date, drawdown: r2(dd) })
  }

  // Equity curve for risk page
  let riskCum = 0
  const riskEquity = dailyPnl.map((d) => {
    riskCum += d.pnl
    return { date: d.date, cumulative: r2(riskCum) }
  })

  // Streaks
  let ws = 0, ls = 0, bestWs = 0, worstLs = 0
  for (const d of dailyPnl) {
    if (d.pnl > 0) { ws++; ls = 0 }
    else if (d.pnl < 0) { ls++; ws = 0 }
    bestWs = Math.max(bestWs, ws)
    worstLs = Math.max(worstLs, ls)
  }

  // Unrealized from positions
  const totalUnrealized = positions.reduce((s: number, p: any) => s + parseFloat(p.unrealized_pnl || '0'), 0)

  // Open positions mapping
  const openPositions = positions
    .filter((p: any) => parseInt(p.size || '0') !== 0)
    .map((p: any) => {
      const prod = productsMap[p.product_id] || {}
      return {
        symbol: p.product_symbol || '',
        underlying: prod.underlying_asset?.symbol || '',
        type: 'perpetual' as const,
        size: Math.abs(parseInt(p.size || '0')),
        direction: (parseInt(p.size || '0') > 0 ? 'long' : 'short') as 'long' | 'short',
        entry_price: parseFloat(p.entry_price || '0'),
        mark_price: 0,
        unrealized_pnl: r2(parseFloat(p.unrealized_pnl || '0')),
        pnl_pct: 0,
        margin: r2(parseFloat(p.margin || '0')),
        leverage: 0,
        liquidation_price: parseFloat(p.liquidation_price || '0'),
        realized_funding: r2(parseFloat(p.realized_funding || '0')),
      }
    })

  // Funding analysis from wallet transactions
  const fundingTxnsByProduct = new Map<string, { token: string; pnl: number; count: number }>()
  const dailyFundingMap = new Map<string, number>()
  let fundingPaidLong = 0, fundingReceivedShort = 0
  for (const tx of fundingTxns) {
    const amt = parseFloat(tx.amount || '0')
    const pid = tx.product_id
    const prod = productsMap[pid] || {}
    const token = prod.underlying_asset?.symbol || tx.asset_symbol || 'Unknown'
    const cur = fundingTxnsByProduct.get(token) || { token, pnl: 0, count: 0 }
    cur.pnl += amt
    cur.count++
    fundingTxnsByProduct.set(token, cur)

    const d = (tx.created_at || '').slice(0, 10)
    if (d) dailyFundingMap.set(d, (dailyFundingMap.get(d) || 0) + amt)

    if (amt < 0) fundingPaidLong += amt
    else fundingReceivedShort += amt
  }
  const fundingByToken = [...fundingTxnsByProduct.values()].sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
  const dailyFundingArr = [...dailyFundingMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, pnl]) => ({ date, pnl: r2(pnl) }))
  let fundCum = 0
  const cumulativeFunding = dailyFundingArr.map((d) => { fundCum += d.pnl; return { date: d.date, cumulative: r2(fundCum) } })

  // Monthly funding vs trading
  const monthlyFundVsTrade: { month: string; trading_pnl: number; funding_pnl: number }[] = []
  const allMonths = new Set([...monthlyMap.keys(), ...dailyFundingArr.map((d) => d.date.slice(0, 7))])
  for (const m of [...allMonths].sort()) {
    const trading = monthlyMap.get(m)?.net ?? 0
    const fund = dailyFundingArr.filter((d) => d.date.startsWith(m)).reduce((s, d) => s + d.pnl, 0)
    monthlyFundVsTrade.push({ month: m, trading_pnl: r2(trading), funding_pnl: r2(fund) })
  }

  // Correlation matrix (Pearson) — only for tokens with 10+ daily observations
  const tokenDailyPnl = new Map<string, Map<string, number>>()
  for (const t of trades) {
    const d = t.exit_time.slice(0, 10)
    const tok = t.underlying
    if (!tokenDailyPnl.has(tok)) tokenDailyPnl.set(tok, new Map())
    tokenDailyPnl.get(tok)!.set(d, (tokenDailyPnl.get(tok)!.get(d) || 0) + t.net_pnl)
  }
  const corrTokens = [...tokenDailyPnl.entries()].filter(([, m]) => m.size >= 5).map(([t]) => t).slice(0, 10)
  const allDates = [...new Set(dailyPnl.map((d) => d.date))]
  const corrMatrix: number[][] = []
  for (const t1 of corrTokens) {
    const row: number[] = []
    const m1 = tokenDailyPnl.get(t1)!
    const v1 = allDates.map((d) => m1.get(d) || 0)
    for (const t2 of corrTokens) {
      const m2 = tokenDailyPnl.get(t2)!
      const v2 = allDates.map((d) => m2.get(d) || 0)
      row.push(r2(pearson(v1, v2)))
    }
    corrMatrix.push(row)
  }

  // Expiry analysis for options
  const optionTrades = trades.filter((t) => t.instrument_type === 'call' || t.instrument_type === 'put')
  const expiryTypeMap = new Map<string, { pnl: number; count: number; wins: number }>()
  const dteMap = new Map<string, { pnl: number; count: number }>()
  const expiryDateMap = new Map<string, { pnl: number; count: number }>()
  for (const t of optionTrades) {
    // Parse option symbol: e.g. C-ETH-2340-160426 → expiry = 160426
    const parts = t.product_symbol.split('-')
    const expiryStr = parts[parts.length - 1] || ''
    let expiryDate = ''
    if (expiryStr.length === 6) {
      const dd = expiryStr.slice(0, 2), mm = expiryStr.slice(2, 4), yy = expiryStr.slice(4, 6)
      expiryDate = `20${yy}-${mm}-${dd}`
    }

    // DTE calculation
    let dte = 0
    if (expiryDate && t.entry_time) {
      try {
        const entryMs = new Date(t.entry_time).getTime()
        const expiryMs = new Date(expiryDate).getTime()
        dte = Math.max(0, Math.floor((expiryMs - entryMs) / 86400000))
      } catch { /* ignore */ }
    }

    // Classify expiry type
    let expiryType = 'Other'
    if (dte <= 1) expiryType = 'Daily'
    else if (dte <= 7) expiryType = 'Weekly'
    else if (dte <= 31) expiryType = 'Monthly'
    else expiryType = 'Quarterly+'

    const et = expiryTypeMap.get(expiryType) || { pnl: 0, count: 0, wins: 0 }
    et.pnl += t.net_pnl; et.count++; if (t.net_pnl > 0) et.wins++
    expiryTypeMap.set(expiryType, et)

    // DTE bucket
    let dteBucket = '7+ days'
    if (dte === 0) dteBucket = '0-day'
    else if (dte <= 3) dteBucket = '1-3 days'
    else if (dte <= 7) dteBucket = '4-7 days'
    const db = dteMap.get(dteBucket) || { pnl: 0, count: 0 }
    db.pnl += t.net_pnl; db.count++
    dteMap.set(dteBucket, db)

    // By expiry date
    if (expiryDate) {
      const ed = expiryDateMap.get(expiryDate) || { pnl: 0, count: 0 }
      ed.pnl += t.net_pnl; ed.count++
      expiryDateMap.set(expiryDate, ed)
    }
  }

  // Monthly streak
  let profMonthStreak = 0, bestMonthStreak = 0, curMonthStreak = 0
  for (const m of monthly) {
    if (m.net_pnl > 0) { curMonthStreak++; bestMonthStreak = Math.max(bestMonthStreak, curMonthStreak) }
    else curMonthStreak = 0
  }
  profMonthStreak = curMonthStreak

  const projections = computeProjections(trades, dailyPnl)
  const whatIfs = computeWhatIfs(trades, netPnl, undMap)
  const achievements = computeAchievements(trades, dailyPnl, winRate, bestWs, underlyings)

  const report: DeltaReportData = {
    metadata: {
      date_range: {
        start: sorted[0]?.entry_time?.slice(0, 10) || '',
        end: sorted[sorted.length - 1]?.exit_time?.slice(0, 10) || '',
      },
      total_trades: trades.length,
      tokens_traded: underlyings.length,
      platform: 'india',
      fetch_timestamp: new Date().toISOString(),
    },
    overview: {
      net_realized_pnl: r2(netPnl),
      unrealized_pnl: r2(totalUnrealized),
      total_fees: r2(totalFees),
      total_funding_pnl: r2(totalFunding),
      net_after_fees: r2(netPnl),
      win_rate: r1(winRate),
      total_trades: trades.length,
      tokens_traded: underlyings.length,
      winners: winning.length,
      losers: losing.length,
      breakeven: breakeven.length,
      avg_winner: r2(avgWinner),
      avg_loser: r2(avgLoser),
      win_loss_ratio: avgLoser !== 0 ? r2(Math.abs(avgWinner / avgLoser)) : 0,
      best_trade: r2(Math.max(...trades.map((t) => t.net_pnl), 0)),
      worst_trade: r2(Math.min(...trades.map((t) => t.net_pnl), 0)),
      long_pnl: r2(sum(trades.filter((t) => t.direction === 'long'), 'net_pnl')),
      short_pnl: r2(sum(trades.filter((t) => t.direction === 'short'), 'net_pnl')),
      perps_pnl: r2(sum(perps, 'net_pnl')),
      options_pnl: r2(sum(options, 'net_pnl')),
      equity_curve: equityCurve.slice(-500),
      pnl_distribution: makeHistogram(trades.map((t) => t.net_pnl), 20),
      return_distribution: makeHistogram(trades.filter((t) => t.pnl_pct !== 0).map((t) => t.pnl_pct), 20),
    },
    pnl_analysis: {
      monthly,
      daily_pnl: dailyPnl,
      hourly_pnl: hourlyPnl,
      day_of_week: dayOfWeek,
      trades_per_day: dailyPnl.map((d) => ({ date: d.date, count: d.trades })),
      top_contributors: topContributors,
      top_detractors: topDetractors,
      waterfall,
      pareto: [],
      pareto_80_index: 0,
    },
    instruments: {
      perps_pnl: r2(sum(perps, 'net_pnl')),
      perps_count: perps.length,
      options_pnl: r2(sum(options, 'net_pnl')),
      options_count: options.length,
      calls_pnl: r2(sum(calls, 'net_pnl')),
      calls_count: calls.length,
      puts_pnl: r2(sum(puts, 'net_pnl')),
      puts_count: puts.length,
      pnl_by_underlying: pnlByUnd.slice(0, 50),
      capital_vs_returns: pnlByUnd.slice(0, 50).map((u) => ({ underlying: u.underlying, capital: u.capital, return_pct: u.avg_return, pnl: u.pnl })),
      long_vs_short: pnlByUnd.slice(0, 15).map((u) => ({
        underlying: u.underlying,
        long_pnl: r2(trades.filter((t) => t.underlying === u.underlying && t.direction === 'long').reduce((s, t) => s + t.net_pnl, 0)),
        short_pnl: r2(trades.filter((t) => t.underlying === u.underlying && t.direction === 'short').reduce((s, t) => s + t.net_pnl, 0)),
      })),
      correlation_matrix: { tokens: corrTokens, matrix: corrMatrix },
    },
    funding: {
      total_funding_pnl: r2(totalFunding),
      funding_by_token: fundingByToken.map((f) => ({ token: f.token, pnl: r2(f.pnl), count: f.count })),
      daily_funding: dailyFundingArr,
      cumulative_funding: cumulativeFunding,
      monthly_funding_vs_trading: monthlyFundVsTrade,
      avg_funding_rate: 0,
      funding_paid_as_long: r2(fundingPaidLong),
      funding_received_as_short: r2(fundingReceivedShort),
    },
    expiry: {
      has_options: optionTrades.length > 0,
      by_expiry_type: [...expiryTypeMap.entries()].map(([type, d]) => ({ type, pnl: r2(d.pnl), count: d.count, win_rate: d.count ? r1(d.wins / d.count * 100) : 0 })),
      by_dte: ['0-day', '1-3 days', '4-7 days', '7+ days'].map((bucket) => { const d = dteMap.get(bucket) || { pnl: 0, count: 0 }; return { bucket, pnl: r2(d.pnl), count: d.count } }),
      by_expiry_date: [...expiryDateMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({ date, pnl: r2(d.pnl), count: d.count })),
    },
    risk_metrics: {
      sharpe_ratio: r2(sharpe),
      sortino_ratio: r2(sortino),
      profit_factor: r2(profitFactor),
      payoff_ratio: avgLoser !== 0 ? r2(Math.abs(avgWinner / avgLoser)) : 0,
      max_drawdown: r2(maxDd),
      max_drawdown_duration_days: 0,
      calmar_ratio: maxDd !== 0 ? r2(netPnl / Math.abs(maxDd)) : 0,
      daily_std_dev: r2(stdDev),
      consecutive_wins: bestWs,
      consecutive_losses: worstLs,
      recovery_factor: maxDd !== 0 ? r2(netPnl / Math.abs(maxDd)) : 0,
      expectancy: r2((winRate / 100) * avgWinner + (1 - winRate / 100) * avgLoser),
      equity_curve: riskEquity,
      drawdown_curve: ddCurve,
      pnl_distribution: makeHistogram(trades.map((t) => t.net_pnl), 20),
      return_distribution: makeHistogram(trades.filter((t) => t.pnl_pct !== 0).map((t) => t.pnl_pct), 20),
      risk_reward_scatter: trades.slice(0, 500).map((t) => ({ pnl: t.net_pnl, capital: t.notional_value, return_pct: t.pnl_pct, underlying: t.underlying })),
    },
    charges: {
      total_fees: r2(totalFees),
      fees_pct_pnl: grossPnl ? r2((totalFees / Math.abs(grossPnl)) * 100) : 0,
      fees_pct_volume: trades.length ? r4((totalFees / sum(trades, 'notional_value')) * 100) : 0,
      maker_fees: r2(sum(trades.filter((t) => t.role === 'maker'), 'fees')),
      taker_fees: r2(sum(trades.filter((t) => t.role === 'taker'), 'fees')),
      maker_fill_rate: trades.length ? r1(trades.filter((t) => t.role === 'maker').length / trades.length * 100) : 0,
      gst_estimate: r2(totalFees * 0.18),
      fees_by_instrument: [
        { instrument: 'Perpetuals', fees: r2(sum(perps, 'fees')) },
        { instrument: 'Options', fees: r2(sum(options, 'fees')) },
      ],
      fees_by_token: [...undMap.entries()]
        .map(([token]) => ({ token, fees: r2(trades.filter((t) => t.underlying === token).reduce((s, t) => s + t.fees, 0)) }))
        .sort((a, b) => b.fees - a.fees)
        .slice(0, 10),
      trades_to_cover_fees: 0,
    },
    open_portfolio: {
      open_count: openPositions.length,
      total_unrealized_pnl: r2(totalUnrealized),
      max_profit: r2(Math.max(...openPositions.map((p) => p.unrealized_pnl), 0)),
      max_loss: r2(Math.min(...openPositions.map((p) => p.unrealized_pnl), 0)),
      positions: openPositions,
      concentration: [],
      unrealized_by_position: openPositions.map((p) => ({ symbol: p.symbol, pnl: p.unrealized_pnl })),
    },
    trade_log: { trades: sorted.slice(-1000) },
    projections,
    what_ifs: whatIfs,
    streaks: {
      current_win_streak: ws,
      best_win_streak: bestWs,
      current_loss_streak: ls,
      worst_loss_streak: worstLs,
      profitable_month_streak: profMonthStreak,
      best_month_streak: bestMonthStreak,
      achievements,
    },
  }

  return report
}

// ==========================================
// HELPERS
// ==========================================

function sum(arr: any[], key: string): number {
  return arr.reduce((s, x) => s + (x[key] || 0), 0)
}
function r1(n: number): number { return Math.round(n * 10) / 10 }
function r2(n: number): number { return Math.round(n * 100) / 100 }
function r4(n: number): number { return Math.round(n * 10000) / 10000 }

function pearson(x: number[], y: number[]): number {
  const n = x.length
  if (n < 3) return 0
  const mx = x.reduce((a, b) => a + b, 0) / n
  const my = y.reduce((a, b) => a + b, 0) / n
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < n; i++) {
    const xi = x[i] - mx, yi = y[i] - my
    num += xi * yi
    dx += xi * xi
    dy += yi * yi
  }
  const denom = Math.sqrt(dx * dy)
  return denom > 0 ? num / denom : 0
}

function makeHistogram(values: number[], numBins: number): HistogramBin[] {
  if (!values.length) return []
  const mn = Math.min(...values)
  const mx = Math.max(...values)
  if (mn === mx) return [{ range: `${mn.toFixed(0)}`, count: values.length, min: mn, max: mx }]
  const step = (mx - mn) / numBins
  const bins: HistogramBin[] = []
  for (let i = 0; i < numBins; i++) {
    const lo = mn + i * step
    const hi = mn + (i + 1) * step
    const count = values.filter((v) => v >= lo && (i === numBins - 1 ? v <= hi : v < hi)).length
    if (count > 0) bins.push({ range: `${lo.toFixed(0)} - ${hi.toFixed(0)}`, count, min: lo, max: hi })
  }
  return bins
}

function computeProjections(trades: MatchedTrade[], dailyPnl: { date: string; pnl: number }[]): ProjectionData {
  const empty: ProjectionData = { overall: null, categories: { perps: null, options: null, calls: null, puts: null }, edges: [], avoid: [] }
  if (!trades.length || dailyPnl.length < 7) return empty

  const days = dailyPnl.length
  const project = (pnl: number, capital: number) => {
    if (pnl <= 0 || capital <= 0) return null
    const daily = pnl / capital / days
    const rate = 1 + daily
    return {
      apr: r1(daily * 365 * 100),
      apy_1yr: r1((rate ** 365 - 1) * 100),
      apy_5yr: r1((rate ** (365 * 5) - 1) * 100),
      apy_10yr: r1((rate ** (365 * 10) - 1) * 100),
      value_1yr: r2(capital * rate ** 365),
      value_3yr: r2(capital * rate ** (365 * 3)),
      value_5yr: r2(capital * rate ** (365 * 5)),
      value_10yr: r2(capital * rate ** (365 * 10)),
      starting_capital: r2(capital),
      daily_return_pct: r4(daily * 100),
    }
  }

  const totalPnl = sum(trades, 'net_pnl')
  const totalCapital = trades.length ? sum(trades, 'notional_value') / trades.length : 0
  const catProj = (subset: MatchedTrade[]) => {
    const p = sum(subset, 'net_pnl')
    const c = subset.length ? sum(subset, 'notional_value') / subset.length : 0
    return project(p, c)
  }

  return {
    overall: project(totalPnl, totalCapital),
    categories: {
      perps: catProj(trades.filter((t) => t.instrument_type === 'perpetual')),
      options: catProj(trades.filter((t) => t.instrument_type === 'call' || t.instrument_type === 'put')),
      calls: catProj(trades.filter((t) => t.instrument_type === 'call')),
      puts: catProj(trades.filter((t) => t.instrument_type === 'put')),
    },
    edges: [],
    avoid: [],
  }
}

function computeWhatIfs(trades: MatchedTrade[], currentPnl: number, undMap: Map<string, any>): WhatIfScenario[] {
  if (!trades.length) return []
  const scenarios: WhatIfScenario[] = []
  const sortedByPnl = [...trades].sort((a, b) => a.net_pnl - b.net_pnl)

  // Cut worst 5
  if (trades.length > 5 && sortedByPnl[0].net_pnl < 0) {
    const newPnl = sum(sortedByPnl.slice(5), 'net_pnl')
    if (newPnl > currentPnl) {
      scenarios.push({
        id: 'cut_worst_5', label: 'Cut your 5 worst trades', icon: 'scissors',
        original_pnl: r2(currentPnl), new_pnl: r2(newPnl),
        improvement_pct: currentPnl ? r1(((newPnl - currentPnl) / Math.abs(currentPnl)) * 100) : 0,
        detail: 'Tighter risk management would have boosted your P&L',
      })
    }
  }

  // Remove worst underlying
  const undPnl = new Map<string, number>()
  const undCount = new Map<string, number>()
  for (const [u, d] of undMap) { undPnl.set(u, d.pnl); undCount.set(u, d.trades) }
  let worstUnd = '', worstPnlVal = 0
  for (const [u, p] of undPnl) { if (p < worstPnlVal) { worstUnd = u; worstPnlVal = p } }
  if (worstUnd && worstPnlVal < 0) {
    const newPnl = currentPnl - worstPnlVal
    scenarios.push({
      id: `remove_${worstUnd}`, label: `Stop trading ${worstUnd}`, icon: 'ban',
      original_pnl: r2(currentPnl), new_pnl: r2(newPnl),
      improvement_pct: currentPnl ? r1(((newPnl - currentPnl) / Math.abs(currentPnl)) * 100) : 0,
      detail: `${undCount.get(worstUnd) || 0} fewer trades, less exposure to ${worstUnd}`,
    })
  }

  // Only trade top 3
  const top3 = [...undPnl.entries()].sort(([, a], [, b]) => b - a).slice(0, 3)
  const top3Names = new Set(top3.map(([u]) => u))
  const top3Pnl = trades.filter((t) => top3Names.has(t.underlying)).reduce((s, t) => s + t.net_pnl, 0)
  if (top3Pnl > currentPnl && undPnl.size > 3) {
    scenarios.push({
      id: 'top3_only', label: `Only trade ${[...top3Names].join(', ')}`, icon: 'target',
      original_pnl: r2(currentPnl), new_pnl: r2(top3Pnl),
      improvement_pct: currentPnl ? r1(((top3Pnl - currentPnl) / Math.abs(currentPnl)) * 100) : 0,
      detail: `Focus on your top 3, fewer trades, higher win rate`,
    })
  }

  return scenarios.sort((a, b) => b.improvement_pct - a.improvement_pct).slice(0, 5)
}

function computeAchievements(trades: MatchedTrade[], dailyPnl: { pnl: number; date: string }[], winRate: number, bestStreak: number, underlyings: string[]): Achievement[] {
  const a: Achievement[] = []
  const add = (id: string, name: string, icon: string, desc: string, unlocked: boolean, date?: string) =>
    a.push({ id, name, icon, description: desc, unlocked, unlocked_date: date })

  let cum = 0, d1k: string | undefined, d10k: string | undefined
  for (const d of dailyPnl) {
    cum += d.pnl
    if (cum >= 1000 && !d1k) d1k = d.date
    if (cum >= 10000 && !d10k) d10k = d.date
  }

  add('first_profit', 'First Profit', 'trophy', 'First day with positive P&L', dailyPnl.some((d) => d.pnl > 0))
  add('1k_club', '$1K Club', 'dollar-sign', 'Cumulative P&L exceeds $1,000', !!d1k, d1k)
  add('10k_club', '$10K Club', 'gem', 'Cumulative P&L exceeds $10,000', !!d10k, d10k)
  add('hot_streak', 'Hot Streak', 'flame', '5+ consecutive winning days', bestStreak >= 5)
  add('century', 'Century', 'trending-up', '100 total trades', trades.length >= 100)
  add('sharpshooter', 'Sharpshooter', 'crosshair', '70%+ win rate over 50+ trades', winRate >= 70 && trades.length >= 50)
  add('diversified', 'Diversified', 'pie-chart', 'Traded 10+ different tokens', underlyings.length >= 10)
  add('fee_efficient', 'Fee Efficient', 'zap', 'Maker fill rate > 60%',
    trades.length > 0 && trades.filter((t) => t.role === 'maker').length / trades.length > 0.6)

  return a
}
