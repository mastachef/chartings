import type { CandleData } from '@/types/chart'
import type { Time } from 'lightweight-charts'

export interface RSIPoint {
  time: Time
  value: number
}

export function calculateRSI(data: CandleData[], period: number = 14): RSIPoint[] {
  if (data.length < period + 1) return []

  const rsiData: RSIPoint[] = []
  const gains: number[] = []
  const losses: number[] = []

  // Calculate price changes
  for (let i = 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close
    gains.push(change > 0 ? change : 0)
    losses.push(change < 0 ? -change : 0)
  }

  // First average (simple average for first period)
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period

  // Calculate RSI for first valid point
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss
  let rsi = 100 - (100 / (1 + rs))

  rsiData.push({
    time: data[period].time,
    value: rsi,
  })

  // Calculate remaining RSI values using smoothed averages
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    rsi = 100 - (100 / (1 + rs))

    rsiData.push({
      time: data[i + 1].time,
      value: rsi,
    })
  }

  return rsiData
}
