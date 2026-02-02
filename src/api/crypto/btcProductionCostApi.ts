import type { Time } from 'lightweight-charts'

export interface BTCProductionCostData {
  time: Time
  electricalCost: number
  productionCost: number
}

/**
 * Bitcoin Production Cost Calculation - Enhanced Model
 *
 * Based on CBECI methodology and industry research:
 * - Cambridge Bitcoin Electricity Consumption Index (CBECI)
 * - Mining company financial reports (Marathon, Riot, CleanSpark)
 * - Capriole/Bitcoin Layer research
 *
 * Key improvements:
 * 1. Historical miner efficiency curve (ASICs improve ~25-30% annually)
 * 2. Weighted average electricity costs by mining region
 * 3. Dynamic overhead based on market conditions
 */

// Historical miner efficiency (J/TH) - weighted fleet average
// Sources: CBECI, ASIC manufacturer specs, mining pool data
const EFFICIENCY_HISTORY: Array<{ date: string; jPerTh: number }> = [
  // Early GPU/FPGA era
  { date: '2010-01-01', jPerTh: 9000000 }, // GPU mining ~9 MJ/TH
  { date: '2011-01-01', jPerTh: 5000000 },
  { date: '2012-01-01', jPerTh: 1000000 }, // FPGA era

  // First ASICs (2013) - Avalon, ASICMiner
  { date: '2013-01-01', jPerTh: 1000 },    // ~1000 J/TH
  { date: '2013-07-01', jPerTh: 700 },

  // Antminer S1-S3 era
  { date: '2014-01-01', jPerTh: 500 },
  { date: '2014-07-01', jPerTh: 350 },

  // Antminer S5-S7 era (28nm chips)
  { date: '2015-01-01', jPerTh: 250 },
  { date: '2015-07-01', jPerTh: 200 },
  { date: '2016-01-01', jPerTh: 150 },

  // Antminer S9 era (16nm) - dominated 2016-2019
  { date: '2016-07-01', jPerTh: 100 },
  { date: '2017-01-01', jPerTh: 98 },
  { date: '2017-07-01', jPerTh: 95 },
  { date: '2018-01-01', jPerTh: 90 },
  { date: '2018-07-01', jPerTh: 85 },
  { date: '2019-01-01', jPerTh: 75 },

  // Antminer S17/S19 era (7nm)
  { date: '2019-07-01', jPerTh: 60 },
  { date: '2020-01-01', jPerTh: 50 },
  { date: '2020-05-01', jPerTh: 45 },
  { date: '2020-10-01', jPerTh: 40 },

  // S19 Pro / Whatsminer M30S (fleet upgrades)
  { date: '2021-01-01', jPerTh: 38 },
  { date: '2021-07-01', jPerTh: 35 }, // China ban - older machines offline
  { date: '2021-10-01', jPerTh: 34 },
  { date: '2022-01-01', jPerTh: 32 },
  { date: '2022-07-01', jPerTh: 30 },

  // S19 XP / M50 era (5nm)
  { date: '2023-01-01', jPerTh: 28 },
  { date: '2023-07-01', jPerTh: 26 },
  { date: '2024-01-01', jPerTh: 24 },

  // S21 / M60 era (3nm) - post 2024 halving upgrades
  { date: '2024-04-01', jPerTh: 22 },
  { date: '2024-07-01', jPerTh: 21 },
  { date: '2024-10-01', jPerTh: 20 },
  { date: '2025-01-01', jPerTh: 19 },
  { date: '2025-07-01', jPerTh: 18 },
  { date: '2026-01-01', jPerTh: 17 },
]

// Regional electricity costs and mining distribution
// Sources: CBECI, mining pool geographic data, company reports
const ELECTRICITY_COST_HISTORY: Array<{ date: string; weightedCost: number }> = [
  // Early days - hobbyist miners, residential rates
  { date: '2010-01-01', weightedCost: 0.12 },
  { date: '2013-01-01', weightedCost: 0.10 },

  // China dominance begins (cheap hydro/coal)
  { date: '2015-01-01', weightedCost: 0.06 },
  { date: '2016-01-01', weightedCost: 0.05 },
  { date: '2017-01-01', weightedCost: 0.045 },
  { date: '2018-01-01', weightedCost: 0.04 },
  { date: '2019-01-01', weightedCost: 0.038 },
  { date: '2020-01-01', weightedCost: 0.035 },
  { date: '2021-01-01', weightedCost: 0.035 },

  // Post-China ban - migration to US, Kazakhstan, Russia
  // Higher costs initially
  { date: '2021-07-01', weightedCost: 0.055 },
  { date: '2021-10-01', weightedCost: 0.05 },
  { date: '2022-01-01', weightedCost: 0.048 },
  { date: '2022-07-01', weightedCost: 0.052 }, // Energy crisis
  { date: '2023-01-01', weightedCost: 0.05 },
  { date: '2023-07-01', weightedCost: 0.048 },
  { date: '2024-01-01', weightedCost: 0.046 },
  { date: '2024-07-01', weightedCost: 0.045 },
  { date: '2025-01-01', weightedCost: 0.044 },
  { date: '2026-01-01', weightedCost: 0.043 },
]

