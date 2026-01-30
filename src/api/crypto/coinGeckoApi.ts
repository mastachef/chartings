import type { CandleData, Timeframe } from '@/types/chart'

const BASE_URL = 'https://api.coingecko.com/api/v3'

// Cache for symbol to CoinGecko ID lookups
const symbolToIdCache: Record<string, string> = {}

// Known mappings for symbols that don't match their CoinGecko ID
const knownMappings: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'SOL': 'solana',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'DOGE': 'dogecoin',
  'AVAX': 'avalanche-2',
  'DOT': 'polkadot',
  'MATIC': 'matic-network',
  'BNB': 'binancecoin',
  'LTC': 'litecoin',
  'ATOM': 'cosmos',
  'SHIB': 'shiba-inu',
  'FET': 'fetch-ai',
  'GRT': 'the-graph',
  'STX': 'blockstack',
  'IMX': 'immutable-x',
}

// Timeframe to CoinGecko days parameter
const timeframeToDays: Record<Timeframe, number> = {
  '1m': 1,       // 1 day of 1-minute data
  '5m': 1,       // 1 day
  '15m': 7,      // 7 days
  '30m': 14,     // 14 days
  '1h': 30,      // 30 days
  '4h': 90,      // 90 days
  '1d': 365,     // 1 year
  '3d': 730,     // 2 years
  '1w': 1095,    // 3 years
  '1M': 'max' as unknown as number,
  '3M': 'max' as unknown as number,
}

function cleanSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/[/-]?(USD|USDT|USDC)$/i, '')
}

// Search CoinGecko for a coin by symbol
async function searchCoinGeckoId(symbol: string): Promise<string | null> {
  const cleaned = cleanSymbol(symbol)

  // Check cache first
  if (symbolToIdCache[cleaned]) {
    return symbolToIdCache[cleaned]
  }

  // Check known mappings
  if (knownMappings[cleaned]) {
    symbolToIdCache[cleaned] = knownMappings[cleaned]
    return knownMappings[cleaned]
  }

  try {
    // Search CoinGecko for the symbol
    const searchUrl = `${BASE_URL}/search?query=${cleaned.toLowerCase()}`
    const response = await fetch(searchUrl)

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    const coins = data.coins || []

    // Find exact symbol match (case-insensitive)
    const exactMatch = coins.find((coin: { symbol: string; id: string }) =>
      coin.symbol.toUpperCase() === cleaned
    )

    if (exactMatch) {
      symbolToIdCache[cleaned] = exactMatch.id
      return exactMatch.id
    }

    // If no exact match, try the first result
    if (coins.length > 0) {
      symbolToIdCache[cleaned] = coins[0].id
      return coins[0].id
    }

    return null
  } catch {
    return null
  }
}

async function getCoinGeckoId(symbol: string): Promise<string> {
  const cleaned = cleanSymbol(symbol)

  // Check cache and known mappings first
  if (symbolToIdCache[cleaned]) {
    return symbolToIdCache[cleaned]
  }
  if (knownMappings[cleaned]) {
    return knownMappings[cleaned]
  }

  // Try to search for it
  const searchedId = await searchCoinGeckoId(symbol)
  if (searchedId) {
    return searchedId
  }

  // Fallback: just use lowercase symbol
  return cleaned.toLowerCase()
}

interface OHLCData {
  0: number  // timestamp
  1: number  // open
  2: number  // high
  3: number  // low
  4: number  // close
}

interface MarketChartData {
  prices: [number, number][]
  market_caps: [number, number][]
  total_volumes: [number, number][]
}

// Fetch volume data from market_chart endpoint
async function fetchCoinGeckoVolumes(
  coinId: string,
  days: number | string
): Promise<Map<number, number>> {
  const volumeMap = new Map<number, number>()

  try {
    const url = `${BASE_URL}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`
    const response = await fetch(url)

    if (!response.ok) return volumeMap

    const data: MarketChartData = await response.json()

    if (data.total_volumes && Array.isArray(data.total_volumes)) {
      for (const [timestamp, volume] of data.total_volumes) {
        // Round to nearest minute for matching
        const roundedTs = Math.floor(timestamp / 60000) * 60
        volumeMap.set(roundedTs, volume)
      }
    }
  } catch {
    // Silently fail, volumes are optional
  }

  return volumeMap
}

export async function fetchCoinGeckoOHLC(
  symbol: string,
  timeframe: Timeframe
): Promise<CandleData[]> {
  const coinId = await getCoinGeckoId(symbol)
  const days = timeframeToDays[timeframe]

  // Fetch OHLC and volumes in parallel
  const [ohlcResponse, volumeMap] = await Promise.all([
    fetch(`${BASE_URL}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`),
    fetchCoinGeckoVolumes(coinId, days),
  ])

  if (!ohlcResponse.ok) {
    throw new Error(`CoinGecko API error: ${ohlcResponse.status}`)
  }

  const data: OHLCData[] = await ohlcResponse.json()

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('No data returned from CoinGecko')
  }

  // CoinGecko returns [timestamp, open, high, low, close]
  const candles: CandleData[] = data.map((d) => {
    const timestamp = Math.floor(d[0] / 1000)
    const roundedTs = Math.floor(d[0] / 60000) * 60

    // Try to find matching volume (within a few minutes tolerance)
    let volume = 0
    for (let offset = 0; offset <= 30; offset++) {
      const checkTs = roundedTs + offset * 60
      const checkTs2 = roundedTs - offset * 60
      if (volumeMap.has(checkTs)) {
        volume = volumeMap.get(checkTs)!
        break
      }
      if (volumeMap.has(checkTs2)) {
        volume = volumeMap.get(checkTs2)!
        break
      }
    }

    return {
      time: timestamp as import('lightweight-charts').Time,
      open: d[1],
      high: d[2],
      low: d[3],
      close: d[4],
      volume,
    }
  })

  // Aggregate if needed for larger timeframes
  if (timeframe === '3d') {
    return aggregateCandles(candles, 3)
  }
  if (timeframe === '1M') {
    return aggregateCandles(candles, 30)
  }
  if (timeframe === '3M') {
    return aggregateCandles(candles, 90)
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

// CoinGecko can search for any symbol, so always return true
export function isCoinGeckoSymbol(_symbol: string): boolean {
  return true
}

// Search CoinGecko for symbols matching a query
export async function searchCoinGeckoSymbols(query: string): Promise<Array<{ symbol: string; name: string }>> {
  if (query.length < 2) return []

  try {
    const searchUrl = `${BASE_URL}/search?query=${encodeURIComponent(query.toLowerCase())}`
    const response = await fetch(searchUrl)

    if (!response.ok) return []

    const data = await response.json()
    const coins = data.coins || []

    return coins.slice(0, 10).map((coin: { symbol: string; name: string; id: string }) => {
      // Cache the mapping for later use
      symbolToIdCache[coin.symbol.toUpperCase()] = coin.id
      return {
        symbol: `${coin.symbol.toUpperCase()}USD`,
        name: coin.name,
      }
    })
  } catch {
    return []
  }
}
