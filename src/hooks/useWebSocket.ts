import { useEffect, useRef, useCallback } from 'react'
import { BinanceWebSocket, KlineUpdateCallback } from '@/api/binance/binanceWebSocket'
import type { Timeframe } from '@/types/chart'

interface UseWebSocketOptions {
  symbol: string
  timeframe: Timeframe
  onUpdate: KlineUpdateCallback
  enabled?: boolean
}

export function useWebSocket({ symbol, timeframe, onUpdate, enabled = true }: UseWebSocketOptions) {
  const wsRef = useRef<BinanceWebSocket | null>(null)
  const onUpdateRef = useRef(onUpdate)

  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])

  const connect = useCallback(() => {
    if (!enabled || !symbol) return

    if (wsRef.current) {
      wsRef.current.disconnect()
    }

    wsRef.current = new BinanceWebSocket(
      symbol,
      timeframe,
      (candle, isFinal) => onUpdateRef.current(candle, isFinal)
    )
    wsRef.current.connect()
  }, [symbol, timeframe, enabled])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.disconnect()
      wsRef.current = null
    }
  }, [])

  useEffect(() => {
    connect()
    return disconnect
  }, [connect, disconnect])

  return { connect, disconnect }
}
