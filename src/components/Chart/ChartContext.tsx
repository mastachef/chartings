import { createContext, useContext, useRef, ReactNode, MutableRefObject } from 'react'
import type { IChartApi, ISeriesApi } from 'lightweight-charts'

interface ChartContextValue {
  chartRef: MutableRefObject<IChartApi | null>
  candleSeriesRef: MutableRefObject<ISeriesApi<'Candlestick'> | null>
  volumeSeriesRef: MutableRefObject<ISeriesApi<'Histogram'> | null>
}

const ChartContext = createContext<ChartContextValue | null>(null)

export function ChartProvider({ children }: { children: ReactNode }) {
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)

  return (
    <ChartContext.Provider value={{ chartRef, candleSeriesRef, volumeSeriesRef }}>
      {children}
    </ChartContext.Provider>
  )
}

export function useChartContext() {
  const context = useContext(ChartContext)
  if (!context) {
    throw new Error('useChartContext must be used within a ChartProvider')
  }
  return context
}
