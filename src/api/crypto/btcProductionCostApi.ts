import type { Time } from 'lightweight-charts'

export interface BTCProductionCostData {
  time: Time
  electricalCost: number
  productionCost: number
}

/**
 * Bitcoin Production Cost Calculation
 *
 * Based on the Electricity Hash Valuation (EHV) formula from Capriole/Bitcoin Layer:
 * EHV = (Th/BTC) × (kWh/Th) × ($/kWh) = $/BTC
 *
 * Where:
 * - Th/BTC = Network Hashrate / Daily BTC Mined (terahashes required to mine 1 BTC)
 * - kWh/Th = Miner efficiency in kWh per terahash
 * - $/kWh = Electricity cost per kilowatt-hour
 *
 * Sources:
 * - https://thebitcoinlayer.substack.com/p/electricity-hash-valuation
 * - https://ccaf.io/cbnsi/cbeci (Cambridge Bitcoin Electricity Consumption Index)
 * - https://renaudcuny.substack.com/p/the-cost-of-mining-bitcoin-2025-update
 */

// Mining constants (2024-2025 estimates based on CBECI methodology)
const ELECTRICITY_COST_PER_KWH = 0.05 // $0.05/kWh - global average for large miners (CBECI default)
const MINER_EFFICIENCY_J_PER_TH = 22 // 22 J/TH - 2024-2025 weighted fleet average per CBECI
const BLOCKS_PER_DAY = 144
const SECONDS_PER_DAY = 86400

// Hardware cost adds ~67% on top of electricity (from mining company reports)
// Total production = electrical * 1.67, so overhead multiplier = 1.67
const OVERHEAD_MULTIPLIER = 1.67

// Historical halving dates and rewards
const HALVINGS = [
  { timestamp: new Date('2009-01-03').getTime() / 1000, reward: 50 },
  { timestamp: new Date('2012-11-28').getTime() / 1000, reward: 25 },
  { timestamp: new Date('2016-07-09').getTime() / 1000, reward: 12.5 },
  { timestamp: new Date('2020-05-11').getTime() / 1000, reward: 6.25 },
  { timestamp: new Date('2024-04-20').getTime() / 1000, reward: 3.125 },
]

function getBlockRewardAtTimestamp(timestamp: number): number {
  for (let i = HALVINGS.length - 1; i >= 0; i--) {
    if (timestamp >= HALVINGS[i].timestamp) {
      return HALVINGS[i].reward
    }
  }
  return 50
}

/**
 * Calculate production cost using the EHV formula
 *
 * EHV = (Th/BTC) × (kWh/Th) × ($/kWh)
 *
 * @param hashRateTHs - Network hash rate in TH/s (terahashes per second)
 * @param blockReward - Current block reward in BTC
 * @returns Object with electrical and total production cost per BTC
 */
function calculateCostFromHashRate(
  hashRateTHs: number,
  blockReward: number
): { electricalCost: number; productionCost: number } {
  // Daily BTC mined
  const dailyBTC = BLOCKS_PER_DAY * blockReward

  // Terahashes per day = hashrate (TH/s) * seconds per day
  const terahashesPerDay = hashRateTHs * SECONDS_PER_DAY

  // Terahashes required to mine 1 BTC
  const thPerBTC = terahashesPerDay / dailyBTC

  // Convert J/TH to kWh/TH
  // 1 Joule = 1 Watt-second = 1/3600 Watt-hour = 1/3,600,000 kWh
  const kWhPerTH = MINER_EFFICIENCY_J_PER_TH / 3_600_000

  // EHV Formula: (Th/BTC) × (kWh/Th) × ($/kWh) = $/BTC
  const electricalCost = thPerBTC * kWhPerTH * ELECTRICITY_COST_PER_KWH

  // Total production cost (includes hardware depreciation, cooling, staff, etc.)
  const productionCost = electricalCost * OVERHEAD_MULTIPLIER

  return { electricalCost, productionCost }
}

// Cache for the production cost data
let cachedData: BTCProductionCostData[] | null = null
let cacheTimestamp = 0
const CACHE_DURATION = 3600000 // 1 hour

interface BlockchainInfoResponse {
  status: string
  name: string
  unit: string
  period: string
  values: Array<{ x: number; y: number }>
}

