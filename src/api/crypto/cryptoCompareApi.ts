import type { CandleData, Timeframe } from '@/types/chart'

const BASE_URL = 'https://min-api.cryptocompare.com/data/v2'

interface CryptoCompareCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volumefrom: number
  volumeto: number
}

interface CryptoCompareResponse {
  Response: string
  Message?: string
  Data: {
    Data: CryptoCompareCandle[]
    TimeFrom: number
    TimeTo: number
  }
}

// Config: endpoint, limit per request, number of batches to fetch initially
const timeframeConfig: Record<Timeframe, { endpoint: string; limit: number; batches: number; aggregate?: number }> = {
  '1m': { endpoint: 'histominute', limit: 2000, batches: 1 },
  '5m': { endpoint: 'histominute', limit: 2000, batches: 1, aggregate: 5 },
  '15m': { endpoint: 'histominute', limit: 2000, batches: 2, aggregate: 15 },
  '30m': { endpoint: 'histohour', limit: 2000, batches: 2 },
  '1h': { endpoint: 'histohour', limit: 2000, batches: 4 },
  '4h': { endpoint: 'histohour', limit: 2000, batches: 4, aggregate: 4 },
  '1d': { endpoint: 'histoday', limit: 2000, batches: 2 },
  '3d': { endpoint: 'histoday', limit: 2000, batches: 3, aggregate: 3 },
  '1w': { endpoint: 'histoday', limit: 2000, batches: 4, aggregate: 7 },
  '1M': { endpoint: 'histoday', limit: 2000, batches: 5, aggregate: 30 },
  '3M': { endpoint: 'histoday', limit: 2000, batches: 8, aggregate: 90 },
}

function parseSymbol(symbol: string): { fsym: string; tsym: string } {
  const cleaned = symbol.toUpperCase().replace(/[/-]/g, '')
  const quotes = ['USD', 'USDT', 'USDC', 'EUR', 'GBP', 'BTC', 'ETH']

  for (const quote of quotes) {
    if (cleaned.endsWith(quote)) {
      return {
        fsym: cleaned.slice(0, -quote.length),
        tsym: quote === 'USDT' || quote === 'USDC' ? 'USD' : quote,
      }
    }
  }

  return {
    fsym: cleaned.slice(0, -3),
    tsym: cleaned.slice(-3),
  }
}

function aggregateCandles(candles: CandleData[], period: number): CandleData[] {
  if (period <= 1) return candles

  const result: CandleData[] = []

  for (let i = 0; i < candles.length; i += period) {
    const chunk = candles.slice(i, i + period)
    if (chunk.length === 0) continue

    result.push({
      time: chunk[0].time,
      open: chunk[0].open,
      high: Math.max(...chunk.map(c => c.high)),
      low: Math.min(...chunk.map(c => c.low)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((sum, c) => sum + c.volume, 0),
    })
  }

  return result
}

async function fetchBatch(
  endpoint: string,
  fsym: string,
  tsym: string,
  limit: number,
  toTs?: number
): Promise<{ candles: CryptoCompareCandle[]; earliestTime: number }> {
  let url = `${BASE_URL}/${endpoint}?fsym=${fsym}&tsym=${tsym}&limit=${limit}`
  if (toTs) {
    url += `&toTs=${toTs}`
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`CryptoCompare API error: ${response.status}`)
  }

  const data: CryptoCompareResponse = await response.json()

  if (data.Response === 'Error') {
    throw new Error(data.Message || 'CryptoCompare API error')
  }

  const candles = data.Data.Data.filter(c => c.close > 0)
  const earliestTime = candles.length > 0 ? candles[0].time : 0

  return { candles, earliestTime }
}

function processCandles(rawCandles: CryptoCompareCandle[], aggregate?: number): CandleData[] {
  // Deduplicate by time
  const seen = new Set<number>()
  const uniqueCandles = rawCandles.filter(c => {
    if (seen.has(c.time)) return false
    seen.add(c.time)
    return true
  })

  // Sort by time
  uniqueCandles.sort((a, b) => a.time - b.time)

  // Convert to CandleData
  const candles: CandleData[] = uniqueCandles.map(c => ({
    time: c.time as import('lightweight-charts').Time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volumefrom,
  }))

  // Aggregate if needed
  if (aggregate && aggregate > 1) {
    return aggregateCandles(candles, aggregate)
  }

  return candles
}

export async function fetchCryptoCompareKlines(
  symbol: string,
  timeframe: Timeframe
): Promise<CandleData[]> {
  const { fsym, tsym } = parseSymbol(symbol)
  const config = timeframeConfig[timeframe]

  const allCandles: CryptoCompareCandle[] = []
  let toTs: number | undefined = undefined

  // Fetch multiple batches
  for (let i = 0; i < config.batches; i++) {
    const { candles, earliestTime } = await fetchBatch(
      config.endpoint,
      fsym,
      tsym,
      config.limit,
      toTs
    )

    if (candles.length === 0) break

    allCandles.unshift(...candles)
    toTs = earliestTime - 1

    if (i < config.batches - 1) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return processCandles(allCandles, config.aggregate)
}

// Fetch more historical data before a given timestamp
export async function fetchMoreCryptoHistory(
  symbol: string,
  timeframe: Timeframe,
  beforeTimestamp: number
): Promise<CandleData[]> {
  const { fsym, tsym } = parseSymbol(symbol)
  const config = timeframeConfig[timeframe]

  const allCandles: CryptoCompareCandle[] = []
  let toTs = beforeTimestamp - 1

  // Fetch 2 batches of older data
  for (let i = 0; i < 2; i++) {
    const { candles, earliestTime } = await fetchBatch(
      config.endpoint,
      fsym,
      tsym,
      config.limit,
      toTs
    )

    if (candles.length === 0) break

    allCandles.unshift(...candles)
    toTs = earliestTime - 1

    if (i < 1) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return processCandles(allCandles, config.aggregate)
}
