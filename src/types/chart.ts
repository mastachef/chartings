import type { IChartApi, ISeriesApi, CandlestickData, HistogramData, Time } from 'lightweight-charts'

export type DataSource = 'binance' | 'yahoo'

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '3d' | '1w' | '1M' | '3M'

export interface ChartConfig {
  id: string
  ticker: string
  timeframe: Timeframe
  dataSource: DataSource
  showVRVP: boolean
  showHullSuite: boolean
  showRSI: boolean
  showGuppy: boolean
  showKeyLevels: boolean
  showBTCCost: boolean
}

export interface HullSuiteData {
  time: Time
  hullValue: number
  trend: 'up' | 'down'
}

export interface CandleData extends CandlestickData<Time> {
  volume: number
}

export interface VolumeData extends HistogramData<Time> {
  color: string
}

export interface ChartInstance {
  chart: IChartApi
  candleSeries: ISeriesApi<'Candlestick'>
  volumeSeries: ISeriesApi<'Histogram'>
}

export interface PriceLevel {
  price: number
  volume: number
  buyVolume: number
  sellVolume: number
}

export interface VRVPData {
  levels: PriceLevel[]
  poc: number
  valueAreaHigh: number
  valueAreaLow: number
  maxVolume: number
}

export interface GridLayout {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
}

export type LayoutPreset = '1x1' | '2x2' | '1x2' | '2x1' | '3x2'

export interface BinanceKline {
  openTime: number
  open: string
  high: string
  low: string
  close: string
  volume: string
  closeTime: number
  quoteAssetVolume: string
  numberOfTrades: number
  takerBuyBaseAssetVolume: string
  takerBuyQuoteAssetVolume: string
}

export interface YahooQuote {
  timestamp: number[]
  indicators: {
    quote: Array<{
      open: number[]
      high: number[]
      low: number[]
      close: number[]
      volume: number[]
    }>
  }
}