// Overhead multiplier history (hardware, cooling, staff, facilities)
// Lower in bull markets (hardware ROI faster), higher in bear markets
const OVERHEAD_HISTORY: Array<{ date: string; multiplier: number }> = [
  { date: '2010-01-01', multiplier: 1.3 },  // Low overhead, hobby mining
  { date: '2014-01-01', multiplier: 1.5 },  // Professionalization begins
  { date: '2017-01-01', multiplier: 1.4 },  // Bull market, fast ROI
  { date: '2018-07-01', multiplier: 1.8 },  // Bear market, slow ROI
  { date: '2019-01-01', multiplier: 1.7 },
  { date: '2020-01-01', multiplier: 1.6 },
  { date: '2021-01-01', multiplier: 1.4 },  // Bull run
  { date: '2021-11-01', multiplier: 1.35 }, // Peak bull
  { date: '2022-06-01', multiplier: 1.8 },  // Bear market
  { date: '2023-01-01', multiplier: 1.7 },
  { date: '2023-10-01', multiplier: 1.6 },
  { date: '2024-01-01', multiplier: 1.5 },
  { date: '2024-04-01', multiplier: 1.65 }, // Post-halving adjustment
  { date: '2024-10-01', multiplier: 1.55 },
  { date: '2025-01-01', multiplier: 1.5 },
]

// Halving schedule
const HALVINGS = [
  { timestamp: new Date('2009-01-03').getTime() / 1000, reward: 50 },
  { timestamp: new Date('2012-11-28').getTime() / 1000, reward: 25 },
  { timestamp: new Date('2016-07-09').getTime() / 1000, reward: 12.5 },
  { timestamp: new Date('2020-05-11').getTime() / 1000, reward: 6.25 },
  { timestamp: new Date('2024-04-20').getTime() / 1000, reward: 3.125 },
]

const BLOCKS_PER_DAY = 144
const SECONDS_PER_DAY = 86400

function getBlockRewardAtTimestamp(timestamp: number): number {
  for (let i = HALVINGS.length - 1; i >= 0; i--) {
    if (timestamp >= HALVINGS[i].timestamp) {
      return HALVINGS[i].reward
    }
  }
  return 50
}

function interpolateValue(history: Array<{ date: string; [key: string]: number | string }>, timestamp: number, key: string): number {
  const sortedHistory = [...history].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  const targetTime = timestamp * 1000 // Convert to ms

  // Find surrounding data points
  let lower = sortedHistory[0]
  let upper = sortedHistory[sortedHistory.length - 1]

  for (let i = 0; i < sortedHistory.length - 1; i++) {
    const lowerTime = new Date(sortedHistory[i].date).getTime()
    const upperTime = new Date(sortedHistory[i + 1].date).getTime()

    if (lowerTime <= targetTime && upperTime >= targetTime) {
      lower = sortedHistory[i]
      upper = sortedHistory[i + 1]
      break
    }
  }

  const lowerTime = new Date(lower.date).getTime()
  const upperTime = new Date(upper.date).getTime()

  if (upperTime === lowerTime) {
    return lower[key] as number
  }

  let ratio = (targetTime - lowerTime) / (upperTime - lowerTime)
  ratio = Math.max(0, Math.min(1, ratio))

  return (lower[key] as number) + ((upper[key] as number) - (lower[key] as number)) * ratio
}

function getEfficiencyAtTimestamp(timestamp: number): number {
  return interpolateValue(EFFICIENCY_HISTORY, timestamp, 'jPerTh')
}

function getElectricityCostAtTimestamp(timestamp: number): number {
  return interpolateValue(ELECTRICITY_COST_HISTORY, timestamp, 'weightedCost')
}

function getOverheadAtTimestamp(timestamp: number): number {
  return interpolateValue(OVERHEAD_HISTORY, timestamp, 'multiplier')
}

/**
 * Calculate production cost using enhanced EHV formula
 */
function calculateCostFromHashRate(
  hashRateTHs: number,
  timestamp: number
): { electricalCost: number; productionCost: number } {
  const blockReward = getBlockRewardAtTimestamp(timestamp)
  const efficiency = getEfficiencyAtTimestamp(timestamp)
  const electricityPrice = getElectricityCostAtTimestamp(timestamp)
  const overhead = getOverheadAtTimestamp(timestamp)

  // Daily BTC mined
  const dailyBTC = BLOCKS_PER_DAY * blockReward

  // Terahashes per day
  const terahashesPerDay = hashRateTHs * SECONDS_PER_DAY

  // Terahashes required to mine 1 BTC
  const thPerBTC = terahashesPerDay / dailyBTC

  // Convert J/TH to kWh/TH (1 J = 1/3,600,000 kWh)
  const kWhPerTH = efficiency / 3_600_000

  // EHV: (TH/BTC) × (kWh/TH) × ($/kWh) = $/BTC
  const electricalCost = thPerBTC * kWhPerTH * electricityPrice

  // Total production cost with dynamic overhead
  const productionCost = electricalCost * overhead

  return { electricalCost, productionCost }
}

