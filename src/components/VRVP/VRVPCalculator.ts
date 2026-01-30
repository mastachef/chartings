import type { CandleData, VRVPData, PriceLevel } from '@/types/chart'

const NUM_ROWS = 200
const VALUE_AREA_PERCENT = 0.70

export function calculateVRVP(candles: CandleData[]): VRVPData {
  if (candles.length === 0) {
    return {
      levels: [],
      poc: 0,
      valueAreaHigh: 0,
      valueAreaLow: 0,
      maxVolume: 0,
    }
  }

  const highPrice = Math.max(...candles.map((c) => c.high))
  const lowPrice = Math.min(...candles.map((c) => c.low))
  const priceRange = highPrice - lowPrice

  if (priceRange === 0) {
    return {
      levels: [],
      poc: highPrice,
      valueAreaHigh: highPrice,
      valueAreaLow: lowPrice,
      maxVolume: 0,
    }
  }

  const rowHeight = priceRange / NUM_ROWS
  const levels: PriceLevel[] = []

  for (let i = 0; i < NUM_ROWS; i++) {
    const price = lowPrice + (i + 0.5) * rowHeight
    levels.push({
      price,
      volume: 0,
      buyVolume: 0,
      sellVolume: 0,
    })
  }

  for (const candle of candles) {
    const isBullish = candle.close >= candle.open
    const candleRange = candle.high - candle.low

    if (candleRange === 0) {
      const rowIndex = Math.min(
        NUM_ROWS - 1,
        Math.max(0, Math.floor((candle.close - lowPrice) / rowHeight))
      )
      levels[rowIndex].volume += candle.volume
      if (isBullish) {
        levels[rowIndex].buyVolume += candle.volume
      } else {
        levels[rowIndex].sellVolume += candle.volume
      }
      continue
    }

    for (let i = 0; i < NUM_ROWS; i++) {
      const levelLow = lowPrice + i * rowHeight
      const levelHigh = levelLow + rowHeight

      const overlap = Math.max(
        0,
        Math.min(candle.high, levelHigh) - Math.max(candle.low, levelLow)
      )

      if (overlap > 0) {
        const volumeShare = (overlap / candleRange) * candle.volume
        levels[i].volume += volumeShare
        if (isBullish) {
          levels[i].buyVolume += volumeShare
        } else {
          levels[i].sellVolume += volumeShare
        }
      }
    }
  }

  let maxVolume = 0
  let pocIndex = 0

  for (let i = 0; i < levels.length; i++) {
    if (levels[i].volume > maxVolume) {
      maxVolume = levels[i].volume
      pocIndex = i
    }
  }

  const poc = levels[pocIndex].price

  const totalVolume = levels.reduce((sum, level) => sum + level.volume, 0)
  const targetVolume = totalVolume * VALUE_AREA_PERCENT

  let valueAreaVolume = levels[pocIndex].volume
  let upperIndex = pocIndex
  let lowerIndex = pocIndex

  while (valueAreaVolume < targetVolume && (upperIndex < NUM_ROWS - 1 || lowerIndex > 0)) {
    const upperVolume = upperIndex < NUM_ROWS - 1 ? levels[upperIndex + 1].volume : 0
    const lowerVolume = lowerIndex > 0 ? levels[lowerIndex - 1].volume : 0

    if (upperVolume >= lowerVolume && upperIndex < NUM_ROWS - 1) {
      upperIndex++
      valueAreaVolume += upperVolume
    } else if (lowerIndex > 0) {
      lowerIndex--
      valueAreaVolume += lowerVolume
    } else if (upperIndex < NUM_ROWS - 1) {
      upperIndex++
      valueAreaVolume += upperVolume
    }
  }

  const valueAreaHigh = lowPrice + (upperIndex + 1) * rowHeight
  const valueAreaLow = lowPrice + lowerIndex * rowHeight

  return {
    levels,
    poc,
    valueAreaHigh,
    valueAreaLow,
    maxVolume,
  }
}
