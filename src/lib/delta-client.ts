/**
 * Delta Exchange API client that runs in the browser.
 * Requests come from the user's IP (whitelisted on Delta).
 * API keys stay in browser memory only — never sent to our server.
 */

const BASE_URL = 'https://api.india.delta.exchange'

async function hmacSign(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function makeRequest(
  apiKey: string,
  apiSecret: string,
  method: string,
  path: string,
  queryString = '',
): Promise<any> {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const message = method + timestamp + path + (queryString ? '?' + queryString : '')
  const signature = await hmacSign(apiSecret, message)

  const url = BASE_URL + path + (queryString ? '?' + queryString : '')
  const resp = await fetch(url, {
    method,
    headers: {
      'api-key': apiKey,
      signature,
      timestamp,
      'Content-Type': 'application/json',
    },
  })

  if (resp.status === 429) {
    const reset = resp.headers.get('X-RATE-LIMIT-RESET')
    const waitMs = reset ? parseInt(reset) : 5000
    await new Promise((r) => setTimeout(r, waitMs))
    return makeRequest(apiKey, apiSecret, method, path, queryString)
  }

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Delta API ${resp.status}: ${text}`)
  }

  return resp.json()
}

export interface FetchProgress {
  step: string
  stepIndex: number
  totalSteps: number
  detail?: string
  percent: number
}

export async function fetchAllDeltaData(
  apiKey: string,
  apiSecret: string,
  onProgress: (p: FetchProgress) => void,
) {
  // Step 0: Validate credentials
  onProgress({ step: 'Connecting to Delta Exchange...', stepIndex: 0, totalSteps: 6, percent: 5 })
  const balResp = await makeRequest(apiKey, apiSecret, 'GET', '/v2/wallet/balances')
  if (!balResp.success) throw new Error('Invalid API key or missing read permission')
  const balances = balResp.result || []

  // Step 1: Fetch products
  onProgress({ step: 'Fetching product metadata...', stepIndex: 1, totalSteps: 6, percent: 10 })
  const prodResp = await makeRequest(apiKey, apiSecret, 'GET', '/v2/products', 'page_size=500')
  const products: any[] = prodResp.result || []
  const productsMap: Record<number, any> = {}
  for (const p of products) productsMap[p.id] = p

  // Step 2: Fetch fills (paginated)
  onProgress({ step: 'Fetching fill history...', stepIndex: 2, totalSteps: 6, percent: 15 })
  const fills: any[] = []
  let afterCursor: string | null = null
  let page = 0
  while (true) {
    const params: string[] = ['page_size=50']
    if (afterCursor) params.push(`after=${afterCursor}`)
    const qs = params.join('&')
    const data = await makeRequest(apiKey, apiSecret, 'GET', '/v2/fills', qs)
    if (!data.success) break
    const batch = data.result || []
    fills.push(...batch)
    page++
    const pct = Math.min(15 + page * 2, 55)
    onProgress({
      step: 'Fetching fill history...',
      stepIndex: 2,
      totalSteps: 6,
      percent: pct,
      detail: `${fills.length} fills fetched (${page} pages)`,
    })
    afterCursor = data.meta?.after ?? null
    if (!afterCursor || batch.length < 50) break
  }

  // Step 3: Fetch wallet transactions (paginated)
  onProgress({ step: 'Fetching wallet transactions...', stepIndex: 3, totalSteps: 6, percent: 60 })
  const transactions: any[] = []
  afterCursor = null
  while (true) {
    const params: string[] = ['page_size=50']
    if (afterCursor) params.push(`after=${afterCursor}`)
    const qs = params.join('&')
    const data = await makeRequest(apiKey, apiSecret, 'GET', '/v2/wallet/transactions', qs)
    if (!data.success) break
    const batch = data.result || []
    transactions.push(...batch)
    afterCursor = data.meta?.after ?? null
    if (!afterCursor || batch.length < 50) break
  }

  // Step 4: Fetch open positions
  onProgress({ step: 'Fetching open positions...', stepIndex: 4, totalSteps: 6, percent: 70 })
  let positions: any[] = []
  try {
    const posResp = await makeRequest(apiKey, apiSecret, 'GET', '/v2/positions/margined')
    positions = posResp.success ? posResp.result || [] : []
  } catch {
    positions = []
  }

  // Step 5: Compute analytics
  onProgress({ step: 'Computing analytics...', stepIndex: 5, totalSteps: 6, percent: 80 })

  return { fills, transactions, positions, products, productsMap, balances }
}