// Cache
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
  if (cachedData && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedData
  }

  try {
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

    // Sample every Nth point to reduce data size while maintaining accuracy
    const sampleRate = Math.max(1, Math.floor(data.values.length / 2000))

    for (let i = 0; i < data.values.length; i += sampleRate) {
      const point = data.values[i]
      const timestamp = point.x
      const hashRateTHs = point.y

      if (hashRateTHs <= 0) continue

      const costs = calculateCostFromHashRate(hashRateTHs, timestamp)

      // Sanity check
      if (costs.electricalCost < 0.01 || costs.electricalCost > 10000000) continue

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

function generateFallbackData(): BTCProductionCostData[] {
  // Generate data points using our model with estimated hash rates
  const hashRateEstimates = [
    { date: '2013-01-01', hashRate: 25000 },        // 25 TH/s
    { date: '2014-01-01', hashRate: 10000000 },     // 10 PH/s
    { date: '2015-01-01', hashRate: 300000000 },    // 300 PH/s
    { date: '2016-01-01', hashRate: 800000000 },    // 800 PH/s
    { date: '2016-07-01', hashRate: 1500000000 },   // 1.5 EH/s
    { date: '2017-01-01', hashRate: 2500000000 },   // 2.5 EH/s
    { date: '2017-07-01', hashRate: 6000000000 },   // 6 EH/s
    { date: '2017-12-01', hashRate: 15000000000 },  // 15 EH/s
    { date: '2018-06-01', hashRate: 35000000000 },  // 35 EH/s
    { date: '2018-12-01', hashRate: 40000000000 },  // 40 EH/s
    { date: '2019-06-01', hashRate: 65000000000 },  // 65 EH/s
    { date: '2019-12-01', hashRate: 95000000000 },  // 95 EH/s
    { date: '2020-05-01', hashRate: 120000000000 }, // 120 EH/s
    { date: '2020-12-01', hashRate: 150000000000 }, // 150 EH/s
    { date: '2021-04-01', hashRate: 180000000000 }, // 180 EH/s
    { date: '2021-07-01', hashRate: 90000000000 },  // 90 EH/s (China ban)
    { date: '2021-12-01', hashRate: 180000000000 }, // 180 EH/s (recovery)
    { date: '2022-06-01', hashRate: 220000000000 }, // 220 EH/s
    { date: '2022-12-01', hashRate: 250000000000 }, // 250 EH/s
    { date: '2023-06-01', hashRate: 380000000000 }, // 380 EH/s
    { date: '2023-12-01', hashRate: 520000000000 }, // 520 EH/s
    { date: '2024-04-01', hashRate: 600000000000 }, // 600 EH/s
    { date: '2024-08-01', hashRate: 650000000000 }, // 650 EH/s
    { date: '2024-12-01', hashRate: 750000000000 }, // 750 EH/s
    { date: '2025-06-01', hashRate: 850000000000 }, // 850 EH/s (projected)
    { date: '2026-01-01', hashRate: 950000000000 }, // 950 EH/s (projected)
  ]

  return hashRateEstimates.map(est => {
    const timestamp = Math.floor(new Date(est.date).getTime() / 1000)
    const costs = calculateCostFromHashRate(est.hashRate, timestamp)

    return {
      time: timestamp as Time,
      electricalCost: Math.round(costs.electricalCost * 100) / 100,
      productionCost: Math.round(costs.productionCost * 100) / 100,
    }
  })
}

export function interpolateProductionCost(
  costData: BTCProductionCostData[],
  candleTimes: Time[]
): BTCProductionCostData[] {
  if (costData.length === 0) return []

  const sortedCostData = [...costData].sort((a, b) => (a.time as number) - (b.time as number))
  const result: BTCProductionCostData[] = []

  for (const candleTime of candleTimes) {
    const t = candleTime as number

    let lower = sortedCostData[0]
    let upper = sortedCostData[sortedCostData.length - 1]

    for (let i = 0; i < sortedCostData.length - 1; i++) {
      if ((sortedCostData[i].time as number) <= t && (sortedCostData[i + 1].time as number) >= t) {
        lower = sortedCostData[i]
        upper = sortedCostData[i + 1]
        break
      }
    }

    const lowerTime = lower.time as number
    const upperTime = upper.time as number

    let ratio = 0
    if (upperTime !== lowerTime) {
      ratio = (t - lowerTime) / (upperTime - lowerTime)
    }

    ratio = Math.max(0, Math.min(1, ratio))

    result.push({
      time: candleTime,
      electricalCost: lower.electricalCost + (upper.electricalCost - lower.electricalCost) * ratio,
      productionCost: lower.productionCost + (upper.productionCost - lower.productionCost) * ratio,
    })
  }

  return result
}
