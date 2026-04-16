import type { DeltaReportData, LoadingProgress } from '../types/report'
import { fetchAllDeltaData } from './delta-client'
import { matchTrades, computeAnalytics } from './analytics-engine'

/**
 * Client-side portfolio analysis.
 * All Delta API calls happen from the user's browser (their whitelisted IP).
 * API keys never leave the browser.
 */
export async function analyzePortfolio(
  apiKey: string,
  apiSecret: string,
  onProgress: (progress: LoadingProgress) => void,
): Promise<DeltaReportData> {
  // Step 1-4: Fetch all data from Delta (browser → Delta API)
  const { fills, transactions, positions, productsMap, balances } =
    await fetchAllDeltaData(apiKey, apiSecret, onProgress)

  // Step 5: Match trades (in browser)
  onProgress({ step: 'Matching trades...', stepIndex: 5, totalSteps: 7, percent: 80, detail: `${fills.length} fills to process` })
  const matchedTrades = matchTrades(fills, productsMap)

  // Step 6: Compute analytics (in browser)
  onProgress({ step: 'Computing analytics...', stepIndex: 6, totalSteps: 7, percent: 90, detail: `${matchedTrades.length} trades matched` })
  const report = computeAnalytics(matchedTrades, fills, transactions, positions, productsMap, balances)

  onProgress({ step: 'Done!', stepIndex: 7, totalSteps: 7, percent: 100 })

  return report
}

/**
 * AI advice — calls backend, then normalizes response to match frontend interface.
 *
 * Backend returns: { grade, summary, strengths[], weaknesses[], recommendations[],
 *                    kelly_full, kelly_half, pareto_insight, overall_score, ... }
 *
 * Frontend expects: { grade, summary, whats_working[], whats_not_working[],
 *                     how_to_improve[], kelly_criterion{}, bottom_line, key_metrics[] }
 */
export async function fetchAdvice(
  report: DeltaReportData,
  tone: 'helpful' | 'roast',
): Promise<any> {
  const response = await fetch('/api/advice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ report, tone }),
  })
  if (!response.ok) throw new Error(`Advice request failed: ${response.status}`)
  const raw = await response.json()

  // Normalize backend response to frontend AdviceResponse interface
  const o = report.overview
  const strengths: any[] = raw.strengths || []
  const weaknesses: any[] = raw.weaknesses || []
  const recs: any[] = raw.recommendations || []

  // Tab name mapping for navigation links
  const TAB_NAMES: Record<number, string> = {
    0: 'Overview', 1: 'P&L Analysis', 2: 'Instruments', 3: 'Funding',
    4: 'Expiry', 5: 'Risk & Metrics', 6: 'Charges', 7: 'Open Portfolio',
    8: 'Trade Log', 9: 'AI Advice',
  }

  return {
    grade: raw.grade || '?',
    summary: raw.summary || '',
    key_metrics: [
      { label: 'Net P&L', value: `$${o.net_realized_pnl.toFixed(2)}` },
      { label: 'Win Rate', value: `${o.win_rate.toFixed(1)}%` },
      { label: 'Trades', value: String(o.total_trades) },
    ],
    whats_working: strengths.map((s: any) => typeof s === 'string' ? s : s.text || ''),
    whats_not_working: weaknesses.map((w: any) => typeof w === 'string' ? w : w.text || ''),
    how_to_improve: recs.map((r: any) => ({
      text: typeof r === 'string' ? r : r.text || '',
      tab: typeof r === 'object' && r.related_tab != null ? TAB_NAMES[r.related_tab] : undefined,
    })),
    kelly_criterion: {
      full_kelly_pct: raw.kelly_full ?? 0,
      half_kelly_pct: raw.kelly_half ?? 0,
      explanation: raw.pareto_insight || 'Kelly Criterion calculates optimal position sizing based on your win rate and payoff ratio.',
    },
    bottom_line: raw.pareto_insight || raw.summary || '',
    overall_score: raw.overall_score ?? 0,
    dimensions: raw.dimensions || {},
  }
}