export async function fetchBTCProductionCost(): Promise<BTCProductionCostData[]> {
  // Return cached data if fresh
  if (cachedData && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedData
  }

  try {
    // Fetch hash rate data from blockchain.info
    // Returns hash rate in TH/s (terahashes per second)
    const response = await fetch(
      'https://api.blockchain.info/charts/hash-rate?timespan=all&format=json&cors=true'
    )

    if (!response.ok) {
      console.warn('Failed to fetch hash rate, using fallback data')
      return generateFallbackData()
    }

    const data: BlockchainInfoResponse = await response.json()

    if (!data.values || data.values.length === 0) {
      return generateFallbackData()
    }

    const result: BTCProductionCostData[] = []

    for (const point of data.values) {
      const timestamp = point.x
      const hashRateTHs = point.y // Already in TH/s from the API

      // Skip invalid data points
      if (hashRateTHs <= 0) continue

      const blockReward = getBlockRewardAtTimestamp(timestamp)
      const costs = calculateCostFromHashRate(hashRateTHs, blockReward)

      // Sanity check - skip if values are unrealistic
      if (costs.electricalCost < 1 || costs.electricalCost > 1000000) continue

      result.push({
        time: timestamp as Time,
        electricalCost: Math.round(costs.electricalCost * 100) / 100,
        productionCost: Math.round(costs.productionCost * 100) / 100,
      })
    }

    if (result.length > 0) {
      cachedData = result
      cacheTimestamp = Date.now()
      return result
    }

    return generateFallbackData()
  } catch (error) {
    console.error('Error fetching BTC production cost:', error)
    return generateFallbackData()
  }
}

// Fallback data based on historical research estimates
// Used when API fails or returns invalid data
function generateFallbackData(): BTCProductionCostData[] {
  // These estimates are based on:
  // - CBECI historical data
  // - Mining company financial reports
  // - Industry research from Capriole, Bitcoin Layer
  const estimates = [
    // Pre-2020 halving estimates (6.25 BTC reward era approaching)
    { date: '2019-01-01', electrical: 3500, production: 5845 },
    { date: '2019-06-01', electrical: 5000, production: 8350 },
    { date: '2019-12-01', electrical: 6500, production: 10855 },

    // Post-2020 halving (reward: 6.25 BTC) - cost doubled
    { date: '2020-05-11', electrical: 8000, production: 13360 },
    { date: '2020-08-01', electrical: 9500, production: 15865 },
    { date: '2020-12-01', electrical: 12000, production: 20040 },

    // 2021 - Hash rate growth
    { date: '2021-01-01', electrical: 14000, production: 23380 },
    { date: '2021-04-01', electrical: 18000, production: 30060 },
    { date: '2021-07-01', electrical: 12000, production: 20040 }, // China ban drop
    { date: '2021-11-01', electrical: 22000, production: 36740 },

    // 2022 - Bear market, hash rate recovery
    { date: '2022-01-01', electrical: 24000, production: 40080 },
    { date: '2022-06-01', electrical: 18000, production: 30060 },
    { date: '2022-12-01', electrical: 16000, production: 26720 },

    // 2023 - Recovery
    { date: '2023-01-01', electrical: 18000, production: 30060 },
    { date: '2023-06-01', electrical: 24000, production: 40080 },
    { date: '2023-12-01', electrical: 32000, production: 53440 },

    // Post-2024 halving (reward: 3.125 BTC) - cost doubled again
    { date: '2024-04-20', electrical: 54000, production: 90180 },
    { date: '2024-06-01', electrical: 56000, production: 93520 },
    { date: '2024-09-01', electrical: 52000, production: 86840 },
    { date: '2024-12-01', electrical: 55000, production: 91850 },

    // 2025-2026 projections
    { date: '2025-01-01', electrical: 54000, production: 90180 },
    { date: '2025-06-01', electrical: 58000, production: 96860 },
    { date: '2026-01-01', electrical: 62000, production: 103540 },
  ]

  return estimates.map(est => ({
    time: Math.floor(new Date(est.date).getTime() / 1000) as Time,
    electricalCost: est.electrical,
    productionCost: est.production,
  }))
}

// Interpolate production cost data to match candle timestamps
export function interpolateProductionCost(
  costData: BTCProductionCostData[],
  candleTimes: Time[]
): BTCProductionCostData[] {
  if (costData.length === 0) return []

  // Sort cost data by time
  const sortedCostData = [...costData].sort((a, b) => (a.time as number) - (b.time as number))

  const result: BTCProductionCostData[] = []

  for (const candleTime of candleTimes) {
    const t = candleTime as number

    // Find surrounding data points
    let lower = sortedCostData[0]
    let upper = sortedCostData[sortedCostData.length - 1]

    for (let i = 0; i < sortedCostData.length - 1; i++) {
      if ((sortedCostData[i].time as number) <= t && (sortedCostData[i + 1].time as number) >= t) {
        lower = sortedCostData[i]
        upper = sortedCostData[i + 1]
        break
      }
    }

    // Linear interpolation
    const lowerTime = lower.time as number
    const upperTime = upper.time as number

    let ratio = 0
    if (upperTime !== lowerTime) {
      ratio = (t - lowerTime) / (upperTime - lowerTime)
    }

    // Clamp ratio to avoid extrapolation beyond known data
    ratio = Math.max(0, Math.min(1, ratio))

    result.push({
      time: candleTime,
      electricalCost: lower.electricalCost + (upper.electricalCost - lower.electricalCost) * ratio,
      productionCost: lower.productionCost + (upper.productionCost - lower.productionCost) * ratio,
    })
  }

  return result
}
