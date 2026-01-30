import { useState, useEffect, useCallback, useRef } from 'react'
import type { CandleData, Timeframe, DataSource } from '@/types/chart'
import { fetchCryptoCompareKlines, fetchMoreCryptoHistory } from '@/api/crypto/cryptoCompareApi'
import { fetchCoinGeckoOHLC } from '@/api/crypto/coinGeckoApi'
import { fetchBinanceKlines } from '@/api/crypto/binanceApi'
import { fetchYahooKlines } from '@/api/yahoo/yahooApi'

interface UseCandlestickDataResult {
  data: CandleData[]
  loading: boolean
  loadingMore: boolean
  error: string | null
  refetch: () => void
  loadMoreHistory: () => Promise<void>
  hasMoreHistory: boolean
}

export function useCandlestickData(
  ticker: string,
  timeframe: Timeframe,
  dataSource: DataSource
): UseCandlestickDataResult {
  const [data, setData] = useState<CandleData[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMoreHistory, setHasMoreHistory] = useState(true)
  const loadingMoreRef = useRef(false)
  const fetchVersionRef = useRef(0) // Track fetch version to prevent stale updates

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    setHasMoreHistory(true)

    // Increment version to invalidate any pending fetches
    const currentVersion = ++fetchVersionRef.current

    try {
      let candles: CandleData[]

      if (dataSource === 'binance') {
        // Try multiple sources in order: CryptoCompare -> Binance -> CoinGecko
        let lastError: Error | null = null

        // 1. Try CryptoCompare first (good historical data)
        try {
          candles = await fetchCryptoCompareKlines(ticker, timeframe)
          if (fetchVersionRef.current !== currentVersion) return // Stale request
          if (candles.length >= 10) {
            setData(candles)
            setLoading(false)
            return
          }
        } catch (e) {
          if (fetchVersionRef.current !== currentVersion) return // Stale request
          lastError = e instanceof Error ? e : new Error('CryptoCompare failed')
        }

        // 2. Try Binance (real-time, many pairs)
        try {
          candles = await fetchBinanceKlines(ticker, timeframe)
          if (fetchVersionRef.current !== currentVersion) return // Stale request
          if (candles.length >= 10) {
            setData(candles)
            setLoading(false)
            return
          }
        } catch (e) {
          if (fetchVersionRef.current !== currentVersion) return // Stale request
          lastError = e instanceof Error ? e : new Error('Binance failed')
        }

        // 3. Try CoinGecko (searches by name, good for new tokens)
        try {
          candles = await fetchCoinGeckoOHLC(ticker, timeframe)
          if (fetchVersionRef.current !== currentVersion) return // Stale request
          if (candles.length > 0) {
            setData(candles)
            setLoading(false)
            return
          }
        } catch (e) {
          if (fetchVersionRef.current !== currentVersion) return // Stale request
          lastError = e instanceof Error ? e : new Error('CoinGecko failed')
        }

        // All sources failed
        throw lastError || new Error(`Symbol ${ticker} not found on any exchange`)
      } else {
        candles = await fetchYahooKlines(ticker, timeframe)
        if (fetchVersionRef.current !== currentVersion) return // Stale request
      }

      setData(candles)
    } catch (err) {
      if (fetchVersionRef.current !== currentVersion) return // Stale request
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
      setData([])
    } finally {
      if (fetchVersionRef.current === currentVersion) {
        setLoading(false)
      }
    }
  }, [ticker, timeframe, dataSource])

  const loadMoreHistory = useCallback(async () => {
    if (loadingMoreRef.current || data.length === 0 || !hasMoreHistory) return
    if (dataSource !== 'binance') return // Only crypto supports loading more

    loadingMoreRef.current = true
    setLoadingMore(true)

    try {
      const earliestTime = data[0].time as number
      const moreCandles = await fetchMoreCryptoHistory(ticker, timeframe, earliestTime)

      if (moreCandles.length === 0) {
        setHasMoreHistory(false)
        return
      }

      // Merge with existing data, avoiding duplicates
      const existingTimes = new Set(data.map(c => c.time as number))
      const newCandles = moreCandles.filter(c => !existingTimes.has(c.time as number))

      if (newCandles.length === 0) {
        setHasMoreHistory(false)
        return
      }

      setData(prev => [...newCandles, ...prev])
    } catch (err) {
      console.error('Failed to load more history:', err)
    } finally {
      setLoadingMore(false)
      loadingMoreRef.current = false
    }
  }, [data, ticker, timeframe, dataSource, hasMoreHistory])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, loadingMore, error, refetch: fetchData, loadMoreHistory, hasMoreHistory }
}
