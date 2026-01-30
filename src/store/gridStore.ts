import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GridLayout, LayoutPreset } from '@/types/chart'

interface GridState {
  layouts: GridLayout[]
  currentPreset: LayoutPreset
  cols: number

  setLayouts: (layouts: GridLayout[]) => void
  setPreset: (preset: LayoutPreset) => void
  setCols: (cols: number) => void
}

export const layoutPresets: Record<LayoutPreset, GridLayout[]> = {
  '1x1': [
    { i: 'chart-0', x: 0, y: 0, w: 12, h: 12, minW: 4, minH: 4 },
  ],
  '2x2': [
    { i: 'chart-0', x: 0, y: 0, w: 6, h: 6, minW: 3, minH: 3 },
    { i: 'chart-1', x: 6, y: 0, w: 6, h: 6, minW: 3, minH: 3 },
    { i: 'chart-2', x: 0, y: 6, w: 6, h: 6, minW: 3, minH: 3 },
    { i: 'chart-3', x: 6, y: 6, w: 6, h: 6, minW: 3, minH: 3 },
  ],
  '1x2': [
    { i: 'chart-0', x: 0, y: 0, w: 12, h: 6, minW: 4, minH: 3 },
    { i: 'chart-1', x: 0, y: 6, w: 12, h: 6, minW: 4, minH: 3 },
  ],
  '2x1': [
    { i: 'chart-0', x: 0, y: 0, w: 6, h: 12, minW: 3, minH: 4 },
    { i: 'chart-1', x: 6, y: 0, w: 6, h: 12, minW: 3, minH: 4 },
  ],
  '3x2': [
    { i: 'chart-0', x: 0, y: 0, w: 4, h: 6, minW: 3, minH: 3 },
    { i: 'chart-1', x: 4, y: 0, w: 4, h: 6, minW: 3, minH: 3 },
    { i: 'chart-2', x: 8, y: 0, w: 4, h: 6, minW: 3, minH: 3 },
    { i: 'chart-3', x: 0, y: 6, w: 4, h: 6, minW: 3, minH: 3 },
    { i: 'chart-4', x: 4, y: 6, w: 4, h: 6, minW: 3, minH: 3 },
    { i: 'chart-5', x: 8, y: 6, w: 4, h: 6, minW: 3, minH: 3 },
  ],
}

export const useGridStore = create<GridState>()(
  persist(
    (set) => ({
      layouts: layoutPresets['1x1'],
      currentPreset: '1x1',
      cols: 12,

      setLayouts: (layouts) => set({ layouts }),

      setPreset: (preset) =>
        set({
          currentPreset: preset,
          layouts: layoutPresets[preset],
        }),

      setCols: (cols) => set({ cols }),
    }),
    {
      name: 'grid-storage',
    }
  )
)
