import type { CandleData, Timeframe } from '@/types/chart'

const WS_BASE_URL = 'wss://stream.binance.us:9443/ws'

interface BinanceKlineMessage {
  e: string
  E: number
  s: string
  k: {
    t: number
    T: number
    s: string
    i: string
    f: number
    L: number
    o: string
    c: string
    h: string
    l: string
    v: string
    n: number
    x: boolean
    q: string
    V: string
    Q: string
    B: string
  }
}

export type KlineUpdateCallback = (candle: CandleData, isFinal: boolean) => void

export class BinanceWebSocket {
  private ws: WebSocket | null = null
  private symbol: string
  private timeframe: Timeframe
  private onUpdate: KlineUpdateCallback
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectTimeout: number | null = null

  constructor(symbol: string, timeframe: Timeframe, onUpdate: KlineUpdateCallback) {
    this.symbol = symbol.toLowerCase()
    this.timeframe = timeframe
    this.onUpdate = onUpdate
  }

  connect(): void {
    if (this.ws) {
      this.disconnect()
    }

    const streamName = `${this.symbol}@kline_${this.timeframe}`
    const url = `${WS_BASE_URL}/${streamName}`

    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.reconnectAttempts = 0
    }

    this.ws.onmessage = (event) => {
      try {
        const message: BinanceKlineMessage = JSON.parse(event.data)
        if (message.e === 'kline') {
          const kline = message.k
          const candle: CandleData = {
            time: (kline.t / 1000) as import('lightweight-charts').Time,
            open: parseFloat(kline.o),
            high: parseFloat(kline.h),
            low: parseFloat(kline.l),
            close: parseFloat(kline.c),
            volume: parseFloat(kline.v),
          }
          this.onUpdate(candle, kline.x)
        }
      } catch (error) {
        console.error('WebSocket message parse error:', error)
      }
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    this.ws.onclose = () => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
        this.reconnectTimeout = window.setTimeout(() => this.connect(), delay)
      }
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.reconnectAttempts = this.maxReconnectAttempts
  }

  updateConfig(symbol: string, timeframe: Timeframe): void {
    this.symbol = symbol.toLowerCase()
    this.timeframe = timeframe
    this.reconnectAttempts = 0
    this.connect()
  }
}
