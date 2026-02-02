import { useRef, useLayoutEffect, useCallback, useState, useEffect } from 'react'
import { createChart, IChartApi, ISeriesApi, CandlestickData, HistogramData, Time, LogicalRangeChangeEventHandler, LineData, LogicalRange, CreatePriceLineOptions, IPriceLine, AreaData } from 'lightweight-charts'
import type { ChartConfig } from '@/types/chart'
import { useCandlestickData } from '@/hooks/useCandlestickData'
import { ChartToolbar } from './ChartToolbar'
import { RSIChart } from './RSIChart'
import { VRVPOverlay } from '../VRVP/VRVPOverlay'
import { calculateVRVP } from '../VRVP/VRVPCalculator'
import { calculateHullSuite } from '../Indicators/HullSuiteCalculator'
import { calculateGuppy, type GuppyData } from '../Indicators/GuppyCalculator'
import { calculateKeyLevels, keyLevelsToArray, type KeyLevel } from '../Indicators/KeyLevelsCalculator'
import { KeyLevelsTimer } from '../Indicators/KeyLevelsTimer'
import { FavoritesBar } from '../Favorites/FavoritesBar'
import { fetchBTCProductionCost, interpolateProductionCost } from '@/api/crypto/btcProductionCostApi'
import type { DataSource } from '@/types/chart'
import type { VRVPData, HullSuiteData } from '@/types/chart'
import styles from './ChartContainer.module.css'

interface ChartContainerProps {
  config: ChartConfig
  onConfigChange: (updates: Partial<ChartConfig>) => void
}

