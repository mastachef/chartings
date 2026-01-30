import type { CandleData } from '@/types/chart'

export interface KeyLevel {
  price: number
  label: string
  type: 'daily' | 'weekly' | 'monthly' | 'yearly'
  subtype: 'open' | 'high' | 'low' | 'close'
}

export interface KeyLevelsData {
  daily: {
    open: number | null
    prevHigh: number | null
    prevLow: number | null
    prevClose: number | null
  }
  weekly: {
    open: number | null
    prevHigh: number | null
    prevLow: number | null
    prevClose: number | null
  }
  monthly: {
    open: number | null
    prevHigh: number | null
    prevLow: number | null
    prevClose: number | null
  }
  yearly: {
    open: number | null
  }
}

function getDateFromTimestamp(timestamp: number): Date {
  return new Date(timestamp * 1000)
}

export function calculateKeyLevels(data: CandleData[]): KeyLevelsData {
  if (data.length === 0) {
    return {
      daily: { open: null, prevHigh: null, prevLow: null, prevClose: null },
      weekly: { open: null, prevHigh: null, prevLow: null, prevClose: null },
      monthly: { open: null, prevHigh: null, prevLow: null, prevClose: null },
      yearly: { open: null },
    }
  }

  const sortedData = [...data].sort((a, b) => (a.time as number) - (b.time as number))

  // Group candles by day, week, month, year
  const dailyCandles: Map<string, CandleData[]> = new Map()
  const weeklyCandles: Map<string, CandleData[]> = new Map()
  const monthlyCandles: Map<string, CandleData[]> = new Map()
  const yearlyCandles: Map<string, CandleData[]> = new Map()

  for (const candle of sortedData) {
    const date = getDateFromTimestamp(candle.time as number)

    // Daily key
    const dayKey = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`
    if (!dailyCandles.has(dayKey)) dailyCandles.set(dayKey, [])
    dailyCandles.get(dayKey)!.push(candle)

    // Weekly key (week start)
    const weekStart = new Date(date)
    const day = weekStart.getUTCDay()
    const diff = weekStart.getUTCDate() - day + (day === 0 ? -6 : 1)
    weekStart.setUTCDate(diff)
    const weekKey = `${weekStart.getUTCFullYear()}-${weekStart.getUTCMonth()}-${weekStart.getUTCDate()}`
    if (!weeklyCandles.has(weekKey)) weeklyCandles.set(weekKey, [])
    weeklyCandles.get(weekKey)!.push(candle)

    // Monthly key
    const monthKey = `${date.getUTCFullYear()}-${date.getUTCMonth()}`
    if (!monthlyCandles.has(monthKey)) monthlyCandles.set(monthKey, [])
    monthlyCandles.get(monthKey)!.push(candle)

    // Yearly key
    const yearKey = `${date.getUTCFullYear()}`
    if (!yearlyCandles.has(yearKey)) yearlyCandles.set(yearKey, [])
    yearlyCandles.get(yearKey)!.push(candle)
  }

  // Get aggregated OHLC for each period
  const aggregatePeriod = (candles: CandleData[]): { open: number; high: number; low: number; close: number } => {
    const sorted = [...candles].sort((a, b) => (a.time as number) - (b.time as number))
    return {
      open: sorted[0].open,
      high: Math.max(...sorted.map(c => c.high)),
      low: Math.min(...sorted.map(c => c.low)),
      close: sorted[sorted.length - 1].close,
    }
  }

  // Convert maps to sorted arrays
  const dailyPeriods = Array.from(dailyCandles.entries())
    .map(([key, candles]) => ({ key, ...aggregatePeriod(candles), firstTime: candles[0].time as number }))
    .sort((a, b) => a.firstTime - b.firstTime)

  const weeklyPeriods = Array.from(weeklyCandles.entries())
    .map(([key, candles]) => ({ key, ...aggregatePeriod(candles), firstTime: candles[0].time as number }))
    .sort((a, b) => a.firstTime - b.firstTime)

  const monthlyPeriods = Array.from(monthlyCandles.entries())
    .map(([key, candles]) => ({ key, ...aggregatePeriod(candles), firstTime: candles[0].time as number }))
    .sort((a, b) => a.firstTime - b.firstTime)

  const yearlyPeriods = Array.from(yearlyCandles.entries())
    .map(([key, candles]) => ({ key, ...aggregatePeriod(candles), firstTime: candles[0].time as number }))
    .sort((a, b) => a.firstTime - b.firstTime)

  // Get current and previous periods
  const result: KeyLevelsData = {
    daily: { open: null, prevHigh: null, prevLow: null, prevClose: null },
    weekly: { open: null, prevHigh: null, prevLow: null, prevClose: null },
    monthly: { open: null, prevHigh: null, prevLow: null, prevClose: null },
    yearly: { open: null },
  }

  // Daily levels
  if (dailyPeriods.length >= 1) {
    const current = dailyPeriods[dailyPeriods.length - 1]
    result.daily.open = current.open
  }
  if (dailyPeriods.length >= 2) {
    const prev = dailyPeriods[dailyPeriods.length - 2]
    result.daily.prevHigh = prev.high
    result.daily.prevLow = prev.low
    result.daily.prevClose = prev.close
  }

  // Weekly levels
  if (weeklyPeriods.length >= 1) {
    const current = weeklyPeriods[weeklyPeriods.length - 1]
    result.weekly.open = current.open
  }
  if (weeklyPeriods.length >= 2) {
    const prev = weeklyPeriods[weeklyPeriods.length - 2]
    result.weekly.prevHigh = prev.high
    result.weekly.prevLow = prev.low
    result.weekly.prevClose = prev.close
  }

  // Monthly levels
  if (monthlyPeriods.length >= 1) {
    const current = monthlyPeriods[monthlyPeriods.length - 1]
    result.monthly.open = current.open
  }
  if (monthlyPeriods.length >= 2) {
    const prev = monthlyPeriods[monthlyPeriods.length - 2]
    result.monthly.prevHigh = prev.high
    result.monthly.prevLow = prev.low
    result.monthly.prevClose = prev.close
  }

  // Yearly levels
  if (yearlyPeriods.length >= 1) {
    // Get current year's data
    const currentYear = new Date().getUTCFullYear().toString()
    const currentYearData = yearlyPeriods.find(p => p.key === currentYear)
    if (currentYearData) {
      result.yearly.open = currentYearData.open
    }
  }

  return result
}

export function keyLevelsToArray(levels: KeyLevelsData): KeyLevel[] {
  const result: KeyLevel[] = []

  // Daily
  if (levels.daily.open !== null) {
    result.push({ price: levels.daily.open, label: 'D Open', type: 'daily', subtype: 'open' })
  }
  if (levels.daily.prevHigh !== null) {
    result.push({ price: levels.daily.prevHigh, label: 'PDH', type: 'daily', subtype: 'high' })
  }
  if (levels.daily.prevLow !== null) {
    result.push({ price: levels.daily.prevLow, label: 'PDL', type: 'daily', subtype: 'low' })
  }

  // Weekly
  if (levels.weekly.open !== null) {
    result.push({ price: levels.weekly.open, label: 'W Open', type: 'weekly', subtype: 'open' })
  }
  if (levels.weekly.prevHigh !== null) {
    result.push({ price: levels.weekly.prevHigh, label: 'PWH', type: 'weekly', subtype: 'high' })
  }
  if (levels.weekly.prevLow !== null) {
    result.push({ price: levels.weekly.prevLow, label: 'PWL', type: 'weekly', subtype: 'low' })
  }

  // Monthly
  if (levels.monthly.open !== null) {
    result.push({ price: levels.monthly.open, label: 'M Open', type: 'monthly', subtype: 'open' })
  }
  if (levels.monthly.prevHigh !== null) {
    result.push({ price: levels.monthly.prevHigh, label: 'PMH', type: 'monthly', subtype: 'high' })
  }
  if (levels.monthly.prevLow !== null) {
    result.push({ price: levels.monthly.prevLow, label: 'PML', type: 'monthly', subtype: 'low' })
  }

  // Yearly
  if (levels.yearly.open !== null) {
    result.push({ price: levels.yearly.open, label: 'Y Open', type: 'yearly', subtype: 'open' })
  }

  return result
}

export interface CountdownTimers {
  daily: string
  weekly: string
  monthly: string
  yearly: string
}

export function getCountdownTimers(): CountdownTimers {
  const now = new Date()

  // Daily: time until next UTC midnight
  const nextDayUTC = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0
  ))
  const dailyMs = nextDayUTC.getTime() - now.getTime()

  // Weekly: time until next Monday UTC midnight
  const daysUntilMonday = (8 - now.getUTCDay()) % 7 || 7
  const nextMondayUTC = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + daysUntilMonday,
    0, 0, 0
  ))
  const weeklyMs = nextMondayUTC.getTime() - now.getTime()

  // Monthly: time until 1st of next month UTC midnight
  const nextMonthUTC = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    1,
    0, 0, 0
  ))
  const monthlyMs = nextMonthUTC.getTime() - now.getTime()

  // Yearly: time until Jan 1st of next year UTC midnight
  const nextYearUTC = new Date(Date.UTC(
    now.getUTCFullYear() + 1,
    0,
    1,
    0, 0, 0
  ))
  const yearlyMs = nextYearUTC.getTime() - now.getTime()

  return {
    daily: formatCountdown(dailyMs),
    weekly: formatCountdown(weeklyMs),
    monthly: formatCountdown(monthlyMs),
    yearly: formatCountdown(yearlyMs),
  }
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00:00'

  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`
  }
  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}
