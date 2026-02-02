import type { CandleData, Timeframe } from '@/types/chart'

const timeframeMap: Record<Timeframe, { interval: string; range: string }> = {
  '1m': { interval: '1m', range: '7d' },
  '5m': { interval: '5m', range: '60d' },
  '15m': { interval: '15m', range: '60d' },
  '30m': { interval: '30m', range: '60d' },
  '1h': { interval: '1h', range: '2y' },
  '4h': { interval: '1h', range: '2y' },
  '1d': { interval: '1d', range: '5y' },
  '3d': { interval: '1d', range: '5y' },
  '1w': { interval: '1wk', range: 'max' },
  '1M': { interval: '1mo', range: 'max' },
  '3M': { interval: '1mo', range: 'max' },
}

// Cloudflare Worker proxy for Yahoo Finance (deployed to your account)
const WORKER_URL = 'https://yahoo-finance-proxy.voxadub.workers.dev'

// Fallback CORS proxies if worker is not configured
const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
]

// Cache for responses
const responseCache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 60 * 1000 // 1 minute cache

async function fetchWithProxy(yahooUrl: string): Promise<Response> {
  const isDev = import.meta.env.DEV

  if (isDev) {
    // Use Vite proxy in development
    const path = yahooUrl.replace('https://query1.finance.yahoo.com', '')
    return fetch(`/api/yahoo${path}`)
  }

  // Check cache first
  const cached = responseCache.get(yahooUrl)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return new Response(JSON.stringify(cached.data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  let lastError: Error | null = null

  // Try Cloudflare Worker first (most reliable)
  if (WORKER_URL) {
    try {
      const path = yahooUrl.replace('https://query1.finance.yahoo.com/', '')
      const response = await fetch(`${WORKER_URL}/${path}`, {
        headers: { 'Accept': 'application/json' },
      })

      if (response.ok) {
        // Cache successful response
        const data = await response.json()
        responseCache.set(yahooUrl, { data, timestamp: Date.now() })
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    } catch (e) {
      lastError = e instanceof Error ? e : new Error('Worker fetch failed')
    }
  }

  // Fallback to CORS proxies
  for (const proxyFn of CORS_PROXIES) {
    try {
      const proxyUrl = proxyFn(yahooUrl)
      const response = await fetch(proxyUrl, {
        headers: { 'Accept': 'application/json' },
      })

      if (response.ok) {
        // Cache successful response
        const data = await response.json()
        responseCache.set(yahooUrl, { data, timestamp: Date.now() })
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      if (response.status === 403 || response.status === 429) {
        continue
      }

      return response
    } catch (e) {
      lastError = e instanceof Error ? e : new Error('Fetch failed')
      continue
    }
  }

  throw lastError || new Error('All proxies failed - deploy the Cloudflare Worker in /worker folder')
}

export async function fetchYahooKlines(
  symbol: string,
  timeframe: Timeframe
): Promise<CandleData[]> {
  const config = timeframeMap[timeframe]

  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${config.interval}&range=${config.range}`

  const response = await fetchWithProxy(yahooUrl)

  if (!response.ok) {
    throw new Error(`Yahoo Finance API error: ${response.status}`)
  }

  const data = await response.json()
  const result = data.chart?.result?.[0]

  if (!result) {
    throw new Error('No data returned from Yahoo Finance')
  }

  const timestamps = result.timestamp || []
  const quote = result.indicators?.quote?.[0] || {}
  const opens = quote.open || []
  const highs = quote.high || []
  const lows = quote.low || []
  const closes = quote.close || []
  const volumes = quote.volume || []

  const candles: CandleData[] = []

  for (let i = 0; i < timestamps.length; i++) {
    if (
      opens[i] != null &&
      highs[i] != null &&
      lows[i] != null &&
      closes[i] != null
    ) {
      candles.push({
        time: timestamps[i] as import('lightweight-charts').Time,
        open: opens[i],
        high: highs[i],
        low: lows[i],
        close: closes[i],
        volume: volumes[i] || 0,
      })
    }
  }

  if (timeframe === '4h') {
    return aggregateTo4Hour(candles)
  }

  if (timeframe === '3d') {
    return aggregateCandles(candles, 3)
  }

  if (timeframe === '3M') {
    return aggregateCandles(candles, 3)
  }

  return candles
}

function aggregateCandles(candles: CandleData[], period: number): CandleData[] {
  const aggregated: CandleData[] = []

  for (let i = 0; i < candles.length; i += period) {
    const chunk = candles.slice(i, i + period)
    if (chunk.length === 0) continue

    aggregated.push({
      time: chunk[0].time,
      open: chunk[0].open,
      high: Math.max(...chunk.map(c => c.high)),
      low: Math.min(...chunk.map(c => c.low)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((sum, c) => sum + c.volume, 0),
    })
  }

  return aggregated
}

function aggregateTo4Hour(hourlyCandles: CandleData[]): CandleData[] {
  return aggregateCandles(hourlyCandles, 4)
}

export async function searchYahooSymbols(query: string): Promise<Array<{ symbol: string; name: string }>> {
  const yahooUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`

  try {
    const response = await fetchWithProxy(yahooUrl)
    if (!response.ok) {
      return []
    }

    const data = await response.json()
    return (data.quotes || [])
      .filter((q: { quoteType: string }) => q.quoteType === 'EQUITY' || q.quoteType === 'ETF')
      .map((q: { symbol: string; shortname?: string; longname?: string }) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
      }))
  } catch {
    return []
  }
}
