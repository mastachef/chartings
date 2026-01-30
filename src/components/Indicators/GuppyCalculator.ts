import type { CandleData } from '@/types/chart'
import type { Time } from 'lightweight-charts'

export interface GuppyData {
  time: Time
  // Short-term EMAs (3, 5, 8, 10, 12, 15)
  short: number[]
  // Long-term EMAs (30, 35, 40, 45, 50, 60)
  long: number[]
}

function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = []
  const multiplier = 2 / (period + 1)

  // First EMA is SMA
  let sum = 0
  for (let i = 0; i < period && i < data.length; i++) {
    sum += data[i]
  }

  if (data.length < period) return []

  ema.push(sum / period)

  // Calculate remaining EMAs
  for (let i = period; i < data.length; i++) {
    const newEma = (data[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1]
    ema.push(newEma)
  }

  return ema
}

export function calculateGuppy(data: CandleData[]): GuppyData[] {
  if (data.length < 60) return []

  const closes = data.map(d => d.close)

  // Short-term periods
  const shortPeriods = [3, 5, 8, 10, 12, 15]
  // Long-term periods
  const longPeriods = [30, 35, 40, 45, 50, 60]

  const shortEMAs = shortPeriods.map(p => calculateEMA(closes, p))
  const longEMAs = longPeriods.map(p => calculateEMA(closes, p))

  // Find the start index where all EMAs have values
  const maxPeriod = 60
  const startIndex = maxPeriod - 1

  const result: GuppyData[] = []

  for (let i = startIndex; i < data.length; i++) {
    const shortValues: number[] = []
    const longValues: number[] = []

    // Get short EMA values
    for (let j = 0; j < shortPeriods.length; j++) {
      const emaIndex = i - (shortPeriods[j] - 1)
      if (emaIndex >= 0 && emaIndex < shortEMAs[j].length) {
        shortValues.push(shortEMAs[j][emaIndex])
      }
    }

    // Get long EMA values
    for (let j = 0; j < longPeriods.length; j++) {
      const emaIndex = i - (longPeriods[j] - 1)
      if (emaIndex >= 0 && emaIndex < longEMAs[j].length) {
        longValues.push(longEMAs[j][emaIndex])
      }
    }

    if (shortValues.length === 6 && longValues.length === 6) {
      result.push({
        time: data[i].time,
        short: shortValues,
        long: longValues,
      })
    }
  }

  return result
}
