import type { CandleData, Timeframe } from '@/types/chart'

const BASE_URL = 'https://api.binance.com/api/v3'

// Binance interval mapping
const timeframeToInterval: Record<Timeframe, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
  '3d': '3d',
  '1w': '1w',
  '1M': '1M',
  '3M': '1M', // Will aggregate
}

function parseSymbol(symbol: string): string {
  // Convert BTCUSD -> BTCUSDT for Binance
  const cleaned = symbol.toUpperCase().replace(/[/-]/g, '')
  if (cleaned.endsWith('USD') && !cleaned.endsWith('USDT')) {
    return cleaned + 'T'
  }
  if (!cleaned.endsWith('USDT') && !cleaned.endsWith('BUSD') && !cleaned.endsWith('BTC') && !cleaned.endsWith('ETH')) {
    return cleaned + 'USDT'
  }
  return cleaned
}

interface BinanceKline {
  0: number  // Open time
  1: string  // Open
  2: string  // High
  3: string  // Low
  4: string  // Close
  5: string  // Volume
  6: number  // Close time
  7: string  // Quote asset volume
  8: number  // Number of trades
  9: string  // Taker buy base asset volume
  10: string // Taker buy quote asset volume
  11: string // Ignore
}

export async function fetchBinanceKlines(
  symbol: string,
  timeframe: Timeframe
): Promise<CandleData[]> {
  const binanceSymbol = parseSymbol(symbol)
  const interval = timeframeToInterval[timeframe]

  const url = `${BASE_URL}/klines?symbol=${binanceSymbol}&interval=${interval}&limit=1000`

  const response = await fetch(url)
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.msg || `Binance API error: ${response.status}`)
  }

  const data: BinanceKline[] = await response.json()

  const candles: CandleData[] = data.map((d) => ({
    time: Math.floor(d[0] / 1000) as import('lightweight-charts').Time,
    open: parseFloat(d[1]),
    high: parseFloat(d[2]),
    low: parseFloat(d[3]),
    close: parseFloat(d[4]),
    volume: parseFloat(d[5]),
  }))

  // Aggregate for 3M timeframe
  if (timeframe === '3M') {
    return aggregateCandles(candles, 3)
  }

  return candles
}

function aggregateCandles(candles: CandleData[], period: number): CandleData[] {
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

// Search for available Binance trading pairs
export async function searchBinanceSymbols(query: string): Promise<Array<{ symbol: string; name: string }>> {
  // Binance doesn't have a search API, so we'll use exchange info
  // and filter locally (this is cached after first load)
  const symbols = await getBinanceSymbols()
  const upperQuery = query.toUpperCase()

  return symbols
    .filter(s => s.symbol.includes(upperQuery))
    .slice(0, 10)
}

let cachedSymbols: Array<{ symbol: string; name: string }> | null = null

async function getBinanceSymbols(): Promise<Array<{ symbol: string; name: string }>> {
  if (cachedSymbols) return cachedSymbols

  try {
    const response = await fetch(`${BASE_URL}/exchangeInfo`)
    if (!response.ok) return []

    const data = await response.json()
    cachedSymbols = data.symbols
      .filter((s: { status: string; quoteAsset: string }) =>
        s.status === 'TRADING' && s.quoteAsset === 'USDT'
      )
      .map((s: { symbol: string; baseAsset: string }) => ({
        symbol: s.symbol.replace('USDT', 'USD'),
        name: s.baseAsset,
      }))

    return cachedSymbols ?? []
  } catch {
    return []
  }
}

// Check if a symbol exists on Binance
export async function isBinanceSymbol(symbol: string): Promise<boolean> {
  const binanceSymbol = parseSymbol(symbol)
  try {
    const response = await fetch(`${BASE_URL}/ticker/price?symbol=${binanceSymbol}`)
    return response.ok
  } catch {
    return false
  }
}
