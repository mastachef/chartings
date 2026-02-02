import { useRef, useLayoutEffect, useEffect } from 'react'
import { createChart, IChartApi, ISeriesApi, LineData, Time, LogicalRange } from 'lightweight-charts'
import { calculateRSI, type RSIPoint } from '../Indicators/RSICalculator'
import type { CandleData } from '@/types/chart'
import styles from './RSIChart.module.css'

interface RSIChartProps {
  data: CandleData[]
  width: number
  onVisibleRangeChange?: (range: LogicalRange | null) => void
  visibleRange?: LogicalRange | null
}

export function RSIChart({ data, width, onVisibleRangeChange, visibleRange }: RSIChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const line70Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const line50Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const line30Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const isSettingRange = useRef(false)

  useLayoutEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      width: width,
      height: 120,
      layout: {
        background: { color: '#131722' },
        textColor: '#787b86',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: '#6366f1',
          width: 1,
          style: 2,
          labelVisible: false,
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
          bottom: 0.1,
        },
        minimumWidth: 80,
      },
      timeScale: {
        borderColor: '#27273a',
        visible: false,
        rightOffset: 5,
      },
    })

    chartRef.current = chart

    // 70 line (overbought threshold)
    const line70 = chart.addLineSeries({
      color: 'rgba(239, 68, 68, 0.5)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      autoscaleInfoProvider: () => ({
        priceRange: { minValue: 0, maxValue: 100 },
      }),
    })
    line70Ref.current = line70

    // 50 line (middle)
    const line50 = chart.addLineSeries({
      color: 'rgba(120, 123, 134, 0.5)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      autoscaleInfoProvider: () => ({
        priceRange: { minValue: 0, maxValue: 100 },
      }),
    })
    line50Ref.current = line50

    // 30 line (oversold threshold)
    const line30 = chart.addLineSeries({
      color: 'rgba(34, 197, 94, 0.5)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      autoscaleInfoProvider: () => ({
        priceRange: { minValue: 0, maxValue: 100 },
      }),
    })
    line30Ref.current = line30

    // RSI line
    const rsiSeries = chart.addLineSeries({
      color: '#a855f7',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      autoscaleInfoProvider: () => ({
        priceRange: { minValue: 0, maxValue: 100 },
      }),
    })
    rsiSeriesRef.current = rsiSeries

    // Subscribe to visible range changes
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!isSettingRange.current) {
        onVisibleRangeChange?.(range)
      }
    })

    return () => {
      chart.remove()
      chartRef.current = null
      rsiSeriesRef.current = null
      line70Ref.current = null
      line50Ref.current = null
      line30Ref.current = null
    }
  }, [width, onVisibleRangeChange])

  // Sync visible range from main chart
  useEffect(() => {
    if (chartRef.current && visibleRange) {
      isSettingRange.current = true
      chartRef.current.timeScale().setVisibleLogicalRange(visibleRange)
      // Reset flag after a small delay to allow the change to propagate
      setTimeout(() => {
        isSettingRange.current = false
      }, 0)
    }
  }, [visibleRange])

  // Update RSI data
  useEffect(() => {
    if (!rsiSeriesRef.current || !line70Ref.current || !line50Ref.current || !line30Ref.current || data.length === 0) return

    const rsiData: RSIPoint[] = calculateRSI(data, 14)

    if (rsiData.length === 0) return

    const lineData: LineData<Time>[] = rsiData.map((d) => ({
      time: d.time,
      value: d.value,
    }))

    rsiSeriesRef.current.setData(lineData)

    // Create reference lines spanning the full data range (use candle times, not RSI times)
    const fullTimeRange = data.map((d) => d.time)

    const line70Data: LineData<Time>[] = fullTimeRange.map((time) => ({
      time,
      value: 70,
    }))
    line70Ref.current.setData(line70Data)

    const line50Data: LineData<Time>[] = fullTimeRange.map((time) => ({
      time,
      value: 50,
    }))
    line50Ref.current.setData(line50Data)

    const line30Data: LineData<Time>[] = fullTimeRange.map((time) => ({
      time,
      value: 30,
    }))
    line30Ref.current.setData(line30Data)

    // After setting data, sync the visible range
    if (chartRef.current && visibleRange) {
      chartRef.current.timeScale().setVisibleLogicalRange(visibleRange)
    }
  }, [data, visibleRange])

  // Resize chart when width changes
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions({ width })
    }
  }, [width])

  return (
    <div className={styles.container}>
      <div ref={containerRef} className={styles.chart} />
    </div>
  )
}
