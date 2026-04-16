import type { DeltaReportData, LoadingProgress } from '../types/report'

export async function analyzePortfolio(
  apiKey: string,
  apiSecret: string,
  onProgress: (progress: LoadingProgress) => void,
): Promise<DeltaReportData> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `HTTP ${response.status}`)
  }

  if (!response.body) {
    throw new Error('No response body — streaming not supported')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      if (!part.trim()) continue
      const lines = part.split('\n')
      let eventType = ''
      let eventData = ''

      for (const line of lines) {
        if (line.startsWith('event: ')) eventType = line.slice(7)
        else if (line.startsWith('data: ')) eventData = line.slice(6)
      }

      if (!eventType || !eventData) continue

      try {
        const data = JSON.parse(eventData)
        if (eventType === 'progress') {
          onProgress(data as LoadingProgress)
        } else if (eventType === 'error') {
          throw new Error(data.message || 'Analysis failed')
        } else if (eventType === 'complete') {
          return data as DeltaReportData
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue
        throw e
      }
    }
  }

  throw new Error('Stream ended without complete event')
}

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
