import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChartConfig, Timeframe, DataSource } from '@/types/chart'

interface ChartState {
  charts: Record<string, ChartConfig>
  activeChartId: string | null

  addChart: (id: string, config?: Partial<ChartConfig>) => void
  removeChart: (id: string) => void
  updateChart: (id: string, updates: Partial<ChartConfig>) => void
  setActiveChart: (id: string | null) => void
  setTicker: (id: string, ticker: string) => void
  setTimeframe: (id: string, timeframe: Timeframe) => void
  setDataSource: (id: string, dataSource: DataSource) => void
  toggleVRVP: (id: string) => void
}

const defaultChartConfig = (id: string): ChartConfig => ({
  id,
  ticker: 'BTCUSD',
  timeframe: '1h',
  dataSource: 'binance',
  showVRVP: false,
  showHullSuite: false,
  showRSI: false,
  showGuppy: false,
  showKeyLevels: false,
  showBTCCost: false,
})

export const useChartStore = create<ChartState>()(
  persist(
    (set) => ({
      charts: {},
      activeChartId: null,

      addChart: (id, config) =>
        set((state) => ({
          charts: {
            ...state.charts,
            [id]: { ...defaultChartConfig(id), ...config },
          },
        })),

      removeChart: (id) =>
        set((state) => {
          const { [id]: _, ...rest } = state.charts
          return {
            charts: rest,
            activeChartId: state.activeChartId === id ? null : state.activeChartId,
          }
        }),

      updateChart: (id, updates) =>
        set((state) => ({
          charts: {
            ...state.charts,
            [id]: state.charts[id] ? { ...state.charts[id], ...updates } : state.charts[id],
          },
        })),

      setActiveChart: (id) => set({ activeChartId: id }),

      setTicker: (id, ticker) =>
        set((state) => ({
          charts: {
            ...state.charts,
            [id]: state.charts[id] ? { ...state.charts[id], ticker } : state.charts[id],
          },
        })),

      setTimeframe: (id, timeframe) =>
        set((state) => ({
          charts: {
            ...state.charts,
            [id]: state.charts[id] ? { ...state.charts[id], timeframe } : state.charts[id],
          },
        })),

      setDataSource: (id, dataSource) =>
        set((state) => ({
          charts: {
            ...state.charts,
            [id]: state.charts[id] ? { ...state.charts[id], dataSource } : state.charts[id],
          },
        })),

      toggleVRVP: (id) =>
        set((state) => ({
          charts: {
            ...state.charts,
            [id]: state.charts[id]
              ? { ...state.charts[id], showVRVP: !state.charts[id].showVRVP }
              : state.charts[id],
          },
        })),
    }),
    {
      name: 'chart-storage',
    }
  )
)