export function ChartContainer({ config, onConfigChange }: ChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const hullSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const guppyShortSeriesRef = useRef<ISeriesApi<'Line'>[]>([])
  const guppyLongSeriesRef = useRef<ISeriesApi<'Line'>[]>([])
  const keyLevelLinesRef = useRef<IPriceLine[]>([])
  const btcCostSeriesRef = useRef<ISeriesApi<'Area'>[]>([])
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  const [vrvpData, setVrvpData] = useState<VRVPData | null>(null)
  const [chartDimensions, setChartDimensions] = useState({ width: 0, height: 0 })
  const [visibleRange, setVisibleRange] = useState<LogicalRange | null>(null)

  const { data, loading, loadingMore, error, loadMoreHistory, hasMoreHistory } = useCandlestickData(
    config.ticker,
    config.timeframe,
    config.dataSource
  )

  useLayoutEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: { color: '#1a1a2e' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#27273a' },
        horzLines: { color: '#27273a' },
      },
      crosshair: {
        mode: 0, // Normal mode - free cursor movement
        vertLine: {
          color: '#6366f1',
          width: 1,
          style: 2,
        },
        horzLine: {
          color: '#6366f1',
          width: 1,
          style: 2,
        },
      },
      rightPriceScale: {
        borderColor: '#27273a',
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
      timeScale: {
        borderColor: '#27273a',
        timeVisible: true,
        secondsVisible: false,
      },
    })

    chartRef.current = chart

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })
    candleSeriesRef.current = candleSeries

    const volumeSeries = chart.addHistogramSeries({
      color: '#6366f1',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
      lastValueVisible: false,
      priceLineVisible: false,
    })

    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.85,
        bottom: 0,
      },
    })

    volumeSeriesRef.current = volumeSeries

    // Set initial dimensions
    setChartDimensions({
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    })

    resizeObserverRef.current = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry && chartRef.current) {
        const { width, height } = entry.contentRect
        chartRef.current.applyOptions({ width, height })
        setChartDimensions({ width, height })
      }
    })

    resizeObserverRef.current.observe(containerRef.current)

    // Track visible range for RSI sync
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      setVisibleRange(range)
    })

    return () => {
      resizeObserverRef.current?.disconnect()
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
      hullSeriesRef.current = null
      guppyShortSeriesRef.current = []
      guppyLongSeriesRef.current = []
      btcCostSeriesRef.current = []
    }
  }, [])

  // Update chart data
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || data.length === 0) return

    const candleData: CandlestickData<Time>[] = data.map((d) => ({
      time: d.time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }))

    const volumeData: HistogramData<Time>[] = data.map((d) => ({
      time: d.time,
      value: d.volume,
      color: d.close >= d.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)',
    }))

    candleSeriesRef.current.setData(candleData)
    volumeSeriesRef.current.setData(volumeData)
  }, [data])

  // Set visible range on initial load or when ticker/timeframe changes
  const initialLoadRef = useRef(true)
  useEffect(() => {
    if (data.length > 0 && initialLoadRef.current && chartRef.current) {
      // Show last ~100 candles for a nice default view
      const visibleBars = Math.min(100, data.length)
      const from = data.length - visibleBars
      const to = data.length
      chartRef.current.timeScale().setVisibleLogicalRange({ from, to })
      initialLoadRef.current = false
    }
  }, [data])

  // Reset initial load flag when ticker/timeframe changes
  useEffect(() => {
    initialLoadRef.current = true
  }, [config.ticker, config.timeframe])

  // Detect scroll to left edge and load more history
  useEffect(() => {
    if (!chartRef.current || !hasMoreHistory) return

    const handler: LogicalRangeChangeEventHandler = (logicalRange) => {
      if (!logicalRange || loadingMore) return

      if (logicalRange.from < 10 && hasMoreHistory) {
        loadMoreHistory()
      }
    }

    chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(handler)

    return () => {
      chartRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(handler)
    }
  }, [loadMoreHistory, loadingMore, hasMoreHistory])

  // Hull Suite effect
  useEffect(() => {
    if (!chartRef.current || data.length === 0) return

    if (hullSeriesRef.current) {
      chartRef.current.removeSeries(hullSeriesRef.current)
      hullSeriesRef.current = null
    }

    if (!config.showHullSuite) return

    const hullData: HullSuiteData[] = calculateHullSuite(data, 55)

    if (hullData.length === 0) return

    const hullSeries = chartRef.current.addLineSeries({
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
    })

    hullSeriesRef.current = hullSeries

    const lineData: LineData<Time>[] = hullData.map((d) => ({
      time: d.time,
      value: d.hullValue,
      color: d.trend === 'up' ? '#22c55e' : '#ef4444',
    }))

    hullSeries.setData(lineData)

  }, [data, config.showHullSuite])

  // Guppy effect
  useEffect(() => {
    if (!chartRef.current || data.length === 0) return

    // Remove existing Guppy series
    for (const series of guppyShortSeriesRef.current) {
      chartRef.current.removeSeries(series)
    }
    for (const series of guppyLongSeriesRef.current) {
      chartRef.current.removeSeries(series)
    }
    guppyShortSeriesRef.current = []
    guppyLongSeriesRef.current = []

    if (!config.showGuppy) return

    const guppyData: GuppyData[] = calculateGuppy(data)

    if (guppyData.length === 0) return

    // Short-term EMAs (green/cyan shades)
    const shortColors = ['#22d3ee', '#22d3ee', '#22d3ee', '#22d3ee', '#22d3ee', '#22d3ee']
    for (let i = 0; i < 6; i++) {
      const series = chartRef.current.addLineSeries({
        color: shortColors[i],
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      })
      guppyShortSeriesRef.current.push(series)

      const lineData: LineData<Time>[] = guppyData.map((d) => ({
        time: d.time,
        value: d.short[i],
      }))
      series.setData(lineData)
    }

    // Long-term EMAs (red/magenta shades)
    const longColors = ['#f472b6', '#f472b6', '#f472b6', '#f472b6', '#f472b6', '#f472b6']
    for (let i = 0; i < 6; i++) {
      const series = chartRef.current.addLineSeries({
        color: longColors[i],
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      })
      guppyLongSeriesRef.current.push(series)

      const lineData: LineData<Time>[] = guppyData.map((d) => ({
        time: d.time,
        value: d.long[i],
      }))
      series.setData(lineData)
    }

  }, [data, config.showGuppy])

  // Key Levels effect
  useEffect(() => {
    if (!candleSeriesRef.current) return

    const series = candleSeriesRef.current

    // Remove existing price lines
    for (const line of keyLevelLinesRef.current) {
      series.removePriceLine(line)
    }
    keyLevelLinesRef.current = []

    if (!config.showKeyLevels || data.length === 0) return

    const keyLevelsData = calculateKeyLevels(data)
    const levels = keyLevelsToArray(keyLevelsData)

    // Color scheme for different timeframes (more transparent)
    const getColor = (level: KeyLevel): string => {
      if (level.type === 'daily') return 'rgba(59, 130, 246, 0.5)' // blue 50% opacity
      if (level.type === 'weekly') return 'rgba(245, 158, 11, 0.5)' // orange 50% opacity
      if (level.type === 'monthly') return 'rgba(168, 85, 247, 0.5)' // purple 50% opacity
      if (level.type === 'yearly') return 'rgba(239, 68, 68, 0.5)' // red 50% opacity
      return 'rgba(168, 85, 247, 0.5)'
    }

    for (const level of levels) {
      const options: CreatePriceLineOptions = {
        price: level.price,
        color: getColor(level),
        lineWidth: 1,
        lineStyle: 2, // dashed
        axisLabelVisible: true,
        title: level.label,
      }
      const line = series.createPriceLine(options)
      keyLevelLinesRef.current.push(line)
    }
  }, [data, config.showKeyLevels])

  // BTC Production Cost effect (only for BTC)
  useEffect(() => {
    if (!chartRef.current || data.length === 0) return

    // Remove existing BTC cost series
    for (const series of btcCostSeriesRef.current) {
      chartRef.current.removeSeries(series)
    }
    btcCostSeriesRef.current = []

    // Only show for BTC
    const isBTC = config.ticker.toUpperCase().includes('BTC')
    if (!config.showBTCCost || !isBTC) return

    // Fetch and display BTC production cost
    const loadBTCCost = async () => {
      try {
        const costData = await fetchBTCProductionCost()
        if (!chartRef.current || costData.length === 0) return

        // Interpolate to match candle times
        const candleTimes = data.map(d => d.time)
        const interpolatedData = interpolateProductionCost(costData, candleTimes)

        // Create Production Cost area series (outer band)
        const productionSeries = chartRef.current.addAreaSeries({
          lineColor: 'rgba(239, 68, 68, 0.8)',
          topColor: 'rgba(239, 68, 68, 0.3)',
          bottomColor: 'rgba(239, 68, 68, 0.05)',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: false,
          title: 'Production Cost',
        })
        btcCostSeriesRef.current.push(productionSeries)

        const productionData: AreaData<Time>[] = interpolatedData.map(d => ({
          time: d.time,
          value: d.productionCost,
        }))
        productionSeries.setData(productionData)

        // Create Electrical Cost area series (inner line)
        const electricalSeries = chartRef.current.addAreaSeries({
          lineColor: 'rgba(239, 68, 68, 1)',
          topColor: 'rgba(239, 68, 68, 0)',
          bottomColor: 'rgba(239, 68, 68, 0)',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: false,
          title: 'Electrical Cost',
        })
        btcCostSeriesRef.current.push(electricalSeries)

        const electricalData: AreaData<Time>[] = interpolatedData.map(d => ({
          time: d.time,
          value: d.electricalCost,
        }))
        electricalSeries.setData(electricalData)
      } catch (error) {
        console.error('Failed to load BTC production cost:', error)
      }
    }

    loadBTCCost()
  }, [data, config.showBTCCost, config.ticker])

  const updateVRVP = useCallback(() => {
    if (!config.showVRVP || !chartRef.current || data.length === 0) {
      setVrvpData(null)
      return
    }

    const timeScale = chartRef.current.timeScale()
    const logicalRange = timeScale.getVisibleLogicalRange()

    if (!logicalRange) {
      setVrvpData(null)
      return
    }

    const startIndex = Math.max(0, Math.floor(logicalRange.from))
    const endIndex = Math.min(data.length - 1, Math.ceil(logicalRange.to))
    const visibleData = data.slice(startIndex, endIndex + 1)

    if (visibleData.length < 2) {
      setVrvpData(null)
      return
    }

    // Check if we have any volume data at all
    const totalVolume = visibleData.reduce((sum, d) => sum + d.volume, 0)
    if (totalVolume === 0) {
      // No volume data available - VRVP cannot be calculated
      setVrvpData(null)
      return
    }

    const vrvp = calculateVRVP(visibleData)
    setVrvpData(vrvp)
  }, [config.showVRVP, data])

  useEffect(() => {
    if (!chartRef.current) return

    const handler: LogicalRangeChangeEventHandler = () => {
      updateVRVP()
    }

    chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(handler)

    return () => {
      chartRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(handler)
    }
  }, [updateVRVP])

  useEffect(() => {
    updateVRVP()
  }, [config.showVRVP, data, updateVRVP])

  const getPriceRange = useCallback(() => {
    if (!candleSeriesRef.current || !chartRef.current) return null

    const timeScale = chartRef.current.timeScale()
    const logicalRange = timeScale.getVisibleLogicalRange()

    if (!logicalRange || data.length === 0) return null

    const startIndex = Math.max(0, Math.floor(logicalRange.from))
    const endIndex = Math.min(data.length - 1, Math.ceil(logicalRange.to))
    const visibleData = data.slice(startIndex, endIndex + 1)

    if (visibleData.length === 0) return null

    const high = Math.max(...visibleData.map((d) => d.high))
    const low = Math.min(...visibleData.map((d) => d.low))

    return { high, low }
  }, [data])

  const priceToCoordinate = useCallback((price: number) => {
    if (!candleSeriesRef.current) return null
    return candleSeriesRef.current.priceToCoordinate(price)
  }, [])

  const handleResetView = useCallback(() => {
    if (!chartRef.current || data.length === 0) return
    // Show last ~100 candles instead of fitting all content
    const visibleBars = Math.min(100, data.length)
    const from = data.length - visibleBars
    const to = data.length
    chartRef.current.timeScale().setVisibleLogicalRange({ from, to })
  }, [data])

  const handleSelectFavorite = useCallback((ticker: string, dataSource: DataSource) => {
    onConfigChange({ ticker, dataSource })
  }, [onConfigChange])


  return (
    <div className={styles.wrapper}>
      <FavoritesBar
        currentTicker={config.ticker}
        currentDataSource={config.dataSource}
        onSelectTicker={handleSelectFavorite}
      />
      <ChartToolbar
        config={config}
        onConfigChange={onConfigChange}
        onResetView={handleResetView}
      />
      <div className={styles.chartArea}>
        <div ref={containerRef} className={styles.container}>
          {loading && <div className={styles.loading}>Loading...</div>}
          {loadingMore && <div className={styles.loadingMore}>Loading more...</div>}
          {error && <div className={styles.error}>{error}</div>}
          {config.showKeyLevels && <KeyLevelsTimer />}
        </div>
        {config.showVRVP && vrvpData && (
          <VRVPOverlay
            data={vrvpData}
            width={chartDimensions.width}
            height={chartDimensions.height}
            priceRange={getPriceRange()}
            priceToCoordinate={priceToCoordinate}
          />
        )}
      </div>
      {config.showRSI && data.length > 0 && (
        <RSIChart
          data={data}
          width={chartDimensions.width}
          visibleRange={visibleRange}
        />
      )}
    </div>
  )
}
