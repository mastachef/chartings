import type { CandleData, Timeframe } from '@/types/chart'

const timeframeMap: Record<Timeframe, { interval: string; range: string }> = {
  '1m': { interval: '1m', range: '7d' },
  '5m': { interval: '5m', range: '60d' },
  '15m': { interval: '15m', range: '60d' },
  '30m': { interval: '30m', range: '60d' },
  '1h': { interval: '1h', range: '2y' },
  '4h': { interval: '1h', range: '2y' },
  '1d': { interval: '1d', range: 'max' },
  '3d': { interval: '1d', range: 'max' },
  '1w': { interval: '1wk', range: 'max' },
  '1M': { interval: '1mo', range: 'max' },
  '3M': { interval: '1mo', range: 'max' },
}

export async function fetchYahooKlines(
  symbol: string,
  timeframe: Timeframe
): Promise<CandleData[]> {
  const config = timeframeMap[timeframe]

  const url = `/api/yahoo/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${config.interval}&range=${config.range}`

  const response = await fetch(url)
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
  const url = `/api/yahoo/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`

  try {
    const response = await fetch(url)
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
