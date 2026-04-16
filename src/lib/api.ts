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
 * AI advice still goes through the backend (needs Groq API key).
 */
export async function fetchAdvice(
  report: DeltaReportData,
  tone: 'helpful' | 'roast',
): Promise<unknown> {
  const response = await fetch('/api/advice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ report, tone }),
  })
  if (!response.ok) throw new Error(`Advice request failed: ${response.status}`)
  return response.json()
}
