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
  const line75Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const line50Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const line25Ref = useRef<ISeriesApi<'Line'> | null>(null)

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
        mode: 1,
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
          top: 0.05,
          bottom: 0.05,
        },
      },
      timeScale: {
        borderColor: '#27273a',
        visible: false,
      },
    })

    chartRef.current = chart

    // 75 line (overbought region)
    const line75 = chart.addLineSeries({
      color: 'rgba(120, 123, 134, 0.5)',
      lineWidth: 1,
      lineStyle: 2, // dashed
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    line75Ref.current = line75

    // 50 line (middle)
    const line50 = chart.addLineSeries({
      color: 'rgba(120, 123, 134, 0.5)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    line50Ref.current = line50

    // 25 line (oversold region)
    const line25 = chart.addLineSeries({
      color: 'rgba(120, 123, 134, 0.5)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    line25Ref.current = line25

    // RSI line
    const rsiSeries = chart.addLineSeries({
      color: '#a855f7',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
    })
    rsiSeriesRef.current = rsiSeries

    // Subscribe to visible range changes
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      onVisibleRangeChange?.(range)
    })

    return () => {
      chart.remove()
      chartRef.current = null
      rsiSeriesRef.current = null
      line75Ref.current = null
      line50Ref.current = null
      line25Ref.current = null
    }
  }, [width, onVisibleRangeChange])

  // Sync visible range from main chart
  useEffect(() => {
    if (chartRef.current && visibleRange) {
      chartRef.current.timeScale().setVisibleLogicalRange(visibleRange)
    }
  }, [visibleRange])

  // Update RSI data
  useEffect(() => {
    if (!rsiSeriesRef.current || !line75Ref.current || !line50Ref.current || !line25Ref.current || data.length === 0) return

    const rsiData: RSIPoint[] = calculateRSI(data, 14)

    if (rsiData.length === 0) return

    const lineData: LineData<Time>[] = rsiData.map((d) => ({
      time: d.time,
      value: d.value,
    }))

    rsiSeriesRef.current.setData(lineData)

    // Set horizontal reference lines
    const line75Data: LineData<Time>[] = rsiData.map((d) => ({
      time: d.time,
      value: 75,
    }))
    line75Ref.current.setData(line75Data)

    const line50Data: LineData<Time>[] = rsiData.map((d) => ({
      time: d.time,
      value: 50,
    }))
    line50Ref.current.setData(line50Data)

    const line25Data: LineData<Time>[] = rsiData.map((d) => ({
      time: d.time,
      value: 25,
    }))
    line25Ref.current.setData(line25Data)
  }, [data])

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
