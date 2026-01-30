import type { CandleData, HullSuiteData } from '@/types/chart'
import type { Time } from 'lightweight-charts'

function wma(data: number[], period: number): number[] {
  const result: number[] = []

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN)
      continue
    }

    let sum = 0
    let weightSum = 0

    for (let j = 0; j < period; j++) {
      const weight = period - j
      sum += data[i - j] * weight
      weightSum += weight
    }

    result.push(sum / weightSum)
  }

  return result
}

function hma(data: number[], period: number): number[] {
  const halfPeriod = Math.floor(period / 2)
  const sqrtPeriod = Math.floor(Math.sqrt(period))

  const wmaHalf = wma(data, halfPeriod)
  const wmaFull = wma(data, period)

  const diff: number[] = []
  for (let i = 0; i < data.length; i++) {
    if (isNaN(wmaHalf[i]) || isNaN(wmaFull[i])) {
      diff.push(NaN)
    } else {
      diff.push(2 * wmaHalf[i] - wmaFull[i])
    }
  }

  return wma(diff, sqrtPeriod)
}

export function calculateHullSuite(
  candles: CandleData[],
  period: number = 55
): HullSuiteData[] {
  if (candles.length < period * 2) {
    return []
  }

  const closes = candles.map(c => c.close)
  const hullValues = hma(closes, period)

  const result: HullSuiteData[] = []

  for (let i = 1; i < candles.length; i++) {
    if (isNaN(hullValues[i]) || isNaN(hullValues[i - 1])) {
      continue
    }

    const trend = hullValues[i] >= hullValues[i - 1] ? 'up' : 'down'

    result.push({
      time: candles[i].time as Time,
      hullValue: hullValues[i],
      trend,
    })
  }

  return result
}
