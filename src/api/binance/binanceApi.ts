import type { CandleData, Timeframe } from '@/types/chart'

const BASE_URL = 'https://api.binance.us/api/v3'

const timeframeMap: Record<Timeframe, string> = {
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
  '3M': '1M',
}

export async function fetchBinanceKlines(
  symbol: string,
  timeframe: Timeframe
): Promise<CandleData[]> {
  const interval = timeframeMap[timeframe]

  // Fetch max 1000 candles (Binance limit) - simple single request
  const url = `${BASE_URL}/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=1000`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status}`)
  }

  const data: Array<[
    number, string, string, string, string, string,
    number, string, number, string, string, string
  ]> = await response.json()

  return data.map((kline) => ({
    time: (kline[0] / 1000) as import('lightweight-charts').Time,
    open: parseFloat(kline[1]),
    high: parseFloat(kline[2]),
    low: parseFloat(kline[3]),
    close: parseFloat(kline[4]),
    volume: parseFloat(kline[5]),
  }))
}

export async function searchBinanceSymbols(query: string): Promise<string[]> {
  const url = `${BASE_URL}/exchangeInfo`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status}`)
  }

  const data = await response.json()
  const symbols: string[] = data.symbols
    .filter((s: { status: string; symbol: string }) =>
      s.status === 'TRADING' &&
      s.symbol.toLowerCase().includes(query.toLowerCase())
    )
    .map((s: { symbol: string }) => s.symbol)
    .slice(0, 20)

  return symbols
}

let exchangeInfoCache: { symbols: string[] } | null = null

export async function getBinanceSymbols(): Promise<string[]> {
  if (exchangeInfoCache) {
    return exchangeInfoCache.symbols
  }

  const url = `${BASE_URL}/exchangeInfo`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status}`)
  }

  const data = await response.json()
  exchangeInfoCache = {
    symbols: data.symbols
      .filter((s: { status: string }) => s.status === 'TRADING')
      .map((s: { symbol: string }) => s.symbol),
  }

  return exchangeInfoCache.symbols
}
